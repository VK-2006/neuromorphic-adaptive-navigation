# NAVORA Route Risk Dataset

This is a deterministic, manually curated prototype dataset for the camera-free NAVORA mini-project. It is not a public benchmark, GPS-ground-truth dataset, or representative sample of real-world roads.

The 14 input features are `distance_km`, `travel_time_min`, `traffic_level`, `road_condition`, `pothole_level`, `road_damage_level`, `road_blockage_level`, `weather_condition`, `accident_risk`, `pedestrian_density`, `vehicle_density`, `road_width`, `lighting_condition`, and `historical_risk`. The target is `route_risk_score` in `[0, 1]`.

Generate or reproduce the 800 records and deterministic 70/15/15 split with:

```bash
python scripts/create_navora_dataset.py --seed 42 --records 800
```

The generated CSV and JSON artifacts are local research inputs. Larger independent real-world validation is required before production use.
