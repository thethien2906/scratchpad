# Design Style Guide — Minimalist Dark UI System

Tài liệu này xác định các quy chuẩn thiết kế giao diện (UI/UX) theo chuẩn **Pure Minimalist Dark Theme** cho ứng dụng, đảm bảo êm mắt, tinh gọn tuyệt đối và hoàn toàn không gây xao nhãng.

---

## 1. Color Palette (Bảng màu Dark Theme)

Bảng màu tối giản thuần Dark Mode, tương phản nhẹ nhàng để bảo vệ mắt khi làm việc lâu:

| Vai trò | Mã Màu HEX | Tailwind Class tương ứng | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Base Main (Editor)** | `#121212` | `bg-dark-base` | Nền chính của ứng dụng và vùng soạn thảo |
| **Base Sidebar** | `#181818` | `bg-dark-sidebar` | Nền thanh điều hướng phân biệt nhẹ nhàng |
| **Hover State** | `#222222` | `bg-dark-hover` | Nền item khi di chuột qua |
| **Active State** | `#2A2A2A` | `bg-dark-active` | Nền item đang được chọn |
| **Text Primary** | `#EDEDED` | `text-text-primary` | Tiêu đề và nội dung chính (êm mắt hơn trắng thuần `#FFF`) |
| **Text Secondary** | `#A3A3A3` | `text-text-secondary` | Nhãn phụ, danh mục phụ |
| **Text Muted** | `#737373` | `text-text-muted` | Placeholder, icon outline mờ |
| **Text Faint** | `#525252` | `text-text-faint` | Đếm từ / số ký tự |
| **Borders** | `#282828` / `#333333` | `border-dark-border` | Viền mảnh 1px phân cách các vùng |

---

## 2. Typography (Kiểu chữ & Phân cấp)

* **Phông chữ duy nhất (Single font family)**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`.
* **Độ đậm chữ giới hạn (Max 2-3 weights)**:
  * Regular (`400`): Dành cho toàn bộ nội dung văn bản ghi chép.
  * Medium (`500`): Dành cho menu navigation, tên dự án.
  * SemiBold (`600`): Dành cho tiêu đề màn hình chính.
* **Tỷ lệ phân cấp kích thước (Type Scale)**:
  * **24px / 32px (`text-2xl` - `font-semibold`)**: Tiêu đề trang / Tên dự án.
  * **16px (`text-base` - `font-normal`)**: Nội dung chính trong vùng soạn thảo (Line-height: `1.6`).
  * **14px / 13px (`text-sm` / `text-xs`)**: Danh mục dự án, đếm từ/ký tự, trạng thái lưu.

---

## 3. Spacing & Layout (Khoảng cách & Bố cục)

* **Hệ thống khoảng cách cố định (4px/8px scale)**:
  * `4px` (`gap-1`) — Khoảng cách icon và text.
  * `8px` (`gap-2`, `p-2`) — Padding trong input, button nhỏ.
  * `12px` / `16px` (`p-3`, `p-4`) — Padding thanh sidebar.
  * `32px` (`px-8`, `pt-7`) — Padding vùng soạn thảo chính (Editor margins).
* **Tận dụng Whitespace (Khoảng trắng / Dark space)**:
  * Không sử dụng bất kỳ dòng phụ đề, hướng dẫn hay slogan rườm rà nào trong màn hình làm việc.

---

## 4. Components (Quy chuẩn Thành phần Giao diện)

* **Flat Design Dark**:
  * Hoàn toàn không đổ bóng nổi, không gradient.
* **Borders (Đường viền)**:
  * Độ dày duy nhất: `1px` với màu tối `#282828`.
* **Buttons & Inputs**:
  * Hình chữ nhật phẳng với góc bo nhẹ (`rounded-md` ~ 6px).
  * Input nền tối `#202020` viền `#333333`.
* **Icons**:
  * Đồng nhất phong cách Single-line/Outline (Lucide icons).
  * Độ dày nét vẽ: `1.75px` đồng bộ.

---

## 5. Interaction & Motion (Tương tác & Hiệu ứng)

* **Thời gian chuyển động**: `150ms` với `ease-in-out`.
* **Trạng thái lưu (Auto-save Indicator)**:
  * Hiển thị chữ nhỏ ở góc giao diện (`Saved` / `Saving...`), mờ nhẹ trong nền tối.
