use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use async_trait::async_trait;
use axum::{
    extract::{ConnectInfo, FromRequestParts},
    http::{request::Parts, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use rand::{rngs::OsRng as RandomOsRng, RngCore};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::routes::AppState;

pub const SESSION_COOKIE: &str = "erwining_session";
const MAX_FAILED_ATTEMPTS: u32 = 5;
const LOCKOUT_DURATION: Duration = Duration::from_secs(300);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AuthenticatedProfile {
    pub profile_id: i64,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedProfile {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token =
            cookie_value(&parts.headers, SESSION_COOKIE).ok_or_else(|| api_unauthorized())?;
        let token_hash = hash_token(&token);
        let profile_id = state
            .db
            .session_profile(&token_hash)
            .map_err(|_| internal_error())?
            .ok_or_else(api_unauthorized)?;
        Ok(Self { profile_id })
    }
}

pub fn validate_pin(pin: &str) -> bool {
    pin.len() == 4 && pin.bytes().all(|byte| byte.is_ascii_digit())
}

pub fn hash_pin(pin: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map(|password_hash| password_hash.to_string())
}

pub fn verify_pin(pin: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed_hash| {
            Argon2::default()
                .verify_password(pin.as_bytes(), &parsed_hash)
                .is_ok()
        })
        .unwrap_or(false)
}

pub fn generate_session_token() -> String {
    let mut bytes = [0_u8; 32];
    RandomOsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

pub fn cookie_value(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
    headers
        .get(axum::http::header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .filter_map(|part| part.trim().split_once('='))
        .find_map(|(name, value)| (name == cookie_name).then(|| value.to_owned()))
}

#[derive(Clone, Default)]
pub struct PinRateLimiter {
    attempts: Arc<Mutex<HashMap<(String, i64), AttemptState>>>,
}

#[derive(Clone, Debug, Default)]
struct AttemptState {
    failures: u32,
    locked_until: Option<Instant>,
}

impl PinRateLimiter {
    pub fn check(&self, client_ip: &str, profile_id: i64) -> Result<(), u64> {
        let mut attempts = self.attempts.lock().expect("PIN limiter mutex poisoned");
        let key = (client_ip.to_owned(), profile_id);
        let Some(state) = attempts.get_mut(&key) else {
            return Ok(());
        };

        if let Some(locked_until) = state.locked_until {
            let remaining = locked_until
                .saturating_duration_since(Instant::now())
                .as_secs();
            if remaining > 0 {
                return Err(remaining.max(1));
            }
            state.failures = 0;
            state.locked_until = None;
        }
        Ok(())
    }

    pub fn record_failure(&self, client_ip: &str, profile_id: i64) {
        let mut attempts = self.attempts.lock().expect("PIN limiter mutex poisoned");
        let state = attempts
            .entry((client_ip.to_owned(), profile_id))
            .or_default();
        state.failures += 1;
        if state.failures >= MAX_FAILED_ATTEMPTS {
            state.locked_until = Some(Instant::now() + LOCKOUT_DURATION);
        }
    }

    pub fn clear(&self, client_ip: &str, profile_id: i64) {
        self.attempts
            .lock()
            .expect("PIN limiter mutex poisoned")
            .remove(&(client_ip.to_owned(), profile_id));
    }
}

pub fn client_ip(headers: &HeaderMap, connect_info: Option<ConnectInfo<SocketAddr>>) -> String {
    for header in ["x-forwarded-for", "x-real-ip"] {
        if let Some(value) = headers.get(header).and_then(|value| value.to_str().ok()) {
            let address = value.split(',').next().unwrap_or_default().trim();
            if !address.is_empty() {
                return address.to_owned();
            }
        }
    }
    connect_info
        .map(|ConnectInfo(address)| address.ip().to_string())
        .unwrap_or_else(|| "unknown".to_owned())
}

fn api_unauthorized() -> Response {
    auth_error(StatusCode::UNAUTHORIZED, "Authentication required")
}

fn internal_error() -> Response {
    auth_error(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
}

#[derive(Serialize)]
struct AuthError {
    error: String,
}

fn auth_error(status: StatusCode, error: &str) -> Response {
    (
        status,
        Json(AuthError {
            error: error.to_owned(),
        }),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_validation_requires_exactly_four_ascii_digits() {
        assert!(validate_pin("0042"));
        assert!(!validate_pin("123"));
        assert!(!validate_pin("12345"));
        assert!(!validate_pin("12a4"));
        assert!(!validate_pin("１２３４"));
    }

    #[test]
    fn rate_limiter_locks_after_five_failures_and_clears_on_success() {
        let limiter = PinRateLimiter::default();
        assert!(limiter.check("127.0.0.1", 7).is_ok());
        for _ in 0..5 {
            limiter.record_failure("127.0.0.1", 7);
        }
        assert!(limiter.check("127.0.0.1", 7).unwrap_err() > 0);
        assert!(limiter.check("127.0.0.2", 7).is_ok());
        limiter.clear("127.0.0.1", 7);
        assert!(limiter.check("127.0.0.1", 7).is_ok());
    }
}
