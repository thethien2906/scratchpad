Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Erwining — Windows Native Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "[1/2] Installing npm packages..." -ForegroundColor Yellow
npm install

Write-Host "[2/2] Building Windows App (.exe / .msi)..." -ForegroundColor Yellow
npm run tauri build

Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Hoàn tất! File cài đặt nằm tại:" -ForegroundColor Green
Write-Host "  src-tauri\target\release\bundle\msi\" -ForegroundColor White
Write-Host "  src-tauri\target\release\bundle\nsis\" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
