from __future__ import annotations

# Backward-compatible detector taxonomy. Keep the original public exports
# because BDD100K callers still use them.
CLASS_ORDER = [
    'person', 'bicycle', 'motorcycle', 'car', 'bus', 'truck',
    'traffic cone', 'barrier', 'road damage', 'pothole',
]

# Ordered list of the nine trainable RDD2022 model classes.
CANONICAL_CLASSES = [
    "D00",  # Longitudinal Crack
    "D01",  # Transverse Crack
    "D10",  # Alligator Crack
    "D11",  # Pothole (large)
    "D20",  # Pothole (small)
    "D40",  # Road‑shoulder damage
    "D43",  # Road‑shoulder/edge crack
    "D44",  # Road‑shoulder/edge pothole
    "D50",  # Manhole / Utility cover
]

# Mapping from the raw RDD2022 identifiers to the canonical names.  In the
# official dataset the identifiers already match the canonical set, but this
# dictionary makes the relationship explicit and allows future extensions.
RDD_TO_CANONICAL = {
    "D00": "D00",
    "D01": "D01",
    "D10": "D10",
    "D11": "D11",
    "D20": "D20",
    "D40": "D40",
    "D43": "D43",
    "D44": "D44",
    "D50": "D50",
    # The anomalous label — we map it to None to signal quarantine.
    "D0w0": None,
}

QUARANTINED_CLASSES = {"D0w0"}

SOURCE_CLASSES = {
    'BDD100K': set(CLASS_ORDER[:8]),
    # Preserve the original source contract; canonical RDD2022 model classes
    # are declared separately in CANONICAL_CLASSES.
    'RDD2022': {'road damage', 'pothole'},
}

# Reverse mapping for convenience.
CANONICAL_TO_RDD = {v: k for k, v in RDD_TO_CANONICAL.items() if v is not None}

# Keep the model class contract explicit. Quarantined raw labels must never
# enter a model head even if they appear in future annotation metadata.
TRAINABLE_CLASSES = list(CANONICAL_TO_RDD.keys())

# Number of trainable classes — used to size the detection head.
NUM_CLASSES = len(TRAINABLE_CLASSES)

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def ordered_classes(values) -> list[str]:
    """Return the list of class names ordered according to ``CANONICAL_CLASSES``.

    ``values`` may be any iterable of class identifiers (raw RDD IDs or
    canonical names).  Unknown identifiers raise ``ValueError``.
    """
    values = set(values)
    unknown = sorted(values - set(CLASS_ORDER) - set(CANONICAL_CLASSES))
    if unknown:
        raise ValueError(f"unsupported detector classes: {unknown}")
    # Preserve the canonical ordering.
    return [c for c in CLASS_ORDER + CANONICAL_CLASSES if c in values]


def validate_source_class(source: str, class_name: str) -> None:
    """Validate that ``class_name`` is allowed for ``source``.

    The only supported source for Phase‑17 is ``"RDD2022"``.  Any other source
    raises ``ValueError``.  ``D0w0`` is explicitly rejected.
    """
    allowed = SOURCE_CLASSES.get(source)
    if allowed is None:
        raise ValueError(f"unsupported detector source: {source!r}")
    if class_name == "D0w0":
        raise ValueError("D0w0 is quarantined and cannot be used for training")
    if class_name not in allowed and not (source == "RDD2022" and class_name in CANONICAL_CLASSES):
        raise ValueError(f"class {class_name!r} is not valid for detector source {source!r}")


def validate_source_classes(source: str, class_names) -> None:
    """Validate a collection of class names for a given source."""
    for class_name in class_names:
        validate_source_class(source, class_name)

TAXONOMY = CANONICAL_CLASSES
