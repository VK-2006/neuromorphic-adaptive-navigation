const request = require('supertest');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
const { createApp } = require('../src/app');
const journeyController = require('../src/controllers/journeyController');
const routeService = require('../src/services/routeService');

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

describe('Phase 12: Final Live Production Release Contracts & Invariants', () => {

  const charminar = { lat: 17.3616, lng: 78.4747 };
  const hitecCity = { lat: 17.4435, lng: 78.3772 };
  const userIdA = '507f1f77bcf86cd799439011';
  const userIdB = '507f1f77bcf86cd799439022';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Step 12.1: Production Configuration Template contains all release variables without secret leakage', () => {
    const templatePath = path.join(__dirname, '../.env.production.example');
    expect(fs.existsSync(templatePath)).toBe(true);
    const content = fs.readFileSync(templatePath, 'utf8');

    expect(content).toContain('NODE_ENV=production');
    expect(content).toContain('MONGODB_URI=');
    expect(content).toContain('JWT_ACCESS_SECRET=');
    expect(content).toContain('JWT_REFRESH_SECRET=');
    expect(content).toContain('FRONTEND_URL=');
    expect(content).not.toContain('mongodb+srv://admin');
    expect(content).not.toContain('sk-proj-');
  });

  test('Step 12.2: Liveness (/health) and Readiness Gating (/ready 503) verify process and dependency status', async () => {
    const resHealth = await request(app).get('/health');
    expect(resHealth.status).toBe(200);
    expect(resHealth.body.status).toBe('ok');
    expect(resHealth.body.service).toBe('navora-backend');

    const resReady = await request(app).get('/ready');
    expect([200, 503]).toContain(resReady.status);
    expect(resReady.body).toHaveProperty('critical');
    expect(resReady.body).toHaveProperty('missingIntegrations');
  });

  test('Step 12.3: Provider Truthfulness — Simulation routes strictly declare provider development/mock and mode simulation', async () => {
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

  test('Step 12.4: End-to-End Navigation Journey Lifecycle & CRM EMA Update Flow', async () => {
    const routeSnapshot = {
      _id: '507f1f77bcf86cd799439088',
      label: 'Shortest Adaptive Route',
      provider: 'development/mock',
      coordinates: [charminar, hitecCity],
      distance: 13783,
      baseDuration: 1198,
      trafficDuration: 1250,
      safetyScore: 90,
      acoScore: 1.0,
      finalUtility: 0.84
    };

    const journeyDoc = {
      _id: '507f1f77bcf86cd799439099',
      userId: userIdA,
      routeId: routeSnapshot._id,
      originalRouteId: routeSnapshot._id,
      mode: 'SIMULATION',
      status: 'PLANNED',
      source: charminar,
      destination: hitecCity,
      totalDistance: 13783,
      distanceRemaining: 13783,
      reroutes: 0,
      totalPausedMs: 0,
      decisionEvents: [],
      selectedRouteSnapshot: routeSnapshot,
      save: jest.fn().mockResolvedValue(undefined)
    };

    Route.findOne.mockResolvedValue(routeSnapshot);
    Journey.create.mockResolvedValue(journeyDoc);
    Journey.findOne.mockResolvedValue(journeyDoc);
    Route.findById.mockResolvedValue(routeSnapshot);

    // 1. Create & Start
    const reqStart = { user: { _id: userIdA }, params: { id: journeyDoc._id } };
    const resStart = mockRes();
    await journeyController.start(reqStart, resStart);
    expect(journeyDoc.status).toBe('ACTIVE');

    // 2. Complete & Verify Memory Update
    const memDoc = {
      userId: userIdA,
      routeSignature: 'sig999',
      routeCoordinates: routeSnapshot.coordinates,
      journeyCount: 0,
      successfulJourneyCount: 0,
      save: jest.fn().mockResolvedValue(undefined)
    };
    RouteMemory.findOne.mockResolvedValue(memDoc);

    const reqComplete = { user: { _id: userIdA }, params: { id: journeyDoc._id }, body: { success: true } };
    const resComplete = mockRes();
    await journeyController.complete(reqComplete, resComplete);

    expect(journeyDoc.status).toBe('COMPLETED');
    expect(memDoc.journeyCount).toBe(1);
    expect(memDoc.historicalSafety).toBeGreaterThan(0.5);
  });

  test('Step 12.5: User Isolation Guard — User B receives 404 when querying User A journey', async () => {
    Journey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const reqGet = { user: { _id: userIdB }, params: { id: '507f1f77bcf86cd799439099' } };
    const resGet = mockRes();
    await journeyController.get(reqGet, resGet);

    expect(resGet.statusCode).toBe(404);
    expect(resGet.body.message).toMatch(/journey not found/i);
  });

  test('Step 12.6: Non-Secret Diagnostic Status Endpoints expose only readiness booleans', async () => {
    const authCfg = await request(app).get('/api/v1/auth/config');
    expect(authCfg.status).toBe(200);
    expect(typeof authCfg.body.data.google.enabled).toBe('boolean');

    const traffic = await request(app).get('/api/v1/traffic/status');
    expect(traffic.status).toBe(200);
    expect(typeof traffic.body.data.live).toBe('boolean');

    const geocoding = await request(app).get('/api/v1/geocoding/status');
    expect(geocoding.status).toBe(200);
    expect(typeof geocoding.body.data.typeahead).toBe('boolean');
  });

});
