use tauri::State;
use crate::db::Database;
use crate::models::{Project, ProjectSummary};

pub struct AppState {
    pub db: Database,
}

// --- General Scratchpad Commands ---

#[tauri::command]
pub fn get_general_scratchpad(state: State<'_, AppState>) -> Result<String, String> {
    state.db.get_general_scratchpad()
}

#[tauri::command]
pub fn save_general_scratchpad(state: State<'_, AppState>, content: String) -> Result<(), String> {
    state.db.save_general_scratchpad(&content)
}

// --- Projects Commands ---

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<ProjectSummary>, String> {
    state.db.list_projects()
}

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, name: String) -> Result<Project, String> {
    state.db.create_project(&name)
}

#[tauri::command]
pub fn update_project_name(state: State<'_, AppState>, id: i64, name: String) -> Result<(), String> {
    state.db.update_project_name(id, &name)
}

#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_project(id)
}

#[tauri::command]
pub fn get_project(state: State<'_, AppState>, id: i64) -> Result<Project, String> {
    state.db.get_project(id)
}

#[tauri::command]
pub fn get_project_content(state: State<'_, AppState>, id: i64) -> Result<String, String> {
    state.db.get_project_content(id)
}

#[tauri::command]
pub fn save_project_content(state: State<'_, AppState>, id: i64, content: String) -> Result<(), String> {
    state.db.save_project_content(id, &content)
}
