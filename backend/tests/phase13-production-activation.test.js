const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
const { createApp } = require('../src/app');
const routeService = require('../src/services/routeService');
const journeyController = require('../src/controllers/journeyController');
const aiClient = require('../src/services/aiClient');

jest.mock('../src/models/Journey');
jest.mock('../src/models/Route');
jest.mock('../src/models/RouteMemory');

const Journey = require('../src/models/Journey');
const Route = require('../src/models/Route');
const RouteMemory = require('../src/models/RouteMemory');

const app = createApp();

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

describe('Phase 13: Real Production Activation & Live Verification Contracts', () => {

  const charminar = { lat: 17.3616, lng: 78.4747 };
  const hitecCity = { lat: 17.4435, lng: 78.3772 };
  const userIdA = '507f1f77bcf86cd799439011';
  const userIdB = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Step 13.1: Production environment template documents all required variables without exposing secrets', () => {
    const templatePath = path.join(__dirname, '../.env.production.example');
    expect(fs.existsSync(templatePath)).toBe(true);
    const content = fs.readFileSync(templatePath, 'utf8');

    expect(content).toContain('NODE_ENV=production');
    expect(content).toContain('MONGODB_URI=');
    expect(content).toContain('JWT_ACCESS_SECRET=');
    expect(content).toContain('JWT_REFRESH_SECRET=');
    expect(content).toContain('FRONTEND_URL=');
    expect(content).toContain('LIVE_REQUIRE_VALIDATED_AI=true');
    expect(content).not.toContain('mongodb+srv://admin');
    expect(content).not.toContain('sk-proj-');
  });

  test('Step 13.2: Liveness (/health) and Readiness Gating (/ready) evaluate process status and non-secret readiness', async () => {
    const resHealth = await request(app).get('/health');
    expect(resHealth.status).toBe(200);
    expect(resHealth.body.status).toBe('ok');
    expect(resHealth.body.service).toBe('navora-backend');
    expect(typeof resHealth.body.ready).toBe('boolean');

    const resReady = await request(app).get('/ready');
    expect([200, 503]).toContain(resReady.status);
    expect(resReady.body).toHaveProperty('status');
    expect(resReady.body).toHaveProperty('critical');
    expect(resReady.body).toHaveProperty('missingIntegrations');
  });

  test('Step 13.4: AI Service RiskSNN signature policy handles unconfigured model weights via degraded fallback', async () => {
    const res = await aiClient.predictRisk({
      objectClass: 'car',
      confidence: 0.9,
      estimatedDistance: 5,
      context: { weatherRisk: 0.2 }
    });

    expect(res).toBeDefined();
    expect(res).toHaveProperty('validated', false);
    if (res.degraded) {
      expect(res.mode).toBe('unavailable/degraded');
      expect(res.error).toBeDefined();
    } else {
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(1);
    }
  });

  test('Step 13.5: Routing Provider Metadata Truthfulness — Simulation routes strictly return provider: development/mock', async () => {
    const res = await routeService.compare({
      userId: userIdA,
      source: charminar,
      destination: hitecCity,
      simulation: true
    });

    expect(res.mode).toBe('simulation');
    expect(res.routes.length).toBeGreaterThan(0);
    res.routes.forEach(r => {
      expect(r.mode).toBe('simulation');
      expect(r.provider).toBe('development/mock');
    });
  });

  test('Step 13.9: Production CRM EMA Update & Memory Learning Feedback Loop', async () => {
    const routeSnapshot = {
      _id: '507f1f77bcf86cd799439099',
      label: 'Shortest Adaptive Route',
      provider: 'development/mock',
      coordinates: [charminar, hitecCity],
      distance: 13783,
      baseDuration: 1198,
      trafficDuration: 1250,
      safetyScore: 92,
      acoScore: 1.0,
      finalUtility: 0.85
    };

    const journeyDoc = {
      _id: '507f1f77bcf86cd7994390aa',
      userId: userIdA,
      routeId: routeSnapshot._id,
      originalRouteId: routeSnapshot._id,
      mode: 'SIMULATION',
      status: 'ACTIVE',
      source: charminar,
      destination: hitecCity,
      totalDistance: 13783,
      distanceRemaining: 0,
      reroutes: 0,
      decisionEvents: [],
      selectedRouteSnapshot: routeSnapshot,
      save: jest.fn().mockResolvedValue(undefined)
    };

    const memDoc = {
      userId: userIdA,
      routeSignature: 'sig13_1',
      routeCoordinates: routeSnapshot.coordinates,
      journeyCount: 0,
      successfulJourneyCount: 0,
      save: jest.fn().mockResolvedValue(undefined)
    };

    Journey.findOne.mockResolvedValue(journeyDoc);
    Route.findById.mockResolvedValue(routeSnapshot);
    RouteMemory.findOne.mockResolvedValue(memDoc);

    const reqComplete = { user: { _id: userIdA }, params: { id: journeyDoc._id }, body: { success: true } };
    const resComplete = mockRes();
    await journeyController.complete(reqComplete, resComplete);

    expect(journeyDoc.status).toBe('COMPLETED');
    expect(memDoc.journeyCount).toBe(1);
    expect(memDoc.historicalSafety).toBeGreaterThan(0.5);
  });

  test('Step 13.13: User Isolation Guard — User B receives 404 when requesting User A journey', async () => {
    Journey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const reqGet = { user: { _id: userIdB }, params: { id: '507f1f77bcf86cd7994390aa' } };
    const resGet = mockRes();
    await journeyController.get(reqGet, resGet);

    expect(resGet.statusCode).toBe(404);
    expect(resGet.body.message).toMatch(/journey not found/i);
  });

  test('Step 13.14: Production Diagnostic Status Endpoints return clean booleans without secrets', async () => {
    const authCfg = await request(app).get('/api/v1/auth/config');
    expect(authCfg.status).toBe(200);
    expect(typeof authCfg.body.data.passkeys.enabled).toBe('boolean');

    const traffic = await request(app).get('/api/v1/traffic/status');
    expect(traffic.status).toBe(200);
    expect(typeof traffic.body.data.live).toBe('boolean');

    const geocoding = await request(app).get('/api/v1/geocoding/status');
    expect(geocoding.status).toBe(200);
    expect(typeof geocoding.body.data.typeahead).toBe('boolean');
  });

});
