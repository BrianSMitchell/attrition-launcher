# Create Self-Signed Code Signing Certificate for Attrition Launcher
# This script creates a self-signed certificate that can be used for development

param(
    [string]$CertName = "Attrition Game Studio",
    [string]$OutputPath = ".\attrition-cert.pfx",
    [string]$Password = "AttritionDev2025!"
)

Write-Host "Creating self-signed code signing certificate..." -ForegroundColor Green

try {
    # Create the certificate
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=$CertName" `
        -KeyUsage DigitalSignature `
        -FriendlyName "Attrition Launcher Code Signing Certificate" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyLength 2048 `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyUsageProperty Sign `
        -NotAfter (Get-Date).AddYears(3)

    Write-Host "Certificate created successfully!" -ForegroundColor Green
    Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan

    # Export the certificate to PFX file
    $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $OutputPath -Password $securePassword

    Write-Host "Certificate exported to: $OutputPath" -ForegroundColor Green
    Write-Host "Certificate password: $Password" -ForegroundColor Yellow

    # Add certificate to trusted root (required for self-signed)
    Write-Host "Adding certificate to Trusted Root Certification Authorities..." -ForegroundColor Yellow
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()

    Write-Host "✅ Self-signed certificate setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration for launcher-builder.yml:" -ForegroundColor Cyan
    Write-Host "  certificateFile: `"$OutputPath`"" -ForegroundColor White
    Write-Host "  certificatePassword: `"$Password`"" -ForegroundColor White
    Write-Host ""
    Write-Host "Environment variables for building:" -ForegroundColor Cyan
    Write-Host "  CSC_LINK=$OutputPath" -ForegroundColor White
    Write-Host "  CSC_KEY_PASSWORD=$Password" -ForegroundColor White

} catch {
    Write-Host "❌ Error creating certificate: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "You may need to run this script as Administrator" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Note: Self-signed certificates will show security warnings to users." -ForegroundColor Yellow
Write-Host "For production, consider getting a real code signing certificate." -ForegroundColor Yellow
