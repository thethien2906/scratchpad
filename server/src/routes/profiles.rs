use argon2::password_hash::Error as PasswordHashError;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use rusqlite::Error as SqlError;

use crate::{
    auth::{hash_pin, validate_pin, verify_pin, AuthenticatedProfile},
    models::{CreateProfileRequest, DeleteProfileRequest, ProfilePublic, UpdateProfileRequest},
};

use super::{internal_error, ApiError, AppState};

pub async fn list_profiles(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProfilePublic>>, ApiError> {
    state.db.list_profiles().map(Json).map_err(internal_error)
}

pub async fn create_profile(
    State(state): State<AppState>,
    Json(payload): Json<CreateProfileRequest>,
) -> Result<(StatusCode, Json<ProfilePublic>), ApiError> {
    if payload.admin_secret.as_deref() != Some(state.config.admin_secret.as_str()) {
        return Err(ApiError::coded(
            StatusCode::FORBIDDEN,
            "ADMIN_SECRET_INVALID",
            "Admin secret is missing or invalid",
        ));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Profile name is required",
        ));
    }
    if !validate_pin(&payload.pin) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "PIN must be exactly four digits",
        ));
    }

    let pin_hash =
        hash_pin(&payload.pin).map_err(|error: PasswordHashError| internal_error(error))?;
    let color = payload
        .avatar_color
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("#3b82f6");
    let profile = state
        .db
        .create_profile(name, color, &pin_hash)
        .map_err(map_profile_insert_error)?;
    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn update_current_profile(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<ProfilePublic>, ApiError> {
    let name = payload.name.as_deref().map(str::trim);
    if name.is_some_and(str::is_empty) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Profile name cannot be empty",
        ));
    }

    let mut new_pin_hash = None;
    if let Some(new_pin) = payload.new_pin.as_deref() {
        if !validate_pin(new_pin) {
            return Err(ApiError::new(
                StatusCode::BAD_REQUEST,
                "PIN must be exactly four digits",
            ));
        }
        let current_pin = payload.current_pin.as_deref().ok_or_else(|| {
            ApiError::new(
                StatusCode::BAD_REQUEST,
                "Current PIN is required to change the PIN",
            )
        })?;
        let stored_hash = state
            .db
            .profile_pin_hash(authenticated.profile_id)
            .map_err(internal_error)?
            .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Profile not found"))?;
        if !verify_pin(current_pin, &stored_hash) {
            return Err(ApiError::new(
                StatusCode::UNAUTHORIZED,
                "Current PIN is incorrect",
            ));
        }
        new_pin_hash = Some(hash_pin(new_pin).map_err(internal_error)?);
    }

    state
        .db
        .update_profile(
            authenticated.profile_id,
            name,
            payload.avatar_color.as_deref(),
            new_pin_hash.as_deref(),
        )
        .map_err(map_profile_insert_error)?;
    let profile = state
        .db
        .get_profile(authenticated.profile_id)
        .map_err(internal_error)?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Profile not found"))?;
    Ok(Json(profile))
}

pub async fn delete_current_profile(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Json(payload): Json<DeleteProfileRequest>,
) -> Result<axum::response::Response, ApiError> {
    if !validate_pin(&payload.pin) {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "PIN must be exactly four digits",
        ));
    }
    let stored_hash = state
        .db
        .profile_pin_hash(authenticated.profile_id)
        .map_err(internal_error)?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Profile not found"))?;
    if !verify_pin(&payload.pin, &stored_hash) {
        return Err(ApiError::new(StatusCode::UNAUTHORIZED, "PIN is incorrect"));
    }

    state
        .db
        .delete_profile(authenticated.profile_id)
        .map_err(internal_error)?;
    let cookie = super::auth_routes::clear_session_cookie(state.config.cookie_secure);
    Ok((
        StatusCode::NO_CONTENT,
        [(axum::http::header::SET_COOKIE, cookie)],
    )
        .into_response())
}

fn map_profile_insert_error(error: SqlError) -> ApiError {
    match error {
        SqlError::SqliteFailure(code, _)
            if code.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            ApiError::new(
                StatusCode::CONFLICT,
                "A profile with that name already exists",
            )
        }
        other => internal_error(other),
    }
}
