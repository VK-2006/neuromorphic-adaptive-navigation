# Navora Final Pre-Push Checklist

This is the only checklist needed before the next Git push.

## 1. Apply the final release and verify it in one command

From the **extracted final release** run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply_final_release.ps1 `
  -Target "C:\Users\kitty\Main Project\neuromorphic-adaptive-navigation" `
  -Verify
```

The script preserves:

- `.git/`
- `backend/.env`
- `backend/node_modules`
- `backend/package-lock.json`
- `ai-service/.env`
- `ai-service/.venv`

It also removes obsolete tracked backups/versioned reports/generated QA screenshots and then runs the consolidated source, security, UI, algorithm, AI, Jest/audit and Mongo-backed runtime E2E checks.

Expected final lines include:

```text
NAVORA FINAL VERIFICATION: PASS
FINAL PRE-PUSH VERIFICATION PASS
```

## 2. Review exactly what will be committed

```powershell
cd "C:\Users\kitty\Main Project\neuromorphic-adaptive-navigation"
git status
git add -A
python scripts\prepush_audit.py
git status
```

Expected:

```text
PREPUSH AUDIT: PASS
```

## 3. Commit and push

```powershell
git commit -m "feat: finalize Navora master-prompt compliance and pre-push hardening"
git push origin main
```

Never force-add real `.env`, `.venv`, `node_modules`, trained `.pt` weights or generated QA screenshots.

## External gates after Git

Production deployment and real field use still require real environments: HTTPS deployment, MongoDB Atlas, production OAuth/Brevo/traffic credentials, held-out model evaluation and physical phone GPS/camera/Bluetooth testing. Those are not source-code errors and must not be fabricated.


## v7.2 verifier behavior

Local `backend/.env` and `ai-service/.env` are valid in a Git working tree only when ignored and untracked. Clean release archives must contain no real `.env` files. The consolidated verifier handles these two contexts separately.
