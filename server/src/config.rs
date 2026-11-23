use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_path: PathBuf,
    pub static_dir: PathBuf,
    pub cookie_secure: bool,
    pub session_ttl_days: i64,
    pub admin_secret: String,
}

impl Config {
    pub fn from_env() -> Self {
        let admin_secret = env_string("ADMIN_SECRET", "create_profile");
        Self {
            port: env_value("PORT", 8080),
            database_path: PathBuf::from(env_string("DATABASE_PATH", "./data/erwining.db")),
            static_dir: PathBuf::from(env_string("STATIC_DIR", "./dist")),
            cookie_secure: env_string("COOKIE_SECURE", "false")
                .parse::<bool>()
                .unwrap_or(false),
            session_ttl_days: env_value("SESSION_TTL_DAYS", 30_i64).max(1),
            admin_secret: if admin_secret.is_empty() {
                "create_profile".to_owned()
            } else {
                admin_secret
            },
        }
    }
}

fn env_string(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_owned())
}

fn env_value<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}
