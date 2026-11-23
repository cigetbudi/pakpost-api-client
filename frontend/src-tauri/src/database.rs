use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const MAX_SNAPSHOT_BYTES: usize = 8 * 1024 * 1024;
fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base.join("pakpost-local.sqlite3"))
}
fn open_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(db_path(app)?).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS local_state (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);")
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub fn load_local_collections(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT json FROM local_state WHERE key = 'collections' LIMIT 1")
        .map_err(|e| e.to_string())?;
    let result = stmt.query_row([], |row| row.get::<_, String>(0));
    match result {
        Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e| e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn save_local_collections(app: tauri::AppHandle, snapshot: Value) -> Result<(), String> {
    let collections = snapshot.get("collections").and_then(Value::as_array)
        .ok_or_else(|| "Invalid collections snapshot".to_string())?;
    if snapshot.get("version").and_then(Value::as_u64) != Some(1) || collections.len() > 60 {
        return Err("Invalid snapshot version or collection count".into());
    }
    let json = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    if json.len() > MAX_SNAPSHOT_BYTES { return Err("Local data exceeds 8 MiB limit".into()); }
    let conn = open_db(&app)?;
    conn.execute("INSERT INTO local_state(key,json,updated_at) VALUES('collections',?1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=CURRENT_TIMESTAMP", params![json])
        .map_err(|e| e.to_string())?;
    Ok(())
}


// Desktop-only non-secret environment snapshot. Sensitive variable values are
// never written to this database; users must re-enter secrets each session.
#[tauri::command]
pub fn load_local_environments(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT json FROM local_state WHERE key = 'environments' LIMIT 1").map_err(|e| e.to_string())?;
    match stmt.query_row([], |row| row.get::<_, String>(0)) {
        Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e| e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn save_local_environments(app: tauri::AppHandle, snapshot: Value) -> Result<(), String> {
    if snapshot.get("version").and_then(Value::as_u64) != Some(1) {return Err("Unsupported environment schema".into())}
    let envs = snapshot.get("environments").and_then(Value::as_array).ok_or("Invalid environments")?;
    if envs.len() > 100 {return Err("Too many environments".into())}
    for env in envs {
        let vars = env.get("variables").and_then(Value::as_array).ok_or("Invalid variables")?;
        if vars.len() > 300 {return Err("Too many variables".into())}
        for var in vars {
            if var.get("isSecret").and_then(Value::as_bool) == Some(true)
                && var.get("value").and_then(Value::as_str).unwrap_or("") != "" {
                return Err("Secret environment values cannot be saved to disk".into());
            }
        }
    }
    let json = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    if json.len() > MAX_SNAPSHOT_BYTES {return Err("Environment snapshot too large".into())}
    let conn = open_db(&app)?;
    conn.execute("INSERT INTO local_state(key,json,updated_at) VALUES('environments',?1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=CURRENT_TIMESTAMP", params![json]).map_err(|e|e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_local_history(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let conn = open_db(&app)?;
    let mut stmt = conn.prepare("SELECT json FROM local_state WHERE key = 'history' LIMIT 1").map_err(|e|e.to_string())?;
    match stmt.query_row([], |row| row.get::<_, String>(0)) {
        Ok(json) => serde_json::from_str(&json).map(Some).map_err(|e|e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn save_local_history(app: tauri::AppHandle, snapshot: Value) -> Result<(), String> {
    if snapshot.get("version").and_then(Value::as_u64) != Some(1) {return Err("Unsupported history schema".into())}
    let entries = snapshot.get("entries").and_then(Value::as_array).ok_or("Invalid history")?;
    if entries.len() > 100 {return Err("History limit exceeded".into())}
    for entry in entries {
        let obj = entry.as_object().ok_or("Invalid history entry")?;
        if obj.keys().any(|key| !matches!(key.as_str(), "method" | "url" | "status" | "elapsed")) {
            return Err("History can only store non-sensitive metadata".into())
        }
    }
    let json = serde_json::to_string(&snapshot).map_err(|e|e.to_string())?;
    if json.len() > 65536 {return Err("History snapshot too large".into())}
    let conn = open_db(&app)?;
    conn.execute("INSERT INTO local_state(key,json,updated_at) VALUES('history',?1,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET json=excluded.json,updated_at=CURRENT_TIMESTAMP", params![json]).map_err(|e|e.to_string())?;
    Ok(())
}
