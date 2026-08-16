# NAVORA External Validation

This document defines the three remaining evidence gates without weakening the project's truthfulness policy.

## 1. Google real-browser verification

The repository now contains `scripts/google_real_login_e2e.js` and the manual `external-validation` workflow.

Create a real Google-authenticated browser session against the current production release, export the Playwright storage state, base64-encode the JSON, and store it only as the GitHub Actions secret `GOOGLE_AUTH_STORAGE_STATE_B64`.

The workflow checks all of the following:

- production Google Identity Services configuration is enabled;
- the Google Sign-In control renders;
- the stored session is accepted by the production app;
- navigation to the authenticated dashboard is not redirected to login;
- no page-level browser errors occur.

The storage state is never committed to the repository.

## 2. TURN relay validation

Configure the production Render environment with:

- `WEBRTC_TURN_URL`
- `WEBRTC_TURN_USERNAME`
- `WEBRTC_TURN_CREDENTIAL`

Store the same values as GitHub Actions secrets with the same names. The workflow runs Chromium with `iceTransportPolicy: relay` and fails unless a real `relay` ICE candidate is gathered.

This proves the configured TURN service is reachable and can allocate a relay. It does **not** replace the final physical cross-network field test; that test still requires two real networks/devices and must be recorded in Issue #27.

## 3. Held-out detector/SNN scientific validation

The repository intentionally does not redistribute BDD100K/RDD2022 or claim synthetic fixtures as scientific evidence. The workflow therefore accepts private evaluation bundles through GitHub Actions secrets:

- `DETECTOR_EVAL_BUNDLE_URL` — tarball containing the exact held-out detector manifest and its images;
- `SNN_EVAL_BUNDLE_URL` — tarball containing the fresh held-out normalized SNN CSV.

The existing `evaluate_detector.py` and `evaluate_snn.py` scripts enforce the project's existing data-gate, leakage, policy-floor, per-class, fingerprint and research-lock requirements. The workflow cannot mark a model validated merely because a file exists.

A successful run must produce:

- detector held-out report with `validationEligible: true`;
- SNN held-out report with `validationEligible: true`;
- metadata with both `detectorValidated=true` and `riskValidated=true`;
- `scripts/model_readiness.py` PASS.

## Running the workflow

Open GitHub Actions → **Navora External Validation** → **Run workflow** and enable only the gates whose real inputs have been configured.

No credentials, OTPs, Google storage state, TURN credentials, private dataset URLs, or private device identifiers belong in Git. A missing external input must remain **BLOCKED/PENDING**, never be converted to PASS by a fixture or mock.
