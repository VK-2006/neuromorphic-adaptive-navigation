import pytest

from app.detector_taxonomy import ordered_classes, validate_source_class


def test_ordered_classes_uses_canonical_dynamic_head_order():
    assert ordered_classes({'pothole', 'car', 'person', 'road damage'}) == [
        'person', 'car', 'road damage', 'pothole'
    ]


def test_bdd100k_accepts_road_actors_and_roadside_objects():
    for class_name in ['person', 'car', 'traffic cone', 'barrier']:
        validate_source_class('BDD100K', class_name)


def test_bdd100k_rejects_rdd_damage_labels():
    with pytest.raises(ValueError):
        validate_source_class('BDD100K', 'pothole')


def test_rdd2022_accepts_damage_and_pothole():
    validate_source_class('RDD2022', 'road damage')
    validate_source_class('RDD2022', 'pothole')


def test_rdd2022_rejects_bdd_actor_class():
    with pytest.raises(ValueError):
        validate_source_class('RDD2022', 'car')


def test_unknown_source_is_rejected():
    with pytest.raises(ValueError):
        validate_source_class('UNKNOWN_DATASET', 'pothole')


def test_unknown_class_is_rejected_by_ordering():
    with pytest.raises(ValueError):
        ordered_classes({'car', 'spaceship'})
