pub mod commands;
pub mod db;
pub mod models;

use commands::AppState;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Failed to initialize SQLite database");

    tauri::Builder::default()
        .manage(AppState { db })
        .invoke_handler(tauri::generate_handler![
            commands::get_general_scratchpad,
            commands::save_general_scratchpad,
            commands::list_projects,
            commands::create_project,
            commands::update_project_name,
            commands::delete_project,
            commands::get_project,
            commands::get_project_content,
            commands::save_project_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
