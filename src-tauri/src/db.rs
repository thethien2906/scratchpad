use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use crate::models::{Project, ProjectSummary};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Initialize database connection and run schema migrations
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = Self::get_db_path();
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    /// Helper for testing with in-memory SQLite connection
    #[allow(dead_code)]
    pub fn new_in_memory() -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn get_db_path() -> PathBuf {
        if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("erwining")
                .join("erwining.db")
        } else if let Ok(appdata) = std::env::var("APPDATA") {
            PathBuf::from(appdata)
                .join("erwining")
                .join("erwining.db")
        } else {
            PathBuf::from("erwining.db")
        }
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 1. General scratchpad table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS general_scratchpad (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );",
            [],
        )?;

        // Ensure default row exists
        conn.execute(
            "INSERT OR IGNORE INTO general_scratchpad (id, content) VALUES (1, '');",
            [],
        )?;

        // 2. Projects table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
            );",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects (updated_at DESC);",
            [],
        )?;

        Ok(())
    }

    // --- General Scratchpad Methods ---

    pub fn get_general_scratchpad(&self) -> Result<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT content FROM general_scratchpad WHERE id = 1;")
            .map_err(|e| e.to_string())?;
        
        let content: String = stmt
            .query_row([], |row| row.get(0))
            .unwrap_or_else(|_| "".to_string());

        Ok(content)
    }

    pub fn save_general_scratchpad(&self, content: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO general_scratchpad (id, content, updated_at) 
             VALUES (1, ?1, datetime('now', 'localtime'))
             ON CONFLICT(id) DO UPDATE SET 
                content = excluded.content,
                updated_at = datetime('now', 'localtime');",
            params![content],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    // --- Projects Methods ---

    pub fn list_projects(&self) -> Result<Vec<ProjectSummary>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC, id DESC;")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(ProjectSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut projects = Vec::new();
        for p in rows {
            if let Ok(proj) = p {
                projects.push(proj);
            }
        }
        Ok(projects)
    }

    pub fn create_project(&self, name: &str) -> Result<Project, String> {
        let clean_name = name.trim();
        if clean_name.is_empty() {
            return Err("Project name cannot be empty".to_string());
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (name, content) VALUES (?1, '');",
            params![clean_name],
        )
        .map_err(|e| e.to_string())?;

        let last_id = conn.last_insert_rowid();
        let mut stmt = conn
            .prepare("SELECT id, name, content, created_at, updated_at FROM projects WHERE id = ?1;")
            .map_err(|e| e.to_string())?;

        let project = stmt
            .query_row(params![last_id], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        Ok(project)
    }

    pub fn update_project_name(&self, id: i64, name: &str) -> Result<(), String> {
        let clean_name = name.trim();
        if clean_name.is_empty() {
            return Err("Project name cannot be empty".to_string());
        }

        let conn = self.conn.lock().unwrap();
        let rows = conn
            .execute(
                "UPDATE projects SET name = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2;",
                params![clean_name, id],
            )
            .map_err(|e| e.to_string())?;

        if rows == 0 {
            return Err(format!("Project with ID {} not found", id));
        }

        Ok(())
    }

    pub fn delete_project(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let rows = conn
            .execute("DELETE FROM projects WHERE id = ?1;", params![id])
            .map_err(|e| e.to_string())?;

        if rows == 0 {
            return Err(format!("Project with ID {} not found", id));
        }

        Ok(())
    }

    pub fn get_project(&self, id: i64) -> Result<Project, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, name, content, created_at, updated_at FROM projects WHERE id = ?1;")
            .map_err(|e| e.to_string())?;

        let project = stmt
            .query_row(params![id], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        Ok(project)
    }

    pub fn get_project_content(&self, id: i64) -> Result<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT content FROM projects WHERE id = ?1;")
            .map_err(|e| e.to_string())?;

        let content: String = stmt
            .query_row(params![id], |row| row.get(0))
            .map_err(|_| format!("Project with ID {} not found", id))?;

        Ok(content)
    }

    pub fn save_project_content(&self, id: i64, content: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let rows = conn
            .execute(
                "UPDATE projects SET content = ?1, updated_at = datetime('now', 'localtime') WHERE id = ?2;",
                params![content, id],
            )
            .map_err(|e| e.to_string())?;

        if rows == 0 {
            return Err(format!("Project with ID {} not found", id));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_general_scratchpad_crud() {
        let db = Database::new_in_memory().unwrap();
        
        // Initial state should be empty string
        let initial = db.get_general_scratchpad().unwrap();
        assert_eq!(initial, "");

        // Save content
        db.save_general_scratchpad("Hello World Brainstorming").unwrap();
        let updated = db.get_general_scratchpad().unwrap();
        assert_eq!(updated, "Hello World Brainstorming");

        // Overwrite content
        db.save_general_scratchpad("New idea for 2026").unwrap();
        let overwritten = db.get_general_scratchpad().unwrap();
        assert_eq!(overwritten, "New idea for 2026");
    }

    #[test]
    fn test_projects_crud_and_scratchpad() {
        let db = Database::new_in_memory().unwrap();

        // 1. Create project
        let proj = db.create_project("Project Alpha").unwrap();
        assert_eq!(proj.name, "Project Alpha");
        assert_eq!(proj.content, "");
        assert_eq!(proj.id, 1);

        // 2. List projects
        let list = db.list_projects().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "Project Alpha");

        // 3. Save project content
        db.save_project_content(proj.id, "# Alpha Plan\n- Step 1\n- Step 2").unwrap();
        let content = db.get_project_content(proj.id).unwrap();
        assert_eq!(content, "# Alpha Plan\n- Step 1\n- Step 2");

        // 4. Update project name
        db.update_project_name(proj.id, "Project Alpha V2").unwrap();
        let updated_proj = db.get_project(proj.id).unwrap();
        assert_eq!(updated_proj.name, "Project Alpha V2");

        // 5. Delete project
        db.delete_project(proj.id).unwrap();
        let list_after = db.list_projects().unwrap();
        assert_eq!(list_after.len(), 0);
    }
}
