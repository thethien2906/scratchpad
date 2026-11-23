use axum::{
    body::Body,
    http::{
        header::{CONTENT_TYPE, COOKIE, SET_COOKIE},
        Method, Request, StatusCode,
    },
    Router,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tempfile::TempDir;
use tower::ServiceExt;

use erwining_server::{
    auth::PinRateLimiter,
    config::Config,
    db::Db,
    routes::{app, AppState},
};

fn test_app() -> (Router, TempDir) {
    let directory = tempfile::tempdir().unwrap();
    let config = Config {
        port: 0,
        database_path: directory.path().join("data/test.sqlite"),
        static_dir: directory.path().join("dist"),
        cookie_secure: false,
        session_ttl_days: 30,
        admin_secret: "operator-secret".to_owned(),
    };
    std::fs::create_dir_all(&config.static_dir).unwrap();
    std::fs::write(config.static_dir.join("index.html"), "spa fallback").unwrap();
    let db = Db::open(&config.database_path).unwrap();
    let state = AppState {
        db,
        config,
        rate_limiter: PinRateLimiter::default(),
    };
    (app(state), directory)
}

async fn request(
    app: &Router,
    method: Method,
    path: &str,
    payload: Option<Value>,
    cookie: Option<&str>,
    ip: &str,
) -> axum::response::Response {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("x-forwarded-for", ip);
    if payload.is_some() {
        builder = builder.header(CONTENT_TYPE, "application/json");
    }
    if let Some(cookie) = cookie {
        builder = builder.header(COOKIE, cookie);
    }
    let body = payload
        .map(|value| Body::from(value.to_string()))
        .unwrap_or_else(Body::empty);
    app.clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap()
}

async fn json_body(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

async fn create_profile(app: &Router, name: &str, pin: &str) -> Value {
    let response = request(
        app,
        Method::POST,
        "/api/profiles",
        Some(json!({"name":name,"avatar_color":"#334455","pin":pin,"admin_secret":"operator-secret"})),
        None,
        "198.51.100.1",
    ).await;
    assert_eq!(response.status(), StatusCode::CREATED);
    json_body(response).await
}

async fn unlock(
    app: &Router,
    profile_id: i64,
    pin: &str,
    ip: &str,
) -> (StatusCode, Option<String>, Value) {
    let response = request(
        app,
        Method::POST,
        "/api/auth/unlock",
        Some(json!({"profile_id":profile_id,"pin":pin})),
        None,
        ip,
    )
    .await;
    let status = response.status();
    let cookie = response
        .headers()
        .get(SET_COOKIE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap().to_owned());
    let body = if status == StatusCode::NO_CONTENT {
        Value::Null
    } else {
        json_body(response).await
    };
    (status, cookie, body)
}

#[tokio::test]
async fn profile_creation_requires_admin_secret_and_valid_four_digit_pin() {
    let (app, _directory) = test_app();
    for payload in [
        json!({"name":"No secret","pin":"1234"}),
        json!({"name":"Wrong secret","pin":"1234","admin_secret":"wrong"}),
    ] {
        let response = request(
            &app,
            Method::POST,
            "/api/profiles",
            Some(payload),
            None,
            "198.51.100.1",
        )
        .await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(json_body(response).await["code"], "ADMIN_SECRET_INVALID");
    }

    for pin in ["123", "12345", "12a4"] {
        let response = request(
            &app,
            Method::POST,
            "/api/profiles",
            Some(json!({"name":"Invalid PIN","pin":pin,"admin_secret":"operator-secret"})),
            None,
            "198.51.100.1",
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    let created = create_profile(&app, "Writer", "0042").await;
    assert_eq!(created["name"], "Writer");
    assert!(created.get("pin_hash").is_none());
    let profiles = json_body(
        request(
            &app,
            Method::GET,
            "/api/profiles",
            None,
            None,
            "198.51.100.1",
        )
        .await,
    )
    .await;
    assert_eq!(profiles.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn profile_session_data_isolation_and_project_idor_checks() {
    let (app, _directory) = test_app();
    let profile_a = create_profile(&app, "Alpha", "1111").await;
    let profile_b = create_profile(&app, "Beta", "2222").await;
    let (status_a, cookie_a, _) = unlock(
        &app,
        profile_a["id"].as_i64().unwrap(),
        "1111",
        "198.51.100.10",
    )
    .await;
    let (status_b, cookie_b, _) = unlock(
        &app,
        profile_b["id"].as_i64().unwrap(),
        "2222",
        "198.51.100.11",
    )
    .await;
    assert_eq!(status_a, StatusCode::OK);
    assert_eq!(status_b, StatusCode::OK);
    let cookie_a = cookie_a.unwrap();
    let cookie_b = cookie_b.unwrap();

    let session_response = request(
        &app,
        Method::GET,
        "/api/auth/me",
        None,
        Some(&cookie_a),
        "198.51.100.10",
    )
    .await;
    assert_eq!(session_response.status(), StatusCode::OK);
    assert!(
        session_response.headers().is_empty()
            || session_response.headers().get(SET_COOKIE).is_none()
    );
    assert_eq!(json_body(session_response).await["id"], profile_a["id"]);

    assert_eq!(
        request(
            &app,
            Method::PUT,
            "/api/scratchpad",
            Some(json!({"content":"alpha note"})),
            Some(&cookie_a),
            "198.51.100.10"
        )
        .await
        .status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        request(
            &app,
            Method::PUT,
            "/api/scratchpad",
            Some(json!({"content":"beta note"})),
            Some(&cookie_b),
            "198.51.100.11"
        )
        .await
        .status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        json_body(
            request(
                &app,
                Method::GET,
                "/api/scratchpad",
                None,
                Some(&cookie_a),
                "198.51.100.10"
            )
            .await
        )
        .await["content"],
        "alpha note"
    );
    assert_eq!(
        json_body(
            request(
                &app,
                Method::GET,
                "/api/scratchpad",
                None,
                Some(&cookie_b),
                "198.51.100.11"
            )
            .await
        )
        .await["content"],
        "beta note"
    );

    assert_eq!(
        request(
            &app,
            Method::PUT,
            "/api/schedules/routine",
            Some(json!({"content":"alpha schedule"})),
            Some(&cookie_a),
            "198.51.100.10"
        )
        .await
        .status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        json_body(
            request(
                &app,
                Method::GET,
                "/api/schedules/routine",
                None,
                Some(&cookie_b),
                "198.51.100.11"
            )
            .await
        )
        .await["content"],
        "{}"
    );
    assert_eq!(
        request(
            &app,
            Method::PUT,
            "/api/schedules/routine",
            Some(json!({"content":"beta schedule"})),
            Some(&cookie_b),
            "198.51.100.11"
        )
        .await
        .status(),
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        json_body(
            request(
                &app,
                Method::GET,
                "/api/schedules/routine",
                None,
                Some(&cookie_a),
                "198.51.100.10"
            )
            .await
        )
        .await["content"],
        "alpha schedule"
    );

    let own_project = request(
        &app,
        Method::POST,
        "/api/projects",
        Some(json!({"name":"Alpha project"})),
        Some(&cookie_a),
        "198.51.100.10",
    )
    .await;
    assert_eq!(own_project.status(), StatusCode::CREATED);
    let own_project_id = json_body(own_project).await["id"].as_i64().unwrap();
    let other_project = request(
        &app,
        Method::POST,
        "/api/projects",
        Some(json!({"name":"Beta project"})),
        Some(&cookie_b),
        "198.51.100.11",
    )
    .await;
    assert_eq!(other_project.status(), StatusCode::CREATED);
    let other_project_id = json_body(other_project).await["id"].as_i64().unwrap();

    let listed_a = json_body(
        request(
            &app,
            Method::GET,
            "/api/projects",
            None,
            Some(&cookie_a),
            "198.51.100.10",
        )
        .await,
    )
    .await;
    assert_eq!(listed_a.as_array().unwrap().len(), 1);
    assert_eq!(listed_a[0]["id"], own_project_id);

    for (method, suffix, payload) in [
        (Method::GET, "", None),
        (Method::GET, "/content", None),
        (Method::PUT, "/content", Some(json!({"content":"stolen"}))),
        (Method::PATCH, "/name", Some(json!({"name":"stolen"}))),
        (Method::DELETE, "", None),
    ] {
        let path = format!("/api/projects/{other_project_id}{suffix}");
        let response = request(
            &app,
            method.clone(),
            &path,
            payload,
            Some(&cookie_a),
            "198.51.100.10",
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {path}");
    }
    assert_eq!(
        json_body(
            request(
                &app,
                Method::GET,
                &format!("/api/projects/{other_project_id}"),
                None,
                Some(&cookie_b),
                "198.51.100.11"
            )
            .await
        )
        .await["name"],
        "Beta project"
    );

    let unauthenticated = request(
        &app,
        Method::GET,
        "/api/projects",
        None,
        None,
        "198.51.100.12",
    )
    .await;
    assert_eq!(unauthenticated.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn bad_pin_is_rate_limited_and_successful_auth_uses_http_only_session_cookie() {
    let (app, _directory) = test_app();
    let profile = create_profile(&app, "Rate limited", "7351").await;
    let profile_id = profile["id"].as_i64().unwrap();
    for attempt in 0..5 {
        let (status, _, _) = unlock(&app, profile_id, "9999", "203.0.113.25").await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "failed attempt {attempt}");
    }
    let (status, _, body) = unlock(&app, profile_id, "9999", "203.0.113.25").await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert!(body["retry_after_seconds"].as_u64().unwrap() > 0);

    let (status, _, _) = unlock(&app, profile_id, "7351", "203.0.113.26").await;
    assert_eq!(status, StatusCode::OK);
    let response = request(
        &app,
        Method::POST,
        "/api/auth/unlock",
        Some(json!({"profile_id":profile_id,"pin":"7351"})),
        None,
        "203.0.113.27",
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let cookie = response
        .headers()
        .get(SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap();
    assert!(cookie.starts_with("erwining_session="));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Lax"));
    assert!(cookie.contains("Max-Age=2592000"));
}

#[tokio::test]
async fn logout_expires_cookie_and_invalidates_the_session() {
    let (app, _directory) = test_app();
    let profile = create_profile(&app, "Session", "5678").await;
    let (status, cookie, _) =
        unlock(&app, profile["id"].as_i64().unwrap(), "5678", "192.0.2.22").await;
    assert_eq!(status, StatusCode::OK);
    let cookie = cookie.unwrap();

    let logout = request(
        &app,
        Method::POST,
        "/api/auth/logout",
        None,
        Some(&cookie),
        "192.0.2.22",
    )
    .await;
    assert_eq!(logout.status(), StatusCode::NO_CONTENT);
    assert!(logout
        .headers()
        .get(SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .contains("Max-Age=0"));
    let me = request(
        &app,
        Method::GET,
        "/api/auth/me",
        None,
        Some(&cookie),
        "192.0.2.22",
    )
    .await;
    assert_eq!(me.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn profile_can_change_pin_and_delete_itself_and_static_routes_fall_back_to_spa() {
    let (app, _directory) = test_app();
    let profile = create_profile(&app, "Before rename", "2468").await;
    let profile_id = profile["id"].as_i64().unwrap();
    let (status, cookie, _) = unlock(&app, profile_id, "2468", "192.0.2.40").await;
    assert_eq!(status, StatusCode::OK);
    let cookie = cookie.unwrap();

    let update = request(
        &app,
        Method::PATCH,
        "/api/profiles/current",
        Some(json!({"name":"After rename","avatar_color":"#123456","current_pin":"2468","new_pin":"1357"})),
        Some(&cookie),
        "192.0.2.40",
    ).await;
    assert_eq!(update.status(), StatusCode::OK);
    assert_eq!(json_body(update).await["name"], "After rename");
    assert_eq!(
        unlock(&app, profile_id, "2468", "192.0.2.41").await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        unlock(&app, profile_id, "1357", "192.0.2.41").await.0,
        StatusCode::OK
    );

    let delete = request(
        &app,
        Method::DELETE,
        "/api/profiles/current",
        Some(json!({"pin":"1357"})),
        Some(&cookie),
        "192.0.2.40",
    )
    .await;
    assert_eq!(delete.status(), StatusCode::NO_CONTENT);
    assert!(delete
        .headers()
        .get(SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .contains("Max-Age=0"));
    assert_eq!(
        request(
            &app,
            Method::GET,
            "/api/auth/me",
            None,
            Some(&cookie),
            "192.0.2.40"
        )
        .await
        .status(),
        StatusCode::UNAUTHORIZED
    );
    assert!(
        json_body(request(&app, Method::GET, "/api/profiles", None, None, "192.0.2.40").await)
            .await
            .as_array()
            .unwrap()
            .is_empty()
    );

    let fallback = request(
        &app,
        Method::GET,
        "/workspace/notes/entry",
        None,
        None,
        "192.0.2.40",
    )
    .await;
    assert_eq!(fallback.status(), StatusCode::OK);
    let body = fallback.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&body[..], b"spa fallback");
}
