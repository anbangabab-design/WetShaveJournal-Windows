mod ai;
mod config;
mod logos;
mod storage;
mod updater;

use ai::{AiChatRequest, AiChatResponse, AiConnectionTestResponse};
use config::{
    build_config_response, load_persisted_config, resolve_active_data_dir, save_persisted_config,
    AppConfigResponse,
};
use logos::CustomLogoResult;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use storage::{BackupResult, LoadJournalResult, SaveJournalResult};
use updater::{UpdateCheckResult, UpdaterState};

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
fn save_ai_config(
    enabled: bool,
    preset: String,
    base_url: String,
    model: String,
    enable_web_search: bool,
    enable_google_search: bool,
) -> Result<AppConfigResponse, String> {
    let mut cfg = load_persisted_config()?;
    cfg.ai_enabled = enabled;
    cfg.ai_preset = preset;
    cfg.ai_base_url = base_url;
    cfg.ai_model = model;
    cfg.ai_enable_web_search = enable_web_search;
    cfg.ai_enable_google_search = enable_google_search;
    save_persisted_config(&cfg)?;
    build_config_response(&cfg)
}

#[tauri::command]
fn get_ai_api_key() -> Result<String, String> {
    ai::get_stored_api_key()
}

#[tauri::command]
fn set_ai_api_key(api_key: String) -> Result<AppConfigResponse, String> {
    ai::set_stored_api_key(&api_key)?;
    let cfg = load_persisted_config()?;
    build_config_response(&cfg)
}

#[tauri::command]
fn clear_ai_api_key() -> Result<AppConfigResponse, String> {
    ai::clear_stored_api_key()?;
    let cfg = load_persisted_config()?;
    build_config_response(&cfg)
}

#[tauri::command]
async fn ai_chat_completion(request: AiChatRequest) -> Result<AiChatResponse, String> {
    ai::chat_completion(request).await
}

#[tauri::command]
async fn ai_test_connection(
    base_url: String,
    model: String,
    preset: String,
    api_key_override: Option<String>,
) -> Result<AiConnectionTestResponse, String> {
    Ok(ai::test_connection(base_url, model, preset, api_key_override).await)
}

#[tauri::command]
fn save_update_preferences(
    auto_check_updates: bool,
    ignored_update_version: String,
) -> Result<AppConfigResponse, String> {
    let mut cfg = load_persisted_config()?;
    cfg.auto_check_updates = auto_check_updates;
    cfg.ignored_update_version = ignored_update_version;
    save_persisted_config(&cfg)?;
    build_config_response(&cfg)
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    updater::check_for_updates().await
}

#[tauri::command]
async fn download_and_open_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, UpdaterState>,
    download_url: String,
    file_name: String,
    expected_size: u64,
) -> Result<String, String> {
    let cancel_flag = state.cancel_flag.clone();
    updater::download_and_open_update(app, cancel_flag, download_url, file_name, expected_size)
        .await
}

#[tauri::command]
fn cancel_update_download(state: tauri::State<'_, UpdaterState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    updater::open_external_url(&url)
}

#[tauri::command]
fn reveal_file_in_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    updater::reveal_file_in_folder(&target)
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
        .manage(UpdaterState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            set_custom_data_dir,
            save_preferences,
            save_ai_config,
            get_ai_api_key,
            set_ai_api_key,
            clear_ai_api_key,
            ai_chat_completion,
            ai_test_connection,
            save_update_preferences,
            check_for_updates,
            download_and_open_update,
            cancel_update_download,
            open_external_url,
            reveal_file_in_folder,
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
