# Performance Guide

Camera rendering can remain near device frame rate while AI inference is throttled (frontend uses ~4 FPS by default). GPS is a single watcher. Three.js initializes one scene/renderer/animation loop and disposes geometry/materials/textures. Map updates avoid duplicate listeners. MongoDB uses indexes. Production should add metrics for P95 route latency, AI latency, socket throughput, memory/GPU usage and map FPS.
