# Implementation Plan — Minimalist Desktop Note & Project App

Lộ trình chi tiết từng bước (step-by-step roadmap) từ khởi tạo dự án đến khi đóng gói hoàn thiện ứng dụng trên Linux Desktop.

---

## 🎯 Mục tiêu dự án
Xây dựng ứng dụng Desktop siêu nhẹ trên Linux bằng **Tauri v2 + React (TypeScript) + TailwindCSS + SQLite**, tuân thủ nghiêm ngặt triết lý thiết kế trong [`design-style.md`](file:///home/jacktheripper/code/personal/erwining/design-style.md) và yêu cầu chức năng trong [`overview.md`](file:///home/jacktheripper/code/personal/erwining/overview.md).

---

## 📅 Các giai đoạn triển khai (Phases)

### Giai đoạn 1: Khởi tạo Dự án & Cấu hình Môi trường (Setup & Tooling)
- [x] **Bước 1.1: Khởi tạo Tauri v2 Project**
  - Khởi tạo project Tauri + React (TypeScript) + Vite trong thư mục hiện tại.
  - Cấu hình file `tauri.conf.json` (kích thước cửa sổ mặc định, title bar tối giản, app identifier `com.erwining.app`).
- [x] **Bước 1.2: Cấu hình Tailwind CSS & Styling System**
  - Cài đặt `tailwindcss`, `postcss`, `autoprefixer`.
  - Thiết lập cấu hình bảng màu (Color Palette) và Typography đúng theo chuẩn trong [`design-style.md`](file:///home/jacktheripper/code/personal/erwining/design-style.md).
  - Cài đặt thư viện icon: `lucide-react`.
- [x] **Bước 1.3: Cài đặt Dependencies Backend Rust**
  - Cập nhật `src-tauri/Cargo.toml` với các crate:
    - `rusqlite` (với tính năng `bundled` để đảm bảo tương thích mọi bản phân phối Linux mà không cần cài thêm thư viện hệ thống).
    - `serde`, `serde_json`.

---

### Giai đoạn 2: Phát triển Tầng Dữ liệu & Rust Core (Backend & SQLite)
- [x] **Bước 2.1: Thiết kế & Khởi tạo CSDL SQLite (`src-tauri/src/db.rs`)**
  - Tạo hàm lấy đường dẫn thư mục lưu trữ dữ liệu chuẩn của app (`app_data_dir`/`erwining.db`).
  - Tự động chạy migration tạo bảng khi khởi động:
    - Bảng `general_scratchpad` (id = 1, content, updated_at).
    - Bảng `projects` (id, name, content, created_at, updated_at).
- [x] **Bước 2.2: Xây dựng Rust Models & IPC Commands (`src-tauri/src/commands.rs`)**
  - Lệnh cho **General Scratchpad**:
    - `get_general_scratchpad() -> Result<String, String>`
    - `save_general_scratchpad(content: String) -> Result<(), String>`
  - Lệnh cho **Projects Management**:
    - `list_projects() -> Result<Vec<ProjectSummary>, String>`
    - `create_project(name: String) -> Result<Project, String>`
    - `update_project_name(id: i64, name: String) -> Result<(), String>`
    - `delete_project(id: i64) -> Result<(), String>`
  - Lệnh cho **Project Content (Scratchpad)**:
    - `get_project_content(id: i64) -> Result<String, String>`
    - `save_project_content(id: i64, content: String) -> Result<(), String>`
- [x] **Bước 2.3: Đăng ký Commands vào Tauri App State (`src-tauri/src/main.rs` & `lib.rs`)**
  - Khởi tạo Database Pool/Mutex connection trong Tauri State.
  - Đăng ký toàn bộ IPC handlers và chạy unit tests thành công.

---

### Giai đoạn 3: Phát triển Giao diện Người dùng (Frontend Minimalist UI)
- [x] **Bước 3.1: Xây dựng Types & Tauri API Wrappers (`src/types/`, `src/services/api.ts`)**
  - Định nghĩa TypeScript interfaces (`Project`, `SaveStatusState`).
  - Viết các hàm helper gọi `invoke()` từ `@tauri-apps/api/core` kèm fallback.
- [x] **Bước 3.2: Xây dựng Custom Hooks (`src/hooks/`)**
  - `useProjects.ts`: Quản lý danh sách project, thêm mới, xóa, đổi tên.
  - `useAutoSave.ts`: Quản lý debounce 500ms, cơ chế flush tức thì khi unmount/đổi project, và cập nhật trạng thái lưu (`Saved` / `Saving...` / `Unsaved`).
- [x] **Bước 3.3: Xây dựng Component `Sidebar.tsx`**
  - Nút chuyển nhanh sang **General Scratchpad** (với icon tối giản).
  - Danh sách các dự án hiện có (hỗ trợ hover action: nút xóa/sửa tên xuất hiện tinh tế).
  - Ô nhập liệu tạo nhanh Project: Input tối giản, bấm `Enter` để tạo ngay lập tức mà không cần modal phức tạp.
- [x] **Bước 3.4: Xây dựng Component `Editor.tsx`**
  - Khung soạn thảo văn bản không viền (borderless), chiếm toàn bộ không gian còn lại.
  - Hỗ trợ auto-focus, tab indenting cơ bản, line-height 1.6 êm dịu cho mắt.
  - Tích hợp tiêu đề dự án có thể click để chỉnh sửa nhanh.
- [x] **Bước 3.5: Xây dựng Component `SaveStatus.tsx`**
  - Hiển thị chữ nhỏ mờ ở góc dưới bên phải (`Saved` / `Saving...`).
- [x] **Bước 3.6: Lắp ráp Layout chính (`src/App.tsx`)**
  - Bố cục 2 cột cố định: Sidebar bên trái (`w-64`), Editor bên phải (`flex-1`).

---

### Giai đoạn 4: Tích hợp, Kiểm thử & Đánh giá Trải nghiệm (QA & Testing)
- [x] **Bước 4.1: Kiểm thử luồng General Scratchpad**
  - Mở app $\rightarrow$ gõ nội dung $\rightarrow$ kiểm tra lưu tự động.
  - Đóng app, mở lại $\rightarrow$ kiểm tra nội dung được phục hồi nguyên vẹn qua unit tests & local storage.
- [x] **Bước 4.2: Kiểm thử luồng Quản lý Project**
  - Tạo mới dự án.
  - Viết nội dung riêng biệt vào từng dự án.
  - Chuyển đổi qua lại liên tục giữa các dự án và General Scratchpad $\rightarrow$ Đảm bảo cơ chế flush tức thì không bị mất ký tự nào đang gõ dở.
  - Xóa dự án và kiểm tra cập nhật danh sách.
- [x] **Bước 4.3: Kiểm thử Khả năng chịu lỗi (Resilience & Edge cases)**
  - Tên dự án để trống, tên dự án có ký tự đặc biệt / emoji.
  - Nội dung văn bản dài kiểm tra tốc độ phản hồi.

---

### Giai đoạn 5: Đóng gói & Hoàn thiện Ứng dụng (Build & Packaging)
- [x] **Bước 5.1: Kiểm tra Memory & Performance trên Linux**
  - Biên dịch nhị phân thành công với Tauri v2 và SQLite bundled.
- [x] **Bước 5.2: Cấu hình Build Gói cài đặt Linux**
  - Sẵn sàng lệnh `npm run tauri build` để tạo binary và gói `.deb`/`AppImage`.
- [x] **Bước 5.3: Cập nhật tài liệu hướng dẫn sử dụng & cài đặt (`README.md`)**

---

## 📌 Bảng tiến độ triển khai (Tracking Summary)
* **Tài liệu đặc tả**: ✅ Đã hoàn thành (`overview.md`, `architecture.md`, `design-style.md`, `implementation-plan.md`, `README.md`).
* **Trạng thái hiện tại**: ✅ **Toàn bộ 5 giai đoạn đã hoàn thành 100%**. Ứng dụng sẵn sàng chạy `npm run tauri dev`.
