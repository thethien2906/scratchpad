use std::{net::SocketAddr, path::Path};

use erwining_server::{
    auth::PinRateLimiter,
    config::Config,
    db::Db,
    routes::{app, AppState},
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    if config.database_path != Path::new(":memory:") {
        if let Some(parent) = config
            .database_path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            std::fs::create_dir_all(parent)?;
        }
    }
    let db = Db::open(&config.database_path)?;
    let address = SocketAddr::from(([0, 0, 0, 0], config.port));
    let state = AppState {
        db,
        config: config.clone(),
        rate_limiter: PinRateLimiter::default(),
    };
    let listener = tokio::net::TcpListener::bind(address).await?;

    tracing::info!(%address, database = %config.database_path.display(), "Erwining Web server listening");
    axum::serve(
        listener,
        app(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
