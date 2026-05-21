param(
  [Parameter(Mandatory = $true)]
  [string] $CertificatePath,

  [Parameter(Mandatory = $true)]
  [string] $CertificatePassword,

  [string] $Repository = "twohemp-design/aura-desktop"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI is not installed. Install gh before running this script."
}

if (-not (Test-Path -LiteralPath $CertificatePath)) {
  throw "Certificate file not found: $CertificatePath"
}

$resolvedCertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path
$certificateBytes = [System.IO.File]::ReadAllBytes($resolvedCertificatePath)
$certificateBase64 = [Convert]::ToBase64String($certificateBytes)

$certificateBase64 | gh secret set CSC_LINK --repo $Repository
$CertificatePassword | gh secret set CSC_KEY_PASSWORD --repo $Repository

Write-Host "GitHub signing secrets were updated for $Repository"
