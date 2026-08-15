@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   NAVORA - OBSIDIAN INTELLIGENCE UI VERIFICATION
echo ============================================================
echo.
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python was not found in PATH.
  echo Install/enable Python and run this file again.
  pause
  exit /b 1
)

echo [1/2] Checking Obsidian UI contracts...
python tests\obsidian_ui_contracts.py
if errorlevel 1 goto :fail

echo.
echo [2/2] Running final project verification...
python scripts\final_verify.py
if errorlevel 1 goto :fail

echo.
echo [PASS] Navora Obsidian Intelligence verification completed.
pause
exit /b 0

:fail
echo.
echo [FAIL] A verification check failed. Review the output above.
pause
exit /b 1
