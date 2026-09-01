# Technical Architecture — Minimalist Desktop Note & Project App

## 1. Công nghệ tổng quan (Tech Stack)

| Tầng (Layer) | Công nghệ | Lý do lựa chọn |
| :--- | :--- | :--- |
| **Desktop Runtime** | **Tauri v2 (Rust)** | Siêu nhẹ (~30-50MB RAM), hiệu năng cực cao, khởi động tức thì, tối ưu tuyệt đối cho Linux |
| **Frontend Framework** | **React 18 + TypeScript + Vite** | Quản lý UI mượt mà, type-safety, hot-reloading nhanh |
| **Styling** | **Tailwind CSS** | Xây dựng giao diện Minimalist linh hoạt theo hệ thống spacing và color palette cố định |
| **Database** | **SQLite (via `rusqlite` / `sqlx` in Rust)** | Lưu trữ dữ liệu dạng single-file local database, an toàn giao dịch (ACID), không phụ thuộc server |
| **Icons** | **Lucide React** | Icon outline đơn giản, đường nét mảnh và nhất quán |

---

## 2. Kiến trúc Hệ thống (System Architecture)

```
+-------------------------------------------------------------------+
|                        FRONTEND (React + Vite)                    |
|                                                                   |
|   +--------------------------+  +-------------------------------+  |
|   |         Sidebar          |  |         Editor Area           |  |
|   |  - General Scratchpad    |  |  - Auto-growing Textarea /    |  |
|   |  - Project List & Input  |  |    Markdown Editor            |  |
|   |  - Project Actions       |  |  - Auto-save Indicator (Quiet)|  |
|   +--------------------------+  +-------------------------------+  |
|                 \                              /                  |
|                  \                            /                   |
|                   +--------------------------+                    |
|                   |  State & useAutoSave()   |                    |
|                   +--------------------------+                    |
+---------------------------------|---------------------------------+
                                  | Tauri IPC (invoke)
+---------------------------------v---------------------------------+
|                        BACKEND (Tauri / Rust)                     |
|                                                                   |
|   +-------------------------------------------------------------+ |
|   |                  Tauri Command Handlers                     | |
|   |   - get_general_scratchpad() / save_general_scratchpad()    | |
|   |   - list_projects() / create_project() / delete_project()   | |
|   |   - get_project_content() / save_project_content()          | |
|   +-------------------------------------------------------------+ |
|                                 |                                 |
|   +-----------------------------v-------------------------------+ |
|   |                   Database Service (rusqlite)               | |
|   |   - Connection pool / Single connection mutex               | |
|   |   - Schema migrations / Initializer                         | |
|   +-------------------------------------------------------------+ |
+---------------------------------|---------------------------------+
                                  |
                   +--------------v---------------+
                   |   Local SQLite DB File       |
                   |   ~/.local/share/erwining/   |
                   |   erwining.db                |
                   +------------------------------+
```

---

## 3. Thiết kế Cơ sở Dữ liệu (Database Schema)

Dữ liệu được lưu trong 1 file SQLite duy nhất tại thư mục dữ liệu chuẩn của ứng dụng trên Linux (`~/.local/share/erwining/erwining.db` hoặc `app_data_dir`).

### Bảng 1: `general_scratchpad`
Lưu trữ nội dung nháp chung (chỉ có duy nhất 1 bản ghi với `id = 1`).

```sql
CREATE TABLE IF NOT EXISTS general_scratchpad (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Khởi tạo bản ghi mặc định ban đầu nếu chưa tồn tại
INSERT OR IGNORE INTO general_scratchpad (id, content) VALUES (1, '');
```

### Bảng 2: `projects`
Lưu danh sách dự án và nội dung ghi chú/kế hoạch tương ứng của từng dự án.

```sql
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects (updated_at DESC);
```

---

## 4. Tauri IPC API (Rust Commands)

Frontend giao tiếp với Rust backend thông qua các lệnh IPC bất đồng bộ:

```rust
// 1. General Scratchpad
#[tauri::command]
fn get_general_scratchpad() -> Result<String, String>;

#[tauri::command]
fn save_general_scratchpad(content: String) -> Result<(), String>;

// 2. Projects Management
#[tauri::command]
fn list_projects() -> Result<Vec<ProjectSummary>, String>;

#[tauri::command]
fn create_project(name: String) -> Result<Project, String>;

#[tauri::command]
fn update_project_name(id: i64, name: String) -> Result<(), String>;

#[tauri::command]
fn delete_project(id: i64) -> Result<(), String>;

// 3. Project Content (Scratchpad)
#[tauri::command]
fn get_project_content(id: i64) -> Result<String, String>;

#[tauri::command]
fn save_project_content(id: i64, content: String) -> Result<(), String>;
```

---

## 5. Cơ chế Tự động lưu (Auto-Save & Data Integrity)

1. **Debounce Auto-save**:
   - Khi người dùng gõ phím trong Editor, React hook `useAutoSave` sẽ đợi **500ms** sau lần nhấn phím cuối cùng để gửi lệnh `save_*` xuống Rust backend.
2. **Lưu trước khi chuyển tab (Flush on blur / switch)**:
   - Khi người dùng chuyển từ General Scratchpad sang một Project (hoặc đóng ứng dụng), dữ liệu chưa lưu sẽ được lập tức flush/commit xuống database mà không chờ hết debounce time.
3. **Optimistic State & Status Indicator**:
   - Giao diện có 1 chỉ báo trạng thái cực kỳ tinh tế ở góc dưới (`Saved` / `Saving...` / `Error`).

---

## 6. Cấu trúc Thư mục Dự án Dự kiến

```
erwining/
├── src-tauri/                 # Backend Rust (Tauri core & SQLite)
│   ├── src/
│   │   ├── db.rs              # SQLite connection & Schema initialization
│   │   ├── commands.rs        # Tauri IPC commands
│   │   ├── models.rs          # Rust structs (Project, Scratchpad)
│   │   └── main.rs            # Tauri setup & entry point
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                       # Frontend React (TypeScript + Vite)
│   ├── components/
│   │   ├── Sidebar.tsx        # Danh sách Project + Mục General Scratchpad
│   │   ├── Editor.tsx         # Khung viết tối giản + Auto-resize textarea
│   │   ├── ProjectModal.tsx   # Hoặc Inline Input để tạo Project mới
│   │   └── SaveStatus.tsx     # Chỉ báo trạng thái lưu kín đáo
│   ├── hooks/
│   │   ├── useAutoSave.ts     # Hook debounce auto-save
│   │   └── useProjects.ts     # Hook fetch & CRUD projects
│   ├── types/
│   │   └── index.ts           # Type definitions
│   ├── App.tsx                # Main Layout 2 cột
│   ├── main.tsx
│   └── index.css              # Tailwind CSS & Typography base
├── overview.md
├── architecture.md
├── design-style.md
├── package.json
├── tailwind.config.js
└── vite.config.ts
```
