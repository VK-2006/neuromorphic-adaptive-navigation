from __future__ import annotations

CLASS_ORDER = [
    'person',
    'bicycle',
    'motorcycle',
    'car',
    'bus',
    'truck',
    'traffic cone',
    'barrier',
    'road damage',
    'pothole',
]

SOURCE_CLASSES = {
    'BDD100K': {
        'person', 'bicycle', 'motorcycle', 'car', 'bus', 'truck',
        'traffic cone', 'barrier',
    },
    'RDD2022': {'road damage', 'pothole'},
}


def ordered_classes(values) -> list[str]:
    values = set(values)
    unknown = sorted(values - set(CLASS_ORDER))
    if unknown:
        raise ValueError(f'unsupported detector classes: {unknown}')
    return [name for name in CLASS_ORDER if name in values]


def validate_source_class(source: str, class_name: str) -> None:
    allowed = SOURCE_CLASSES.get(source)
    if allowed is None:
        raise ValueError(f'unsupported detector source: {source!r}')
    if class_name not in allowed:
        raise ValueError(
            f'class {class_name!r} is not valid for detector source {source!r}'
        )


def validate_source_classes(source: str, class_names) -> None:
    for class_name in class_names:
        validate_source_class(source, class_name)
