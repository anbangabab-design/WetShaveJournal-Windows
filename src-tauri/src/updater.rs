use futures_util::StreamExt;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use url::Url;

pub const GITHUB_REPO: &str = "anbangabab-design/WetShaveJournal-Windows";
pub const CURRENT_VERSION: &str = "1.3.5";

const ALLOWED_CDN_HOSTS: &[&str] = &[
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "github-releases.githubusercontent.com",
];

#[derive(Default)]
pub struct UpdaterState {
    pub cancel_flag: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAssetInfo {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    pub digest: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub version: String,
    pub title: String,
    pub body: String,
    pub html_url: String,
    pub matched_asset: Option<ReleaseAssetInfo>,
    pub is_from_web_fallback: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub has_update: bool,
    pub release: Option<ReleaseInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub progress: f64,
}

#[derive(Debug, Deserialize)]
struct ApiReleaseAsset {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    digest: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiReleasePayload {
    tag_name: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    html_url: Option<String>,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    assets: Vec<ApiReleaseAsset>,
}

// MARK: - 版本解析与比较

fn normalize_version(raw: &str) -> String {
    let trimmed = raw.trim();
    trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

fn is_prerelease_version(version: &str) -> bool {
    let lower = version.to_lowercase();
    lower.contains('-')
        || lower.contains("alpha")
        || lower.contains("beta")
        || lower.contains("rc")
        || lower.contains("preview")
}

fn numeric_version_parts(version: &str) -> Option<Vec<u64>> {
    let core = version.split(['-', '+']).next()?;
    let mut parts = Vec::new();
    for seg in core.split('.') {
        let n = seg.parse::<u64>().ok()?;
        parts.push(n);
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts)
    }
}

pub fn is_newer_version(candidate: &str, current: &str) -> bool {
    let norm_cand = normalize_version(candidate);
    let norm_curr = normalize_version(current);
    if norm_cand.is_empty() || norm_curr.is_empty() || is_prerelease_version(&norm_cand) {
        return false;
    }
    let (Some(a), Some(b)) = (
        numeric_version_parts(&norm_cand),
        numeric_version_parts(&norm_curr),
    ) else {
        return false;
    };
    let len = a.len().max(b.len());
    for i in 0..len {
        let va = a.get(i).copied().unwrap_or(0);
        let vb = b.get(i).copied().unwrap_or(0);
        if va != vb {
            return va > vb;
        }
    }
    false
}

// MARK: - URL 安全白名单与资产挑选（Windows 优先 .exe / .msi）

fn is_allowed_release_page_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if !host.eq_ignore_ascii_case("github.com") {
        return false;
    }
    let path = url.path().to_lowercase();
    !path.contains("..") && path.starts_with(&format!("/{}/releases/", GITHUB_REPO.to_lowercase()))
}

fn is_allowed_release_asset_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if !host.eq_ignore_ascii_case("github.com") {
        return false;
    }
    let path = url.path().to_lowercase();
    !path.contains("..")
        && path.starts_with(&format!(
            "/{}/releases/download/",
            GITHUB_REPO.to_lowercase()
        ))
}

fn is_allowed_download_redirect_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let lower_host = host.to_lowercase();
    if lower_host == "github.com" {
        return is_allowed_release_asset_url(url);
    }
    ALLOWED_CDN_HOSTS.contains(&lower_host.as_str())
}

fn is_allowed_windows_asset_name(name: &str) -> bool {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains("..")
    {
        return false;
    }
    let lower = trimmed.to_lowercase();
    lower.ends_with(".exe") || lower.ends_with(".msi")
}

fn select_preferred_windows_asset(assets: &[ReleaseAssetInfo]) -> Option<ReleaseAssetInfo> {
    let valid: Vec<&ReleaseAssetInfo> = assets
        .iter()
        .filter(|a| {
            is_allowed_windows_asset_name(&a.name)
                && Url::parse(&a.browser_download_url)
                    .map(|u| is_allowed_release_asset_url(&u))
                    .unwrap_or(false)
        })
        .collect();

    if valid.is_empty() {
        return None;
    }

    let is_arm64 = cfg!(target_arch = "aarch64");
    let arch_matches = |name: &str| -> bool {
        let lower = name.to_lowercase();
        if is_arm64 {
            lower.contains("arm64") || lower.contains("aarch64")
        } else {
            lower.contains("x64") || lower.contains("x86_64") || lower.contains("amd64")
        }
    };

    // 优先 NSIS .exe 安装包（匹配当前架构优先），其次 .msi
    if let Some(a) = valid
        .iter()
        .find(|a| a.name.to_lowercase().ends_with(".exe") && arch_matches(&a.name))
    {
        return Some((*a).clone());
    }
    if let Some(a) = valid
        .iter()
        .find(|a| a.name.to_lowercase().ends_with(".exe"))
    {
        return Some((*a).clone());
    }
    if let Some(a) = valid
        .iter()
        .find(|a| a.name.to_lowercase().ends_with(".msi") && arch_matches(&a.name))
    {
        return Some((*a).clone());
    }
    valid.first().map(|a| (*a).clone())
}

// MARK: - 网页降级 HTML 解析（HTTP 403/429 免限流通道）

fn decode_percent_basic(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex_str) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex_str, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| input.to_string())
}

fn decode_html_entities(raw: &str) -> String {
    let mut s = raw
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'");

    if let Ok(re) = Regex::new(r"&#(?:x([0-9a-fA-F]+)|(\d+));") {
        s = re
            .replace_all(&s, |caps: &regex::Captures| {
                let code = if let Some(hex) = caps.get(1) {
                    u32::from_str_radix(hex.as_str(), 16).ok()
                } else if let Some(dec) = caps.get(2) {
                    dec.as_str().parse::<u32>().ok()
                } else {
                    None
                };
                code.and_then(char::from_u32)
                    .map(|c| c.to_string())
                    .unwrap_or_else(|| caps[0].to_string())
            })
            .to_string();
    }
    s
}

fn extract_tag_from_release_url(url: &Url) -> Option<String> {
    if !is_allowed_release_page_url(url) {
        return None;
    }
    let path = url.path();
    let lower = path.to_lowercase();
    let marker = "/releases/tag/";
    let idx = lower.find(marker)?;
    let remainder = &path[idx + marker.len()..];
    let seg = remainder.split('/').next()?;
    let decoded = decode_percent_basic(seg).trim().to_string();
    if decoded.is_empty() {
        None
    } else {
        Some(decoded)
    }
}

fn extract_release_notes_from_html(html: &str) -> String {
    let Ok(start_re) = Regex::new(r#"(?i)<div\b[^>]*\bclass="[^"]*\bmarkdown-body\b[^"]*"[^>]*>"#)
    else {
        return String::new();
    };
    let Some(first) = start_re.find(html) else {
        return String::new();
    };
    let tail = &html[first.end()..];
    let Ok(div_re) = Regex::new(r"(?i)</?div\b[^>]*>") else {
        return String::new();
    };

    let mut depth: i32 = 1;
    let mut end_offset: Option<usize> = None;
    for m in div_re.find_iter(tail) {
        if m.as_str().to_lowercase().starts_with("</div") {
            depth -= 1;
            if depth == 0 {
                end_offset = Some(m.start());
                break;
            }
        } else {
            depth += 1;
        }
    }
    let Some(end_idx) = end_offset else {
        return String::new();
    };

    let mut text = tail[..end_idx].to_string();
    let rules: &[(&str, &str)] = &[
        (r"(?is)<svg\b[^>]*>.*?</svg>", ""),
        (r"(?is)<script\b[^>]*>.*?</script>", ""),
        (r"(?is)<style\b[^>]*>.*?</style>", ""),
        (r"(?is)<h2\b[^>]*>(.*?)</h2>", "\n\n## $1\n"),
        (r"(?is)<h3\b[^>]*>(.*?)</h3>", "\n### $1\n"),
        (r"(?is)<li\b[^>]*>", "\n• "),
        (r"(?is)</li>", ""),
        (r"(?is)<br\s*/?>", "\n"),
        (r"(?is)</p>", "\n\n"),
        (r"<[^>]+>", ""),
    ];
    for (pat, rep) in rules {
        if let Ok(re) = Regex::new(pat) {
            text = re.replace_all(&text, *rep).to_string();
        }
    }

    text = decode_html_entities(&text)
        .replace("\r\n", "\n")
        .replace('\r', "\n");

    let cleaned: Vec<&str> = text.lines().map(str::trim).collect();
    let joined = cleaned.join("\n");
    if let Ok(multi_nl) = Regex::new(r"\n{3,}") {
        multi_nl.replace_all(&joined, "\n\n").trim().to_string()
    } else {
        joined.trim().to_string()
    }
}

fn extract_assets_from_expanded_html(html: &str) -> Vec<ReleaseAssetInfo> {
    let escaped_repo = regex::escape(GITHUB_REPO);
    let pattern = format!(
        r#"(?i)href="?(/{}/releases/download/[^"'\s<>]+)"?"#,
        escaped_repo
    );
    let Ok(re) = Regex::new(&pattern) else {
        return Vec::new();
    };

    let mut seen = HashSet::new();
    let mut results = Vec::new();
    for caps in re.captures_iter(html) {
        let Some(rel_match) = caps.get(1) else {
            continue;
        };
        let rel = rel_match.as_str();
        let full_url = format!("https://github.com{}", rel);
        if !seen.insert(full_url.clone()) {
            continue;
        }
        let raw_name = rel.rsplit('/').next().unwrap_or("");
        let decoded_name = decode_percent_basic(raw_name).trim().to_string();
        if decoded_name.is_empty() {
            continue;
        }
        results.push(ReleaseAssetInfo {
            name: decoded_name,
            browser_download_url: full_url,
            size: 0,
            digest: None,
        });
    }
    results
}

// MARK: - 检查更新主流程（API 优先 + 403/429 网页免限流降级）

async fn fetch_latest_via_web_fallback(client: &reqwest::Client) -> Result<ReleaseInfo, String> {
    let latest_url = format!("https://github.com/{}/releases/latest", GITHUB_REPO);
    let resp = client
        .get(&latest_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header(
            "User-Agent",
            format!("WetShaveJournal-Windows/{}", CURRENT_VERSION),
        )
        .send()
        .await
        .map_err(|e| format!("网页更新通道连接失败: {}", e))?;

    let status = resp.status().as_u16();
    if status == 404 {
        return Err("尚未发布任何正式版本".to_string());
    }
    if !(200..=299).contains(&status) {
        return Err(format!("网页更新通道返回 HTTP {}", status));
    }

    let final_url = resp.url().clone();
    let raw_tag = extract_tag_from_release_url(&final_url)
        .ok_or_else(|| "尚未发布任何正式版本（未识别到版本标签）".to_string())?;
    let normalized_version = normalize_version(&raw_tag);
    if normalized_version.is_empty() {
        return Err("未能解析最新版本号".to_string());
    }

    let page_html = resp
        .text()
        .await
        .map_err(|e| format!("读取发布页内容失败: {}", e))?;
    let notes = extract_release_notes_from_html(&page_html);

    let expanded_url = format!(
        "https://github.com/{}/releases/expanded_assets/{}",
        GITHUB_REPO, raw_tag
    );
    let mut assets = Vec::new();
    if let Ok(assets_resp) = client
        .get(&expanded_url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header(
            "User-Agent",
            format!("WetShaveJournal-Windows/{}", CURRENT_VERSION),
        )
        .send()
        .await
    {
        if assets_resp.status().is_success() {
            if let Ok(assets_html) = assets_resp.text().await {
                assets = extract_assets_from_expanded_html(&assets_html);
            }
        }
    }

    let matched_asset = select_preferred_windows_asset(&assets);
    Ok(ReleaseInfo {
        tag_name: raw_tag.clone(),
        version: normalized_version,
        title: raw_tag,
        body: notes,
        html_url: final_url.to_string(),
        matched_asset,
        is_from_web_fallback: true,
    })
}

pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(12))
        .timeout(Duration::from_secs(18))
        .build()
        .map_err(|e| format!("初始化更新客户端失败: {}", e))?;

    let api_url = format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO);
    let api_res = client
        .get(&api_url)
        .header("Accept", "application/vnd.github+json")
        .header(
            "User-Agent",
            format!("WetShaveJournal-Windows/{}", CURRENT_VERSION),
        )
        .send()
        .await;

    let release: Option<ReleaseInfo> = match api_res {
        Ok(resp) => {
            let status = resp.status().as_u16();
            if status == 200 {
                let text = resp
                    .text()
                    .await
                    .map_err(|e| format!("读取 GitHub API 响应失败: {}", e))?;
                match serde_json::from_str::<ApiReleasePayload>(&text) {
                    Ok(payload) => {
                        let version = normalize_version(&payload.tag_name);
                        if payload.draft || payload.prerelease || is_prerelease_version(&version) {
                            None
                        } else {
                            let assets: Vec<ReleaseAssetInfo> = payload
                                .assets
                                .into_iter()
                                .map(|a| ReleaseAssetInfo {
                                    name: a.name,
                                    browser_download_url: a.browser_download_url,
                                    size: a.size,
                                    digest: a.digest,
                                })
                                .collect();
                            let matched_asset = select_preferred_windows_asset(&assets);
                            let html_url = payload
                                .html_url
                                .filter(|u| {
                                    Url::parse(u)
                                        .map(|parsed| is_allowed_release_page_url(&parsed))
                                        .unwrap_or(false)
                                })
                                .unwrap_or_else(|| {
                                    format!(
                                        "https://github.com/{}/releases/tag/{}",
                                        GITHUB_REPO, payload.tag_name
                                    )
                                });
                            Some(ReleaseInfo {
                                tag_name: payload.tag_name.clone(),
                                version,
                                title: payload
                                    .name
                                    .filter(|n| !n.trim().is_empty())
                                    .unwrap_or(payload.tag_name),
                                body: payload.body.unwrap_or_default(),
                                html_url,
                                matched_asset,
                                is_from_web_fallback: false,
                            })
                        }
                    }
                    Err(_) => Some(fetch_latest_via_web_fallback(&client).await?),
                }
            } else if status == 403 || status == 429 || status >= 500 {
                // GitHub API 频率受限或异常：自动降级走网页免限流通道
                let fallback = fetch_latest_via_web_fallback(&client).await?;
                if is_prerelease_version(&fallback.version) {
                    None
                } else {
                    Some(fallback)
                }
            } else if status == 404 {
                None
            } else {
                let fallback = fetch_latest_via_web_fallback(&client).await?;
                if is_prerelease_version(&fallback.version) {
                    None
                } else {
                    Some(fallback)
                }
            }
        }
        Err(_) => {
            // 网络层异常时尝试一次网页通道
            let fallback = fetch_latest_via_web_fallback(&client).await?;
            if is_prerelease_version(&fallback.version) {
                None
            } else {
                Some(fallback)
            }
        }
    };

    if let Some(rel) = release {
        let has_update = is_newer_version(&rel.version, CURRENT_VERSION);
        Ok(UpdateCheckResult {
            current_version: CURRENT_VERSION.to_string(),
            has_update,
            release: if has_update { Some(rel) } else { None },
        })
    } else {
        Ok(UpdateCheckResult {
            current_version: CURRENT_VERSION.to_string(),
            has_update: false,
            release: None,
        })
    }
}

// MARK: - 流式下载安装包到 Downloads 并自动打开

fn resolve_downloads_dir() -> Result<PathBuf, String> {
    if let Some(dl) = dirs::download_dir() {
        return Ok(dl);
    }
    if let Some(home) = dirs::home_dir() {
        return Ok(home.join("Downloads"));
    }
    Err("无法定位用户 Downloads 目录".to_string())
}

pub async fn download_and_open_update(
    app: AppHandle,
    cancel_flag: Arc<AtomicBool>,
    download_url: String,
    file_name: String,
    expected_size: u64,
) -> Result<String, String> {
    let parsed_url = Url::parse(download_url.trim())
        .map_err(|_| "无效的安装包下载地址".to_string())?;
    if !is_allowed_release_asset_url(&parsed_url) {
        return Err("已阻止下载：地址不在官方 GitHub Releases 白名单内".to_string());
    }
    if !is_allowed_windows_asset_name(&file_name) {
        return Err("已阻止下载：目标文件不是受支持的 Windows 安装包（.exe / .msi）".to_string());
    }

    cancel_flag.store(false, Ordering::SeqCst);

    let redirect_policy = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() > 10 {
            attempt.error("重定向次数过多")
        } else if is_allowed_download_redirect_url(attempt.url()) {
            attempt.follow()
        } else {
            attempt.error("重定向目标域名不在 GitHub 官方白名单内")
        }
    });

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .redirect(redirect_policy)
        .build()
        .map_err(|e| format!("初始化下载客户端失败: {}", e))?;

    let resp = client
        .get(parsed_url)
        .header(
            "User-Agent",
            format!("WetShaveJournal-Windows/{}", CURRENT_VERSION),
        )
        .send()
        .await
        .map_err(|e| format!("连接下载服务器失败: {}", e))?;

    let status = resp.status().as_u16();
    if !(200..=299).contains(&status) {
        return Err(format!("下载失败（HTTP {}）", status));
    }

    let total_bytes = resp.content_length().unwrap_or(expected_size);
    let downloads_dir = resolve_downloads_dir()?;
    fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("创建下载目录失败: {}", e))?;

    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("WetShaveJournal-Setup.exe");
    let final_path = downloads_dir.join(safe_name);
    let part_path = downloads_dir.join(format!("{}.part", safe_name));

    let mut file = File::create(&part_path)
        .map_err(|e| format!("创建下载临时文件失败: {}", e))?;

    let mut stream = resp.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    let _ = app.emit(
        "update-download-progress",
        DownloadProgressEvent {
            downloaded_bytes: 0,
            total_bytes,
            progress: 0.0,
        },
    );

    while let Some(chunk_res) = stream.next().await {
        if cancel_flag.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&part_path);
            return Err("CANCELLED".to_string());
        }

        let chunk = match chunk_res {
            Ok(c) => c,
            Err(e) => {
                drop(file);
                let _ = fs::remove_file(&part_path);
                return Err(format!("下载中断: {}", e));
            }
        };

        if let Err(e) = file.write_all(&chunk) {
            drop(file);
            let _ = fs::remove_file(&part_path);
            return Err(format!("写入下载文件失败: {}", e));
        }

        downloaded_bytes = downloaded_bytes.saturating_add(chunk.len() as u64);

        if last_emit.elapsed() >= Duration::from_millis(80) {
            last_emit = Instant::now();
            let progress = if total_bytes > 0 {
                (downloaded_bytes as f64 / total_bytes as f64).clamp(0.0, 1.0)
            } else {
                0.0
            };
            let _ = app.emit(
                "update-download-progress",
                DownloadProgressEvent {
                    downloaded_bytes,
                    total_bytes,
                    progress,
                },
            );
        }
    }

    if cancel_flag.load(Ordering::SeqCst) {
        drop(file);
        let _ = fs::remove_file(&part_path);
        return Err("CANCELLED".to_string());
    }

    if downloaded_bytes == 0 {
        drop(file);
        let _ = fs::remove_file(&part_path);
        return Err("下载的安装包为空文件".to_string());
    }

    file.flush()
        .and_then(|()| file.sync_all())
        .map_err(|e| {
            let _ = fs::remove_file(&part_path);
            format!("落盘安装包失败: {}", e)
        })?;
    drop(file);

    if final_path.exists() {
        let _ = fs::remove_file(&final_path);
    }
    fs::rename(&part_path, &final_path).map_err(|e| {
        let _ = fs::remove_file(&part_path);
        format!("重命名安装包失败: {}", e)
    })?;

    let _ = app.emit(
        "update-download-progress",
        DownloadProgressEvent {
            downloaded_bytes,
            total_bytes: total_bytes.max(downloaded_bytes),
            progress: 1.0,
        },
    );

    open_path_with_system(&final_path)?;
    Ok(final_path.to_string_lossy().to_string())
}

// MARK: - 系统打开 URL / 安装包 / 在文件夹中定位

pub fn open_external_url(raw_url: &str) -> Result<(), String> {
    let parsed = Url::parse(raw_url.trim()).map_err(|_| "无效的 URL".to_string())?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("仅允许打开 http/https 链接".to_string());
    }
    let target = parsed.as_str();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", target])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("打开外部链接失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("打开外部链接失败: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("打开外部链接失败: {}", e))?;
    }

    Ok(())
}

fn open_path_with_system(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let path_str = path.to_string_lossy().to_string();
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_str])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开安装包失败: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开安装包失败: {}", e))?;
    }

    Ok(())
}

pub fn reveal_file_in_folder(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .spawn()
            .map_err(|e| format!("定位文件失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("定位文件失败: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("打开所在目录失败: {}", e))?;
        }
    }

    Ok(())
}
