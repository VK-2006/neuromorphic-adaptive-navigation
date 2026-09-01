@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

rem ============================================================================
rem NAVORA V10 - EXTERNAL GATES + SAFE GIT PUSH + EXACT RENDER DEPLOY VERIFIER
rem ============================================================================
rem This runner does NOT fabricate external evidence.
rem It automates everything a Windows BAT can verify, then asks for real/manual
rem evidence for Google consent, mailbox OTP, physical hardware and TURN relay.
rem Validated AI passes only when the deployed AI /model/info reports BOTH
rem detector.validated=true and riskModel.validated=true.
rem ============================================================================

set "EXPECTED_REMOTE=VK-2006/neuromorphic-adaptive-navigation"
set "DEFAULT_REPO=C:\Users\kitty\Main Project\neuromorphic-adaptive-navigation"
set "BACKEND_URL=https://navora-backend-clzp.onrender.com"
set "AI_URL=https://navora-ai-ttsr.onrender.com"
set "RELEASE_BAT=NAVORA_V10_EXTERNAL_GATES_PUSH_DEPLOY.bat"
set "FAILS=0"
set "PENDING=0"
set "GOOGLE_GATE=PENDING"
set "OTP_GATE=PENDING"
set "HARDWARE_GATE=PENDING"
set "TURN_GATE=PENDING"
set "MODEL_GATE=PENDING"

if not "%~1"=="" (
  set "REPO=%~1"
) else (
  set "REPO=%DEFAULT_REPO%"
)

echo.
echo ============================================================================
echo   NAVORA V10 - EXTERNAL VALIDATION / PUSH / RENDER RELEASE GATE
echo ============================================================================
echo Repo: %REPO%
echo.

if not exist "%REPO%\.git" (
  echo [FAIL] Git repository not found: "%REPO%"
  goto :fatal
)

cd /d "%REPO%" || goto :fatal

call :need git
if errorlevel 1 goto :fatal
call :need node
if errorlevel 1 goto :fatal
call :need npm
if errorlevel 1 goto :fatal
call :pick_python
if errorlevel 1 goto :fatal

for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ORIGIN=%%R"
echo %ORIGIN% | findstr /I /C:"%EXPECTED_REMOTE%" >nul
if errorlevel 1 (
  echo [FAIL] Unexpected Git origin: %ORIGIN%
  echo Expected repository: %EXPECTED_REMOTE%
  goto :fatal
)

rem Never overwrite a dirty project tree.
for /f "delims=" %%S in ('git status --porcelain --untracked-files=normal') do (
  echo [FAIL] Working tree is not clean before V10 starts.
  echo        %%S
  echo Commit/stash/remove unrelated changes first, then rerun this BAT.
  goto :fatal
)

echo [1/12] Syncing exact main branch safely...
git fetch origin main || goto :fatal
git checkout main || goto :fatal
git pull --ff-only origin main || goto :fatal
for /f "delims=" %%C in ('git rev-parse HEAD') do set "BASE_COMMIT=%%C"
echo Base commit: %BASE_COMMIT%

rem --------------------------------------------------------------------------
rem Software/config readiness checks run on the clean synchronized tree first.
rem The V10 BAT is copied into the repo only AFTER these checks pass so existing
rem working-tree/pre-push audits are not disturbed by a new untracked file.
rem --------------------------------------------------------------------------
echo.
echo [2/12] V9/V10 source contracts...
"%PYTHON_EXE%" scripts\v9_contracts.py || goto :fatal

echo.
echo [3/12] Local browser E2E suites...
node scripts\browser_v7_local_runner.js || goto :fatal
node scripts\browser_v8_local_runner.js || goto :fatal
node scripts\browser_v9_local_runner.js || goto :fatal

echo.
echo [4/12] Full repository verifier including Runtime E2E...
"%PYTHON_EXE%" scripts\final_verify.py || goto :fatal

echo.
echo [5/12] Local TURN + model truthfulness readiness...
call :local_turn_readiness
"%PYTHON_EXE%" scripts\model_readiness.py || goto :fatal

rem --------------------------------------------------------------------------
rem Commit only this reviewed V10 release runner. Never stage .env or random files.
rem --------------------------------------------------------------------------
echo.
echo [6/12] Security-safe staging...
rem Keep this verified release runner in the repository as an auditable tool.
if /I not "%~f0"=="%REPO%\%RELEASE_BAT%" (
  copy /Y "%~f0" "%REPO%\%RELEASE_BAT%" >nul || goto :fatal
)
git add -- "%RELEASE_BAT%" || goto :fatal

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "chore: add Navora V10 external validation release gate" || goto :fatal
) else (
  echo No new V10 runner change to commit; using current HEAD.
)

for /f "delims=" %%C in ('git rev-parse HEAD') do set "COMMIT=%%C"

echo.
echo [7/12] Pushing main to GitHub...
git push origin main || goto :fatal
echo GitHub push state OK: %COMMIT%

rem Optional Render deploy hook. Do not print the secret URL.
if defined RENDER_DEPLOY_HOOK_URL (
  echo Triggering configured Render deploy hook...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Method Post -Uri $env:RENDER_DEPLOY_HOOK_URL -UseBasicParsing -TimeoutSec 30 ^| Out-Null; exit 0 } catch { Write-Host ('[WARN] Deploy hook failed: ' + $_.Exception.Message); exit 0 }"
) else (
  echo RENDER_DEPLOY_HOOK_URL is not set; relying on Render linked-branch auto-deploy.
)

echo.
echo [8/12] Waiting until production health reports THIS exact Git commit...
set "DEPLOYED=0"
for /L %%I in (1,1,44) do (
  echo Render poll %%I/44...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ProgressPreference='SilentlyContinue'; try { $h=Invoke-RestMethod -Uri '%BACKEND_URL%/health' -TimeoutSec 30; if($h.commit -eq '%COMMIT%'){ Write-Host ('Exact commit live: ' + $h.commit); exit 0 } else { exit 3 } } catch { exit 4 }"
  if not errorlevel 1 (
    set "DEPLOYED=1"
    goto :render_ready
  )
  timeout /t 15 /nobreak >nul
)

:render_ready
if not "%DEPLOYED%"=="1" (
  echo [FAIL] Render never reported exact commit %COMMIT%.
  echo Check Render Auto-Deploy or set RENDER_DEPLOY_HOOK_URL and rerun.
  goto :fatal
)

echo.
echo [9/12] Production smoke against exact Render commit...
"%PYTHON_EXE%" scripts\production_smoke.py --backend "%BACKEND_URL%" --ai "%AI_URL%" --expected-commit "%COMMIT%" || goto :fatal

echo.
echo [10/12] Production Chromium suites...
node scripts\browser_v7_smoke.js "%BACKEND_URL%" || goto :fatal
node scripts\browser_v8_full_sweep.js "%BACKEND_URL%" || goto :fatal
node scripts\browser_v9_functional_e2e.js "%BACKEND_URL%" || goto :fatal

rem --------------------------------------------------------------------------
rem Strict deployed-model check. Unlike production_smoke warning mode, this gate
rem fails unless BOTH deployed models report validated=true.
rem --------------------------------------------------------------------------
echo.
echo [11/12] Strict external-gate evidence...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue'; try { $m=Invoke-RestMethod -Uri '%AI_URL%/model/info' -TimeoutSec 60; $d=($m.detector.validated -eq $true); $r=($m.riskModel.validated -eq $true); if($d -and $r){ Write-Host 'PASS deployed detector + SNN are both validated'; exit 0 } else { Write-Host ('PENDING validated AI: detector=' + $d + ', riskModel=' + $r); exit 2 } } catch { Write-Host ('PENDING validated AI: ' + $_.Exception.Message); exit 2 }"
if errorlevel 1 (
  set "MODEL_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "MODEL_GATE=PASS"
)

rem --------------------------------------------------------------------------
rem The remaining gates require a human/device/provider. Open the real pages and
rem record explicit evidence. A BAT cannot click Google consent, read your inbox,
rem or manufacture Bluetooth/GPS/TURN field behavior.
rem --------------------------------------------------------------------------
echo.
echo Google gate: complete REAL Google Signup with your account.
start "" "%BACKEND_URL%/register.html"
choice /C YN /N /M "Did real Google Signup/consent complete and reach the expected authenticated flow? [Y/N] "
if errorlevel 2 (set "GOOGLE_GATE=PENDING"& set /a PENDING+=1) else set "GOOGLE_GATE=PASS"

echo.
echo OTP gate: request a REAL password-reset/verification email and confirm delivery.
start "" "%BACKEND_URL%/forgot-password.html"
choice /C YN /N /M "Did the real OTP email arrive and did resend/verification/reset work? [Y/N] "
if errorlevel 2 (set "OTP_GATE=PENDING"& set /a PENDING+=1) else set "OTP_GATE=PASS"

echo.
echo Hardware gate: test on a physical HTTPS-capable phone/device.
start "" "%BACKEND_URL%/journey.html"
start "" "%BACKEND_URL%/devices.html"
start "" "%BACKEND_URL%/journey.html"
choice /C YN /N /M "Did physical GPS + camera + Bluetooth + WebRTC work on the real device? [Y/N] "
if errorlevel 2 (set "HARDWARE_GATE=PENDING"& set /a PENDING+=1) else set "HARDWARE_GATE=PASS"

echo.
echo TURN gate: this means cross-network WebRTC relay, not just same-Wi-Fi/STUN success.
choice /C YN /N /M "Are Render WEBRTC_TURN_* vars configured AND did a real cross-network relay test succeed? [Y/N] "
if errorlevel 2 (set "TURN_GATE=PENDING"& set /a PENDING+=1) else set "TURN_GATE=PASS"

rem --------------------------------------------------------------------------
rem Evidence report is local and contains no secrets.
rem --------------------------------------------------------------------------
echo.
echo [12/12] Writing external-gate result...
if not exist "%REPO%\logs" mkdir "%REPO%\logs" >nul 2>nul
set "REPORT=%REPO%\logs\V10_EXTERNAL_GATE_RESULT.txt"
(
  echo NAVORA V10 EXTERNAL GATE RESULT
  echo ================================================
  echo Commit=%COMMIT%
  echo Backend=%BACKEND_URL%
  echo AI=%AI_URL%
  echo GoogleRealConsent=%GOOGLE_GATE%
  echo RealOtpMailbox=%OTP_GATE%
  echo PhysicalGpsCameraBluetoothWebRTC=%HARDWARE_GATE%
  echo TurnCrossNetworkRelay=%TURN_GATE%
  echo HeldOutValidatedDetectorAndSNN=%MODEL_GATE%
  echo PendingCount=%PENDING%
  echo ================================================
  echo NOTE: No secret values are written to this report.
) > "%REPORT%"

echo.
echo ============================================================================
echo   NAVORA V10 RESULT
echo ============================================================================
echo Commit: %COMMIT%
echo Google real consent:          %GOOGLE_GATE%
echo Real OTP mailbox:             %OTP_GATE%
echo Physical GPS/camera/BLE/RTC:  %HARDWARE_GATE%
echo TURN cross-network relay:     %TURN_GATE%
echo Validated detector + SNN:     %MODEL_GATE%
echo Pending external gates:       %PENDING%
echo Evidence: %REPORT%
echo.

if "%PENDING%"=="0" (
  echo V10 EXTERNAL GATES: PASS
  echo All automated checks and all five real-world evidence gates passed.
  exit /b 0
) else (
  echo V10 SOFTWARE / PUSH / EXACT-DEPLOY CHECKS: PASS
  echo V10 EXTERNAL GATES: %PENDING% PENDING
  echo The project remains truthful: pending real-world evidence is NOT reported as PASS.
  exit /b 2
)

:local_turn_readiness
if not exist "backend\.env" (
  echo [INFO] backend\.env is absent locally. Production TURN secrets must live in Render env.
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lines=Get-Content 'backend/.env' -ErrorAction SilentlyContinue; $need=@('WEBRTC_TURN_URL','WEBRTC_TURN_USERNAME','WEBRTC_TURN_CREDENTIAL'); $ok=$true; foreach($k in $need){ $hit=$lines ^| Where-Object { $_ -match ('^' + [regex]::Escape($k) + '=.+') }; if(-not $hit){$ok=$false} }; if($ok){Write-Host '[INFO] Local TURN variables are populated (values hidden).'} else {Write-Host '[INFO] Local TURN variables are incomplete. This is not a code failure.'}; exit 0"
exit /b 0

:pick_python
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys" >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=py -3"
    rem A command with a space cannot be safely quoted as one executable; use python fallback below.
  )
)
where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys" >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=python"
    exit /b 0
  )
)
where py >nul 2>nul
if not errorlevel 1 (
  rem Create a tiny wrapper so later calls can use one executable path.
  set "PYTHON_EXE=%TEMP%\navora-python3.cmd"
  >"!PYTHON_EXE!" echo @py -3 %%*
  exit /b 0
)
echo [FAIL] Python 3 not found.
exit /b 1

:need
where %~1 >nul 2>nul
if errorlevel 1 (
  echo [FAIL] Required command not found: %~1
  exit /b 1
)
exit /b 0

:fatal
echo.
echo ============================================================================
echo   NAVORA V10: STOPPED - NOTHING ELSE WILL BE CLAIMED AS PASS
echo ============================================================================
exit /b 1
