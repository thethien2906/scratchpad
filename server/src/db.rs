use std::{
    fs,
    path::Path,
    sync::{Arc, Mutex},
};

use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};

use crate::models::{ProfilePublic, Project, ProjectSummary};

#[derive(Clone)]
pub struct Db {
    connection: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(path: impl AsRef<Path>) -> SqlResult<Self> {
        let path = path.as_ref();
        if path != Path::new(":memory:") {
            if let Some(parent) = path
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
            {
                fs::create_dir_all(parent)
                    .map_err(|_| rusqlite::Error::InvalidPath(parent.to_owned()))?;
            }
        }

        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS profiles (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               name TEXT NOT NULL UNIQUE,
               avatar_color TEXT NOT NULL DEFAULT '#3b82f6',
               pin_hash TEXT NOT NULL,
               created_at TEXT NOT NULL DEFAULT (datetime('now')),
               updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE TABLE IF NOT EXISTS sessions (
               token_hash TEXT PRIMARY KEY,
               profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
               expires_at TEXT NOT NULL,
               created_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE INDEX IF NOT EXISTS idx_sessions_profile_id ON sessions (profile_id);
             CREATE TABLE IF NOT EXISTS general_scratchpad (
               profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
               content TEXT NOT NULL DEFAULT '',
               updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE TABLE IF NOT EXISTS projects (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
               name TEXT NOT NULL,
               content TEXT NOT NULL DEFAULT '',
               created_at TEXT NOT NULL DEFAULT (datetime('now')),
               updated_at TEXT NOT NULL DEFAULT (datetime('now'))
             );
             CREATE INDEX IF NOT EXISTS idx_projects_profile_updated
               ON projects (profile_id, updated_at DESC, id DESC);
             CREATE TABLE IF NOT EXISTS schedules (
               profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
               key TEXT NOT NULL,
               content TEXT NOT NULL DEFAULT '{}',
               updated_at TEXT NOT NULL DEFAULT (datetime('now')),
               PRIMARY KEY (profile_id, key)
             );",
        )?;

        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }

    fn with_connection<T>(
        &self,
        operation: impl FnOnce(&Connection) -> SqlResult<T>,
    ) -> SqlResult<T> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| rusqlite::Error::InvalidQuery)?;
        operation(&connection)
    }

    pub fn list_profiles(&self) -> SqlResult<Vec<ProfilePublic>> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT id, name, avatar_color FROM profiles ORDER BY name COLLATE NOCASE, id",
            )?;
            let profiles = statement
                .query_map([], profile_from_row)?
                .collect::<SqlResult<Vec<_>>>();
            profiles
        })
    }

    pub fn create_profile(
        &self,
        name: &str,
        avatar_color: &str,
        pin_hash: &str,
    ) -> SqlResult<ProfilePublic> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO profiles (name, avatar_color, pin_hash) VALUES (?1, ?2, ?3)",
                params![name, avatar_color, pin_hash],
            )?;
            let id = connection.last_insert_rowid();
            connection.query_row(
                "SELECT id, name, avatar_color FROM profiles WHERE id = ?1",
                [id],
                profile_from_row,
            )
        })
    }

    pub fn get_profile(&self, id: i64) -> SqlResult<Option<ProfilePublic>> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT id, name, avatar_color FROM profiles WHERE id = ?1",
                    [id],
                    profile_from_row,
                )
                .optional()
        })
    }

    pub fn profile_pin_hash(&self, id: i64) -> SqlResult<Option<String>> {
        self.with_connection(|connection| {
            connection
                .query_row("SELECT pin_hash FROM profiles WHERE id = ?1", [id], |row| {
                    row.get(0)
                })
                .optional()
        })
    }

    pub fn update_profile(
        &self,
        id: i64,
        name: Option<&str>,
        avatar_color: Option<&str>,
        pin_hash: Option<&str>,
    ) -> SqlResult<bool> {
        self.with_connection(|connection| {
            let affected = connection.execute(
                "UPDATE profiles
                 SET name = COALESCE(?1, name),
                     avatar_color = COALESCE(?2, avatar_color),
                     pin_hash = COALESCE(?3, pin_hash),
                     updated_at = datetime('now')
                 WHERE id = ?4",
                params![name, avatar_color, pin_hash, id],
            )?;
            Ok(affected > 0)
        })
    }

    pub fn delete_profile(&self, id: i64) -> SqlResult<bool> {
        self.with_connection(|connection| {
            Ok(connection.execute("DELETE FROM profiles WHERE id = ?1", [id])? > 0)
        })
    }

    pub fn create_session(
        &self,
        token_hash: &str,
        profile_id: i64,
        expires_at: &str,
    ) -> SqlResult<()> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (?1, ?2, ?3)",
                params![token_hash, profile_id, expires_at],
            )?;
            Ok(())
        })
    }

    pub fn session_profile(&self, token_hash: &str) -> SqlResult<Option<i64>> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT profile_id FROM sessions WHERE token_hash = ?1 AND expires_at > datetime('now')",
                    [token_hash],
                    |row| row.get(0),
                )
                .optional()
        })
    }

    pub fn delete_session(&self, token_hash: &str) -> SqlResult<()> {
        self.with_connection(|connection| {
            connection.execute("DELETE FROM sessions WHERE token_hash = ?1", [token_hash])?;
            Ok(())
        })
    }

    pub fn get_scratchpad(&self, profile_id: i64) -> SqlResult<String> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT OR IGNORE INTO general_scratchpad (profile_id, content) VALUES (?1, '')",
                [profile_id],
            )?;
            connection.query_row(
                "SELECT content FROM general_scratchpad WHERE profile_id = ?1",
                [profile_id],
                |row| row.get(0),
            )
        })
    }

    pub fn save_scratchpad(&self, profile_id: i64, content: &str) -> SqlResult<()> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO general_scratchpad (profile_id, content) VALUES (?1, ?2)
                 ON CONFLICT(profile_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')",
                params![profile_id, content],
            )?;
            Ok(())
        })
    }

    pub fn list_projects(&self, profile_id: i64) -> SqlResult<Vec<ProjectSummary>> {
        self.with_connection(|connection| {
            let mut statement = connection.prepare(
                "SELECT id, name, updated_at FROM projects WHERE profile_id = ?1 ORDER BY updated_at DESC, id DESC",
            )?;
            let projects = statement
                .query_map([profile_id], |row| {
                    Ok(ProjectSummary { id: row.get(0)?, name: row.get(1)?, updated_at: row.get(2)? })
                })?
                .collect::<SqlResult<Vec<_>>>();
            projects
        })
    }

    pub fn create_project(&self, profile_id: i64, name: &str) -> SqlResult<Project> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO projects (profile_id, name) VALUES (?1, ?2)",
                params![profile_id, name],
            )?;
            let id = connection.last_insert_rowid();
            connection.query_row(
                "SELECT id, name, content, created_at, updated_at FROM projects WHERE id = ?1 AND profile_id = ?2",
                params![id, profile_id],
                project_from_row,
            )
        })
    }

    pub fn get_project(&self, profile_id: i64, project_id: i64) -> SqlResult<Option<Project>> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT id, name, content, created_at, updated_at FROM projects WHERE id = ?1 AND profile_id = ?2",
                    params![project_id, profile_id],
                    project_from_row,
                )
                .optional()
        })
    }

    pub fn get_project_content(
        &self,
        profile_id: i64,
        project_id: i64,
    ) -> SqlResult<Option<String>> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT content FROM projects WHERE id = ?1 AND profile_id = ?2",
                    params![project_id, profile_id],
                    |row| row.get(0),
                )
                .optional()
        })
    }

    pub fn update_project_name(
        &self,
        profile_id: i64,
        project_id: i64,
        name: &str,
    ) -> SqlResult<bool> {
        self.with_connection(|connection| {
            Ok(connection.execute(
                "UPDATE projects SET name = ?1, updated_at = datetime('now') WHERE id = ?2 AND profile_id = ?3",
                params![name, project_id, profile_id],
            )? > 0)
        })
    }

    pub fn save_project_content(
        &self,
        profile_id: i64,
        project_id: i64,
        content: &str,
    ) -> SqlResult<bool> {
        self.with_connection(|connection| {
            Ok(connection.execute(
                "UPDATE projects SET content = ?1, updated_at = datetime('now') WHERE id = ?2 AND profile_id = ?3",
                params![content, project_id, profile_id],
            )? > 0)
        })
    }

    pub fn delete_project(&self, profile_id: i64, project_id: i64) -> SqlResult<bool> {
        self.with_connection(|connection| {
            Ok(connection.execute(
                "DELETE FROM projects WHERE id = ?1 AND profile_id = ?2",
                params![project_id, profile_id],
            )? > 0)
        })
    }

    pub fn get_schedule(&self, profile_id: i64, key: &str) -> SqlResult<String> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT content FROM schedules WHERE profile_id = ?1 AND key = ?2",
                    params![profile_id, key],
                    |row| row.get(0),
                )
                .optional()
                .map(|content| content.unwrap_or_else(|| "{}".to_owned()))
        })
    }

    pub fn save_schedule(&self, profile_id: i64, key: &str, content: &str) -> SqlResult<()> {
        self.with_connection(|connection| {
            connection.execute(
                "INSERT INTO schedules (profile_id, key, content) VALUES (?1, ?2, ?3)
                 ON CONFLICT(profile_id, key) DO UPDATE SET content = excluded.content, updated_at = datetime('now')",
                params![profile_id, key, content],
            )?;
            Ok(())
        })
    }

    pub fn delete_schedule(&self, profile_id: i64, key: &str) -> SqlResult<()> {
        self.with_connection(|connection| {
            connection.execute(
                "DELETE FROM schedules WHERE profile_id = ?1 AND key = ?2",
                params![profile_id, key],
            )?;
            Ok(())
        })
    }
}

fn profile_from_row(row: &rusqlite::Row<'_>) -> SqlResult<ProfilePublic> {
    Ok(ProfilePublic {
        id: row.get(0)?,
        name: row.get(1)?,
        avatar_color: row.get(2)?,
    })
}

fn project_from_row(row: &rusqlite::Row<'_>) -> SqlResult<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        content: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}
