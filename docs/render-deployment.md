# Render Deployment Guide — Future Production Step

The source is prepared for a later deployment; this guide does not create cloud resources or secrets.

Backend Render settings:

- Environment: Node
- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Port contract: `const PORT = process.env.PORT || 5000;`

The Git working repository must keep the verified `backend/package-lock.json`. The final pre-push audit checks that its direct dependency specifications match `package.json` so `npm ci` will not fail because of a stale lockfile.

Production configuration must supply MongoDB Atlas, strong JWT secrets, HTTPS frontend/socket origins, the separately deployed FastAPI AI URL, Google/Brevo credentials and any live traffic/routing credentials. Use HTTPS/WSS and secure cookies. Do not commit those values.
