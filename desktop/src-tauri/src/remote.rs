pub mod socket;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, State};
use crate::{profiles, credential_vault};

const MAX_RESPONSE: usize = 10 * 1024 * 1024;

pub struct RemoteState {
    pub(crate) inner: Mutex<RemoteInner>,
    hub_slots: tokio::sync::Semaphore,
}
impl Default for RemoteState {
    fn default() -> Self { Self { inner: Mutex::new(RemoteInner::default()), hub_slots: tokio::sync::Semaphore::new(8) } }
}
#[derive(Default)]
pub(crate) struct RemoteInner {
    generation: u64,
    restore_attempted: bool,
    session: Option<Session>,
    pending: Option<Pending>,
}
#[derive(Clone)]
struct Session {
    context: RemoteContext,
    token: String,
}
#[derive(Clone)]
struct Pending {
    context: RemoteContext,
    request_id: String,
    device_secret: String,
    expires: Instant,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteContext {
    profile_id: String,
    origin: String,
    // Non-secret lease. It is not an authentication credential.
    generation: u64,
}
impl RemoteInner {
    fn advance(&mut self) -> u64 {
        self.generation += 1;
        self.restore_attempted = true;
        self.pending = None;
        self.generation
    }
    pub(crate) fn invalidate(&mut self) {
        self.advance();
        self.session = None;
    }
    fn cancel_pairing(&mut self) { self.advance(); }
    fn matches(&self, context: &RemoteContext) -> bool {
        self.session.as_ref().is_some_and(|s| s.context == *context)
    }
    fn evict(&mut self, context: &RemoteContext) {
        if self.matches(context) { self.session = None; }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserHandoff { approval_url: String, generation: u64 }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartResponse { request_id: String, device_secret: String }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollResponse { status: String, desktop_token: Option<String> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteResponse { status: u16, data: Value, request_id: Option<String>, retry_after: Option<String> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubResponse { status: u16, content: String }

fn valid_proof(value: &str) -> bool {
    value.len() == 43 && value.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(15))
        .build().map_err(|_| "Remote client unavailable".into())
}
fn active_server(app: &AppHandle) -> Result<(String, String), String> {
    let store = profiles::load_connection_profiles(app.clone())?;
    let profile = store.profiles.iter().find(|p| p.id == store.active_id && p.kind != "local")
        .ok_or("Local mode cannot access a remote backend")?;
    let base = profile.url.as_deref().ok_or("No server URL")?;
    let parsed = reqwest::Url::parse(base).map_err(|_| "Invalid server URL")?;
    if parsed.scheme() != "https" || parsed.host_str().is_none() || !parsed.username().is_empty()
        || parsed.password().is_some() || parsed.path() != "/" || parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Invalid remote server configuration".into());
    }
    Ok((profile.id.clone(), parsed.origin().ascii_serialization()))
}
fn same_server(app: &AppHandle, context: &RemoteContext) -> bool {
    active_server(app).is_ok_and(|(id, origin)| id == context.profile_id && origin == context.origin)
}
fn snapshot(app: &AppHandle, state: &RemoteState) -> Result<Session, String> {
    let inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
    let session = inner.session.as_ref().filter(|s| same_server(app, &s.context))
        .ok_or("Desktop session is not connected. Sign in again.")?;
    Ok(session.clone())
}
fn ensure_current(app: &AppHandle, state: &RemoteState, context: &RemoteContext, invalid: bool) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
    if !inner.matches(context) || !same_server(app, context) { return Err("Remote connection changed".into()); }
    if invalid {
        inner.evict(context);
        disable_remembered(app)?;
    }
    Ok(())
}
async fn bounded_body(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>, String> {
    if response.content_length().is_some_and(|n| n > limit as u64) { return Err("Remote response too large".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Remote response interrupted")? {
        if chunk.len() > limit.saturating_sub(bytes.len()) { return Err("Remote response too large".into()); }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
async fn revoke(session: Session) {
    // Always revoke against the original origin, never the currently selected profile.
    if let Ok(c) = client() {
        let _ = c.post(format!("{}/api/auth/logout", session.context.origin))
            .header("Authorization", format!("PakpostDesktop {}", session.token)).send().await;
    }
}
#[tauri::command]
pub async fn begin_remote_sign_in(app: AppHandle, state: State<'_, RemoteState>, profile_id: String) -> Result<BrowserHandoff, String> {
    let context = {
        let mut inner = state.inner.lock().map_err(|_| "Pairing state unavailable")?;
        let (id, origin) = active_server(&app)?;
        if id != profile_id { return Err("Select the remote profile first".into()); }
        disable_remembered(&app)?;
        RemoteContext { profile_id: id, origin, generation: inner.advance() }
    };
    let response = client()?.post(format!("{}/api/desktop-auth/start", context.origin)).send().await
        .map_err(|_| "Could not reach the selected server")?;
    if !response.status().is_success() { return Err(format!("Server rejected pairing (HTTP {})", response.status())); }
    let started: StartResponse = serde_json::from_slice(&bounded_body(response, 8192).await?).map_err(|_| "Invalid pairing response")?;
    if !valid_proof(&started.request_id) || !valid_proof(&started.device_secret) { return Err("Invalid pairing response".into()); }
    let generation = context.generation;
    let approval_url = format!("{}/desktop-connect?request={}", context.origin, started.request_id);
    {
        let mut inner = state.inner.lock().map_err(|_| "Pairing state unavailable")?;
        if inner.generation != context.generation || !same_server(&app, &context) { return Err("Pairing cancelled".into()); }
        inner.pending = Some(Pending { context, request_id: started.request_id, device_secret: started.device_secret,
            expires: Instant::now() + Duration::from_secs(300) });
        if let Err(error) = open_in_system_browser(&approval_url) { inner.cancel_pairing(); return Err(error); }
    }
    Ok(BrowserHandoff { approval_url, generation })
}
#[cfg(target_os = "linux")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open").arg(url).spawn().map_err(|_| "Could not open browser".to_string())?; Ok(())
}
#[cfg(target_os = "macos")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("open").arg(url).spawn().map_err(|_| "Could not open browser".to_string())?; Ok(())
}
#[cfg(target_os = "windows")]
fn open_in_system_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(url).spawn().map_err(|_| "Could not open browser".to_string())?; Ok(())
}
#[tauri::command]
pub async fn cancel_remote_sign_in(app: AppHandle, state: State<'_, RemoteState>, generation: u64) -> Result<(), String> {
    let cancelled = {
        let mut inner = state.inner.lock().map_err(|_| "Pairing state unavailable")?;
        if inner.generation != generation { return Ok(()); }
        inner.cancel_pairing();
        // Approval may have completed concurrently with the Stop action.
        if inner.session.as_ref().is_some_and(|s| s.context.generation == generation) {
            disable_remembered(&app)?; inner.session.take()
        } else { None }
    };
    if let Some(session) = cancelled { revoke(session).await; }
    Ok(())
}
#[tauri::command]
pub async fn poll_remote_sign_in(app: AppHandle, state: State<'_, RemoteState>, generation: u64) -> Result<String, String> {
    let pending = {
        let inner = state.inner.lock().map_err(|_| "Pairing state unavailable")?;
        let p = inner.pending.as_ref().ok_or("No desktop pairing in progress")?;
        if p.context.generation != generation || p.expires <= Instant::now() || !same_server(&app, &p.context) { return Err("Pairing expired or cancelled".into()); }
        p.clone()
    };
    let response = client()?.post(format!("{}/api/desktop-auth/poll", pending.context.origin))
        .json(&json!({"requestId":pending.request_id, "deviceSecret":pending.device_secret})).send().await
        .map_err(|_| "Could not reach the selected server")?;
    if !response.status().is_success() { return Err(format!("Pairing rejected (HTTP {})", response.status())); }
    let result: PollResponse = serde_json::from_slice(&bounded_body(response, 8192).await?).map_err(|_| "Invalid pairing response")?;
    if result.status == "pending" { return Ok("pending".into()); }
    if result.status != "approved" { return Err("Unrecognized pairing status".into()); }
    let token = result.desktop_token.filter(|v| valid_proof(v)).ok_or("Invalid session token")?;
    let fresh = Session { context: pending.context.clone(), token };
    let (accepted, previous) = {
        let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
        if inner.pending.as_ref().is_some_and(|p| p.context == pending.context && p.request_id == pending.request_id && p.expires > Instant::now())
            && same_server(&app, &pending.context) {
            inner.pending = None;
            (true, inner.session.replace(fresh.clone()))
        } else { (false, None) }
    };
    if let Some(old) = previous { revoke(old).await; }
    if !accepted { revoke(fresh).await; return Err("Pairing cancelled".into()); }
    ensure_current(&app, &state, &pending.context, false)?;
    Ok("approved".into())
}
// Called under RemoteInner's lock. The marker prevents resurrection even if
// OS deletion fails; explicit Forget surfaces the vault error to the user.
pub(crate) fn disable_remembered(app: &AppHandle) -> Result<(), String> {
    let enabled = profiles::remembered(app)?;
    profiles::set_remembered(app, false)?;
    if enabled { let _ = credential_vault::clear(); }
    Ok(())
}

#[tauri::command]
pub fn desktop_remembered_status(app: AppHandle) -> Result<bool, String> {
    profiles::remembered(&app)
}

#[tauri::command]
pub async fn remember_remote_session(app: AppHandle, state: State<'_, RemoteState>) -> Result<(), String> {
    let inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
    let session = inner.session.as_ref().filter(|s| same_server(&app, &s.context) && s.context.generation == inner.generation && inner.pending.is_none())
        .ok_or("Sign in before enabling persistent login")?;
    // Never re-enable an old record after a failed write.
    profiles::set_remembered(&app, false)?;
    credential_vault::save(&credential_vault::RememberedSession {
        profile_id: session.context.profile_id.clone(), origin: session.context.origin.clone(), token: session.token.clone(),
    })?;
    if let Err(error) = profiles::set_remembered(&app, true) {
        let _ = credential_vault::clear();
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub async fn forget_remote_session(app: AppHandle, state: State<'_, RemoteState>) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
    // Cancel an in-flight restore without changing an already active session.
    inner.restore_attempted = true;
    if inner.session.is_none() && inner.pending.is_none() { inner.advance(); }
    profiles::set_remembered(&app, false)?;
    credential_vault::clear()
}

#[derive(PartialEq, Eq, Debug)]
enum RestoreVerdict { Valid, Rejected, Retry }
fn restore_verdict(status: u16, body: &Value) -> RestoreVerdict {
    if status == 401 || (status == 200 && body.get("authenticated").and_then(Value::as_bool) == Some(false)) {
        RestoreVerdict::Rejected
    } else if status == 200 && body.get("authenticated").and_then(Value::as_bool) == Some(true)
        && body.get("user").and_then(|u| u.get("id")).and_then(Value::as_str).is_some_and(|id| !id.is_empty()) {
        RestoreVerdict::Valid
    } else { RestoreVerdict::Retry }
}

#[tauri::command]
pub async fn restore_remote_session(app: AppHandle, state: State<'_, RemoteState>) -> Result<bool, String> {
    let session = {
        let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
        if inner.session.is_some() { return Ok(inner.session.as_ref().is_some_and(|s| same_server(&app, &s.context))); }
        if inner.restore_attempted || inner.pending.is_some() { return Ok(false); }
        inner.restore_attempted = true;
        if !profiles::remembered(&app)? { return Ok(false); }
        let (id, origin) = match active_server(&app) { Ok(pair) => pair, Err(_) => return Ok(false) };
        let saved = match credential_vault::load()? {
            Some(saved) => saved,
            None => { profiles::set_remembered(&app, false)?; return Ok(false); }
        };
        if saved.profile_id != id || saved.origin != origin || !valid_proof(&saved.token) {
            disable_remembered(&app)?; return Ok(false);
        }
        let context = RemoteContext { profile_id: id, origin, generation: inner.advance() };
        Session { context, token: saved.token }
    };
    // Do not expose a lease or authenticated UI before the server verifies the token.
    let check: Result<RestoreVerdict, String> = async {
        let response = client()?.get(format!("{}/api/auth/session", session.context.origin))
            .header("Authorization", format!("PakpostDesktop {}", session.token))
            .header("X-PakPost-Instance", "desktop-native").send().await.map_err(|_| "Session verification unavailable")?;
        let status = response.status().as_u16();
        let body = serde_json::from_slice(&bounded_body(response, 64 * 1024).await?).unwrap_or(Value::Null);
        Ok(restore_verdict(status, &body))
    }.await;
    let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
    if inner.generation != session.context.generation || !same_server(&app, &session.context)
        || inner.pending.is_some() || inner.session.is_some() || !profiles::remembered(&app)? { return Ok(false); }
    match check {
        Ok(RestoreVerdict::Valid) => { inner.session = Some(session); Ok(true) }
        Ok(RestoreVerdict::Rejected) => { disable_remembered(&app)?; Ok(false) }
        _ => { inner.restore_attempted = false; Ok(false) } // retry on existing online/visibility cadence
    }
}

#[tauri::command]
pub fn desktop_remote_status(app: AppHandle, state: State<'_, RemoteState>) -> Result<bool, String> {
    Ok(snapshot(&app, &state).is_ok())
}
#[tauri::command]
pub fn desktop_remote_context(app: AppHandle, state: State<'_, RemoteState>) -> Result<RemoteContext, String> {
    Ok(snapshot(&app, &state)?.context)
}
fn api_url(origin: &str, path: &str) -> Result<reqwest::Url, String> {
    let raw_path = path.split('?').next().unwrap_or("");
    // API paths are constructed internally from GUIDs and static routes. Reject
    // encoded separators and dot segments before URL normalization can hide them.
    if !raw_path.starts_with("/api/") || raw_path.contains('%') || path.contains('\\') || path.contains('#') || raw_path.contains("//")
        || raw_path.split('/').any(|p| p == "." || p == "..") || raw_path.to_ascii_lowercase().starts_with("/api/desktop-auth/") {
        return Err("Invalid remote API path".into());
    }
    let mut url = reqwest::Url::parse(origin).map_err(|_| "Invalid origin")?;
    url.set_path(raw_path);
    if let Some((_, query)) = path.split_once('?') { url.set_query(Some(query)); }
    Ok(url)
}
#[tauri::command]
pub async fn remote_api(app: AppHandle, state: State<'_, RemoteState>, context: RemoteContext, path: String, method: String, body: Option<Value>) -> Result<RemoteResponse, String> {
    let session = snapshot(&app, &state)?;
    if context != session.context { return Err("Remote connection changed".into()); }
    let url = api_url(&session.context.origin, &path)?;
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid method")?;
    if !matches!(verb.as_str(), "GET" | "POST" | "PUT" | "PATCH" | "DELETE") { return Err("Unsupported HTTP method".into()); }
    let mut request = client()?.request(verb, url).header("Authorization", format!("PakpostDesktop {}", session.token))
        .header("Accept", "application/json").header("X-PakPost-Instance", "desktop-native");
    if let Some(value) = body { request = request.json(&value); }
    let response = request.send().await.map_err(|_| "Remote request failed")?;
    let status = response.status().as_u16();
    let request_id = response.headers().get("X-Request-ID").and_then(|v| v.to_str().ok()).map(str::to_owned);
    let retry_after = response.headers().get("Retry-After").and_then(|v| v.to_str().ok()).map(str::to_owned);
    let bytes = bounded_body(response, MAX_RESPONSE).await?;
    let data: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    let invalid = status == 401 || (path == "/api/auth/session" && data.get("authenticated").and_then(Value::as_bool) == Some(false))
        || (path == "/api/auth/logout" && (200..300).contains(&status));
    ensure_current(&app, &state, &session.context, invalid)?;
    Ok(RemoteResponse { status, data, request_id, retry_after })
}
fn hub_url(context: &RemoteContext, url: &str, method: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "Invalid hub URL")?;
    if parsed.origin().ascii_serialization() != context.origin || !parsed.username().is_empty() || parsed.password().is_some() || parsed.fragment().is_some()
        || !matches!((parsed.path(), method), ("/hubs/workspace/negotiate", "POST") | ("/hubs/workspace", "GET" | "POST" | "DELETE")) {
        return Err("Invalid hub destination".into());
    }
    if parsed.query_pairs().any(|(k, _)| !matches!(k.as_ref(), "id" | "_" | "negotiateVersion" | "useStatefulReconnect")) { return Err("Invalid hub query".into()); }
    Ok(parsed)
}
#[tauri::command]
pub async fn remote_hub_http(app: AppHandle, state: State<'_, RemoteState>, context: RemoteContext, url: String, method: String, content: Option<String>) -> Result<HubResponse, String> {
    let session = snapshot(&app, &state)?;
    if context != session.context { return Err("Remote connection changed".into()); }
    let target = hub_url(&context, &url, &method)?;
    let _permit = state.hub_slots.try_acquire().map_err(|_| "Too many realtime requests")?;
    let verb = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "Invalid hub method")?;
    let mut request = client()?.request(verb, target).timeout(Duration::from_secs(if method == "GET" { 105 } else { 15 }))
        .header("Authorization", format!("PakpostDesktop {}", session.token));
    if let Some(text) = content {
        if text.len() > 64 * 1024 || (method != "POST" && !text.is_empty()) { return Err("Invalid hub payload".into()); }
        if method == "POST" { request = request.header("Content-Type", "text/plain;charset=UTF-8").body(text); }
    }
    let response = request.send().await.map_err(|_| "Realtime transport unavailable")?;
    let status = response.status().as_u16();
    let bytes = bounded_body(response, 1024 * 1024).await?;
    ensure_current(&app, &state, &context, status == 401)?;
    let content = String::from_utf8(bytes).map_err(|_| "Invalid hub response")?;
    Ok(HubResponse { status, content })
}
#[tauri::command]
pub async fn disconnect_remote(app: AppHandle, state: State<'_, RemoteState>) -> Result<(), String> {
    let previous = {
        let mut inner = state.inner.lock().map_err(|_| "Session state unavailable")?;
        disable_remembered(&app)?;
        inner.advance(); inner.session.take()
    };
    if let Some(session) = previous { revoke(session).await; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn context(origin: &str, generation: u64) -> RemoteContext { RemoteContext { profile_id: "public".into(), origin: origin.into(), generation } }
    #[test] fn old_unauthorized_cannot_clear_new_session() {
        let old = context("https://a.example", 1); let new = context("https://a.example", 2);
        let mut inner = RemoteInner::default(); inner.session = Some(Session { context: new.clone(), token: "test".into() });
        inner.evict(&old); assert!(inner.matches(&new)); inner.evict(&new); assert!(inner.session.is_none());
    }
    #[test] fn profile_switch_invalidates_pending_and_session() {
        let mut inner = RemoteInner::default(); let c = context("https://a.example", inner.advance());
        inner.session = Some(Session { context: c.clone(), token:"test".into() });
        inner.pending = Some(Pending { context: c, request_id:"id".into(),device_secret:"secret".into(),expires:Instant::now() });
        inner.invalidate(); assert!(inner.session.is_none() && inner.pending.is_none()); assert_eq!(inner.generation,2);
    }
    #[test] fn hub_rejects_cross_origin_and_non_hub_paths() {
        let c = context("https://a.example",1);
        assert!(hub_url(&c,"https://a.example/hubs/workspace?id=abc&_=123","GET").is_ok());
        assert!(hub_url(&c,"https://a.example/hubs/workspace/negotiate?negotiateVersion=1","POST").is_ok());
        for url in ["https://b.example/hubs/workspace", "https://a.example/api/auth/me", "https://a.example/hubs/workspace?access_token=test", "https://user@a.example/hubs/workspace"] { assert!(hub_url(&c,url,"GET").is_err()); }
    }
    #[test] fn api_paths_cannot_escape_or_access_pairing() {
        for path in ["/api/../hubs/workspace", "/api/%2e%2e/hubs/workspace", "/api/desktop-auth/poll", "/api/Desktop-Auth/poll", "//b.example/api/auth/me"] { assert!(api_url("https://a.example",path).is_err()); }
        assert!(api_url("https://a.example","/api/workspaces?search=a%20b").is_ok());
    }
    #[test] fn restore_requires_verified_identity() {
        assert_eq!(restore_verdict(200, &json!({"authenticated":true,"user":{"id":"abc"}})), RestoreVerdict::Valid);
        assert_eq!(restore_verdict(200, &json!({"authenticated":false})), RestoreVerdict::Rejected);
        assert_eq!(restore_verdict(401, &Value::Null), RestoreVerdict::Rejected);
        for code in [403, 429, 500, 503] { assert_eq!(restore_verdict(code, &Value::Null), RestoreVerdict::Retry); }
        assert_eq!(restore_verdict(200, &json!({"authenticated":true})), RestoreVerdict::Retry);
    }
    #[test] fn proof_is_base64url() { assert!(valid_proof(&"a".repeat(43))); assert!(!valid_proof(&"/".repeat(43))); }
}
