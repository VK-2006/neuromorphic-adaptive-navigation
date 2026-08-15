# Testing Guide

The final repository uses one consolidated verifier so the developer does not have to discover failures one command at a time.

## Normal pre-push verification

From the project root:

```powershell
python scripts\final_verify.py
```

It runs master-prompt/source/security/frontend/algorithm/AI checks and, when installed, backend Jest + `npm audit`.

## Full local runtime verification

With local MongoDB running, backend `node_modules` installed and the AI `.venv` available:

```powershell
python scripts\final_verify.py --runtime
```

The runtime E2E creates an isolated temporary MongoDB database and a temporary backend port. It exercises:

`register → email OTP fallback → verify → login → refresh → route compare/ACO → persisted journey → GPS tracking → reroute → Socket.IO ownership + World Chat → live readiness → trusted contact + SOS → completion → CRM/EMA → replay → forgot/reset → re-login → admin RBAC`.

The test database is dropped after the run.

## Optional browser visual QA

```powershell
python -m pip install playwright
python -m playwright install chromium
python qa-screens\render_qa.py --check-only
python qa-screens\render_qa.py --check-only --matrix
```

The QA script is repository-relative, has no BeautifulSoup dependency and can run from any clone location. Generated screenshots are ignored by Git.

## Model validation

Training never means validation. Use real held-out data:

```powershell
python scripts\evaluate_detector.py --manifest <held-out-detection-manifest.jsonl> --mark-validation
python scripts\evaluate_snn.py --csv <held-out-risk.csv> --mark-validation
python scripts\model_readiness.py
```

The global safety-eligible flag is true only when both detector and SNN validation gates pass.

## Git safety

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_for_git.ps1
python scripts\prepush_audit.py
```

`prepush_audit.py` checks tracked secrets, real `.env` files, backups, generated QA images, trained weights, required `package-lock.json`, and direct dependency consistency between `package.json` and `package-lock.json`.
