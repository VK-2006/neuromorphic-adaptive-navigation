param(
  [Parameter(Mandatory=$true)]
  [string]$Target,
  [switch]$Verify
)
$ErrorActionPreference='Stop'
$Source=Split-Path -Parent $PSScriptRoot
$Target=(Resolve-Path $Target).Path
Write-Host "Source: $Source"
Write-Host "Target: $Target"

$requiredPreserved = @(
  'backend\package-lock.json'
)
foreach($rel in $requiredPreserved){
  if(-not (Test-Path (Join-Path $Target $rel))){
    throw "Required preserved file is missing: $rel. Restore it before applying the final release."
  }
}

$preserve=@(
  '.git','backend\.env','backend\node_modules','backend\package-lock.json',
  'ai-service\.env','ai-service\.venv'
)
Write-Host 'Preserving local runtime/Git state:'
$preserve | ForEach-Object { Write-Host " - $_" }

& robocopy $Source $Target /E /R:1 /W:1 /XD node_modules .venv .git /XF .env package-lock.json
$code=$LASTEXITCODE
if($code -ge 8){throw "robocopy failed with exit code $code"}

& powershell -ExecutionPolicy Bypass -File (Join-Path $Target 'scripts\cleanup_for_git.ps1')
Write-Host 'APPLY_FINAL_RELEASE PASS'

if($Verify){
  Push-Location $Target
  try {
    & python scripts\final_verify.py --runtime
    if($LASTEXITCODE -ne 0){throw "Final verification failed with exit code $LASTEXITCODE"}
  } finally { Pop-Location }
  Write-Host 'FINAL PRE-PUSH VERIFICATION PASS'
} else {
  Write-Host 'Next: cd target; python scripts\final_verify.py --runtime'
}
