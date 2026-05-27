# Deploy Supabase Edge Functions for project mssihzqvxdndovvohqch
# Requires: npm + SUPABASE_ACCESS_TOKEN (or run `supabase login` once)
#
# Get a token: https://supabase.com/dashboard/account/tokens
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."

$ErrorActionPreference = "Stop"
$ProjectRef = "mssihzqvxdndovvohqch"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$SupabaseCmd = "npm exec --yes supabase@2.101.0 --"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "SUPABASE_ACCESS_TOKEN not set. Checking CLI login..." -ForegroundColor Yellow
  & npm exec --yes supabase@2.101.0 -- projects list 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Not authenticated. Either:" -ForegroundColor Red
    Write-Host "  1. npm exec --yes supabase@2.101.0 -- login"
    Write-Host "  2. `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'  (from dashboard/account/tokens)"
    exit 1
  }
}

$functions = @(
  "export-reports",
  "invite-user",
  "update-role",
  "admin-user-action"
)

foreach ($fn in $functions) {
  Write-Host "Deploying $fn..." -ForegroundColor Cyan
  Invoke-Expression "$SupabaseCmd functions deploy $fn --project-ref $ProjectRef --yes"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "All edge functions deployed." -ForegroundColor Green
