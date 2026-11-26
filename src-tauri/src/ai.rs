use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::{Ipv4Addr, Ipv6Addr};
use std::time::{Duration, Instant};
use url::{Host, Url};

use crate::config::load_persisted_config;

const KEYRING_SERVICE: &str = "com.wetshavejournal.windows";
const KEYRING_USER: &str = "ai_api_key";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub system: String,
    pub user: String,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub enable_web_search: Option<bool>,
    #[serde(default)]
    pub enable_google_search: Option<bool>,
    #[serde(default)]
    pub api_key_override: Option<String>,
    #[serde(default)]
    pub use_web_search: bool,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub content: String,
    pub actual_model: String,
    pub web_search_evidence: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConnectionTestResponse {
    pub ok: bool,
    pub message: String,
    pub actual_model: Option<String>,
    pub latency_ms: u64,
}

// MARK: - Windows 凭据管理器安全存储（keyring v3）

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("无法初始化系统凭据管理器: {}", e))
}

pub fn get_stored_api_key() -> Result<String, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(pw) => Ok(pw),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("读取系统凭据管理器中的 API Key 失败: {}", e)),
    }
}

pub fn set_stored_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return clear_stored_api_key();
    }
    let entry = keyring_entry()?;
    entry
        .set_password(trimmed)
        .map_err(|e| format!("保存 API Key 到系统凭据管理器失败: {}", e))
}

pub fn clear_stored_api_key() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("从系统凭据管理器删除 API Key 失败: {}", e)),
    }
}

pub fn has_stored_api_key() -> bool {
    get_stored_api_key()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
}

fn redact_secret(secret: &str, text: &str) -> String {
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        return text.to_string();
    }
    text.replace(trimmed, "***")
}

// MARK: - 端点安全校验（仅本机允许明文 HTTP，远端强制 HTTPS）

fn is_local_host(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(ip)) => ip == Ipv4Addr::LOCALHOST,
        Some(Host::Ipv6(ip)) => ip == Ipv6Addr::LOCALHOST,
        None => false,
    }
}

pub fn validate_ai_base_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Base URL 不能为空".to_string());
    }
    let parsed = Url::parse(trimmed).map_err(|_| "Base URL 格式无效，请输入完整地址".to_string())?;
    if parsed.host().is_none() {
        return Err("Base URL 缺少有效主机名".to_string());
    }
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" => {
            if is_local_host(&parsed) {
                Ok(parsed)
            } else {
                Err("出于安全策略，远端 AI 接口必须使用 HTTPS（仅 localhost / 127.0.0.1 / [::1] 允许明文 HTTP）".to_string())
            }
        }
        _ => Err("Base URL 仅支持 https:// 或本机 http:// 协议".to_string()),
    }
}

fn chat_completions_endpoint(base_url: &str) -> Result<Url, String> {
    let validated = validate_ai_base_url(base_url)?;
    let mut s = validated.as_str().trim_end_matches('/').to_string();
    if !s.ends_with("/chat/completions") {
        s.push_str("/chat/completions");
    }
    validate_ai_base_url(&s)
}

// MARK: - OpenAI 兼容请求与联网工具降级重试

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WebSearchToolMode {
    None,
    DeepSeek,
    GoogleSearch,
}

fn extract_api_error_message(body_text: &str) -> Option<String> {
    let parsed: Value = serde_json::from_str(body_text).ok()?;
    if let Some(msg) = parsed
        .get("error")
        .and_then(|e| e.get("message"))
        .and_then(|m| m.as_str())
    {
        let trimmed = msg.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.chars().take(180).collect());
        }
    }
    if let Some(msg) = parsed.get("message").and_then(|m| m.as_str()) {
        let trimmed = msg.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.chars().take(180).collect());
        }
    }
    None
}

fn should_downgrade_web_search_tool(status_code: u16, body_text: &str) -> bool {
    if status_code != 400 && status_code != 422 {
        return false;
    }
    let msg = extract_api_error_message(body_text)
        .unwrap_or_else(|| body_text.to_string())
        .to_lowercase();
    if msg.contains("context_length")
        || msg.contains("maximum context")
        || msg.contains("insufficient_quota")
        || msg.contains("billing")
    {
        return false;
    }
    true
}

fn has_web_search_grounding_evidence(root: &Value) -> bool {
    if root
        .get("citations")
        .and_then(|v| v.as_array())
        .map(|arr| !arr.is_empty())
        .unwrap_or(false)
    {
        return true;
    }
    if root.get("groundingMetadata").is_some()
        || root.get("grounding_metadata").is_some()
        || root.get("search_results").is_some()
    {
        return true;
    }
    if let Some(first_choice) = root
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
    {
        if first_choice.get("groundingMetadata").is_some()
            || first_choice.get("grounding_metadata").is_some()
        {
            return true;
        }
        if let Some(msg) = first_choice.get("message") {
            if msg.get("groundingMetadata").is_some()
                || msg.get("grounding_metadata").is_some()
                || msg.get("citations").is_some()
            {
                return true;
            }
            if let Some(annotations) = msg.get("annotations").and_then(|a| a.as_array()) {
                for ann in annotations {
                    let typ = ann
                        .get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if typ.contains("citation") || typ.contains("search") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub async fn chat_completion(req: AiChatRequest) -> Result<AiChatResponse, String> {
    let cfg = load_persisted_config()?;

    let base_url = req
        .base_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(cfg.ai_base_url.as_str())
        .to_string();

    let model = req
        .model
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(cfg.ai_model.as_str())
        .to_string();

    let preset = req
        .preset
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(cfg.ai_preset.as_str())
        .to_string();

    let enable_web_search = req.enable_web_search.unwrap_or(cfg.ai_enable_web_search);
    let enable_google_search = req
        .enable_google_search
        .unwrap_or(cfg.ai_enable_google_search);

    let api_key = match req.api_key_override.as_deref().map(str::trim) {
        Some(override_key) if !override_key.is_empty() => override_key.to_string(),
        _ => get_stored_api_key()?,
    };

    if api_key.trim().is_empty() {
        return Err("未填写 API Key，请先在设置页配置并保存".to_string());
    }
    if model.is_empty() {
        return Err("未填写模型名称".to_string());
    }

    let endpoint = chat_completions_endpoint(&base_url)?;
    let timeout_secs = req.timeout_secs.unwrap_or(90).clamp(15, 300);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("初始化 HTTP 客户端失败: {}", e))?;

    let is_deepseek = preset.eq_ignore_ascii_case("deepseek")
        || base_url.to_lowercase().contains("deepseek.com");

    let initial_tool_mode = if !req.use_web_search {
        WebSearchToolMode::None
    } else if is_deepseek && enable_web_search {
        WebSearchToolMode::DeepSeek
    } else if !is_deepseek && enable_google_search {
        WebSearchToolMode::GoogleSearch
    } else {
        WebSearchToolMode::None
    };

    let temperature = req.temperature.unwrap_or(0.15);

    let send_once = |mode: WebSearchToolMode| {
        let client = client.clone();
        let endpoint = endpoint.clone();
        let api_key = api_key.clone();
        let model = model.clone();
        let system = req.system.clone();
        let user = req.user.clone();
        let max_tokens = req.max_tokens;
        let timeout_secs = timeout_secs;
        let temperature = temperature;
        async move {
            let mut body = json!({
                "model": model,
                "temperature": temperature,
                "messages": [
                    { "role": "system", "content": system },
                    { "role": "user", "content": user }
                ]
            });

            if let Some(obj) = body.as_object_mut() {
                if let Some(mt) = max_tokens {
                    obj.insert("max_tokens".to_string(), json!(mt));
                }
                match mode {
                    WebSearchToolMode::None => {}
                    WebSearchToolMode::DeepSeek => {
                        obj.insert(
                            "tools".to_string(),
                            json!([{ "type": "deepseek_web_search" }]),
                        );
                    }
                    WebSearchToolMode::GoogleSearch => {
                        obj.insert("tools".to_string(), json!([{ "google_search": {} }]));
                    }
                }
            }

            let resp = client
                .post(endpoint)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    let msg = if e.is_timeout() {
                        format!("AI 请求超时（{} 秒）", timeout_secs)
                    } else {
                        redact_secret(&api_key, &e.to_string())
                    };
                    msg
                })?;

            let status = resp.status().as_u16();
            let text = resp
                .text()
                .await
                .map_err(|e| redact_secret(&api_key, &e.to_string()))?;
            Ok::<(u16, String), String>((status, text))
        }
    };

    let (mut status, mut body_text) = send_once(initial_tool_mode).await?;
    let mut did_downgrade = false;

    if initial_tool_mode != WebSearchToolMode::None
        && should_downgrade_web_search_tool(status, &body_text)
    {
        did_downgrade = true;
        let (retry_status, retry_body) = send_once(WebSearchToolMode::None).await?;
        status = retry_status;
        body_text = retry_body;
    }

    if !(200..=299).contains(&status) {
        let raw_msg = extract_api_error_message(&body_text)
            .unwrap_or_else(|| format!("HTTP {}", status));
        return Err(redact_secret(&api_key, &raw_msg));
    }

    let root: Value = serde_json::from_str(&body_text)
        .map_err(|_| "AI 接口返回了无法解析的 JSON 响应".to_string())?;

    let content = root
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|first| first.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "AI 接口响应中缺少有效的 choices[0].message.content".to_string())?;

    let actual_model = root
        .get("model")
        .and_then(|m| m.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(model.as_str())
        .to_string();

    let evidence = if initial_tool_mode == WebSearchToolMode::None {
        "notRequested"
    } else if did_downgrade {
        "downgradedToPlain"
    } else if has_web_search_grounding_evidence(&root) {
        "verifiedWithSources"
    } else {
        "toolAcceptedUnverified"
    };

    Ok(AiChatResponse {
        content,
        actual_model,
        web_search_evidence: evidence.to_string(),
    })
}

pub async fn test_connection(
    base_url: String,
    model: String,
    preset: String,
    api_key_override: Option<String>,
) -> AiConnectionTestResponse {
    let start = Instant::now();
    let req = AiChatRequest {
        system: "You are a concise assistant.".to_string(),
        user: "Reply OK".to_string(),
        base_url: Some(base_url),
        model: Some(model),
        preset: Some(preset),
        enable_web_search: Some(false),
        enable_google_search: Some(false),
        api_key_override,
        use_web_search: false,
        timeout_secs: Some(30),
        max_tokens: Some(16),
        temperature: Some(0.0),
    };

    match chat_completion(req).await {
        Ok(res) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            AiConnectionTestResponse {
                ok: true,
                message: format!(
                    "连接成功（模型：{}，耗时 {} ms）",
                    res.actual_model, latency_ms
                ),
                actual_model: Some(res.actual_model),
                latency_ms,
            }
        }
        Err(err) => AiConnectionTestResponse {
            ok: false,
            message: err,
            actual_model: None,
            latency_ms: start.elapsed().as_millis() as u64,
        },
    }
}
