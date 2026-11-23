use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

const MAX_PROFILES: usize = 20;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub url: Option<String>,
}

fn open(app: &tauri::AppHandle) -> Result<Connection, String> {
    let dir: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let c = Connection::open(dir.join("pakpost-local.sqlite3")).map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    c.execute_batch(
        "CREATE TABLE IF NOT EXISTS desktop_profiles (key TEXT PRIMARY KEY, json TEXT NOT NULL);",
    )
    .map_err(|e| e.to_string())?;
    Ok(c)
}

fn validate(profiles: &[ConnectionProfile], active: &str) -> Result<(), String> {
    if profiles.is_empty() || profiles.len() > MAX_PROFILES {
        return Err("Invalid profile count".into());
    }
    let mut ids: std::collections::HashSet<&str> = std::collections::HashSet::new();
    for p in profiles {
        if p.id.is_empty()
            || p.id.len() > 80
            || !p
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-_".contains(c))
            || p.name.trim().is_empty()
            || p.name.len() > 80
            || !ids.insert(p.id.as_str())
        {
            return Err("Invalid or duplicate profile".into());
        }
        match p.kind.as_str() {
            "local" if p.id == "local" && p.url.is_none() => {}
            "public"
                if p.id == "public" && p.url.as_deref() == Some("https://pakpost.duckdns.org") => {}
            "selfhosted" => {
                let u = p.url.as_deref().ok_or("Missing server URL")?;
                // Require HTTPS, DNS host, no username, password, query, fragment, or path.
                // DNS resolution / certificate verification is handled on connection, never bypassed.
                let parsed = reqwest::Url::parse(u).map_err(|_| "Invalid server URL")?;
                if parsed.scheme() != "https"
                    || parsed.host_str().is_none()
                    || parsed.username() != ""
                    || parsed.password().is_some()
                    || parsed.query().is_some()
                    || parsed.fragment().is_some()
                    || parsed.path() != "/"
                    || u.len() > 512
                    || parsed
                        .host_str()
                        .unwrap_or("")
                        .parse::<std::net::IpAddr>()
                        .is_ok()
                {
                    return Err("Provide an HTTPS hostname without path or credentials".into());
                }
            }
            _ => return Err("Invalid profile type".into()),
        }
    }
    if !ids.contains("local") || !ids.contains("public") || !ids.contains(active) {
        return Err("Missing required profile".into());
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStore {
    pub active_id: String,
    pub profiles: Vec<ConnectionProfile>,
}

fn default_store() -> ProfileStore {
    ProfileStore {
        active_id: "local".into(),
        profiles: vec![
            ConnectionProfile {
                id: "local".into(),
                name: "Local Workspace".into(),
                kind: "local".into(),
                url: None,
            },
            ConnectionProfile {
                id: "public".into(),
                name: "PakPost Cloud".into(),
                kind: "public".into(),
                url: Some("https://pakpost.duckdns.org".into()),
            },
        ],
    }
}

#[tauri::command]
pub fn load_connection_profiles(app: tauri::AppHandle) -> Result<ProfileStore, String> {
    let c = open(&app)?;
    let json = match c.query_row(
        "SELECT json FROM desktop_profiles WHERE key='connections'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(default_store()),
        Err(e) => return Err(e.to_string()),
    };
    let data: ProfileStore = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    validate(&data.profiles, &data.active_id)?;
    Ok(data)
}

#[tauri::command]
pub fn save_connection_profiles(app: tauri::AppHandle, store: ProfileStore) -> Result<(), String> {
    validate(&store.profiles, &store.active_id)?;
    let json = serde_json::to_string(&store).map_err(|e| e.to_string())?;
    let c = open(&app)?;
    c.execute("INSERT INTO desktop_profiles(key,json) VALUES('connections',?1) ON CONFLICT(key) DO UPDATE SET json=excluded.json",params![json]).map_err(|e|e.to_string())?;
    Ok(())
}
