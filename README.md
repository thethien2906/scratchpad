# Erwining — Minimalist Desktop Note & Project App

Ứng dụng ghi chú và quản lý dự án siêu tinh gọn dành cho Desktop (Linux & Windows), được xây dựng theo phong cách **Minimalist Dark Theme**.

---

## 📥 Hướng dẫn Cài đặt (Installation Guide)

### 1. Tải bản cài đặt sẵn (GitHub Releases)
Bạn có thể tải các file thành phẩm từ mục **Releases** trên GitHub:
- **Linux Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo dpkg -i Erwining_2.0.0_amd64.deb
  ```
- **Linux Chạy trực tiếp (`.AppImage`)**:
  ```bash
  chmod +x Erwining_2.0.0_amd64.AppImage
  ./Erwining_2.0.0_amd64.AppImage
  ```
- **Windows (`.exe` / `.msi`)**:
  Tải file về và nhấp đúp để cài đặt hoặc mở ứng dụng.

---

### 2. Cài đặt từ mã nguồn (Build from Source)

#### Yêu cầu hệ thống:
- **Node.js**: >= 18
- **Rust & Cargo**: >= 1.75
- **Linux Packages**: `webkit2gtk-4.1` / `libgtk-3-dev`

#### Các bước thực hiện:
1. **Clone repository và cài đặt dependencies:**
   ```bash
   git clone https://github.com/thethien2906/scratchpad.git
   cd scratchpad
   npm install
   ```

2. **Chạy ở chế độ phát triển (Dev Mode):**
   ```bash
   npm run tauri dev
   ```

3. **Build thành phẩm cho Linux:**
   ```bash
   npm run tauri build
   ```
   *File cài đặt sẽ được tạo tại: `src-tauri/target/release/bundle/deb/` và `src-tauri/target/release/bundle/appimage/`.*

4. **Cross-compile cho Windows (từ Linux):**
   ```bash
   sudo apt update && sudo apt install -y clang lld
   ./build-windows.sh
   ```

---

## 📖 Hướng dẫn Sử dụng (User Guide)

### 1. Creative Mode
- Nhấp vào **Creative Mode** ở thanh điều hướng bên trái.
- Đây là không gian mở để bạn viết tự do mọi suy nghĩ, brainstorming và ghi chú nhanh mà không cần cấu hình tiêu đề hay thư mục.

### 2. Quản lý Projects
- **Tạo dự án mới**: Nhấp vào biểu tượng `+` trên thanh điều hướng hoặc gõ tên dự án vào ô nhập liệu rồi nhấn `Enter`.
- **Xem chi tiết dự án**: Nhấp vào bất kỳ dự án nào trong danh sách. Mỗi dự án có một không gian ghi chú/planning riêng biệt.
- **Đổi tên dự án**: 
  - Nhấp trực tiếp vào **Tiêu đề dự án** trong vùng soạn thảo để chỉnh sửa.
  - Hoặc di chuột vào tên dự án trên thanh điều hướng và nhấp vào biểu tượng sửa (bút chì).
- **Xóa dự án**: Di chuột vào tên dự án trên thanh điều hướng và nhấp vào biểu tượng thùng rác.

---

## ⌨️ Phím tắt & Thao tác nhanh (Shortcuts)

- **`Tab`**: Thụt lề 2 khoảng trắng trong vùng soạn thảo văn bản.
- **`Enter` (tại ô tạo dự án)**: Tạo và mở ngay dự án mới.
- **`Escape`**: Hủy bỏ thao tác tạo hoặc đổi tên dự án.
- **`Click vào Tiêu đề`**: Sửa tên dự án trực tiếp tại vùng soạn thảo.
