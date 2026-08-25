const journeyController = require('../src/controllers/journeyController');
const routeService = require('../src/services/routeService');
const routeMemoryService = require('../src/services/routeMemoryService');

jest.mock('../src/models/Journey');
jest.mock('../src/models/Route');
jest.mock('../src/models/RouteMemory');
jest.mock('../src/models/JourneyLocationPoint');
jest.mock('../src/models/Hazard');

const Journey = require('../src/models/Journey');
const Route = require('../src/models/Route');
const RouteMemory = require('../src/models/RouteMemory');
const Point = require('../src/models/JourneyLocationPoint');
const Hazard = require('../src/models/Hazard');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

describe('Phase 8: End-to-End User Journey Lifecycle & Feedback Loop', () => {

  const userIdA = '507f1f77bcf86cd799439011';
  const userIdB = '507f1f77bcf86cd799439022';
  const charminar = { lat: 17.3616, lng: 78.4747 };
  const hitecCity = { lat: 17.4435, lng: 78.3772 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Step 8.1: Authenticated User A compares adaptive routes and receives ranking with explanations', async () => {
    const res = await routeService.compare({
      userId: userIdA,
      source: charminar,
      destination: hitecCity,
      preferences: { safety: 0.8, traffic: 0.5, familiarity: 0.3 },
      simulation: true
    });

    expect(res.routes.length).toBeGreaterThanOrEqual(3);
    expect(res.recommendedRouteId).toBeTruthy();
    const selected = res.routes.find(r => r.id === res.recommendedRouteId);
    expect(selected.explanation.title).toBe('WHY THIS ROUTE?');
    expect(selected.routeTypes).toContain('ADAPTIVE');
  });

  test('Step 8.2 & 8.3: Journey Lifecycle (create -> start -> reroute -> complete -> CRM update)', async () => {
    const routeSnapshot = {
      _id: '507f1f77bcf86cd799439033',
      label: 'Shortest Route',
      provider: 'development/mock',
      coordinates: [charminar, hitecCity],
      distance: 13783,
      baseDuration: 1198,
      trafficDuration: 1250,
      safetyScore: 88,
      acoScore: 1.0,
      finalUtility: 0.82
    };

    const journeyDoc = {
      _id: '507f1f77bcf86cd799439044',
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
      hazardCount: 0,
      totalPausedMs: 0,
      decisionEvents: [],
      selectedRouteSnapshot: routeSnapshot,
      save: jest.fn().mockResolvedValue(undefined)
    };

    Route.findOne.mockResolvedValue(routeSnapshot);
    Journey.create.mockResolvedValue(journeyDoc);
    Journey.findOne.mockResolvedValue(journeyDoc);
    Route.findById.mockResolvedValue(routeSnapshot);

    // 1. Create Journey
    const reqCreate = { user: { _id: userIdA }, body: { routeId: routeSnapshot._id, source: charminar, destination: hitecCity } };
    const resCreate = mockRes();
    await journeyController.create(reqCreate, resCreate);
    expect(resCreate.statusCode).toBe(201);
    expect(resCreate.body.data._id).toBe(journeyDoc._id);

    // 2. Start Journey
    const reqStart = { user: { _id: userIdA }, params: { id: journeyDoc._id } };
    const resStart = mockRes();
    await journeyController.start(reqStart, resStart);
    expect(journeyDoc.status).toBe('ACTIVE');
    expect(journeyDoc.decisionEvents.some(e => e.type === 'JOURNEY_STARTED')).toBe(true);

    // 3. Switch Route (Reroute)
    const newRouteSnapshot = {
      _id: '507f1f77bcf86cd799439055',
      label: 'Safest Route',
      provider: 'development/mock',
      coordinates: [charminar, { lat: 17.4000, lng: 78.4500 }, hitecCity],
      distance: 14100,
      safetyScore: 95,
      acoScore: 0.95,
      finalUtility: 0.85
    };
    Route.findOne.mockResolvedValue(newRouteSnapshot);

    const reqReroute = {
      user: { _id: userIdA },
      params: { id: journeyDoc._id },
      body: { routeId: newRouteSnapshot._id, reason: 'avoided sudden obstacle' },
      app: { get: () => ({ to: () => ({ emit: jest.fn() }) }) }
    };
    const resReroute = mockRes();
    await journeyController.switchRoute(reqReroute, resReroute);
    expect(journeyDoc.reroutes).toBe(1);
    expect(journeyDoc.decisionEvents.some(e => e.type === 'REROUTE_ACCEPTED')).toBe(true);

    // 4. Complete Journey & CRM Update
    const memDoc = {
      userId: userIdA,
      routeSignature: 'sig123',
      routeCoordinates: newRouteSnapshot.coordinates,
      journeyCount: 0,
      successfulJourneyCount: 0,
      save: jest.fn().mockResolvedValue(undefined)
    };
    RouteMemory.findOne.mockResolvedValue(memDoc);

    const reqComplete = {
      user: { _id: userIdA },
      params: { id: journeyDoc._id },
      body: { success: true, userFeedback: 0.9 }
    };
    const resComplete = mockRes();
    await journeyController.complete(reqComplete, resComplete);

    expect(journeyDoc.status).toBe('COMPLETED');
    expect(memDoc.journeyCount).toBe(1);
    expect(memDoc.successfulJourneyCount).toBe(1);
    expect(memDoc.historicalSafety).toBeGreaterThan(0.5);
    expect(journeyDoc.decisionEvents.some(e => e.type === 'CRM_EMA_UPDATED')).toBe(true);
  });

  test('Step 8.4: User Isolation Guard — User B cannot read or replay User A journey', async () => {
    Journey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const reqGet = { user: { _id: userIdB }, params: { id: '507f1f77bcf86cd799439044' } };
    const resGet = mockRes();
    await journeyController.get(reqGet, resGet);

    expect(resGet.statusCode).toBe(404);
    expect(resGet.body.message).toMatch(/journey not found/i);
  });

  test('Step 8.5: Replay Bundle Endpoint returns complete journey event log, points, and hazard history', async () => {
    const journeyDoc = {
      _id: '507f1f77bcf86cd799439044',
      userId: userIdA,
      originalRouteId: '507f1f77bcf86cd799439033',
      routeId: '507f1f77bcf86cd799439055',
      mode: 'SIMULATION',
      status: 'COMPLETED',
      decisionEvents: [
        { type: 'JOURNEY_STARTED', at: new Date() },
        { type: 'JOURNEY_COMPLETED', at: new Date() }
      ]
    };
    Journey.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(journeyDoc) });
    Point.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    Hazard.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });
    Route.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const reqReplay = { user: { _id: userIdA }, params: { id: journeyDoc._id } };
    const resReplay = mockRes();
    await journeyController.replay(reqReplay, resReplay);

    expect(resReplay.statusCode).toBe(200);
    expect(resReplay.body.data.journey._id).toBe(journeyDoc._id);
    expect(resReplay.body.data.events.length).toBeGreaterThanOrEqual(2);
  });

});
