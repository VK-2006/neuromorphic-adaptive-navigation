# NAVORA SNN Phase 4 — 2025 External Final Validation Record

Status: **FINAL_2025_EXTERNAL_VALIDATION_FAIL**  
Disposition: **RESEARCH_ONLY / NOT_PRODUCTION_VALIDATED**

This document records the outcome reported by the locked one-time Phase-4 protocol. It does not redistribute the final dataset, labels, candidate weights, or local report files.

## Locked protocol

- protocol lock commit: `1faef7fd4e7ed8a3d1c79a504bfb5858ca6b8d67`
- frozen candidate: `HIER_B` from Phase 3B
- frozen feature dimension: `102`
- frozen risk threshold: `0.45`
- frozen high threshold: `0.45`
- no threshold tuning on the final set
- no retraining after final consumption began
- no model selection on the final set
- no automatic deployment
- production model was not replaced

## Immutable fingerprints

- candidate model SHA-256: `8a1aadd1950a87fcf60192976605f514367024d66790365c24ede04281d1d1ae`
- raw 2025 final-set SHA-256: `633249567e95479a1c30b3f10b0a6271ced11684fb338d0b8b4054ca94b80aa6`

The final-set fingerprint above is permanently **consumed** for this research program. It must not be reused for training, threshold tuning, model selection, or another claimed final validation.

## One-time final results

| Metric | Result |
|---|---:|
| Final rows | 101525 |
| LOW rows | 74881 |
| MEDIUM rows | 25191 |
| HIGH rows | 1453 |
| Macro-F1 | 0.382427 |
| Balanced accuracy | 0.439834 |
| Accuracy | 0.568619 |
| LOW recall | 0.616138 |
| MEDIUM recall | 0.445278 |
| HIGH recall | 0.258087 |
| Majority baseline Macro-F1 | 0.282987 |
| Hidden spike activity | 0.137233 |

`ALL_FINAL_GATE_CHECKS_PASS = FALSE`.

## Scientific disposition

The candidate remains useful as research evidence, but it must not be represented as an externally validated production safety model. The 2025 final set is no longer available for development decisions.

Future SNN development must use development/training data that excludes the consumed 2025 final set. Any future production-validation claim requires a **new independently reserved untouched final set** and a newly frozen candidate/protocol before that final set is opened.

V32 encodes this outcome in `ai-service/app/research_lock.py` so the failed model fingerprint cannot become live-safety validated and the consumed final-set fingerprint cannot be recycled by the repository's SNN training/evaluation entry points.
