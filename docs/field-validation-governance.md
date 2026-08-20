# Field validation and repository governance

## Current evidence boundary

`field-validation/latest.json` preserves the latest known V10.3 operator result without committing secrets or sensitive device data. Its release commit is `4fd3512af5a63899f3ea677ee5d3d89faf7d3ee8`.

The field profile recorded for that exact release is **PASS** for:

- real OTP mailbox delivery;
- physical GPS, camera, Bluetooth, and journey-scoped WebRTC;
- a real cross-network TURN relay.

The imported result is deliberately labelled `legacy-local-log-import`: the original ignored logs recorded the outcomes, but GitHub does not contain the device model, browser version, screenshots, or a cryptographic attachment digest. Its field-surface fingerprint no longer matches current `main` because journey/device field code changed after V10.3. Therefore **current-release field validation is BLOCKED pending a physical retest**. The next run must use the GitHub **Field validation record** issue form and replace the legacy record with a privacy-safe `github-field-issue` record.

Real Google browser sign-in and held-out detector/SNN validation remain pending and are not part of the field profile. They must not be represented as passed by this evidence.

Run the machine-checkable profiles with:

```powershell
python scripts\validate_field_evidence.py --profile field
python scripts\validate_field_evidence.py --profile field --require-current
python scripts\validate_field_evidence.py --profile all-external
```

The first command verifies the historical record. The second command is the merge/release gate and remains blocked until the current field surface is physically retested. The third command also remains blocked until Google browser sign-in and independent scientific model validation are both recorded.

## Evidence handling

- Pin every run to the exact deployed 40-character commit SHA.
- Record device, OS, browser, test time, failures, and unsupported capabilities in a GitHub field-validation issue.
- Redact credentials, OTP values, mailbox contents, precise GPS traces, private journey IDs, and device identifiers.
- Keep TURN credentials only in the deployment environment. Evidence may state that relay candidates succeeded, but must not contain the username or credential.
- Treat unsupported Bluetooth or denied browser permission as `PENDING` or `FAIL`, never as `PASS`.
- Re-run affected gates after changes to `frontend/assets/js/journey.js`, `frontend/assets/js/camera-share.js`, device UI, socket authorization, TURN configuration, authentication, or OTP delivery.

## GitHub main-branch policy

Enable a branch ruleset for `main` in **Settings → Rules → Rulesets** with these controls:

1. Require a pull request before merging.
2. Require conversation resolution.
3. Require branches to be up to date before merging.
4. Block force pushes and branch deletion.
5. Require these pull-request checks exactly:
   - `source-and-backend`
   - `browser-e2e`
   - `ai-fallback-contract`
   - `field-governance`
6. Do not require `verify-production` before merge; it is an exact-SHA post-merge deployment check.

For a single-owner repository, requiring one approval would prevent the author from approving their own pull request. Keep the approval count at zero until a second trusted reviewer is added; then require one CODEOWNER approval. `.github/CODEOWNERS` and the pull-request template make ownership and evidence expectations explicit in either mode.
