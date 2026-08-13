# Senior UI System v4

## Design principles
1. **Navigation-first:** map, journey, risk, memory and routing concepts determine visual emphasis.
2. **Operational clarity:** surface hierarchy is based on decision priority rather than decorative effects.
3. **Controlled motion:** transitions are short and state-driven; background motion is optional and reduced-motion aware.
4. **Functional preservation:** existing IDs, handlers, endpoints and feature modules remain intact.
5. **Theme parity:** light and dark modes use independent surface/contrast tokens rather than inversion.

## Core assets
- `frontend/assets/css/premium.css` — complete senior design layer and responsive system.
- `frontend/assets/js/premium-ui.js` — UI shell enhancement, command palette, auth visual, mobile navigation, runtime affordances and accessibility support.
- `frontend/assets/js/three-scenes.js` — optimized route-intelligence Three.js scene.
- `frontend/assets/js/app-shell.js` — DOM placement compatibility for the upgraded action area while preserving auth/PWA behavior.
- `frontend/service-worker.js` — refreshed cache identity.

## Functional boundaries
No API endpoint, MongoDB model, JWT flow, route algorithm, AI inference contract, Socket.IO room contract, camera permission behavior or Bluetooth protocol is replaced by this UI update.
