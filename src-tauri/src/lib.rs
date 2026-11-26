mod config;
mod logos;
mod storage;

use config::{
    build_config_response, load_persisted_config, resolve_active_data_dir, save_persisted_config,
    AppConfigResponse,
};
use logos::CustomLogoResult;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use storage::{BackupResult, LoadJournalResult, SaveJournalResult};

#[tauri::command]
fn get_app_config() -> Result<AppConfigResponse, String> {
    let cfg = load_persisted_config()?;
    build_config_response(&cfg)
}

#[tauri::command]
fn set_custom_data_dir(path: Option<String>) -> Result<AppConfigResponse, String> {
    let mut cfg = load_persisted_config()?;
    let normalized = path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);

    if let Some(ref custom) = normalized {
        std::fs::create_dir_all(custom)
            .map_err(|e| format!("无法访问或创建所选目录 ({}): {}", custom, e))?;
    }

    cfg.custom_data_dir = normalized;
    save_persisted_config(&cfg)?;
    build_config_response(&cfg)
}

#[tauri::command]
fn save_preferences(
    appearance_mode: String,
    language: String,
) -> Result<AppConfigResponse, String> {
    let mut cfg = load_persisted_config()?;
    cfg.appearance_mode = appearance_mode;
    cfg.language = language;
    save_persisted_config(&cfg)?;
    build_config_response(&cfg)
}

#[tauri::command]
fn load_journal() -> Result<LoadJournalResult, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    storage::load_journal(&active_dir)
}

#[tauri::command]
fn save_journal(data: Value, create_backup: bool) -> Result<SaveJournalResult, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    storage::save_journal(&active_dir, data, create_backup)
}

#[tauri::command]
fn backup_now() -> Result<BackupResult, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    storage::create_verified_backup(&active_dir, None, 30)
}

#[tauri::command]
fn import_journal(source_path: String) -> Result<LoadJournalResult, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    let source = PathBuf::from(source_path);
    storage::import_journal(&active_dir, &source)
}

#[tauri::command]
fn export_journal(target_path: String) -> Result<String, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    let target = PathBuf::from(target_path);
    storage::export_journal(&active_dir, &target)
}

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    storage::open_folder(&active_dir)
}

#[tauri::command]
fn load_brand_logos() -> Result<HashMap<String, String>, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    logos::load_brand_logos(&active_dir)
}

#[tauri::command]
fn set_custom_brand_logo(brand: String, source_path: String) -> Result<CustomLogoResult, String> {
    let cfg = load_persisted_config()?;
    let active_dir = resolve_active_data_dir(&cfg)?;
    let source = PathBuf::from(source_path);
    logos::set_custom_brand_logo(&active_dir, &brand, &source)
}

#[tauri::command]
fn export_csv(target_path: String, content: String) -> Result<String, String> {
    let target = PathBuf::from(target_path);
    storage::export_text_file(&target, &content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            set_custom_data_dir,
            save_preferences,
            load_journal,
            save_journal,
            backup_now,
            import_journal,
            export_journal,
            open_data_folder,
            load_brand_logos,
            set_custom_brand_logo,
            export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
