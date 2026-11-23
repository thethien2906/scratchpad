use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{
    auth::AuthenticatedProfile,
    models::{ContentRequest, ContentResponse},
};

use super::{internal_error, ApiError, AppState};

pub async fn get(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(key): Path<String>,
) -> Result<Json<ContentResponse>, ApiError> {
    let content = state
        .db
        .get_schedule(authenticated.profile_id, &key)
        .map_err(internal_error)?;
    Ok(Json(ContentResponse { content }))
}

pub async fn save(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(key): Path<String>,
    Json(payload): Json<ContentRequest>,
) -> Result<StatusCode, ApiError> {
    state
        .db
        .save_schedule(authenticated.profile_id, &key, &payload.content)
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(key): Path<String>,
) -> Result<StatusCode, ApiError> {
    state
        .db
        .delete_schedule(authenticated.profile_id, &key)
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
