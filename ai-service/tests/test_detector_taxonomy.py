import pytest

from app.detector_taxonomy import CANONICAL_CLASSES, CLASS_ORDER, NUM_CLASSES, SOURCE_CLASSES, TRAINABLE_CLASSES, ordered_classes, validate_source_class


def test_rdd2022_has_exactly_nine_trainable_classes_in_canonical_order():
    assert TRAINABLE_CLASSES == ['D00', 'D01', 'D10', 'D11', 'D20', 'D40', 'D43', 'D44', 'D50']
    assert CANONICAL_CLASSES == TRAINABLE_CLASSES
    assert NUM_CLASSES == 9


def test_ordered_classes_uses_canonical_dynamic_head_order():
    assert ordered_classes({'D20', 'D01', 'D00', 'D10'}) == [
        'D00', 'D01', 'D10', 'D20'
    ]


def test_bdd100k_accepts_road_actors_and_roadside_objects():
    for class_name in ['person', 'car', 'traffic cone', 'barrier']:
        validate_source_class('BDD100K', class_name)


def test_bdd100k_rejects_rdd_damage_labels():
    with pytest.raises(ValueError):
        validate_source_class('BDD100K', 'pothole')


def test_legacy_rdd2022_labels_remain_accepted():
    validate_source_class('RDD2022', 'road damage')
    validate_source_class('RDD2022', 'pothole')


def test_source_exports_retain_backward_compatible_classes():
    assert 'person' in CLASS_ORDER
    assert 'BDD100K' in SOURCE_CLASSES


def test_rdd2022_accepts_canonical_damage_labels():
    for class_name in ['D00', 'D01', 'D10', 'D11', 'D20', 'D40', 'D43', 'D44', 'D50']:
        validate_source_class('RDD2022', class_name)


def test_rdd2022_source_contract_preserves_legacy_labels():
    validate_source_class('RDD2022', 'road damage')
    validate_source_class('RDD2022', 'pothole')


def test_rdd2022_rejects_quarantine_label():
    with pytest.raises(ValueError):
        validate_source_class('RDD2022', 'D0w0')


def test_quarantine_label_is_not_orderable_as_a_model_class():
    with pytest.raises(ValueError):
        ordered_classes({'D00', 'D0w0'})


def test_rdd2022_rejects_non_rdd_class_names():
    with pytest.raises(ValueError):
        validate_source_class('RDD2022', 'car')


def test_unknown_source_is_rejected():
    with pytest.raises(ValueError):
        validate_source_class('UNKNOWN_DATASET', 'D00')


def test_unknown_class_is_rejected_by_ordering():
    with pytest.raises(ValueError):
        ordered_classes({'D00', 'spaceship'})
