# Navora Backend

Node.js/Express 5 orchestration service. Express 5 is used so rejected async route-handler promises flow to the central error middleware. It owns authentication/RBAC, MongoDB, route/geocode/traffic provider abstractions, journey/GPS orchestration, hazards/reputation, CRM/DTW/EMA/ACO/XAI, Socket.IO, trusted sharing/SOS, chat and admin operations. The FastAPI AI service remains separate.

## Local

```bash
npm install
npm start
```

The backend serves the static frontend and uses `const PORT = process.env.PORT || 5000;`. If MongoDB is temporarily unavailable, the HTTP service starts in degraded mode and performs background reconnect attempts instead of crashing the whole application.

## Render-ready source contract

- Environment: Node
- Root: `backend`
- Build: `npm ci`
- Start: `npm start`
- Port: `process.env.PORT || 5000`

`npm ci` requires `backend/package-lock.json`. The current sandbox could not reach the npm registry/cache for all packages, so lockfile generation is an environment warning rather than a fabricated artifact. Run `npm install` once on a networked development machine, commit the generated lockfile only after review, then use `npm ci` for Render.
