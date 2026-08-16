@echo off
setlocal EnableExtensions

rem NAVORA V31 - guarded Windows real-model training and validation pipeline.
rem This script NEVER marks training as validation by itself. Existing Python gates decide eligibility.

cd /d "%~dp0.."
if errorlevel 1 goto :fail_cd
set "ROOT=%CD%"

if not defined PYTHON_EXE set "PYTHON_EXE=python"
if not defined DET_EPOCHS set "DET_EPOCHS=5"
if not defined DET_BATCH_SIZE set "DET_BATCH_SIZE=2"
if not defined DET_LR set "DET_LR=0.0001"
if not defined SNN_EPOCHS set "SNN_EPOCHS=50"
if not defined SNN_LR set "SNN_LR=0.001"
if not defined DET_EVAL_FRACTION set "DET_EVAL_FRACTION=0.20"
if not defined DET_SPLIT_SEED set "DET_SPLIT_SEED=navora-v31-real-model"

set "DERIVED=%ROOT%\datasets\derived-risk-data"
set "DET_MANIFEST=%DERIVED%\detection-manifest.jsonl"
set "DET_TRAIN=%DERIVED%\detection-train.jsonl"
set "DET_EVAL=%DERIVED%\detection-eval.jsonl"

cls
echo ================================================================
echo NAVORA V31 - REAL DETECTOR + SNN PIPELINE
echo ================================================================
echo Repository : %ROOT%
echo Python     : %PYTHON_EXE%
echo.
echo Required environment variables:
echo   RDD_ROOT       = extracted RDD2022 root containing XML annotations/images
echo   SNN_TRAIN_CSV  = leakage-free normalized SNN training CSV
echo   SNN_EVAL_CSV   = untouched normalized SNN held-out CSV
echo.
echo Optional BDD100K pair - set BOTH or neither:
echo   BDD_LABELS     = BDD100K detection labels JSON
echo   BDD_IMAGES     = matching BDD100K image directory
echo.
echo Optional overrides:
echo   PYTHON_EXE, DET_EPOCHS, DET_BATCH_SIZE, DET_LR,
echo   SNN_EPOCHS, SNN_LR, DET_EVAL_FRACTION, DET_SPLIT_SEED,
echo   DET_DEVICE, NAVORA_INSTALL_AI_DEPS=1
echo ================================================================
echo.

call :require_path RDD_ROOT "RDD2022 root"
if errorlevel 1 goto :failed
call :require_file SNN_TRAIN_CSV "SNN training CSV"
if errorlevel 1 goto :failed
call :require_file SNN_EVAL_CSV "SNN held-out CSV"
if errorlevel 1 goto :failed

if defined BDD_LABELS if not defined BDD_IMAGES (
  echo [BLOCKED] BDD_LABELS is set but BDD_IMAGES is missing.
  goto :failed
)
if defined BDD_IMAGES if not defined BDD_LABELS (
  echo [BLOCKED] BDD_IMAGES is set but BDD_LABELS is missing.
  goto :failed
)
if defined BDD_LABELS (
  call :require_file BDD_LABELS "BDD100K labels JSON"
  if errorlevel 1 goto :failed
  call :require_path BDD_IMAGES "BDD100K images directory"
  if errorlevel 1 goto :failed
)

%PYTHON_EXE% --version
if errorlevel 1 (
  echo [BLOCKED] Python executable failed: %PYTHON_EXE%
  goto :failed
)

if /i "%NAVORA_INSTALL_AI_DEPS%"=="1" (
  echo.
  echo [SETUP] Installing AI requirements...
  %PYTHON_EXE% -m pip install -r "%ROOT%\ai-service\requirements.txt"
  if errorlevel 1 goto :failed
)

echo.
echo [PREFLIGHT] Checking required Python modules...
%PYTHON_EXE% -c "import cv2, torch, torchvision, snntorch; print('AI dependency preflight PASS'); print('torch', torch.__version__, 'cuda_available', torch.cuda.is_available())"
if errorlevel 1 (
  echo [BLOCKED] AI dependencies are missing or broken.
  echo Run: set NAVORA_INSTALL_AI_DEPS=1
  echo Then run this BAT again, or install the correct Torch build for your GPU manually.
  goto :failed
)

if not exist "%DERIVED%" mkdir "%DERIVED%"
if errorlevel 1 goto :failed

rem Build the unified real detector manifest. RDD2022 is required because pothole/road-damage
rem validation must be backed by real labeled road-damage examples.
echo.
echo [1/9] Preparing unified detection manifest...
if defined BDD_LABELS (
  %PYTHON_EXE% "%ROOT%\scripts\prepare_detection_data.py" --bdd-labels "%BDD_LABELS%" --bdd-images "%BDD_IMAGES%" --rdd-root "%RDD_ROOT%" --out "%DET_MANIFEST%"
) else (
  %PYTHON_EXE% "%ROOT%\scripts\prepare_detection_data.py" --rdd-root "%RDD_ROOT%" --out "%DET_MANIFEST%"
)
if errorlevel 1 goto :failed

rem Deterministic source-aware split with zero shared image rows and held-out class coverage.
echo.
echo [2/9] Creating leakage-safe detector train/eval split...
%PYTHON_EXE% "%ROOT%\scripts\split_detection_manifest.py" --manifest "%DET_MANIFEST%" --train-out "%DET_TRAIN%" --eval-out "%DET_EVAL%" --eval-fraction "%DET_EVAL_FRACTION%" --seed "%DET_SPLIT_SEED%"
if errorlevel 1 goto :failed

rem Gate all four datasets BEFORE training. This rejects small sets, overlap, duplicates,
rem missing classes/sources, invalid boxes, non-normalized SNN features and weak class coverage.
echo.
echo [3/9] Running V30 real-data gate...
%PYTHON_EXE% "%ROOT%\scripts\model_data_gate.py" --det-train "%DET_TRAIN%" --det-eval "%DET_EVAL%" --snn-train "%SNN_TRAIN_CSV%" --snn-eval "%SNN_EVAL_CSV%"
if errorlevel 1 goto :failed

rem Train detector using the complete gated training manifest. No --max-samples is allowed here.
echo.
echo [4/9] Training detector...
if defined DET_DEVICE (
  %PYTHON_EXE% "%ROOT%\scripts\train_detector.py" --manifest "%DET_TRAIN%" --epochs "%DET_EPOCHS%" --batch-size "%DET_BATCH_SIZE%" --lr "%DET_LR%" --device "%DET_DEVICE%"
) else (
  %PYTHON_EXE% "%ROOT%\scripts\train_detector.py" --manifest "%DET_TRAIN%" --epochs "%DET_EPOCHS%" --batch-size "%DET_BATCH_SIZE%" --lr "%DET_LR%"
)
if errorlevel 1 goto :failed

rem Train SNN on the complete gated SNN training CSV. Training keeps validation FALSE.
echo.
echo [5/9] Training SNN risk model...
%PYTHON_EXE% "%ROOT%\scripts\train_snn.py" --csv "%SNN_TRAIN_CSV%" --epochs "%SNN_EPOCHS%" --lr "%SNN_LR%" --version "risk-snn-v31-real"
if errorlevel 1 goto :failed

rem Held-out detector evaluation. V30 requires every trained class to meet support,
rem precision, recall and F1 floors; aggregate metrics alone cannot pass validation.
echo.
echo [6/9] Evaluating detector on untouched held-out images...
%PYTHON_EXE% "%ROOT%\scripts\evaluate_detector.py" --manifest "%DET_EVAL%" --mark-validation
if errorlevel 1 goto :failed

rem Held-out SNN evaluation. V30 requires every risk class F1 plus HIGH/CRITICAL recall.
echo.
echo [7/9] Evaluating SNN on untouched held-out rows...
%PYTHON_EXE% "%ROOT%\scripts\evaluate_snn.py" --csv "%SNN_EVAL_CSV%" --mark-validation
if errorlevel 1 goto :failed

rem Bind datasets, reports, per-class metrics, metadata and exact weights into schema-3 evidence.
echo.
echo [8/9] Creating V30 cryptographic validation evidence...
%PYTHON_EXE% "%ROOT%\scripts\validation_evidence.py" --det-train "%DET_TRAIN%" --det-eval "%DET_EVAL%" --snn-train "%SNN_TRAIN_CSV%" --snn-eval "%SNN_EVAL_CSV%"
if errorlevel 1 goto :failed

rem Re-run the same guard used by live model startup, then create a local non-Git ZIP.
echo.
echo [9/9] Verifying live readiness and creating model artifact bundle...
%PYTHON_EXE% "%ROOT%\scripts\model_readiness.py"
if errorlevel 1 goto :failed
%PYTHON_EXE% "%ROOT%\scripts\model_artifact_bundle.py"
if errorlevel 1 goto :failed

echo.
echo ================================================================
echo NAVORA V31 REAL MODEL PIPELINE: PASS
echo ================================================================
echo The data gate, held-out metrics, per-class V30 policy, evidence,
echo live readiness guard and artifact bundle all passed.
echo.
echo IMPORTANT:
echo - This result is valid only for the exact dataset/report/weight hashes in evidence.
echo - Do NOT commit datasets, trained weights, .env files or model-artifacts ZIPs.
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
echo NAVORA V31 REAL MODEL PIPELINE: BLOCKED / FAILED
echo ================================================================
echo No success claim is made. Read the first blocker above, fix it, and rerun.
echo Existing validation guards remain authoritative.
exit /b 1
