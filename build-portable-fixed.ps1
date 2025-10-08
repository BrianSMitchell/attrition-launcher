# Build Attrition Launcher as portable executable
# This avoids the NSIS installer and symbolic link issues

Write-Host "Building Attrition Launcher (portable version)..." -ForegroundColor Green

# Set environment variables to use the self-signed certificate
$certPath = ".\attrition-cert.pfx"
$certPassword = "AttritionDev2025!"

if (Test-Path $certPath) {
    Write-Host "Using self-signed certificate for code signing..." -ForegroundColor Cyan
    $env:CSC_LINK = $certPath
    $env:CSC_KEY_PASSWORD = $certPassword
} else {
    Write-Host "No certificate found - building unsigned portable version" -ForegroundColor Yellow
    $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
}

# Clean any existing build artifacts
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "releases") { Remove-Item -Recurse -Force "releases" }

# Ensure dependencies are installed
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Clear electron-builder cache to avoid issues
Write-Host "Clearing electron-builder cache..." -ForegroundColor Yellow
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cacheDir) {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
}

# Build portable version (avoids NSIS installer issues)
Write-Host "Building portable executable..." -ForegroundColor Yellow
npx electron-builder --win --config.win.target=portable --config.directories.output=releases

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Portable executable location: releases\" -ForegroundColor Cyan
    
    # List the created files
    $releaseFiles = Get-ChildItem -Path "releases" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($releaseFiles) {
        Write-Host "Created files:" -ForegroundColor Cyan
        foreach ($file in $releaseFiles) {
            $sizeMB = [math]::Round($file.Length / 1MB, 2)
            Write-Host "  - $($file.Name) ($sizeMB MB)" -ForegroundColor White
        }
        
        # Verify signatures if certificate was used
        if (Test-Path $certPath) {
            Write-Host ""
            Write-Host "Verifying code signatures..." -ForegroundColor Yellow
            foreach ($file in $releaseFiles) {
                $sig = Get-AuthenticodeSignature $file.FullName
                if ($sig.Status -eq "Valid") {
                    Write-Host "Signed successfully: $($file.Name)" -ForegroundColor Green
                } else {
                    Write-Host "Signature status for $($file.Name): $($sig.Status)" -ForegroundColor Yellow
                }
            }
        }
    }
    
    Write-Host ""
    Write-Host "USAGE NOTES:" -ForegroundColor Green
    Write-Host "- Portable version doesn't require installation" -ForegroundColor White
    Write-Host "- Users can run directly from any folder" -ForegroundColor White
    Write-Host "- No desktop shortcuts created automatically" -ForegroundColor White
    Write-Host "- Settings stored in user's AppData folder" -ForegroundColor White
    
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Try running PowerShell as Administrator or enabling Developer Mode" -ForegroundColor Yellow
}
