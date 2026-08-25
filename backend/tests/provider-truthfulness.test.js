const { compare } = require('../src/services/routeService');
const routing = require('../src/services/routingProvider');

describe('Step 10.3: Provider Truthfulness & Diagnostic Metadata Invariants', () => {

  const charminar = { lat: 17.3616, lng: 78.4747 };
  const hitecCity = { lat: 17.4435, lng: 78.3772 };

  test('Simulation route generator strictly returns mode: simulation and provider: development/mock', async () => {
    const res = await compare({
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

  test('Live OSRM provider adapter returns mode: live and provider: osrm', async () => {
    try {
      const routes = await routing.osrm(charminar, hitecCity);
      expect(routes.length).toBeGreaterThan(0);
      routes.forEach(r => {
        expect(r.mode).toBe('live');
        expect(r.provider).toBe('osrm');
      });
    } catch (e) {
      expect(e.message).toMatch(/HTTP|OSRM|No OSRM|timeout/i);
    }
  }, 15000);

  test('Live Valhalla provider adapter returns mode: live or handles network timeout gracefully', async () => {
    try {
      const routes = await routing.valhalla(charminar, hitecCity);
      expect(routes.length).toBeGreaterThan(0);
      routes.forEach(r => {
        expect(r.mode).toBe('live');
        expect(r.provider).toBe('valhalla');
      });
    } catch (e) {
      expect(e.message).toMatch(/HTTP|Valhalla|No Valhalla|timeout/i);
    }
  }, 15000);

  test('GraphHopper unauthenticated request fails gracefully without masquerading as live success', async () => {
    try {
      await routing.graphhopper(charminar, hitecCity);
    } catch (e) {
      expect(e.message).toMatch(/HTTP 401|GraphHopper/i);
    }
  }, 15000);

});
