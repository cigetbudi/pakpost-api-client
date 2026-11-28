//! Explicit user-initiated updates only. No JS-controlled endpoint or headers.
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, State, ipc::Channel};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct InstallLock(tokio::sync::Mutex<()>);

#[derive(Serialize)]
pub struct UpdateInfo {
    version: String,
}

async fn find_update(app: &AppHandle) -> Result<Option<Update>, String> {
    if cfg!(debug_assertions) {
        return Err("Updates are available in installed release builds only.".into());
    }
    app.updater_builder()
        .timeout(Duration::from_secs(30))
        .build().map_err(|_| "Updater configuration unavailable".to_string())?
        .check().await.map_err(|_| "Could not check the official release. Try again later or use the official downloads.".to_string())
}

#[tauri::command]
pub async fn check_pakpost_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    Ok(find_update(&app).await?.map(|update| UpdateInfo { version: update.version }))
}

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

#[tauri::command]
pub async fn install_pakpost_update(app: AppHandle, lock: State<'_, InstallLock>, version: String, progress: Channel<DownloadProgress>) -> Result<(), String> {
    let _guard = lock.0.try_lock().map_err(|_| "An update is already running".to_string())?;
    let update = find_update(&app).await?.ok_or("No update is available")?;
    if update.version != version {
        return Err("The release changed. Check for updates again.".into());
    }
    // Reject URLs outside the official repository before invoking the downloader.
    let expected = format!("https://github.com/cigetbudi/pakpost-api-client/releases/download/v{}/", update.version);
    if !update.download_url.as_str().starts_with(&expected) {
        return Err("Unexpected update download location".into());
    }
    let mut downloaded = 0u64;
    update.download_and_install(|size, total| {
        downloaded = downloaded.saturating_add(size as u64);
        let _ = progress.send(DownloadProgress { downloaded, total });
    }, || {}).await.map_err(|_| "Update download, signature verification or installation failed. Use the official installer if needed.".to_string())
}
