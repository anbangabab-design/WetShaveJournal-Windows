use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::storage::atomic_write_bytes;

const CUSTOM_LOGOS_DIR: &str = "CustomLogos";
const LOGO_CACHE_DIR: &str = "LogoCache";
const LEGACY_LOGOS_DIR: &str = "BrandLogos";
const MAX_LOGO_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLogoResult {
    pub key: String,
    pub data_url: String,
}

/// 与 Mac 版 BrandLogoCache.normalizedBrandKey(_:) 100% 一致的品牌文件名归一化
pub fn normalized_brand_key(brand: &str) -> String {
    brand
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

fn encode_base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((input.len() + 2) / 3) * 4);
    for chunk in input.chunks(3) {
        match chunk.len() {
            3 => {
                let n = ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32);
                out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
                out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
                out.push(TABLE[((n >> 6) & 0x3F) as usize] as char);
                out.push(TABLE[(n & 0x3F) as usize] as char);
            }
            2 => {
                let n = ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8);
                out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
                out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
                out.push(TABLE[((n >> 6) & 0x3F) as usize] as char);
                out.push('=');
            }
            1 => {
                let n = (chunk[0] as u32) << 16;
                out.push(TABLE[((n >> 18) & 0x3F) as usize] as char);
                out.push(TABLE[((n >> 12) & 0x3F) as usize] as char);
                out.push('=');
                out.push('=');
            }
            _ => {}
        }
    }
    out
}

fn detect_image_mime(bytes: &[u8], ext: Option<&str>) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.starts_with(&[0x00, 0x00, 0x01, 0x00]) {
        return Some("image/x-icon");
    }
    if bytes.starts_with(b"BM") {
        return Some("image/bmp");
    }
    if let Ok(head) = std::str::from_utf8(&bytes[..bytes.len().min(256)]) {
        let trimmed = head.trim_start();
        if trimmed.starts_with("<svg") || trimmed.starts_with("<?xml") {
            return Some("image/svg+xml");
        }
    }

    match ext.map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("png") => Some("image/png"),
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("webp") => Some("image/webp"),
        Some("gif") => Some("image/gif"),
        Some("ico") => Some("image/x-icon"),
        Some("bmp") => Some("image/bmp"),
        Some("svg") => Some("image/svg+xml"),
        _ => None,
    }
}

fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/x-icon" => "ico",
        "image/bmp" => "bmp",
        "image/svg+xml" => "svg",
        _ => "png",
    }
}

fn scan_logo_dir(dir: &Path, out: &mut HashMap<String, String>) {
    if !dir.is_dir() {
        return;
    }
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if file_name.starts_with('.') {
            continue;
        }
        let Ok(meta) = fs::metadata(&path) else {
            continue;
        };
        if meta.len() == 0 || meta.len() > MAX_LOGO_BYTES {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let key = stem.trim().to_lowercase();
        if key.is_empty() {
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str());
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let Some(mime) = detect_image_mime(&bytes, ext) else {
            continue;
        };
        let data_url = format!("data:{};base64,{}", mime, encode_base64(&bytes));
        out.insert(key, data_url);
    }
}

/// 扫描当前数据目录下的品牌图标缓存（优先级：CustomLogos > LogoCache > BrandLogos）
pub fn load_brand_logos(data_dir: &Path) -> Result<HashMap<String, String>, String> {
    let mut map = HashMap::new();
    scan_logo_dir(&data_dir.join(LEGACY_LOGOS_DIR), &mut map);
    scan_logo_dir(&data_dir.join(LOGO_CACHE_DIR), &mut map);
    scan_logo_dir(&data_dir.join(CUSTOM_LOGOS_DIR), &mut map);
    Ok(map)
}

/// 将用户选择的本地图片保存至当前数据目录的 CustomLogos/，并返回可直接渲染的 data URL
pub fn set_custom_brand_logo(
    data_dir: &Path,
    brand: &str,
    source_path: &Path,
) -> Result<CustomLogoResult, String> {
    let key = normalized_brand_key(brand);
    if key.is_empty() {
        return Err("品牌名称为空，无法设置自定义图标".to_string());
    }

    let meta = fs::metadata(source_path)
        .map_err(|e| format!("无法读取所选图片文件 ({}): {}", source_path.display(), e))?;
    if meta.len() == 0 {
        return Err("所选图片文件为空".to_string());
    }
    if meta.len() > MAX_LOGO_BYTES {
        return Err("所选图片体积超过 8 MB，请选择更小的图标文件".to_string());
    }

    let bytes = fs::read(source_path)
        .map_err(|e| format!("读取所选图片失败 ({}): {}", source_path.display(), e))?;
    let ext = source_path.extension().and_then(|e| e.to_str());
    let mime = detect_image_mime(&bytes, ext)
        .ok_or_else(|| "不支持的图片格式，请选择 PNG / JPG / WebP / ICO / SVG 图片".to_string())?;

    let custom_dir = data_dir.join(CUSTOM_LOGOS_DIR);
    fs::create_dir_all(&custom_dir)
        .map_err(|e| format!("创建 CustomLogos 目录失败: {}", e))?;

    // 清理同品牌旧扩展名文件，避免同 key 多文件冲突
    if let Ok(read_dir) = fs::read_dir(&custom_dir) {
        for entry in read_dir.flatten() {
            let existing_path = entry.path();
            if existing_path.is_file() {
                if let Some(stem) = existing_path.file_stem().and_then(|s| s.to_str()) {
                    if stem.to_lowercase() == key {
                        let _ = fs::remove_file(&existing_path);
                    }
                }
            }
        }
    }

    let target_ext = extension_for_mime(mime);
    let target_path = custom_dir.join(format!("{}.{}", key, target_ext));
    atomic_write_bytes(&target_path, &bytes)?;

    let data_url = format!("data:{};base64,{}", mime, encode_base64(&bytes));
    Ok(CustomLogoResult { key, data_url })
}
