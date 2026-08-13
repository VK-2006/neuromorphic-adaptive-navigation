# Navora Frontend

Static HTML5/CSS3/ES6 frontend served by the Node backend. Leaflet/OpenStreetMap is the primary navigation map; Three.js is used only for research visualizations/effects. The frontend includes all prompt-required auth, dashboard, map, live journey, chat, devices, memory/history/replay, notifications/profile/settings and admin screens.

Key browser features: single Geolocation watcher, MediaDevices camera selection, explicit detection toggle, journey-scoped WebRTC mobile-camera streaming, optional documented Web Bluetooth GATT commands/sensors, Web Speech navigation, Socket.IO live updates, Chart.js metrics and installable PWA/offline shell. Camera/GPS/Bluetooth/WebAuthn require appropriate secure context/device permission.

Theme modes are LIGHT, DARK and SYSTEM and persist locally. Reduced-motion preferences disable/minimize non-essential effects.

## Premium UI Layer

The production-facing visual system is layered through `assets/css/premium.css` and `assets/js/premium-ui.js`. These files enhance presentation, motion, accessibility, responsive behavior and Three.js experience while preserving the existing IDs, APIs and event-driven business logic. See `../docs/ui-premium-transformation.md` for the full report.


## Cinematic UI v4

The current presentation layer is `assets/css/cinematic.css` + `assets/js/cinematic-ui.js`, layered after the existing product styles. See `../docs/ui-cinematic-v4.md`.
