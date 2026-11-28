mod credential_vault;
mod database;
mod http;
mod profiles;
mod remote;
mod updates;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::InstallLock::default())
        .manage(remote::RemoteState::default())
        .manage(remote::socket::HubSockets::default())
        .manage(http::NativeCancellation::default())
        .invoke_handler(tauri::generate_handler![
            updates::check_pakpost_update,
            updates::install_pakpost_update,
            remote::begin_remote_sign_in,
            remote::poll_remote_sign_in,
            remote::desktop_remote_status,
            remote::restore_remote_session,
            remote::remember_remote_session,
            remote::forget_remote_session,
            remote::desktop_remembered_status,
            remote::desktop_remote_context,
            remote::cancel_remote_sign_in,
            remote::remote_hub_http,
            remote::socket::open_hub_socket,
            remote::socket::send_hub_socket,
            remote::socket::close_hub_socket,
            remote::remote_api,
            remote::disconnect_remote,
            database::load_local_collections,
            database::save_local_collections,
            database::load_local_environments,
            database::save_local_environments,
            database::load_local_history,
            database::save_local_history,
            http::send_native_http,
            http::reserve_native_http,
            http::cancel_native_http,
            http::send_cancelable_native_http,
            profiles::load_connection_profiles,
            profiles::save_connection_profiles
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
