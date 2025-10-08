# Build Attrition Launcher with self-signed certificate
# Run create-self-signed-cert.ps1 first if certificate doesn't exist

param(
    [string]$CertPath = ".\attrition-cert.pfx",
    [string]$CertPassword = "AttritionDev2025!"
)

Write-Host "Building Attrition Launcher with code signing..." -ForegroundColor Green

# Check if certificate exists
if (-not (Test-Path $CertPath)) {
    Write-Host "Certificate not found at $CertPath" -ForegroundColor Red
    Write-Host "Run .\create-self-signed-cert.ps1 first to create a certificate" -ForegroundColor Yellow
    exit 1
}

# Set environment variables for code signing
$env:CSC_LINK = $CertPath
$env:CSC_KEY_PASSWORD = $CertPassword
$env:WIN_CSC_LINK = $CertPath
$env:WIN_CSC_KEY_PASSWORD = $CertPassword

Write-Host "Certificate: $CertPath" -ForegroundColor Cyan
Write-Host "Using code signing for build..." -ForegroundColor Cyan

# Clean any existing build artifacts
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
npm run clean

# Ensure dependencies are installed
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Clear electron-builder cache
Write-Host "Clearing electron-builder cache..." -ForegroundColor Yellow
$cacheDir = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cacheDir) {
    Remove-Item -Recurse -Force $cacheDir -ErrorAction SilentlyContinue
    Write-Host "Cache cleared." -ForegroundColor Green
}

# Build the installer with code signing
Write-Host "Building signed NSIS installer..." -ForegroundColor Yellow
npx electron-builder --config launcher-builder.yml --win

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host "Installer location: releases\" -ForegroundColor Cyan
    
    # List the created files
    $releaseFiles = Get-ChildItem -Path "releases" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($releaseFiles) {
        Write-Host "Created files:" -ForegroundColor Cyan
        $releaseFiles | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
        
        # Verify signatures
        Write-Host ""
        Write-Host "Verifying code signatures..." -ForegroundColor Yellow
        $releaseFiles | ForEach-Object {
            $sig = Get-AuthenticodeSignature $_.FullName
            if ($sig.Status -eq "Valid") {
                Write-Host "✅ $($_.Name) - Signed successfully" -ForegroundColor Green
            } else {
                Write-Host "⚠️  $($_.Name) - Signature status: $($sig.Status)" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "❌ Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
