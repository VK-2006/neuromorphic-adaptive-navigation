from __future__ import annotations

from typing import Any

import numpy as np

FEATURES = [
    "distance_km",
    "travel_time_min",
    "traffic_level",
    "road_condition",
    "pothole_level",
    "road_damage_level",
    "road_blockage_level",
    "weather_condition",
    "accident_risk",
    "pedestrian_density",
    "vehicle_density",
    "road_width",
    "lighting_condition",
    "historical_risk",
]


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _clip01(value: Any) -> float:
    return float(np.clip(_coerce_float(value), 0.0, 1.0))


def _normalize_feature(name: str, value: Any) -> float:
    raw = _coerce_float(value)
    if name == "distance_km":
        return _clip01(raw / 24.0)
    if name == "travel_time_min":
        return _clip01(raw / 100.0)
    if name in {"traffic_level", "road_condition", "lighting_condition"}:
        if name == "road_condition":
            return _clip01(raw / 2.0)
        return _clip01(raw / 2.0)
    if name in {"pothole_level", "road_damage_level", "road_blockage_level", "weather_condition"}:
        return _clip01(raw / 3.0)
    if name in {"accident_risk", "pedestrian_density", "vehicle_density", "historical_risk"}:
        return _clip01(raw)
    if name == "road_width":
        return _clip01(1.0 - (raw / 14.0))
    return _clip01(raw)


def normalize_route_risk_vector(raw_features: Any) -> np.ndarray:
    if isinstance(raw_features, dict):
        values = [raw_features.get(name, 0.0) for name in FEATURES]
    else:
        values = [getattr(raw_features, name, 0.0) for name in FEATURES]
    return np.array([_normalize_feature(name, value) for name, value in zip(FEATURES, values)], dtype=np.float32)
