# Architecture

## Components
1. Browser/PWA: authentication UI, Leaflet map, GPS, optional camera, voice, Three.js, chat.
2. Node orchestration: auth/RBAC, provider abstractions, Socket.IO, journeys, hazards, CRM/DTW/EMA/ACO, explainability.
3. MongoDB: user/session, route/journey, geospatial hazards, route memory, chat, audit data.
4. FastAPI AI: image decode/detection, temporal SNN risk, metadata/explainability.

## Route selection
Source/destination → candidate provider routes → traffic annotation → hazard exposure → CRM/DTW → safety score → ACO → explanation. Live SNN hazards feed subsequent reroute evaluation and future route memory.
