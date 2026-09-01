const request = require('supertest');
process.env.NODE_ENV = 'test';

const { createApp } = require('../src/app');
const app = createApp();

describe('Step 10.4: Production Observability & Structured Diagnostics Contracts', () => {

  test('/health endpoint exposes system diagnostics (service, mode, database, ready, commit) without credentials', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('navora-backend');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('ready');
    expect(res.body).toHaveProperty('commit');

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('MONGODB_URI');
    expect(str).not.toContain('SUPER_SECRET_KEY');
  });

  test('/ready endpoint exposes per-check diagnostics and returns 200 or 503 gating', async () => {
    const res = await request(app).get('/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('critical');
    expect(res.body).toHaveProperty('missingIntegrations');

    const str = JSON.stringify(res.body);
    expect(str).not.toContain('JWT_REFRESH_SECRET=');
    expect(str).not.toContain('secret-key-value');
  });

  test('Status endpoints (/api/v1/auth/config, /api/v1/traffic/status, /api/v1/geocoding/status, /api/v1/chat/status) return clean booleans', async () => {
    const authCfg = await request(app).get('/api/v1/auth/config');
    expect(authCfg.status).toBe(200);
    expect(typeof authCfg.body.data.passkeys.enabled).toBe('boolean');

    const traffic = await request(app).get('/api/v1/traffic/status');
    expect(traffic.status).toBe(200);
    expect(typeof traffic.body.data.live).toBe('boolean');

    const geocoding = await request(app).get('/api/v1/geocoding/status');
    expect(geocoding.status).toBe(200);
    expect(typeof geocoding.body.data.typeahead).toBe('boolean');

    const chat = await request(app).get('/api/v1/chat/status');
    expect(chat.status).toBe(200);
    expect(chat.body.data.available).toBe(true);
  });

});
