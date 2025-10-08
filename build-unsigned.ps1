# Build Attrition Launcher without code signing
# This script sets all necessary environment variables to avoid code signing issues

Write-Host "Building Attrition Launcher (unsigned version)..." -ForegroundColor Green

# Set environment variables to disable code signing
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:CSC_KEY_PASSWORD = ""
$env:WIN_CSC_LINK = ""
$env:WIN_CSC_KEY_PASSWORD = ""
$env:CSC_LINK = ""
$env:CSC_KEY_PASSWORD = ""

# Clean any existing build artifacts
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
npm run clean

# Ensure dependencies are installed
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Clear electron-builder cache to avoid symbolic link issues
Write-Host "Clearing electron-builder cache..." -ForegroundColor Yellow
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cacheDir) {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
    Write-Host "Cache cleared." -ForegroundColor Green
}

# Build the installer
Write-Host "Building NSIS installer..." -ForegroundColor Yellow
npx electron-builder --win --config.win.target=nsis --config.forceCodeSigning=false

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Installer location: releases\" -ForegroundColor Cyan
    
    # List the created files
    $releaseFiles = Get-ChildItem -Path "releases" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($releaseFiles) {
        Write-Host "Created files:" -ForegroundColor Cyan
        $releaseFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    }
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
