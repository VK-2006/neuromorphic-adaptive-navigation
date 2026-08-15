# Pre-Push Verifier Contexts

Navora distinguishes two security-validation contexts:

- **Clean distribution:** real `.env` files are forbidden.
- **Git working tree:** local `backend/.env` and `ai-service/.env` are allowed only when they are ignored and untracked.

`scripts/final_verify.py` automatically uses working-tree mode when `.git` exists. `scripts/repository_crosscheck.py --working-tree` never scans local runtime `.env` contents; it validates Git ignored/untracked status instead. This prevents local secrets from being treated as repository-source failures while preserving strict release hygiene.

## v7.2 verifier-context stabilization

`tests/verifier_context_contracts.py` now constructs its clean-distribution fixture by excluding local runtime `.env`/`.env.*` files (while retaining `.env.example`) before running strict release checks. This prevents a developer working tree from contaminating the clean-release fixture. The test remains strict: after adding runtime `.env` files inside an initialized Git fixture, clean-distribution mode must fail while `--working-tree` mode may pass only when those files are ignored and untracked. The regression test is also executed in CI.
