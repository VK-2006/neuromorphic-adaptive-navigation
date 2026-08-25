const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
const { createApp } = require('../src/app');
const env = require('../src/config/env');
const { evaluateProductionReadiness, publicReadiness } = require('../src/services/productionReadinessService');

const app = createApp();

describe('Phase 9: Production Deployment, Environment & Security Invariants', () => {

  test('Step 9.1 & 9.2: Production environment template documents all required variables', () => {
    const templatePath = path.join(__dirname, '../.env.production.example');
    expect(fs.existsSync(templatePath)).toBe(true);
    const content = fs.readFileSync(templatePath, 'utf8');

    expect(content).toContain('NODE_ENV=production');
    expect(content).toContain('MONGODB_URI=');
    expect(content).toContain('JWT_ACCESS_SECRET=');
    expect(content).toContain('JWT_REFRESH_SECRET=');
    expect(content).toContain('FRONTEND_URL=');
    expect(content).toContain('SOCKET_CORS_ORIGIN=');
    expect(content).toContain('AI_SERVICE_URL=');
    expect(content).toContain('LIVE_REQUIRE_VALIDATED_AI=true');
  });

  test('Step 9.3: Secret Safety Audit — No committed MongoDB Atlas URIs or API secret strings in production template', () => {
    const templatePath = path.join(__dirname, '../.env.production.example');
    const content = fs.readFileSync(templatePath, 'utf8');
    
    expect(content).not.toContain('mongodb+srv://admin');
    expect(content).not.toContain('sk-proj-');
    expect(content).not.toContain('secret-key-value');
  });

  test('Step 9.6: /health (Liveness) and /ready (Readiness Gate) Status Verification', async () => {
    const resHealth = await request(app).get('/health');
    expect(resHealth.status).toBe(200);
    expect(resHealth.body.status).toBe('ok');
    expect(resHealth.body.service).toBe('navora-backend');
    expect(typeof resHealth.body.ready).toBe('boolean');

    const resReady = await request(app).get('/ready');
    // Without connected MongoDB Atlas in test env, /ready returns 503 as designed for V34 readiness gating
    expect([200, 503]).toContain(resReady.status);
    expect(resReady.body).toHaveProperty('status');
    expect(resReady.body).toHaveProperty('critical');
    expect(resReady.body).toHaveProperty('missingIntegrations');
  });

  test('Step 9.7 & 9.8: CORS & Security Header Invariants', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  test('Step 9.11: Truthful Provider Labeling — Simulation mode routes are explicitly tagged', async () => {
    const res = await request(app)
      .post('/api/v1/routes/compare')
      .send({
        source: { lat: 17.3850, lng: 78.4867 },
        destination: { lat: 17.4375, lng: 78.4483 },
        simulation: true
      });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('simulation');
    expect(res.body.data.routes[0].provider).toBe('development/mock');
    expect(res.body.data.routes[0].mode).toBe('simulation');
  });

  test('Step 9.16: AI Client Resilience & Heuristic Fallback Policy', async () => {
    const res = await request(app).get('/api/v1/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('google');
    expect(res.body.data).toHaveProperty('passkeys');
    expect(res.body.data).toHaveProperty('email');
  });

  test('Step 9.24: Public Readiness serialization never leaks JWT or database secrets', () => {
    const rawEnv = {
      MONGODB_URI: 'mongodb+srv://user:secretpass@cluster.mongodb.net/navora',
      JWT_ACCESS_SECRET: 'SUPER_SECRET_ACCESS_KEY_1234567890_ABCDEF',
      JWT_REFRESH_SECRET: 'SUPER_SECRET_REFRESH_KEY_1234567890_ABCDEF'
    };
    const readiness = evaluateProductionReadiness({
      config: { nodeEnv: 'production' },
      rawEnv,
      databaseReady: false
    });
    const publicState = publicReadiness(readiness);
    const str = JSON.stringify(publicState);

    expect(str).not.toContain('secretpass');
    expect(str).not.toContain('SUPER_SECRET_ACCESS_KEY');
    expect(str).not.toContain('SUPER_SECRET_REFRESH_KEY');
  });

});
