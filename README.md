# Erwining — Minimalist Desktop Note & Project App

A lightweight, distraction-free desktop note-taking and project management application for Windows & Linux, built with a **Minimalist Dark Theme**.

---

## 📥 Installation Guide

### 1. Download Pre-built Binaries (GitHub Releases)
You can download the compiled assets directly from the [GitHub Releases](https://github.com/thethien2906/scratchpad/releases) page:

- **Windows (`.exe` / `.msi`)**:
  - `Erwining_2.0.0_x64-setup.exe` (NSIS Installer)
  - `erwining.exe` (Standalone Portable Executable)
  - `Erwining_2.0.0_x64_en-US.msi` (MSI Package)
- **Linux Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo dpkg -i Erwining_2.0.0_amd64.deb
  ```
- **Linux Portable (`.AppImage`)**:
  ```bash
  chmod +x Erwining_2.0.0_amd64.AppImage
  ./Erwining_2.0.0_amd64.AppImage
  ```

---

## 🛠️ Build from Source

### System Requirements
- **Node.js**: >= 18
- **Rust & Cargo**: >= 1.75
- **Linux Packages** (Ubuntu/Debian only): `webkit2gtk-4.1` / `libgtk-3-dev`

### Build Steps

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/thethien2906/scratchpad.git
   cd scratchpad
   npm install
   ```

2. **Run in development mode:**
   ```bash
   npm run tauri dev
   ```

3. **Build for Windows (Native):**
   ```powershell
   npm run tauri build
   ```
   *Installers will be generated at `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.*

4. **Build for Linux:**
   ```bash
   npm run tauri build
   ```
   *Installers will be generated at `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/appimage/`.*

5. **Cross-compile for Windows from Linux:**
   ```bash
   sudo apt update && sudo apt install -y clang lld
   ./build-windows.sh
   ```

---

## ⌨️ Shortcuts

- **`Tab`**: Indent 2 spaces in the text editor.
- **`Enter` (in project creation input)**: Create and immediately navigate to the new project.
- **`Escape`**: Cancel project creation or renaming.
- **`Click on Project Title`**: Edit project name directly in the editor heading.
