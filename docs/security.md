# Security Guide

Passwords use bcrypt hashes; OTPs and refresh tokens are stored hashed. Access/refresh tokens use HttpOnly cookies where appropriate, with refresh rotation/revocation. APIs use Helmet, CORS, rate limiting, validation and RBAC. Socket.IO verifies JWTs and joins private rooms. Chat strips HTML and applies flood protection/ownership checks. Exact GPS is not broadcast globally. No raw camera video is stored by default. Never log or commit passwords, OTPs, JWTs, MongoDB credentials, Google secrets, Brevo keys, routing keys or traffic keys.
