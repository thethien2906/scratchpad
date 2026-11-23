mod auth_routes;
mod profiles;
mod projects;
mod schedules;
mod scratchpad;

use std::path::PathBuf;

use axum::{
    http::StatusCode,
    routing::{get, patch, post},
    Json, Router,
};
use serde::Serialize;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::{auth::PinRateLimiter, config::Config, db::Db};

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub config: Config,
    pub rate_limiter: PinRateLimiter,
}

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub error: String,
    pub code: Option<String>,
    pub retry_after_seconds: Option<u64>,
}

#[derive(Serialize)]
struct ApiErrorBody {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    retry_after_seconds: Option<u64>,
}

impl ApiError {
    pub fn new(status: StatusCode, error: impl Into<String>) -> Self {
        Self {
            status,
            error: error.into(),
            code: None,
            retry_after_seconds: None,
        }
    }

    pub fn coded(status: StatusCode, code: &str, error: impl Into<String>) -> Self {
        Self {
            status,
            error: error.into(),
            code: Some(code.to_owned()),
            retry_after_seconds: None,
        }
    }

    pub fn rate_limited(seconds: u64) -> Self {
        Self {
            status: StatusCode::TOO_MANY_REQUESTS,
            error: "Too many failed attempts".to_owned(),
            code: None,
            retry_after_seconds: Some(seconds),
        }
    }
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(ApiErrorBody {
                error: self.error,
                code: self.code,
                retry_after_seconds: self.retry_after_seconds,
            }),
        )
            .into_response()
    }
}

pub fn app(state: AppState) -> Router {
    let static_dir: PathBuf = state.config.static_dir.clone();
    let api = Router::new()
        .route(
            "/profiles",
            get(profiles::list_profiles).post(profiles::create_profile),
        )
        .route(
            "/profiles/current",
            patch(profiles::update_current_profile).delete(profiles::delete_current_profile),
        )
        .route("/auth/unlock", post(auth_routes::unlock))
        .route("/auth/me", get(auth_routes::me))
        .route("/auth/logout", post(auth_routes::logout))
        .route("/scratchpad", get(scratchpad::get).put(scratchpad::save))
        .route("/projects", get(projects::list).post(projects::create))
        .route(
            "/projects/:id/content",
            get(projects::get_content).put(projects::save_content),
        )
        .route("/projects/:id/name", patch(projects::rename))
        .route("/projects/:id", get(projects::get).delete(projects::delete))
        .route(
            "/schedules/:key",
            get(schedules::get)
                .put(schedules::save)
                .delete(schedules::delete),
        );

    Router::new()
        .nest("/api", api)
        .fallback_service(
            ServeDir::new(&static_dir).fallback(ServeFile::new(static_dir.join("index.html"))),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub(crate) fn internal_error(error: impl std::fmt::Display) -> ApiError {
    tracing::error!(%error, "database operation failed");
    ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
}
