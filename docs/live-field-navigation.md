# Navora Live Field Navigation

This update changes the primary journey experience from a screen-only demo into a foreground, installable PWA field-navigation workflow.

## Field behavior
- Simulation is OFF by default on the route planner.
- LIVE journeys use high-accuracy `watchPosition` GPS and server-side map matching.
- Tracking writes are coalesced to avoid flooding the backend; the latest unsent GPS fix is retained locally when connectivity drops and synced when connectivity returns.
- Screen Wake Lock is requested for active LIVE journeys and reacquired when the page becomes visible again.
- A full-screen control is provided for field use.
- Socket.IO connection, GPS accuracy, network, wake-lock, routing-provider and AI-readiness states are visible in the live HUD.
- Destination arrival requires repeated qualifying fixes before automatic journey completion/CRM update.
- Camera inference uses smaller compressed frames with backpressure to reduce mobile data/CPU pressure.

## Safety gate
Unvalidated AI is never treated as safety-certified. The AI service now reports whether detector/SNN weights are marked validated. For LIVE journeys, unvalidated camera detections may be shown for research but do not automatically persist as live camera hazards or trigger camera-driven automatic rerouting when `LIVE_REQUIRE_VALIDATED_AI=true`.

## Deployment requirement
Real phone field use requires one public HTTPS origin for the frontend/backend, a reachable AI service, a real routing provider, and phone permissions for location/camera. A normal mobile browser cannot be relied on for unrestricted background GPS after the page becomes hidden or the device locks; Navora therefore treats foreground/installed-PWA use as the supported field mode.
