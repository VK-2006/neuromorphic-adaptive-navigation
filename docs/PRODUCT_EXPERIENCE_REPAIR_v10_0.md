# NAVORA Product Experience Repair v10.0

This release addresses screenshot-confirmed UX failures and the backend/data gaps behind them.

## Fixed
- Landing route-network panel can no longer remain visually empty when Three.js/WebGL fails: a built-in route graph backdrop is always present.
- Protected/admin sidebar uses a three-row layout so the account/profile/logout/theme block stays anchored to the bottom while only navigation scrolls.
- Live Journey camera controls, detection controls and privacy note are grouped into one dock; HUD stays at the top; journey stats no longer overlay the map.
- Live Journey without an active journey now shows a guided setup state instead of a confusing blank camera cockpit.
- Route and safety views now emphasize secure camera/WebRTC boundaries and live GPS telemetry rather than device-controller metadata.
- Route Memory now shows summary metrics and full CRM fields: familiarity, historical safety, reliability, average/max risk, hazards, reroutes, feedback and last journey.
- History now opens a full on-screen journey detail dialog using the existing replay endpoint, including route map, timestamps, risk, hazards, reroutes and decision-event timeline.
- Profile now includes richer personal/account information and navigation-activity summary.
- Settings now persist theme, units, voice language, detection default and high-accuracy GPS preference alongside route priorities.
- Dashboard safety-trend zero state is explicitly presented instead of appearing like a broken empty card.

## Backend additions
- User optional profile fields + richer preferences.
- `/users/me/summary`.
- Device-controller telemetry is intentionally removed from the navigation product surface.
- `/memory/summary`.
- RouteMemory route label/source/destination/provider/distance/lastJourney metadata.

No synthetic journey, safety, CRM or history data is created.
