@echo off
echo ==========================================
echo   Erwining — Windows Native Builder
echo ==========================================

echo [1/2] Installing npm packages...
call npm install

echo [2/2] Building Windows App (.exe / .msi)...
call npm run tauri build

echo ==========================================
echo   Hoan tat! Kiem tra file cai dat tai:
echo   src-tauri\target\release\bundle\msi\
echo   src-tauri\target\release\bundle\nsis\
echo ==========================================
pause
