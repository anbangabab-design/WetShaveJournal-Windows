use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::storage::atomic_write_bytes;

const APP_FOLDER_NAME: &str = "WetShaveJournal";
const CONFIG_FILE_NAME: &str = "app_config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAppConfig {
    #[serde(default)]
    pub custom_data_dir: Option<String>,
    #[serde(default = "default_appearance_mode")]
    pub appearance_mode: String,
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_appearance_mode() -> String {
    "system".to_string()
}

fn default_language() -> String {
    "system".to_string()
}

impl Default for PersistedAppConfig {
    fn default() -> Self {
        Self {
            custom_data_dir: None,
            appearance_mode: default_appearance_mode(),
            language: default_language(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigResponse {
    pub default_data_dir: String,
    pub custom_data_dir: Option<String>,
    pub active_data_dir: String,
    pub journal_file_path: String,
    pub backups_dir_path: String,
    pub appearance_mode: String,
    pub language: String,
}

/// 默认数据目录：Windows 为 %APPDATA%\WetShaveJournal，macOS 为 ~/Library/Application Support/WetShaveJournal
pub fn default_data_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "无法解析系统应用数据目录 (%APPDATA%)".to_string())?;
    Ok(base.join(APP_FOLDER_NAME))
}

fn config_file_path() -> Result<PathBuf, String> {
    Ok(default_data_dir()?.join(CONFIG_FILE_NAME))
}

pub fn load_persisted_config() -> Result<PersistedAppConfig, String> {
    let path = config_file_path()?;
    if !path.exists() {
        return Ok(PersistedAppConfig::default());
    }
    let bytes = fs::read(&path).map_err(|e| format!("读取应用配置失败: {}", e))?;
    match serde_json::from_slice::<PersistedAppConfig>(&bytes) {
        Ok(cfg) => Ok(cfg),
        Err(_) => Ok(PersistedAppConfig::default()),
    }
}

pub fn save_persisted_config(cfg: &PersistedAppConfig) -> Result<(), String> {
    let path = config_file_path()?;
    let bytes =
        serde_json::to_vec_pretty(cfg).map_err(|e| format!("序列化应用配置失败: {}", e))?;
    atomic_write_bytes(&path, &bytes)
}

pub fn resolve_active_data_dir(cfg: &PersistedAppConfig) -> Result<PathBuf, String> {
    if let Some(custom) = &cfg.custom_data_dir {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    default_data_dir()
}

pub fn build_config_response(cfg: &PersistedAppConfig) -> Result<AppConfigResponse, String> {
    let default_dir = default_data_dir()?;
    let active_dir = resolve_active_data_dir(cfg)?;
    let journal_path = active_dir.join("journal.json");
    let backups_dir = active_dir.join("Backups");

    Ok(AppConfigResponse {
        default_data_dir: default_dir.to_string_lossy().to_string(),
        custom_data_dir: cfg
            .custom_data_dir
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToString::to_string),
        active_data_dir: active_dir.to_string_lossy().to_string(),
        journal_file_path: journal_path.to_string_lossy().to_string(),
        backups_dir_path: backups_dir.to_string_lossy().to_string(),
        appearance_mode: cfg.appearance_mode.clone(),
        language: cfg.language.clone(),
    })
}
