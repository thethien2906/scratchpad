use axum::{extract::State, http::StatusCode, Json};

use crate::{
    auth::AuthenticatedProfile,
    models::{ContentRequest, ContentResponse},
};

use super::{internal_error, ApiError, AppState};

pub async fn get(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
) -> Result<Json<ContentResponse>, ApiError> {
    let content = state
        .db
        .get_scratchpad(authenticated.profile_id)
        .map_err(internal_error)?;
    Ok(Json(ContentResponse { content }))
}

pub async fn save(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Json(payload): Json<ContentRequest>,
) -> Result<StatusCode, ApiError> {
    state
        .db
        .save_scratchpad(authenticated.profile_id, &payload.content)
        .map_err(internal_error)?;
    Ok(StatusCode::NO_CONTENT)
}
