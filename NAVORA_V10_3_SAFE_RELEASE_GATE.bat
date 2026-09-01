@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title NAVORA V10.3 - SAFE RELEASE GATE

rem ============================================================================
rem NAVORA V10.3
rem Robust Windows release runner:
rem - keeps CMD open even on failure
rem - prints the exact failed stage + exit code
rem - uses project Python venv / python / py -3 safely
rem - actually runs Runtime E2E via final_verify.py --runtime
rem - stages ONLY this reviewed BAT file
rem - pushes main, waits for exact Render commit, then runs production checks
rem - never fabricates Google/OTP/hardware/TURN/model validation
rem ============================================================================

rem Double-click safety: launch inside a persistent CMD window.
if /I "%~1"=="__NAVORA_INNER__" goto :inner
start "NAVORA V10.3" cmd.exe /d /k ""%~f0" __NAVORA_INNER__"
exit /b 0

:inner
set "REPO=C:\Users\kitty\Main Project\neuromorphic-adaptive-navigation"
set "EXPECTED_REMOTE=VK-2006/neuromorphic-adaptive-navigation"
set "BACKEND_URL=https://navora-backend-clzp.onrender.com"
set "AI_URL=https://navora-ai-ttsr.onrender.com"
set "RELEASE_BAT=NAVORA_V10_3_SAFE_RELEASE_GATE.bat"

set "LAST_STEP=Startup"
set "LAST_RC=0"
set "PENDING=0"
set "GOOGLE_GATE=PENDING"
set "OTP_GATE=PENDING"
set "HARDWARE_GATE=PENDING"
set "TURN_GATE=PENDING"
set "MODEL_GATE=PENDING"
set "COMMIT="

echo.
echo ================================================================================
echo   NAVORA V10.3 - SAFE RELEASE / EXTERNAL GATE VERIFIER
echo ================================================================================
echo Repo: "%REPO%"
echo.

if not exist "%REPO%\.git" (
  set "LAST_STEP=Repository detection"
  set "LAST_RC=2"
  echo [FAIL] Git repository not found.
  goto :fatal
)

cd /d "%REPO%"
if errorlevel 1 (
  set "LAST_STEP=Open repository"
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

if not exist "logs" mkdir "logs" >nul 2>nul
set "RUN_LOG=%REPO%\logs\V10_3_LAST_RUN.txt"
> "%RUN_LOG%" echo NAVORA V10.3 RUN
>>"%RUN_LOG%" echo Started=%DATE% %TIME%
>>"%RUN_LOG%" echo Repo=%REPO%

call :need git
if errorlevel 1 goto :fatal
call :need node
if errorlevel 1 goto :fatal
call :need npm
if errorlevel 1 goto :fatal
call :need powershell
if errorlevel 1 goto :fatal

call :pick_python
if errorlevel 1 goto :fatal

echo Python mode: %PY_MODE%
>>"%RUN_LOG%" echo PythonMode=%PY_MODE%

set "ORIGIN="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ORIGIN=%%R"
echo !ORIGIN! | findstr /I /C:"%EXPECTED_REMOTE%" >nul
if errorlevel 1 (
  set "LAST_STEP=Git origin verification"
  set "LAST_RC=3"
  echo [FAIL] Unexpected Git origin: !ORIGIN!
  echo Expected: %EXPECTED_REMOTE%
  goto :fatal
)

rem ----------------------------------------------------------------------------
rem A clean tree is mandatory BEFORE verification. logs/ is ignored by Git.
rem ----------------------------------------------------------------------------
set "DIRTY=0"
for /f "delims=" %%S in ('git status --porcelain --untracked-files=normal') do (
  set "STATUS_ROW=%%S"
  set "STATUS_PATH=!STATUS_ROW:~3!"
  if /I "!STATUS_PATH!"=="%RELEASE_BAT%" (
    echo [INFO] Ignoring this runner's own working-tree entry: %%S
  ) else (
    set "DIRTY=1"
    echo [DIRTY] %%S
  )
)
if "!DIRTY!"=="1" (
  set "LAST_STEP=Working-tree cleanliness"
  set "LAST_RC=4"
  echo.
  echo [FAIL] Repository has unrelated local/staged/untracked changes.
  echo This BAT only ignores its own file: %RELEASE_BAT%
  echo Commit, stash, or remove the OTHER changes first.
  goto :fatal
)

echo.
echo [1/12] Syncing main safely...
set "LAST_STEP=git fetch origin main"
git fetch origin main
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=git checkout main"
git checkout main
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=git pull --ff-only origin main"
git pull --ff-only origin main
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

for /f "delims=" %%C in ('git rev-parse HEAD') do set "BASE_COMMIT=%%C"
echo Base commit: !BASE_COMMIT!
>>"%RUN_LOG%" echo BaseCommit=!BASE_COMMIT!

echo.
echo [2/12] Source contracts...
set "LAST_STEP=V9 contracts"
call :py scripts\v9_contracts.py
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

echo.
echo [3/12] Local Chromium E2E...
set "LAST_STEP=Local V7 browser E2E"
node scripts\browser_v7_local_runner.js
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=Local V8 28-page browser sweep"
node scripts\browser_v8_local_runner.js
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=Local V9 functional E2E"
node scripts\browser_v9_local_runner.js
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

echo.
echo [4/12] Full verifier INCLUDING Runtime E2E...
set "LAST_STEP=final_verify.py --runtime"
call :py scripts\final_verify.py --runtime
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

echo.
echo [5/12] Model truthfulness + local TURN readiness...
set "LAST_STEP=Model readiness"
call :py scripts\model_readiness.py
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)
call :local_turn_info

echo.
echo [6/12] Copying and staging ONLY the reviewed V10.1 BAT...
set "LAST_STEP=Copy release BAT"
if /I not "%~f0"=="%REPO%\%RELEASE_BAT%" (
  copy /Y "%~f0" "%REPO%\%RELEASE_BAT%" >nul
  if errorlevel 1 (
    set "LAST_RC=!errorlevel!"
    goto :fatal
  )
)

set "LAST_STEP=Stage release BAT"
git add -- "%RELEASE_BAT%"
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "BAD_STAGE=0"
for /f "delims=" %%F in ('git diff --cached --name-only') do (
  if /I not "%%F"=="%RELEASE_BAT%" (
    echo [FAIL] Unexpected staged path: %%F
    set "BAD_STAGE=1"
  )
)
if "!BAD_STAGE!"=="1" (
  git reset
  set "LAST_STEP=Staging safety check"
  set "LAST_RC=5"
  goto :fatal
)

rem Run the repository's own pre-push audit AFTER staging the BAT.
set "LAST_STEP=Pre-push audit after V10.1 staging"
call :py scripts\prepush_audit.py
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  git reset -- "%RELEASE_BAT%" >nul 2>nul
  goto :fatal
)

git diff --cached --quiet
if errorlevel 1 (
  set "LAST_STEP=Commit V10.1 release gate"
  git commit -m "chore: make Navora OTP gate send real production email"
  if errorlevel 1 (
    set "LAST_RC=!errorlevel!"
    goto :fatal
  )
) else (
  echo No V10.1 file change to commit; current HEAD will be verified.
)

for /f "delims=" %%C in ('git rev-parse HEAD') do set "COMMIT=%%C"
echo Commit selected: !COMMIT!
>>"%RUN_LOG%" echo Commit=!COMMIT!

echo.
echo [7/12] Pushing main to GitHub...
set "LAST_STEP=git push origin main"
git push origin main
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)
echo [PASS] GitHub push state OK.

rem Optional deploy hook. The secret URL is read only from the environment.
if defined RENDER_DEPLOY_HOOK_URL (
  echo Triggering configured Render deploy hook...
  powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Method Post -Uri $env:RENDER_DEPLOY_HOOK_URL -UseBasicParsing -TimeoutSec 30 | Out-Null; Write-Host '[PASS] Render deploy hook accepted.'; exit 0 } catch { Write-Host ('[WARN] Render deploy hook failed: ' + $_.Exception.Message); exit 0 }"
) else (
  echo [INFO] RENDER_DEPLOY_HOOK_URL not set. Using Render branch auto-deploy.
)

echo.
echo [8/12] Waiting for Render to report this exact commit...
set "DEPLOYED=0"
set /a POLL=1

:poll_render
if !POLL! GTR 44 goto :poll_done
echo Render poll !POLL!/44...
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $h=Invoke-RestMethod -Uri '%BACKEND_URL%/health' -TimeoutSec 30; if($h.commit -eq '!COMMIT!'){ Write-Host ('[PASS] Exact commit live: ' + $h.commit); exit 0 }; Write-Host ('[WAIT] Deployed=' + [string]$h.commit); exit 3 } catch { Write-Host ('[WAIT] Health request: ' + $_.Exception.Message); exit 4 }"
if not errorlevel 1 (
  set "DEPLOYED=1"
  goto :poll_done
)
set /a POLL+=1
timeout /t 15 /nobreak >nul
goto :poll_render

:poll_done
if not "!DEPLOYED!"=="1" (
  set "LAST_STEP=Exact Render commit deployment"
  set "LAST_RC=6"
  echo [FAIL] Render did not report exact commit !COMMIT!.
  echo Check Render Auto-Deploy / deploy status, then rerun this BAT.
  goto :fatal
)

echo.
echo [9/12] Production smoke...
set "LAST_STEP=Production smoke"
call :py scripts\production_smoke.py --backend "%BACKEND_URL%" --ai "%AI_URL%" --expected-commit "!COMMIT!"
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

echo.
echo [10/12] Production Chromium E2E...
set "LAST_STEP=Production V7 browser E2E"
node scripts\browser_v7_smoke.js "%BACKEND_URL%"
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=Production V8 28-page sweep"
node scripts\browser_v8_full_sweep.js "%BACKEND_URL%"
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

set "LAST_STEP=Production V9 functional E2E"
node scripts\browser_v9_functional_e2e.js "%BACKEND_URL%"
if errorlevel 1 (
  set "LAST_RC=!errorlevel!"
  goto :fatal
)

echo.
echo [11/12] Strict deployed AI validation gate...
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { $m=Invoke-RestMethod -Uri '%AI_URL%/model/info' -TimeoutSec 60; $d=($m.detector.validated -eq $true); $r=($m.riskModel.validated -eq $true); if($d -and $r){ Write-Host '[PASS] Deployed detector and SNN are both held-out validated.'; exit 0 } else { Write-Host ('[PENDING] Validated AI: detector=' + $d + ', riskModel=' + $r); exit 2 } } catch { Write-Host ('[PENDING] AI model-info request: ' + $_.Exception.Message); exit 2 }"
if errorlevel 1 (
  set "MODEL_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "MODEL_GATE=PASS"
)

echo.
echo ================================================================================
echo REAL EXTERNAL GATES
echo ================================================================================
echo Google login note:
echo If Google account selection/consent finished and Navora opened the authenticated
echo dashboard showing your account, answer Y. Dashboard is the intended landing page.
echo.
start "" "%BACKEND_URL%/dashboard.html"
choice /C YN /N /M "Did real Google login succeed and open your authenticated dashboard? [Y/N] "
if errorlevel 2 (
  set "GOOGLE_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "GOOGLE_GATE=PASS"
)

echo.
echo ================================================================================
echo REAL OTP MAILBOX GATE
echo ================================================================================
echo This step will now SEND a real production password-reset OTP.
echo.

set "LAST_STEP=Brevo production sender readiness"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $s=Invoke-RestMethod -Uri '%BACKEND_URL%/api/v1/auth/email/status' -TimeoutSec 30; $d=if($s.data){$s.data}else{$s}; Write-Host ('configured=' + $d.configured + ' providerReachable=' + $d.providerReachable + ' senderRegistered=' + $d.senderRegistered + ' senderActive=' + $d.senderActive); if($d.configured -and $d.providerReachable -and $d.senderRegistered -and $d.senderActive){exit 0}else{exit 2} } catch { Write-Host ('[FAIL] Email status request: ' + $_.Exception.Message); exit 3 }"
if errorlevel 1 (
  echo [PENDING] Brevo production sender is not fully ready.
  echo Fix Render BREVO_API_KEY / BREVO_SENDER_EMAIL or activate the sender in Brevo.
  set "OTP_GATE=PENDING"
  set /a PENDING+=1
  goto :after_otp_gate
)

set "OTP_EMAIL="
set /p "OTP_EMAIL=Enter the EXACT Navora account email for OTP: "
if defined OTP_EMAIL set "OTP_EMAIL=%OTP_EMAIL%"
if not defined OTP_EMAIL (
  echo [PENDING] No email entered. OTP request was not sent.
  set "OTP_GATE=PENDING"
  set /a PENDING+=1
  goto :after_otp_gate
)

set "LAST_STEP=Production OTP request"
echo Sending real reset OTP to !OTP_EMAIL! ...

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $email=$env:OTP_EMAIL; try { $body=@{email=$email}|ConvertTo-Json -Compress; $r=Invoke-WebRequest -Method Post -Uri '%BACKEND_URL%/api/v1/auth/forgot-password' -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 45; Write-Host ('[PASS] HTTP ' + [int]$r.StatusCode); Write-Host $r.Content; if([int]$r.StatusCode -ge 200 -and [int]$r.StatusCode -lt 300){exit 0}else{exit 4} } catch { if($_.Exception.Response){ try { $sr=New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt=$sr.ReadToEnd(); Write-Host ('[FAIL] ' + $txt) } catch {} }; Write-Host ('[FAIL] OTP request: ' + $_.Exception.Message); exit 5 }"
if errorlevel 1 (
  echo [PENDING] Production OTP API did not accept the request.
  echo If you see HTTP 429, wait for the resend cooldown and rerun.
  set "OTP_GATE=PENDING"
  set /a PENDING+=1
  goto :after_otp_gate
)

echo.
echo [PASS] Navora backend accepted the real OTP request.
echo Wait about 10-30 seconds, then check Inbox, Spam, and Promotions.
timeout /t 12 /nobreak >nul
start "" "https://mail.google.com/mail/u/0/#search/in:anywhere+newer_than:1d+%22Reset+your+Navora+password%22"

choice /C YN /N /M "Did the NEW Navora OTP email arrive? [Y/N] "
if errorlevel 2 (
  echo [PENDING] API accepted the OTP but mailbox delivery is not yet confirmed.
  set "OTP_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "OTP_GATE=PASS"
)

:after_otp_gate

echo.
echo Test GPS/camera/Bluetooth/WebRTC on the actual phone/device.
start "" "%BACKEND_URL%/journey.html"
start "" "%BACKEND_URL%/devices.html"
start "" "%BACKEND_URL%/journey.html"
choice /C YN /N /M "Did physical GPS + camera + Bluetooth + WebRTC work? [Y/N] "
if errorlevel 2 (
  set "HARDWARE_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "HARDWARE_GATE=PASS"
)

echo.
choice /C YN /N /M "Are WEBRTC_TURN_* configured AND did a real cross-network TURN relay test pass? [Y/N] "
if errorlevel 2 (
  set "TURN_GATE=PENDING"
  set /a PENDING+=1
) else (
  set "TURN_GATE=PASS"
)

echo.
echo [12/12] Writing final evidence...
set "REPORT=%REPO%\logs\V10_3_EXTERNAL_GATE_RESULT.txt"
> "%REPORT%" echo NAVORA V10.3 EXTERNAL GATE RESULT
>>"%REPORT%" echo ============================================================
>>"%REPORT%" echo Commit=!COMMIT!
>>"%REPORT%" echo Backend=%BACKEND_URL%
>>"%REPORT%" echo AI=%AI_URL%
>>"%REPORT%" echo GoogleRealLogin=!GOOGLE_GATE!
>>"%REPORT%" echo RealOtpMailbox=!OTP_GATE!
>>"%REPORT%" echo PhysicalGpsCameraBluetoothWebRTC=!HARDWARE_GATE!
>>"%REPORT%" echo TurnCrossNetworkRelay=!TURN_GATE!
>>"%REPORT%" echo HeldOutValidatedDetectorAndSNN=!MODEL_GATE!
>>"%REPORT%" echo PendingCount=!PENDING!
>>"%REPORT%" echo Completed=%DATE% %TIME%
>>"%REPORT%" echo ============================================================

>>"%RUN_LOG%" echo Result=SOFTWARE_PASS
>>"%RUN_LOG%" echo Pending=!PENDING!
>>"%RUN_LOG%" echo Finished=%DATE% %TIME%

echo.
echo ================================================================================
echo   NAVORA V10.3 RESULT
echo ================================================================================
echo Commit: !COMMIT!
echo Google real login:            !GOOGLE_GATE!
echo Real OTP mailbox:             !OTP_GATE!
echo Physical GPS/camera/BLE/RTC:  !HARDWARE_GATE!
echo TURN cross-network relay:     !TURN_GATE!
echo Validated detector + SNN:     !MODEL_GATE!
echo Pending external gates:       !PENDING!
echo.
echo Evidence:
echo   "%REPORT%"
echo Run log:
echo   "%RUN_LOG%"
echo.

if "!PENDING!"=="0" goto :all_external_pass

echo [PASS] V10.2 SOFTWARE / GITHUB / EXACT RENDER DEPLOYMENT PASSED.
echo [PENDING] !PENDING! real external gates still require evidence.
set "FINAL_RC=2"
goto :finish_result

:all_external_pass
echo [PASS] V10.2 AUTOMATED + ALL REAL EXTERNAL GATES PASSED.
set "FINAL_RC=0"

:finish_result
echo.
echo This window will stay open. Press any key when you are finished reading/copying it.
pause >nul
exit /b !FINAL_RC!

rem ============================================================================
rem Helpers
rem ============================================================================

:pick_python
set "PY_MODE="
set "PY_EXE="

if exist "%REPO%\ai-service\.venv\Scripts\python.exe" (
  "%REPO%\ai-service\.venv\Scripts\python.exe" -c "import sys; print(sys.version)" >nul 2>nul
  if not errorlevel 1 (
    set "PY_MODE=project-venv"
    set "PY_EXE=%REPO%\ai-service\.venv\Scripts\python.exe"
    exit /b 0
  )
)

where python >nul 2>nul
if not errorlevel 1 (
  python -c "import sys; print(sys.version)" >nul 2>nul
  if not errorlevel 1 (
    set "PY_MODE=python"
    exit /b 0
  )
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; print(sys.version)" >nul 2>nul
  if not errorlevel 1 (
    set "PY_MODE=py-launcher"
    exit /b 0
  )
)

set "LAST_STEP=Python 3 detection"
set "LAST_RC=7"
echo [FAIL] No usable Python 3 interpreter found.
exit /b 1

:py
if /I "%PY_MODE%"=="project-venv" (
  "%PY_EXE%" %*
  exit /b !errorlevel!
)
if /I "%PY_MODE%"=="python" (
  python %*
  exit /b !errorlevel!
)
if /I "%PY_MODE%"=="py-launcher" (
  py -3 %*
  exit /b !errorlevel!
)
echo [FAIL] Internal Python mode is missing.
exit /b 99

:need
where %~1 >nul 2>nul
if errorlevel 1 (
  set "LAST_STEP=Required command: %~1"
  set "LAST_RC=8"
  echo [FAIL] Required command not found: %~1
  exit /b 1
)
exit /b 0

:local_turn_info
if not exist "backend\.env" (
  echo [INFO] backend\.env not present locally. Production TURN values belong in Render.
  exit /b 0
)
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$lines=Get-Content 'backend/.env' -ErrorAction SilentlyContinue; $need=@('WEBRTC_TURN_URL','WEBRTC_TURN_USERNAME','WEBRTC_TURN_CREDENTIAL'); $missing=@(); foreach($k in $need){ if(-not ($lines | Where-Object { $_ -match ('^' + [regex]::Escape($k) + '=.+') })){ $missing += $k } }; if($missing.Count -eq 0){ Write-Host '[INFO] Local TURN variables are populated. Values hidden.' } else { Write-Host ('[INFO] Local TURN incomplete: ' + ($missing -join ', ')) }"
exit /b 0

:fatal
if not defined LAST_RC set "LAST_RC=!errorlevel!"
if "!LAST_RC!"=="0" set "LAST_RC=!errorlevel!"
if "!LAST_RC!"=="0" set "LAST_RC=1"

echo.
echo ================================================================================
echo   NAVORA V10.3 STOPPED
echo ================================================================================
echo FAILED STEP : !LAST_STEP!
echo EXIT CODE   : !LAST_RC!
echo.
echo Nothing after this failed step is being claimed as PASS.
echo.

if defined RUN_LOG (
  >>"%RUN_LOG%" echo Result=FAIL
  >>"%RUN_LOG%" echo FailedStep=!LAST_STEP!
  >>"%RUN_LOG%" echo ExitCode=!LAST_RC!
  >>"%RUN_LOG%" echo FailedAt=%DATE% %TIME%
  echo Failure log:
  echo   "%RUN_LOG%"
)

echo.
echo This CMD window WILL NOT close automatically.
echo Copy the FAILED STEP and the lines immediately above it if you need help.
echo.
pause
exit /b !LAST_RC!
