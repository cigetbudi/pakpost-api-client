//! Only the OS credential vault may contain persistent authentication secrets.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub(crate) struct RememberedSession {
    pub profile_id: String,
    pub origin: String,
    pub token: String,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("app.pakpost.desktop", "active-remote-session-v1")
        .map_err(|_| "System credential vault unavailable".into())
}
pub(crate) fn load() -> Result<Option<RememberedSession>, String> {
    match entry()?.get_password() {
        Ok(value) => serde_json::from_str(&value).map(Some).map_err(|_| "Invalid stored session".into()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("System credential vault unavailable".into()),
    }
}
pub(crate) fn save(value: &RememberedSession) -> Result<(), String> {
    let encoded = serde_json::to_string(value).map_err(|_| "Unable to encode session")?;
    entry()?.set_password(&encoded).map_err(|_| "Could not save session in system credential vault".into())
}
pub(crate) fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove session from system credential vault".into()),
    }
}
