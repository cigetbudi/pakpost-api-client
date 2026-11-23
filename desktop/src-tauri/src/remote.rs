use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{AppHandle, State};

use crate::profiles;

#[derive(Default)]
pub struct RemoteState {
    // Secrets deliberately never persisted in SQLite/localStorage or returned to JS.
    pub sessions: Mutex<HashMap<String, String>>,
    pending: Mutex<Option<Pending>>,
}
struct Pending {
    profile_id: String,
    request_id: String,
    device_secret: String,
    url: String,
    expires: std::time::Instant,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserHandoff {
    approval_url: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartResponse {
    request_id: String,
    device_secret: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollResponse {
    status: String,
    desktop_token: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteResponse {
    status: u16,
    data: Value,
    request_id: Option<String>,
    retry_after: Option<String>,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}

fn server_for(app: &AppHandle, id: &str) -> Result<String, String> {
    let store = profiles::load_connection_profiles(app.clone())?;
    let profile = store
        .profiles
        .iter()
        .find(|p| p.id == id && p.kind != "local")
        .ok_or("Unknown remote profile")?;
    let base = profile.url.as_deref().ok_or("No server URL")?;
    // Validated on save; revalidate on each use, protecting against corrupted local data.
    let parsed = reqwest::Url::parse(base).map_err(|_| "Invalid server URL")?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || parsed.username() != ""
        || parsed.password().is_some()
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("Invalid remote server configuration".into());
    }
    Ok(parsed.origin().ascii_serialization())
}

#[tauri::command]
pub async fn begin_remote_sign_in(
    app: AppHandle,
    state: State<'_, RemoteState>,
    profile_id: String,
) -> Result<BrowserHandoff, String> {
    let base = server_for(&app, &profile_id)?;
    let response = client()?
        .post(format!("{base}/api/desktop-auth/start"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Server does not support desktop pairing (HTTP {}). Update the selected PakPost server.",
            response.status()
        ));
    }
    let started: StartResponse = response.json().await.map_err(|e| e.to_string())?;
    if started.request_id.len() != 43 || started.device_secret.len() != 43 {
        return Err("Invalid pairing response".into());
    }
    let approval_url = format!("{base}/desktop-connect?request={}", started.request_id);
    {
        let mut pending = state
            .pending
            .lock()
            .map_err(|_| "Pairing state unavailable")?;
        *pending = Some(Pending {
            profile_id,
            request_id: started.request_id,
            device_secret: started.device_secret,
            url: base,
            expires: std::time::Instant::now() + Duration::from_secs(300),
        });
    }
    // The OS browser handles the existing Google SSO; never use an embedded OAuth WebView.
    open_in_system_browser(&approval_url)?;
    Ok(BrowserHandoff { approval_url })
}

#[cfg(target_os = "linux")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(target_os = "macos")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(target_os = "windows")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    // Command::new with direct arguments avoids shell interpolation of URL.
    std::process::Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn poll_remote_sign_in(state: State<'_, RemoteState>) -> Result<String, String> {
    let (profile_id, url, id, secret) = {
        let guard = state
            .pending
            .lock()
            .map_err(|_| "Pairing state unavailable")?;
        let pending = guard.as_ref().ok_or("No desktop pairing in progress")?;
        if pending.expires <= std::time::Instant::now() {
            return Err("Pairing expired. Start again.".into());
        }
        (
            pending.profile_id.clone(),
            pending.url.clone(),
            pending.request_id.clone(),
            pending.device_secret.clone(),
        )
    };
    let response = client()?
        .post(format!("{url}/api/desktop-auth/poll"))
        .json(&json!({"requestId": id, "deviceSecret":secret}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Pairing rejected (HTTP {})", response.status()));
    }
    let result: PollResponse = response.json().await.map_err(|e| e.to_string())?;
    if result.status == "pending" {
        return Ok("pending".into());
    }
    if result.status != "approved" {
        return Err("Unrecognized pairing status".into());
    }
    let token = result
        .desktop_token
        .ok_or("Server did not issue a session")?;
    if token.len() != 43 {
        return Err("Invalid session token".into());
    }
    state
        .sessions
        .lock()
        .map_err(|_| "Session state unavailable")?
        .insert(profile_id, token);
    *state
        .pending
        .lock()
        .map_err(|_| "Pairing state unavailable")? = None;
    Ok("approved".into())
}

#[tauri::command]
pub fn desktop_remote_status(
    app: AppHandle,
    state: State<'_, RemoteState>,
) -> Result<bool, String> {
    let store = profiles::load_connection_profiles(app)?;
    if store.active_id == "local" {
        return Ok(false);
    }
    Ok(state
        .sessions
        .lock()
        .map_err(|_| "Session state unavailable")?
        .contains_key(&store.active_id))
}

#[tauri::command]
pub async fn remote_api(
    app: AppHandle,
    state: State<'_, RemoteState>,
    path: String,
    method: String,
    body: Option<Value>,
) -> Result<RemoteResponse, String> {
    let store = profiles::load_connection_profiles(app.clone())?;
    if store.active_id == "local" {
        return Err("Local mode cannot access a remote backend".into());
    }
    let base = server_for(&app, &store.active_id)?;
    let token = state
        .sessions
        .lock()
        .map_err(|_| "Session state unavailable")?
        .get(&store.active_id)
        .cloned()
        .ok_or("Desktop session is not connected. Sign in again.")?;
    // Restrict to PakPost API paths on the chosen server. Never follow redirects.
    if !path.starts_with("/api/")
        || path.starts_with("/api/desktop-auth/")
        || path.contains('\\')
        || path.contains('#')
        || path.contains("//")
    {
        return Err("Invalid remote API path".into());
    }
    let mut url = reqwest::Url::parse(&base).map_err(|e| e.to_string())?;
    url.set_path(&path.split('?').next().unwrap_or(""));
    if let Some((_, query)) = path.split_once('?') {
        url.set_query(Some(query));
    }
    if !url.path().starts_with("/api/") {
        return Err("Invalid API destination".into());
    }
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid method")?;
    if !matches!(verb.as_str(), "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
        return Err("Unsupported HTTP method".into());
    }
    let mut request = client()?
        .request(verb, url)
        .header("Authorization", format!("PakpostDesktop {token}"))
        .header("Accept", "application/json")
        .header("X-PakPost-Instance", "desktop-native");
    if let Some(json) = body {
        request = request.json(&json);
    }
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let request_id = response
        .headers()
        .get("X-Request-ID")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let retry_after = response
        .headers()
        .get("Retry-After")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 10 * 1024 * 1024 {
        return Err("Remote response too large".into());
    }
    let data = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    Ok(RemoteResponse {
        status,
        data,
        request_id,
        retry_after,
    })
}

#[tauri::command]
pub async fn disconnect_remote(
    app: AppHandle,
    state: State<'_, RemoteState>,
) -> Result<(), String> {
    let store = profiles::load_connection_profiles(app.clone())?;
    if store.active_id != "local" {
        let token = {
            let mut sessions = state
                .sessions
                .lock()
                .map_err(|_| "Session state unavailable")?;
            sessions.remove(&store.active_id)
        };
        if let Some(token) = token {
            if let Ok(base) = server_for(&app, &store.active_id) {
                if let Ok(c) = client() {
                    let _ = c
                        .post(format!("{base}/api/auth/logout"))
                        .header("Authorization", format!("PakpostDesktop {token}"))
                        .send()
                        .await;
                }
            }
        }
    }
    Ok(())
}
