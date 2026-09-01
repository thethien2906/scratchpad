#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Erwining — Windows Cross-Compiler (Linux)"
echo "=========================================="

# Check if clang and lld are installed for compiling C/SQLite code for Windows
if ! command -v clang &> /dev/null || ! command -v lld &> /dev/null; then
    echo "⚠️  Thiếu công cụ 'clang' hoặc 'lld' để biên dịch SQLite C-code cho Windows."
    echo ""
    echo "👉 Bạn vui lòng mở terminal chạy lệnh sau để cài đặt một lần duy nhất:"
    echo "   sudo apt update && sudo apt install -y clang lld llvm"
    echo ""
    echo "Sau khi cài xong, chạy lại './build-windows.sh' là sẽ xuất ra file .exe ngay!"
    exit 1
fi

# 1. Build Frontend
echo "[1/4] Building React frontend bundle..."
npm run build

# 2. Check & Install cargo-xwin if needed
echo "[2/4] Checking cargo-xwin..."
if ! command -v cargo-xwin &> /dev/null; then
    echo "Installing cargo-xwin..."
    cargo install --locked cargo-xwin
fi

# Ensure rustup target is installed
rustup target add x86_64-pc-windows-msvc 2>/dev/null || true

# 3. Cross-compile for Windows (x86_64 MSVC)
echo "[3/4] Cross-compiling Windows binary (x86_64-pc-windows-msvc)..."
cd src-tauri
cargo xwin build --release --target x86_64-pc-windows-msvc
cd ..

# 4. Output artifact
echo "[4/4] Packaging Windows artifact..."
mkdir -p dist-windows
cp src-tauri/target/x86_64-pc-windows-msvc/release/erwining.exe dist-windows/erwining.exe

echo "=========================================="
echo "✅ Build Windows thành công!"
echo "📁 File thực thi: $(pwd)/dist-windows/erwining.exe"
echo "=========================================="
