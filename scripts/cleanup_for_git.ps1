$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Remove-TrackedOrLocal([string]$rel) {
  $path = Join-Path $root $rel
  if (Test-Path (Join-Path $root '.git')) {
    & git rm -f --ignore-unmatch -- $rel 2>$null | Out-Null
  }
  if (Test-Path $path) { Remove-Item $path -Force -Recurse }
}

# Known legacy UI/QA artifacts that should not survive the consolidated release.
$obsolete = @(
  'docs/PHASE2_QA_REPORT.md',
  'docs/UI_WORLDCLASS_V5_IMPLEMENTATION_REPORT.md',
  'docs/ui-cinematic-v4.md',
  'docs/ui-premium-transformation.md',
  'docs/ui-senior-v4.md',
  'tests/cinematic_ui_contracts.py',
  'tests/senior_ui_contracts.py'
)
$obsolete | ForEach-Object { Remove-TrackedOrLocal $_ }

# Remove all version-by-version root reports/notes; TEST_RESULTS.md remains canonical.
Get-ChildItem $root -File -Filter 'UPDATE_*.md' -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-TrackedOrLocal $_.Name }
Get-ChildItem $root -File -Filter 'TEST_RESULTS_*.md' -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-TrackedOrLocal $_.Name }

# Remove backup/before-fix artifacts anywhere in the repository, including stale lockfile copies.
Get-ChildItem $root -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -like '*.backup' -or
    $_.Name -like '*.before-*' -or
    $_.Name -like '*before-zip-update*'
  } |
  ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\','/').Replace('\','/')
    Remove-TrackedOrLocal $rel
  }

# Generated QA screenshots are reproducible output, not source. Keep the render scripts only.
Get-ChildItem (Join-Path $root 'qa-screens') -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension.ToLowerInvariant() -in @('.png','.jpg','.jpeg') } |
  ForEach-Object {
    $rel = 'qa-screens/' + $_.Name
    Remove-TrackedOrLocal $rel
  }

Write-Host 'CLEANUP_FOR_GIT PASS — legacy reports/backups/generated QA images removed.'
Write-Host 'Preserved: .git, backend/.env, backend/node_modules, backend/package-lock.json, ai-service/.env and ai-service/.venv.'
