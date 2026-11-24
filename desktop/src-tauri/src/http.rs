//! Explicit desktop-only HTTP transport. No server proxy, no cookies, no redirect
//! following, no filesystem paths, and bounded response buffering.
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::{
    Client, Method, Url,
    header::{CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

const MAX_UPLOAD_BYTES: usize = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeCommand {
    method: String,
    url: String,
    #[serde(default)]
    headers: HashMap<String, String>,
    #[serde(default)]
    body: String,
    #[serde(default)]
    body_mode: String,
    content_type: Option<String>,
    #[serde(default)]
    form_fields: Vec<FormField>,
    file_base64: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormField {
    key: String,
    value: Option<String>,
    file_name: Option<String>,
    base64: Option<String>,
    content_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeResponse {
    status_code: u16,
    reason_phrase: String,
    elapsed_ms: u64,
    timing: NativeTiming,
    headers: HashMap<String, String>,
    body: String,
    truncated: bool,
    is_binary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeTiming { headers_ms: u64, body_ms: u64, total_ms: u64 }

// Reserve before dispatch: cancellation can arrive before the HTTP future starts.
struct CancelSlot {
    sender: Option<tokio::sync::oneshot::Sender<()>>,
    receiver: Option<tokio::sync::oneshot::Receiver<()>>,
    created: Instant,
}
#[derive(Default)]
pub struct NativeCancellation(std::sync::Mutex<HashMap<String, CancelSlot>>);

#[tauri::command]
pub fn reserve_native_http(state: tauri::State<'_, NativeCancellation>, request_id: String) -> Result<(), String> {
    if request_id.len()!=36 || !request_id.bytes().all(|c| c.is_ascii_hexdigit() || c==b'-') { return Err("Invalid execution ID".into()); }
    let mut slots=state.0.lock().map_err(|_| "Cancellation state unavailable")?;
    slots.retain(|_,slot| slot.receiver.is_none() || slot.created.elapsed()<Duration::from_secs(60));
    if slots.len()>=32 || slots.contains_key(&request_id) { return Err("Too many native requests".into()); }
    let (sender,receiver)=tokio::sync::oneshot::channel();
    slots.insert(request_id,CancelSlot{sender:Some(sender),receiver:Some(receiver),created:Instant::now()});
    Ok(())
}
#[tauri::command]
pub fn cancel_native_http(state: tauri::State<'_, NativeCancellation>, request_id: String) -> Result<(), String> {
    let mut slots=state.0.lock().map_err(|_| "Cancellation state unavailable")?;
    if let Some(slot)=slots.get_mut(&request_id) { if let Some(sender)=slot.sender.take(){let _=sender.send(());} }
    Ok(())
}
#[tauri::command]
pub async fn send_cancelable_native_http(state: tauri::State<'_, NativeCancellation>, request_id: String, command: NativeCommand) -> Result<NativeResponse,String> {
    let receiver={let mut slots=state.0.lock().map_err(|_| "Cancellation state unavailable")?;
        slots.get_mut(&request_id).and_then(|slot|slot.receiver.take()).ok_or("Unknown execution ID")?};
    // The cancellation future is polled first, so a prior cancellation cannot dispatch HTTP.
    let output=match futures_util::future::select(Box::pin(receiver),Box::pin(send_native_http(command))).await {
        futures_util::future::Either::Left((_cancelled,_http))=>Err("Native request cancelled".into()),
        futures_util::future::Either::Right((response,_cancel))=>response,
    };
    state.0.lock().map_err(|_| "Cancellation state unavailable")?.remove(&request_id);
    output
}

fn decoded_file(encoded: &str) -> Result<Vec<u8>, String> {
    // Reject excessive uploads before allocating decoded bytes.
    if encoded.len() > (MAX_UPLOAD_BYTES * 4 / 3 + 8) {
        return Err("Upload exceeds 16 MiB native request limit".into());
    }
    let decoded = STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid base64 upload".to_string())?;
    if decoded.len() > MAX_UPLOAD_BYTES {
        return Err("Upload exceeds 16 MiB native request limit".into());
    }
    Ok(decoded)
}

#[tauri::command]
pub async fn send_native_http(command: NativeCommand) -> Result<NativeResponse, String> {
    let url = Url::parse(&command.url).map_err(|_| "Invalid HTTP URL".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Only HTTP(S) URLs without embedded credentials are supported".into());
    }
    if url.host_str().is_none() {
        return Err("HTTP URL is missing a hostname".into());
    }
    let method = Method::from_bytes(command.method.as_bytes())
        .map_err(|_| "Invalid HTTP method".to_string())?;
    let mut headers = HeaderMap::new();
    for (key, value) in &command.headers {
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|_| "Invalid HTTP header name".to_string())?;
        // Do not permit manipulation of protocol framing or a forged Host header.
        if [
            "host",
            "content-length",
            "transfer-encoding",
            "connection",
            "proxy-authorization",
        ]
        .contains(&name.as_str())
        {
            return Err(format!("Native transport does not allow header: {key}"));
        }
        let val =
            HeaderValue::from_str(value).map_err(|_| format!("Invalid HTTP header: {key}"))?;
        headers.insert(name, val);
    }
    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| format!("Native HTTP initialization failed: {e}"))?;
    let mut request = client.request(method.clone(), url).headers(headers);
    if method != Method::GET && method != Method::HEAD {
        match command.body_mode.as_str() {
            "urlencoded" => {
                let pairs: Vec<(&str, &str)> = command
                    .form_fields
                    .iter()
                    .filter(|f| !f.key.is_empty())
                    .map(|f| (f.key.as_str(), f.value.as_deref().unwrap_or("")))
                    .collect();
                request = request.form(&pairs);
            }
            "multipart" => {
                let mut form = reqwest::multipart::Form::new();
                let mut total = 0usize;
                for field in &command.form_fields {
                    if field.key.is_empty() {
                        continue;
                    }
                    let mut part = if let Some(b64) = &field.base64 {
                        {
                            let data = decoded_file(b64)?;
                            total = total.saturating_add(data.len());
                            reqwest::multipart::Part::bytes(data)
                        }
                    } else {
                        let value = field.value.as_deref().unwrap_or("");
                        total = total.saturating_add(value.len());
                        reqwest::multipart::Part::text(value.to_string())
                    };
                    if total > MAX_UPLOAD_BYTES {
                        return Err("Multipart request exceeds 16 MiB".into());
                    }
                    if let Some(name) = &field.file_name {
                        part = part.file_name(name.clone());
                    }
                    if let Some(mime) = &field.content_type {
                        part = part
                            .mime_str(mime)
                            .map_err(|_| "Invalid upload content type".to_string())?;
                    }
                    form = form.part(field.key.clone(), part);
                }
                request = request.multipart(form);
            }
            "binary" => {
                let bytes = decoded_file(command.file_base64.as_deref().unwrap_or(""))?;
                request = request.body(bytes);
                if let Some(mime) = &command.content_type {
                    request = request.header(CONTENT_TYPE, mime);
                }
            }
            "raw" | "" => {
                if command.body.len() > MAX_UPLOAD_BYTES {
                    return Err("Request body exceeds 16 MiB".into());
                }
                request = request.body(command.body);
                if let Some(mime) = &command.content_type {
                    request = request.header(CONTENT_TYPE, mime);
                }
            }
            _ => return Err("Unsupported request body mode".into()),
        }
    }
    let start = Instant::now();
    let mut response = request
        .send()
        .await
        .map_err(|e| format!("Native request failed: {e}"))?;
    let headers_ms = start.elapsed().as_millis().min(u64::MAX as u128) as u64;
    let status = response.status();
    if status.is_redirection() {
        return Err("Redirect blocked. Send request to the destination URL directly.".into());
    }
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(name, value)| {
            (
                name.to_string(),
                value.to_str().unwrap_or("[binary header]").to_string(),
            )
        })
        .collect();
    let mut bytes = Vec::new();
    let mut truncated = false;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Response read failed: {e}"))?
    {
        let remaining = MAX_RESPONSE_BYTES - bytes.len();
        if chunk.len() > remaining {
            bytes.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        }
        bytes.extend_from_slice(&chunk);
        if bytes.len() == MAX_RESPONSE_BYTES {
            // A further chunk would exceed the cap; avoid buffering unbounded data.
            truncated = response
                .content_length()
                .map(|n| n > MAX_RESPONSE_BYTES as u64)
                .unwrap_or(true);
            break;
        }
    }
    let (body, is_binary) = match String::from_utf8(bytes.clone()) {
        Ok(text) => (text, false),
        Err(_) => (STANDARD.encode(&bytes), true),
    };
    let total_ms=start.elapsed().as_millis().min(u64::MAX as u128) as u64;
    Ok(NativeResponse {
        status_code: status.as_u16(),
        reason_phrase: status.canonical_reason().unwrap_or("").to_string(),
        elapsed_ms: total_ms,
        timing: NativeTiming{headers_ms,body_ms:total_ms.saturating_sub(headers_ms),total_ms},
        headers: response_headers,
        body,
        truncated,
        is_binary,
    })
}
