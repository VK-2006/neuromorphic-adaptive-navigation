# Render Deployment Guide — Future Only

Do **not** deploy as part of the current implementation task.

Future Node service settings:

- Environment: Node
- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Application port: `const PORT = process.env.PORT || 5000;`

Production configuration must provide MongoDB Atlas URI, strong JWT secrets, production frontend/socket origins, separate FastAPI AI URL, Google identity credentials, Brevo credentials and any chosen routing/traffic credentials. Use HTTPS/WSS and secure cookies. Keep the FastAPI AI service separate.

`npm ci` requires a checked-in `package-lock.json`. This sandbox could not obtain every npm package from registry/cache, so it could not honestly generate the lockfile. On a networked development machine run `npm install` in `backend`, review the generated lockfile, run the full Jest suite, then future Render builds may use `npm ci` without source-code redesign.
