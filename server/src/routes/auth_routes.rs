use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, State},
    http::{header::SET_COOKIE, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{Duration, Utc};

use crate::{
    auth::{
        client_ip, generate_session_token, hash_token, validate_pin, verify_pin,
        AuthenticatedProfile, SESSION_COOKIE,
    },
    models::{ProfilePublic, UnlockRequest},
};

use super::{internal_error, ApiError, AppState};

pub async fn unlock(
    State(state): State<AppState>,
    headers: HeaderMap,
    connect_info: Option<ConnectInfo<SocketAddr>>,
    Json(payload): Json<UnlockRequest>,
) -> Result<Response, ApiError> {
    if !validate_pin(&payload.pin) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "PIN must be exactly four digits",
        ));
    }

    let ip = client_ip(&headers, connect_info);
    if let Err(seconds) = state.rate_limiter.check(&ip, payload.profile_id) {
        return Err(ApiError::rate_limited(seconds));
    }

    let stored_hash = state
        .db
        .profile_pin_hash(payload.profile_id)
        .map_err(internal_error)?;
    let Some(stored_hash) = stored_hash else {
        state.rate_limiter.record_failure(&ip, payload.profile_id);
        return Err(ApiError::new(StatusCode::UNAUTHORIZED, "Incorrect PIN"));
    };
    if !verify_pin(&payload.pin, &stored_hash) {
        state.rate_limiter.record_failure(&ip, payload.profile_id);
        return Err(ApiError::new(StatusCode::UNAUTHORIZED, "Incorrect PIN"));
    }

    state.rate_limiter.clear(&ip, payload.profile_id);
    let token = generate_session_token();
    let token_hash = hash_token(&token);
    let expires_at = (Utc::now() + Duration::days(state.config.session_ttl_days))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    state
        .db
        .create_session(&token_hash, payload.profile_id, &expires_at)
        .map_err(internal_error)?;
    let profile = state
        .db
        .get_profile(payload.profile_id)
        .map_err(internal_error)?
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Profile no longer exists"))?;

    let max_age = state.config.session_ttl_days.saturating_mul(24 * 60 * 60);
    let mut cookie =
        format!("{SESSION_COOKIE}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}");
    if state.config.cookie_secure {
        cookie.push_str("; Secure");
    }
    Ok((StatusCode::OK, [(SET_COOKIE, cookie)], Json(profile)).into_response())
}

pub async fn me(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
) -> Result<Json<ProfilePublic>, ApiError> {
    state
        .db
        .get_profile(authenticated.profile_id)
        .map_err(internal_error)?
        .map(Json)
        .ok_or_else(|| ApiError::new(StatusCode::UNAUTHORIZED, "Profile no longer exists"))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    if let Some(token) = crate::auth::cookie_value(&headers, SESSION_COOKIE) {
        let token_hash = hash_token(&token);
        state
            .db
            .delete_session(&token_hash)
            .map_err(internal_error)?;
    }
    Ok((
        StatusCode::NO_CONTENT,
        [(SET_COOKIE, clear_session_cookie(state.config.cookie_secure))],
    )
        .into_response())
}

pub(super) fn clear_session_cookie(secure: bool) -> String {
    let mut cookie = format!("{SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    if secure {
        cookie.push_str("; Secure");
    }
    cookie
}
