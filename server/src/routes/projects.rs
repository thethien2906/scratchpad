use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{
    auth::AuthenticatedProfile,
    models::{ContentRequest, ContentResponse, NameRequest, Project, ProjectSummary},
};

use super::{internal_error, ApiError, AppState};

pub async fn list(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
) -> Result<Json<Vec<ProjectSummary>>, ApiError> {
    state
        .db
        .list_projects(authenticated.profile_id)
        .map(Json)
        .map_err(internal_error)
}

pub async fn create(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Json(payload): Json<NameRequest>,
) -> Result<(StatusCode, Json<Project>), ApiError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Project name is required",
        ));
    }
    let project = state
        .db
        .create_project(authenticated.profile_id, name)
        .map_err(internal_error)?;
    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn get(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(id): Path<i64>,
) -> Result<Json<Project>, ApiError> {
    state
        .db
        .get_project(authenticated.profile_id, id)
        .map_err(internal_error)?
        .map(Json)
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Project not found"))
}

pub async fn get_content(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(id): Path<i64>,
) -> Result<Json<ContentResponse>, ApiError> {
    let content = state
        .db
        .get_project_content(authenticated.profile_id, id)
        .map_err(internal_error)?
        .ok_or_else(|| ApiError::new(StatusCode::NOT_FOUND, "Project not found"))?;
    Ok(Json(ContentResponse { content }))
}

pub async fn rename(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(id): Path<i64>,
    Json(payload): Json<NameRequest>,
) -> Result<StatusCode, ApiError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "Project name is required",
        ));
    }
    let changed = state
        .db
        .update_project_name(authenticated.profile_id, id, name)
        .map_err(internal_error)?;
    if changed {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::new(StatusCode::NOT_FOUND, "Project not found"))
    }
}

pub async fn save_content(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(id): Path<i64>,
    Json(payload): Json<ContentRequest>,
) -> Result<StatusCode, ApiError> {
    let changed = state
        .db
        .save_project_content(authenticated.profile_id, id, &payload.content)
        .map_err(internal_error)?;
    if changed {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::new(StatusCode::NOT_FOUND, "Project not found"))
    }
}

pub async fn delete(
    State(state): State<AppState>,
    authenticated: AuthenticatedProfile,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    let deleted = state
        .db
        .delete_project(authenticated.profile_id, id)
        .map_err(internal_error)?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::new(StatusCode::NOT_FOUND, "Project not found"))
    }
}
