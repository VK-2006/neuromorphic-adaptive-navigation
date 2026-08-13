# Navora Backend

Node.js/Express 5 orchestration service. It owns authentication/RBAC, MongoDB, routing/geocoding/traffic abstractions, journey/GPS orchestration, hazards/reputation, CRM/DTW/EMA/ACO/XAI, Socket.IO, trusted sharing/SOS, World Chat and admin operations. The FastAPI AI service remains separate.

## Local

```bash
npm install
npm start
```

The backend serves the static frontend and uses `const PORT = process.env.PORT || 5000;`. If MongoDB is temporarily unavailable, HTTP can start in degraded mode and background reconnect attempts continue.

## Verification

```bash
npm test
npm audit --audit-level=high
```

From the repository root, `python scripts/final_verify.py --runtime` also runs the isolated Mongo-backed full runtime flow.

## Render-ready source contract

- Environment: Node
- Root: `backend`
- Build: `npm ci`
- Start: `npm start`
- Port: `process.env.PORT || 5000`

Keep the checked-in `backend/package-lock.json`. `scripts/prepush_audit.py` verifies its direct dependency specifications match `package.json` before Git push.
