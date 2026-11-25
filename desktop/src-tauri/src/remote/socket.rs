//! Restricted text-only native WebSocket transport for the workspace hub.
use super::{RemoteContext, RemoteState, snapshot, ensure_current};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager, State, ipc::Channel};
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::{connect_async_with_config, tungstenite::{Message, client::IntoClientRequest, protocol::WebSocketConfig, http::HeaderValue, Error}};

const MAX_FRAME: usize = 1024 * 1024;
const MAX_SEND: usize = 64 * 1024;
#[derive(Default)]
pub struct HubSockets(Mutex<HashMap<String, SocketSlot>>);
struct SocketSlot {
    context: RemoteContext,
    send: mpsc::Sender<String>,
    cancel: oneshot::Sender<()>,
}
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SocketEvent {
    Open,
    Message { data: String },
    Unauthorized,
    Close,
}
fn socket_url(context: &RemoteContext, url: &str) -> Result<String, String> {
    if url.len() > 2048 || url.chars().any(char::is_control) { return Err("Invalid socket URL".into()); }
    let parsed = reqwest::Url::parse(url).map_err(|_| "Invalid socket URL")?;
    if parsed.scheme() != "wss" || parsed.path() != "/hubs/workspace" || !parsed.username().is_empty()
        || parsed.password().is_some() || parsed.fragment().is_some() { return Err("Invalid socket destination".into()); }
    let mut https = parsed.clone();
    https.set_scheme("https").map_err(|_| "Invalid socket origin")?;
    if https.origin().ascii_serialization() != context.origin { return Err("Invalid socket origin".into()); }
    let params: Vec<_> = parsed.query_pairs().collect();
    if params.len() != 1 || params[0].0 != "id" || params[0].1.is_empty() || params[0].1.len() > 512 {
        return Err("Invalid socket connection ID".into());
    }
    Ok(parsed.to_string())
}
#[tauri::command]
pub fn open_hub_socket(app: AppHandle, state: State<'_, RemoteState>, sockets: State<'_, HubSockets>, context: RemoteContext, id: String, url: String, events: Channel<SocketEvent>) -> Result<(), String> {
    let session = snapshot(&app, &state)?;
    if session.context != context { return Err("Remote connection changed".into()); }
    if id.is_empty() || id.len() > 64 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { return Err("Invalid socket ID".into()); }
    let mut request = socket_url(&context, &url)?.into_client_request().map_err(|_| "Invalid socket request")?;
    let mut auth = HeaderValue::from_str(&format!("PakpostDesktop {}", session.token)).map_err(|_| "Invalid session credential")?;
    auth.set_sensitive(true);
    request.headers_mut().insert("authorization", auth);
    // Match the server Origin guard; never use a renderer-supplied Origin.
    request.headers_mut().insert("origin", HeaderValue::from_str(&context.origin).map_err(|_| "Invalid origin")?);
    let (send, mut outgoing) = mpsc::channel::<String>(16);
    let (cancel, mut cancelled) = oneshot::channel();
    {
        let mut slots = sockets.0.lock().map_err(|_| "Socket state unavailable")?;
        if slots.len() >= 4 || slots.contains_key(&id) { return Err("Too many realtime sockets".into()); }
        slots.insert(id.clone(), SocketSlot { context: context.clone(), send, cancel });
    }
    tauri::async_runtime::spawn(async move {
        let remote = app.state::<RemoteState>();
        let config = WebSocketConfig::default().max_message_size(Some(MAX_FRAME)).max_frame_size(Some(MAX_FRAME));
        // Async tungstenite connect does not follow HTTP redirects. Never pass an auth header to a second origin.
        let connect = tokio::time::timeout(Duration::from_secs(10), connect_async_with_config(request, Some(config), false));
        let result = tokio::select! { _ = &mut cancelled => None, result = connect => Some(result) };
        match result {
            Some(Ok(Ok((mut stream, _)))) => {
                if ensure_current(&app, &remote, &context, false).is_ok() && events.send(SocketEvent::Open).is_ok() {
                    let mut tick = tokio::time::interval(Duration::from_secs(1));
                    loop {
                        if ensure_current(&app, &remote, &context, false).is_err() { break; }
                        tokio::select! {
                            _ = &mut cancelled => break,
                            _ = tick.tick() => {},
                            item = outgoing.recv() => {
                                let Some(text) = item else { break; };
                                if ensure_current(&app, &remote, &context, false).is_err() { break; }
                                if !matches!(tokio::time::timeout(Duration::from_secs(5), stream.send(Message::Text(text.into()))).await, Ok(Ok(()))) { break; }
                            },
                            item = stream.next() => {
                                if ensure_current(&app, &remote, &context, false).is_err() { break; }
                                match item {
                                    Some(Ok(Message::Text(text))) => if events.send(SocketEvent::Message { data: text.to_string() }).is_err() { break; },
                                    Some(Ok(Message::Ping(_))) => if !matches!(tokio::time::timeout(Duration::from_secs(5), stream.flush()).await, Ok(Ok(()))) { break; },
                                    Some(Ok(Message::Pong(_))) => {},
                                    _ => break,
                                }
                            }
                        }
                    }
                }
                // Drop the socket immediately rather than waiting indefinitely for a close handshake.
            }
            Some(Ok(Err(Error::Http(response)))) if response.status().as_u16() == 401 => {
                if ensure_current(&app, &remote, &context, true).is_ok() { let _ = events.send(SocketEvent::Unauthorized); }
            }
            _ => {} // Do not emit raw errors (request URL/header data may be sensitive).
        }
        if let Ok(mut slots) = app.state::<HubSockets>().0.lock() { slots.remove(&id); }
        let _ = events.send(SocketEvent::Close);
    });
    Ok(())
}
#[tauri::command]
pub fn send_hub_socket(app: AppHandle, state: State<'_, RemoteState>, sockets: State<'_, HubSockets>, context: RemoteContext, id: String, content: String) -> Result<(), String> {
    ensure_current(&app, &state, &context, false)?;
    if content.len() > MAX_SEND { return Err("Socket payload too large".into()); }
    let slots = sockets.0.lock().map_err(|_| "Socket state unavailable")?;
    let slot = slots.get(&id).filter(|s| s.context == context).ok_or("Socket is closed")?;
    slot.send.try_send(content).map_err(|_| "Socket queue unavailable".into())
}
#[tauri::command]
pub fn close_hub_socket(sockets: State<'_, HubSockets>, context: RemoteContext, id: String) -> Result<(), String> {
    let mut slots = sockets.0.lock().map_err(|_| "Socket state unavailable")?;
    // Keep the ID reserved until the worker exits, including cancelled handshakes.
    if let Some(slot) = slots.get_mut(&id).filter(|s| s.context == context) {
        let (replacement, _) = oneshot::channel();
        let _ = std::mem::replace(&mut slot.cancel, replacement).send(());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn socket_destination_is_exact_and_bound_to_origin() {
        let context = RemoteContext { profile_id:"public".into(), origin:"https://example.test".into(), generation:1 };
        assert!(socket_url(&context,"wss://example.test/hubs/workspace?id=abc").is_ok());
        for bad in ["ws://example.test/hubs/workspace?id=abc", "wss://other.test/hubs/workspace?id=abc", "wss://example.test/api/auth/session?id=abc", "wss://example.test/hubs/workspace?id=abc&access_token=secret", "wss://example.test/hubs/workspace?id=a&id=b", "wss://user@example.test/hubs/workspace?id=abc"] {
            assert!(socket_url(&context,bad).is_err());
        }
    }
}
