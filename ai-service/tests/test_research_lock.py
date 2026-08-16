from pathlib import Path

import pytest

from app import research_lock


FAILED_MODEL_SHA = '8a1aadd1950a87fcf60192976605f514367024d66790365c24ede04281d1d1ae'
CONSUMED_FINAL_SHA = '633249567e95479a1c30b3f10b0a6271ced11684fb338d0b8b4054ca94b80aa6'


def test_phase4_fingerprints_are_registered():
    assert FAILED_MODEL_SHA in research_lock.RESEARCH_ONLY_RISK_MODELS
    assert research_lock.RESEARCH_ONLY_RISK_MODELS[FAILED_MODEL_SHA]['disposition'] == 'RESEARCH_ONLY'
    assert CONSUMED_FINAL_SHA in research_lock.CONSUMED_SNN_FINAL_DATASETS
    assert research_lock.CONSUMED_SNN_FINAL_DATASETS[CONSUMED_FINAL_SHA]['consumed'] is True


def test_failed_candidate_is_reported_research_only(monkeypatch, tmp_path: Path):
    candidate = tmp_path / 'candidate.pt'
    candidate.write_bytes(b'placeholder')
    monkeypatch.setattr(research_lock, 'sha256_file', lambda _: FAILED_MODEL_SHA)
    status = research_lock.research_only_risk_model_status(candidate)
    assert status is not None
    assert status['sha256'] == FAILED_MODEL_SHA
    assert status['decision'] == 'FINAL_2025_EXTERNAL_VALIDATION_FAIL'


def test_consumed_final_is_blocked_for_future_use(monkeypatch, tmp_path: Path):
    dataset = tmp_path / 'final.csv'
    dataset.write_text('locked', encoding='utf-8')
    monkeypatch.setattr(research_lock, 'sha256_file', lambda _: CONSUMED_FINAL_SHA)
    with pytest.raises(ValueError, match='permanently consumed'):
        research_lock.assert_not_consumed_snn_final(dataset, 'training')
