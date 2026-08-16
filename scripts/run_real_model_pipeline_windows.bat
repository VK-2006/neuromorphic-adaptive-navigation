@echo off
setlocal EnableExtensions

rem NAVORA V36 - functional detector + SNN workflow.
rem Detector scientific validation is NOT a current completion gate.
rem SNN scientific-validation work remains separate and unchanged.

cd /d "%~dp0.."
if errorlevel 1 goto :fail_cd
set "ROOT=%CD%"

if not defined PYTHON_EXE set "PYTHON_EXE=python"
if not defined DET_EPOCHS set "DET_EPOCHS=5"
if not defined DET_BATCH_SIZE set "DET_BATCH_SIZE=2"
if not defined DET_LR set "DET_LR=0.0001"
if not defined SNN_EPOCHS set "SNN_EPOCHS=50"
if not defined SNN_LR set "SNN_LR=0.001"
if not defined RUN_INTERNAL_DETECTOR_EVAL set "RUN_INTERNAL_DETECTOR_EVAL=0"

set "DERIVED=%ROOT%\datasets\derived-risk-data"
set "DET_MANIFEST=%DERIVED%\detection-manifest.jsonl"
set "DET_TRAIN=%DERIVED%\detection-train.jsonl"
set "DET_EVAL=%DERIVED%\detection-eval.jsonl"

cls
echo ================================================================
echo NAVORA V36 - FUNCTIONAL DETECTOR + SNN WORKFLOW
echo ================================================================
echo Repository : %ROOT%
echo Python     : %PYTHON_EXE%
echo.
echo Detector inputs:
echo   BDD_LABELS + BDD_IMAGES are recommended for the BDD100K detector workflow.
echo   RDD_ROOT is optional and adds road-damage/pothole training examples.
echo.
echo SNN inputs:
echo   SNN_TRAIN_CSV and SNN_EVAL_CSV are used only by the retained SNN workflow.
echo.
echo Optional detector diagnostic:
echo   RUN_INTERNAL_DETECTOR_EVAL=1
necho ================================================================

echo.
echo [PREFLIGHT] Checking Python...
%PYTHON_EXE% --version
if errorlevel 1 goto :failed

if defined BDD_LABELS if not defined BDD_IMAGES (
  echo [BLOCKED] BDD_LABELS is set but BDD_IMAGES is missing.
  goto :failed
)
if defined BDD_IMAGES if not defined BDD_LABELS (
  echo [BLOCKED] BDD_IMAGES is set but BDD_LABELS is missing.
  goto :failed
)
if not defined BDD_LABELS if not defined RDD_ROOT (
  echo [BLOCKED] Configure BDD_LABELS + BDD_IMAGES and/or RDD_ROOT for detector training.
  goto :failed
)

if defined BDD_LABELS (
  call :require_file BDD_LABELS "BDD100K labels JSON"
  if errorlevel 1 goto :failed
  call :require_path BDD_IMAGES "BDD100K images directory"
  if errorlevel 1 goto :failed
)
if defined RDD_ROOT (
  call :require_path RDD_ROOT "RDD2022 root"
  if errorlevel 1 goto :failed
)

if not exist "%DERIVED%" mkdir "%DERIVED%"
if errorlevel 1 goto :failed

echo.
echo [1/5] Preparing detector training manifest...
if defined BDD_LABELS if defined RDD_ROOT (
  %PYTHON_EXE% "%ROOT%\scripts\prepare_detection_data.py" --bdd-labels "%BDD_LABELS%" --bdd-images "%BDD_IMAGES%" --rdd-root "%RDD_ROOT%" --out "%DET_MANIFEST%"
) else if defined BDD_LABELS (
  %PYTHON_EXE% "%ROOT%\scripts\prepare_detection_data.py" --bdd-labels "%BDD_LABELS%" --bdd-images "%BDD_IMAGES%" --out "%DET_MANIFEST%"
) else (
  %PYTHON_EXE% "%ROOT%\scripts\prepare_detection_data.py" --rdd-root "%RDD_ROOT%" --out "%DET_MANIFEST%"
)
if errorlevel 1 goto :failed

copy /Y "%DET_MANIFEST%" "%DET_TRAIN%" >nul
if errorlevel 1 goto :failed

echo.
echo [2/5] Training functional detector...
if defined DET_DEVICE (
  %PYTHON_EXE% "%ROOT%\scripts\train_detector.py" --manifest "%DET_TRAIN%" --epochs "%DET_EPOCHS%" --batch-size "%DET_BATCH_SIZE%" --lr "%DET_LR%" --device "%DET_DEVICE%"
) else (
  %PYTHON_EXE% "%ROOT%\scripts\train_detector.py" --manifest "%DET_TRAIN%" --epochs "%DET_EPOCHS%" --batch-size "%DET_BATCH_SIZE%" --lr "%DET_LR%"
)
if errorlevel 1 goto :failed

if /I "%RUN_INTERNAL_DETECTOR_EVAL%"=="1" (
  echo.
  echo [3/5] Optional internal detector diagnostic...
  echo Creating a deterministic internal split for diagnostics only.
  %PYTHON_EXE% "%ROOT%\scripts\split_detection_manifest.py" --manifest "%DET_MANIFEST%" --train-out "%DET_TRAIN%" --eval-out "%DET_EVAL%"
  if errorlevel 1 goto :failed
  %PYTHON_EXE% "%ROOT%\scripts\evaluate_detector.py" --manifest "%DET_EVAL%"
  if errorlevel 1 goto :failed
) else (
  echo.
  echo [3/5] Internal detector diagnostic skipped by scope policy.
)

if defined SNN_TRAIN_CSV if not defined SNN_EVAL_CSV (
  echo [BLOCKED] SNN_TRAIN_CSV is set but SNN_EVAL_CSV is missing.
  goto :failed
)
if defined SNN_EVAL_CSV if not defined SNN_TRAIN_CSV (
  echo [BLOCKED] SNN_EVAL_CSV is set but SNN_TRAIN_CSV is missing.
  goto :failed
)

if defined SNN_TRAIN_CSV (
  call :require_file SNN_TRAIN_CSV "SNN training CSV"
  if errorlevel 1 goto :failed
  call :require_file SNN_EVAL_CSV "SNN held-out CSV"
  if errorlevel 1 goto :failed
  echo.
  echo [4/5] Training SNN risk model...
  %PYTHON_EXE% "%ROOT%\scripts\train_snn.py" --csv "%SNN_TRAIN_CSV%" --epochs "%SNN_EPOCHS%" --lr "%SNN_LR%" --version "risk-snn-v36"
  if errorlevel 1 goto :failed
  echo.
  echo [5/5] Running retained SNN held-out evaluation...
  %PYTHON_EXE% "%ROOT%\scripts\evaluate_snn.py" --csv "%SNN_EVAL_CSV%" --mark-validation
  if errorlevel 1 goto :failed
) else (
  echo.
  echo [4/5] SNN training skipped - no SNN_TRAIN_CSV configured.
  echo [5/5] SNN evaluation skipped - existing scientific evidence remains unchanged.
)

echo.
%PYTHON_EXE% "%ROOT%\scripts\model_readiness.py"
if errorlevel 1 goto :failed

echo.
echo ================================================================
echo NAVORA V36 WORKFLOW: PASS
echo ================================================================
echo Detector functionality is retained.
echo Independent cross-dataset detector scientific validation is OUT OF CURRENT SCOPE.
echo SNN scientific-validation evidence/locks remain authoritative and unchanged.
echo ================================================================
exit /b 0

:require_file
call set "_VALUE=%%%~1%%"
if not defined _VALUE (
  echo [BLOCKED] %~2 variable %~1 is not set.
  exit /b 1
)
if not exist "%_VALUE%" (
  echo [BLOCKED] %~2 not found: %_VALUE%
  exit /b 1
)
exit /b 0

:require_path
call set "_VALUE=%%%~1%%"
if not defined _VALUE (
  echo [BLOCKED] %~2 variable %~1 is not set.
  exit /b 1
)
if not exist "%_VALUE%\" (
  echo [BLOCKED] %~2 directory not found: %_VALUE%
  exit /b 1
)
exit /b 0

:fail_cd
echo [BLOCKED] Could not enter repository root.
exit /b 1

:failed
echo.
echo ================================================================
echo NAVORA V36 WORKFLOW: BLOCKED / FAILED
echo ================================================================
echo No detector scientific-validation claim is made.
echo Read the first runtime/training blocker above, fix it, and rerun.
exit /b 1
