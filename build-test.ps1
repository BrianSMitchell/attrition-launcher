# Test build with explicit config file to ensure our settings are used
Write-Host "🔧 Testing build with explicit config file..." -ForegroundColor Green

# Set environment for self-signed certificate
$env:CSC_LINK = ".\attrition-cert.pfx"
$env:CSC_KEY_PASSWORD = "AttritionDev2025!"

# Clean previous build
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "releases") { Remove-Item -Recurse -Force "releases" }

# Clear cache
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cacheDir) {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
}

Write-Host "Building with explicit config file: launcher-builder.yml" -ForegroundColor Cyan
npx electron-builder --config launcher-builder.yml --win --config.directories.output=releases

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed!" -ForegroundColor Green
    
    # Show what was created
    $releaseFiles = Get-ChildItem -Path "releases" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($releaseFiles) {
        Write-Host "Created files:" -ForegroundColor Cyan
        $releaseFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
    }
} else {
    Write-Host "❌ Build failed" -ForegroundColor Red
}
