use chrono::Local;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Apple Cocoa Reference Date 偏移（2001-01-01T00:00:00Z 相对于 1970-01-01T00:00:00Z）
/// 确保新建的 journal.json 中 `lastSync` 与 Mac 版 `Date().timeIntervalSinceReferenceDate` 100% 兼容
const APPLE_REFERENCE_EPOCH_OFFSET: f64 = 978_307_200.0;
const JOURNAL_FILE_NAME: &str = "journal.json";
const BACKUPS_DIR_NAME: &str = "Backups";
const DEFAULT_MAX_BACKUPS: usize = 30;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadJournalResult {
    pub data: Value,
    pub exists: bool,
    pub file_path: String,
    pub data_dir: String,
    pub backups_dir: String,
    pub backup_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveJournalResult {
    pub saved_at: String,
    pub backup_count: usize,
    pub last_backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub backup_path: String,
    pub backup_count: usize,
}

pub fn current_apple_reference_timestamp() -> f64 {
    let unix_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(APPLE_REFERENCE_EPOCH_OFFSET);
    unix_secs - APPLE_REFERENCE_EPOCH_OFFSET
}

pub fn default_journal_value() -> Value {
    json!({
        "schemaVersion": 2,
        "entries": [],
        "duplicates": 0,
        "skipped": 0,
        "lastSync": current_apple_reference_timestamp(),
        "overrides": {},
        "pending": [],
        "history": []
    })
}

/// 校验 journal.json 根节点与核心集合类型，同时放行所有未知扩展字段
pub fn validate_journal_root(value: &Value) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or_else(|| "journal.json 根节点必须是 JSON 对象".to_string())?;

    if let Some(entries) = obj.get("entries") {
        if !entries.is_array() {
            return Err("journal.json 中 entries 字段必须是数组".to_string());
        }
    }
    if let Some(overrides) = obj.get("overrides") {
        if !overrides.is_object() {
            return Err("journal.json 中 overrides 字段必须是对象".to_string());
        }
    }
    if let Some(pending) = obj.get("pending") {
        if !pending.is_array() {
            return Err("journal.json 中 pending 字段必须是数组".to_string());
        }
    }
    if let Some(history) = obj.get("history") {
        if !history.is_array() {
            return Err("journal.json 中 history 字段必须是数组".to_string());
        }
    }
    Ok(())
}

/// 同目录临时文件 + flush/sync_all + 关闭句柄 + 带短暂重试的原子替换（适配 Windows NTFS 与防病毒扫描锁）
pub fn atomic_write_bytes(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("目标路径无效: {}", target.display()))?;
    fs::create_dir_all(parent).map_err(|e| format!("创建目录失败 ({}): {}", parent.display(), e))?;

    let full_id = Uuid::new_v4().simple().to_string();
    let short_id = &full_id[..10];
    let file_stem = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");
    let tmp_path = parent.join(format!(".{}.{}.tmp", file_stem, short_id));

    let write_res = (|| -> Result<(), String> {
        let mut file = File::create(&tmp_path)
            .map_err(|e| format!("创建临时文件失败 ({}): {}", tmp_path.display(), e))?;
        file.write_all(bytes)
            .map_err(|e| format!("写入临时文件失败: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("刷新临时文件到磁盘失败: {}", e))?;
        drop(file);
        Ok(())
    })();

    if let Err(err) = write_res {
        let _ = fs::remove_file(&tmp_path);
        return Err(err);
    }

    let mut last_err: Option<std::io::Error> = None;
    for attempt in 0..5 {
        match fs::rename(&tmp_path, target) {
            Ok(()) => return Ok(()),
            Err(err) => {
                last_err = Some(err);
                if attempt < 4 {
                    thread::sleep(Duration::from_millis(50 * (attempt + 1) as u64));
                }
            }
        }
    }

    let _ = fs::remove_file(&tmp_path);
    Err(format!(
        "原子替换目标文件失败 ({}): {}",
        target.display(),
        last_err
            .map(|e| e.to_string())
            .unwrap_or_else(|| "未知错误".to_string())
    ))
}

fn ensure_directories(data_dir: &Path) -> Result<(PathBuf, PathBuf), String> {
    let journal_path = data_dir.join(JOURNAL_FILE_NAME);
    let backups_dir = data_dir.join(BACKUPS_DIR_NAME);
    fs::create_dir_all(data_dir)
        .map_err(|e| format!("创建数据目录失败 ({}): {}", data_dir.display(), e))?;
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("创建备份目录失败 ({}): {}", backups_dir.display(), e))?;
    Ok((journal_path, backups_dir))
}

fn list_auto_backups_sorted(backups_dir: &Path) -> Vec<PathBuf> {
    let Ok(read_dir) = fs::read_dir(backups_dir) else {
        return Vec::new();
    };

    let mut entries: Vec<(PathBuf, SystemTime, String)> = read_dir
        .filter_map(|res| res.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|name| name.starts_with("journal_auto_") && name.ends_with(".json"))
                    .unwrap_or(false)
        })
        .map(|path| {
            let mtime = fs::metadata(&path)
                .and_then(|m| m.modified())
                .unwrap_or(UNIX_EPOCH);
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            (path, mtime, name)
        })
        .collect();

    entries.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.2.cmp(&a.2)));
    entries.into_iter().map(|(path, _, _)| path).collect()
}

pub fn count_backups(backups_dir: &Path) -> usize {
    list_auto_backups_sorted(backups_dir).len()
}

fn is_valid_backup_file(path: &Path) -> bool {
    let Ok(bytes) = fs::read(path) else {
        return false;
    };
    if bytes.is_empty() {
        return false;
    }
    match serde_json::from_slice::<Value>(&bytes) {
        Ok(val) => validate_journal_root(&val).is_ok(),
        Err(_) => false,
    }
}

fn prune_backups_safely(backups_dir: &Path, max_keep: usize, protected_valid: &Path) {
    if max_keep == 0 {
        return;
    }
    let candidates = list_auto_backups_sorted(backups_dir);
    if candidates.len() <= max_keep {
        return;
    }

    let protected_canon = fs::canonicalize(protected_valid).ok();
    let is_protected = |p: &Path| -> bool {
        if p == protected_valid {
            return true;
        }
        if let (Some(ref pc), Ok(c)) = (&protected_canon, fs::canonicalize(p)) {
            return *pc == c;
        }
        false
    };

    let mut remaining_valid: usize = candidates
        .iter()
        .filter(|p| is_protected(p.as_path()) || is_valid_backup_file(p.as_path()))
        .count();

    for old_path in candidates.iter().skip(max_keep) {
        if is_protected(old_path.as_path()) {
            continue;
        }
        let valid = is_valid_backup_file(old_path.as_path());
        if valid && remaining_valid <= 1 {
            continue;
        }
        if fs::remove_file(old_path).is_ok() && valid {
            remaining_valid = remaining_valid.saturating_sub(1);
        }
    }
}

/// 创建并回读校验一份独立滚动备份（与 Mac 版命名与保留策略保持一致）
pub fn create_verified_backup(
    data_dir: &Path,
    fallback_bytes: Option<&[u8]>,
    max_keep: usize,
) -> Result<BackupResult, String> {
    let (journal_path, backups_dir) = ensure_directories(data_dir)?;

    let source_bytes: Vec<u8> = if journal_path.exists() {
        fs::read(&journal_path)
            .map_err(|e| format!("读取当前 journal.json 创建备份失败: {}", e))?
    } else if let Some(fb) = fallback_bytes {
        fb.to_vec()
    } else {
        serde_json::to_vec_pretty(&default_journal_value())
            .map_err(|e| format!("序列化默认数据失败: {}", e))?
    };

    let ts = Local::now().format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
    let full_uuid = Uuid::new_v4().simple().to_string();
    let short_uuid = &full_uuid[..8];
    let backup_path = backups_dir.join(format!("journal_auto_{}_{}.json", ts, short_uuid));

    atomic_write_bytes(&backup_path, &source_bytes)?;

    // 回读校验，确保备份非空且为合法 JSON 对象
    let verified_bytes = fs::read(&backup_path).map_err(|e| {
        let _ = fs::remove_file(&backup_path);
        format!("回读校验备份失败: {}", e)
    })?;
    if verified_bytes.is_empty() {
        let _ = fs::remove_file(&backup_path);
        return Err("备份校验失败：备份文件为空".to_string());
    }
    let parsed: Value = serde_json::from_slice(&verified_bytes).map_err(|e| {
        let _ = fs::remove_file(&backup_path);
        format!("备份 JSON 校验失败: {}", e)
    })?;
    if let Err(err) = validate_journal_root(&parsed) {
        let _ = fs::remove_file(&backup_path);
        return Err(format!("备份结构校验失败: {}", err));
    }

    prune_backups_safely(&backups_dir, max_keep, &backup_path);

    Ok(BackupResult {
        backup_path: backup_path.to_string_lossy().to_string(),
        backup_count: count_backups(&backups_dir),
    })
}

pub fn load_journal(data_dir: &Path) -> Result<LoadJournalResult, String> {
    let (journal_path, backups_dir) = ensure_directories(data_dir)?;
    let backup_count = count_backups(&backups_dir);

    if !journal_path.exists() {
        return Ok(LoadJournalResult {
            data: default_journal_value(),
            exists: false,
            file_path: journal_path.to_string_lossy().to_string(),
            data_dir: data_dir.to_string_lossy().to_string(),
            backups_dir: backups_dir.to_string_lossy().to_string(),
            backup_count,
        });
    }

    let bytes = fs::read(&journal_path)
        .map_err(|e| format!("读取 journal.json 失败: {}", e))?;
    let mut parsed: Value = serde_json::from_slice(&bytes)
        .map_err(|e| format!("解析 journal.json 失败: {}", e))?;
    validate_journal_root(&parsed)?;

    sort_entries_descending(&mut parsed);

    Ok(LoadJournalResult {
        data: parsed,
        exists: true,
        file_path: journal_path.to_string_lossy().to_string(),
        data_dir: data_dir.to_string_lossy().to_string(),
        backups_dir: backups_dir.to_string_lossy().to_string(),
        backup_count,
    })
}

fn sort_entries_descending(root: &mut Value) {
    if let Some(entries) = root.get_mut("entries").and_then(|v| v.as_array_mut()) {
        entries.sort_by(|a, b| {
            let da = a.get("date").and_then(|v| v.as_str()).unwrap_or("");
            let db = b.get("date").and_then(|v| v.as_str()).unwrap_or("");
            db.cmp(da)
        });
    }
}

/// 100% 保留所有顶层字段与未知扩展字段的原子保存 + 滚动备份
pub fn save_journal(
    data_dir: &Path,
    mut incoming: Value,
    force_backup: bool,
) -> Result<SaveJournalResult, String> {
    validate_journal_root(&incoming)?;
    let (journal_path, backups_dir) = ensure_directories(data_dir)?;

    // 若磁盘已有合法 journal.json，保留磁盘上存在但前端未携带的任何未知顶层扩展字段
    if journal_path.exists() {
        if let Ok(existing_bytes) = fs::read(&journal_path) {
            if let Ok(Value::Object(existing_map)) = serde_json::from_slice::<Value>(&existing_bytes)
            {
                if let Some(incoming_map) = incoming.as_object_mut() {
                    for (k, v) in existing_map {
                        // deletedSourceIDs 由业务层显式管理（为空时省略），其余未知扩展字段全部无损保留
                        if k != "deletedSourceIDs" && !incoming_map.contains_key(&k) {
                            incoming_map.insert(k, v);
                        }
                    }
                }
            }
        }
    }

    if let Some(map) = incoming.as_object_mut() {
        if !map.contains_key("schemaVersion") {
            map.insert("schemaVersion".to_string(), json!(2));
        }
        if !map.contains_key("entries") {
            map.insert("entries".to_string(), json!([]));
        }
        if !map.contains_key("duplicates") {
            map.insert("duplicates".to_string(), json!(0));
        }
        if !map.contains_key("skipped") {
            map.insert("skipped".to_string(), json!(0));
        }
        if !map.contains_key("lastSync") {
            map.insert("lastSync".to_string(), json!(current_apple_reference_timestamp()));
        }
        if !map.contains_key("overrides") {
            map.insert("overrides".to_string(), json!({}));
        }
        if !map.contains_key("pending") {
            map.insert("pending".to_string(), json!([]));
        }
        if !map.contains_key("history") {
            map.insert("history".to_string(), json!([]));
        }
    }

    sort_entries_descending(&mut incoming);

    let serialized = serde_json::to_vec_pretty(&incoming)
        .map_err(|e| format!("序列化 journal.json 失败: {}", e))?;

    // 写入前自动向 Backups/ 保存一份滚动备份（若已有原文件或显式请求）
    let last_backup_path = if journal_path.exists() || force_backup {
        let backup = create_verified_backup(data_dir, Some(&serialized), DEFAULT_MAX_BACKUPS)?;
        Some(backup.backup_path)
    } else {
        None
    };

    atomic_write_bytes(&journal_path, &serialized)?;

    Ok(SaveJournalResult {
        saved_at: Local::now().to_rfc3339(),
        backup_count: count_backups(&backups_dir),
        last_backup_path,
    })
}

/// 一键导入 journal.json：先校验目标文件合法性，若当前存在数据则先备份，再原样原子替换
pub fn import_journal(data_dir: &Path, source_path: &Path) -> Result<LoadJournalResult, String> {
    let bytes = fs::read(source_path)
        .map_err(|e| format!("读取导入文件失败 ({}): {}", source_path.display(), e))?;
    let parsed: Value = serde_json::from_slice(&bytes)
        .map_err(|e| format!("导入文件不是有效的 JSON: {}", e))?;
    validate_journal_root(&parsed)?;

    let (journal_path, backups_dir) = ensure_directories(data_dir)?;
    if journal_path.exists() {
        if is_valid_backup_file(&journal_path) {
            create_verified_backup(data_dir, None, DEFAULT_MAX_BACKUPS)?;
        } else if let Ok(raw_corrupt) = fs::read(&journal_path) {
            let ts = Local::now().format("%Y-%m-%dT%H-%M-%S%.3f").to_string();
            let corrupt_backup = backups_dir.join(format!("journal_corrupted_{}.json", ts));
            let _ = atomic_write_bytes(&corrupt_backup, &raw_corrupt);
        }
    }

    // 保留所有顶层及嵌套扩展字段，原子写入目标 journal.json
    atomic_write_bytes(&journal_path, &bytes)?;
    load_journal(data_dir)
}

/// 一键导出 journal.json：原样原子导出当前数据文件
pub fn export_journal(data_dir: &Path, target_path: &Path) -> Result<String, String> {
    let (journal_path, _) = ensure_directories(data_dir)?;
    let bytes = if journal_path.exists() {
        fs::read(&journal_path).map_err(|e| format!("读取当前 journal.json 失败: {}", e))?
    } else {
        serde_json::to_vec_pretty(&default_journal_value())
            .map_err(|e| format!("序列化默认数据失败: {}", e))?
    };

    atomic_write_bytes(target_path, &bytes)?;
    Ok(target_path.to_string_lossy().to_string())
}

/// 原子导出 UTF-8 文本文件（用于导出装备资料库 CSV 等）
pub fn export_text_file(target_path: &Path, content: &str) -> Result<String, String> {
    atomic_write_bytes(target_path, content.as_bytes())?;
    Ok(target_path.to_string_lossy().to_string())
}

pub fn open_folder(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|e| format!("无法创建目录 ({}): {}", path.display(), e))?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开资源管理器失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开访达失败: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }

    Ok(())
}
