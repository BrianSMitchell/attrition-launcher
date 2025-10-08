# Create GitHub Release for Attrition Launcher
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$true)]
    [string]$InstallerPath,
    
    [string]$Repo = "BrianSMitchell/attrition-launcher",
    
    [string]$ReleaseNotes = ""
)

# Use the main project's release script
$MainProjectScript = "../../scripts/Create-GitHubRelease.ps1"

if (Test-Path $MainProjectScript) {
    & $MainProjectScript -Version $Version -InstallerPath $InstallerPath -Repo $Repo -ReleaseNotes $ReleaseNotes
} else {
    Write-Error "Main project release script not found at: $MainProjectScript"
    Write-Host "Please run from the main attrition project directory"
}
