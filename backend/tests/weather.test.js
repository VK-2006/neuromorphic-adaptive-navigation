const env = require('../src/config/env');
const weather = require('../src/services/weatherService');

describe('OpenWeatherMap integration', () => {
  const original = {
    provider: env.weatherProvider,
    apiUrl: env.openWeatherApiUrl,
    apiKey: env.openWeatherApiKey,
    cacheTtl: env.weatherCacheTtlSeconds,
    riskWeight: env.weatherRouteRiskWeight,
    fetch: global.fetch,
  };

  beforeEach(() => {
    env.weatherProvider = 'openweathermap';
    env.openWeatherApiUrl = 'https://api.openweathermap.org/data/2.5';
    env.openWeatherApiKey = 'unit-test-key';
    env.weatherCacheTtlSeconds = 300;
    env.weatherRouteRiskWeight = 0.15;
    weather.clearCache();
  });

  afterEach(() => {
    global.fetch = original.fetch;
  });

  afterAll(() => {
    env.weatherProvider = original.provider;
    env.openWeatherApiUrl = original.apiUrl;
    env.openWeatherApiKey = original.apiKey;
    env.weatherCacheTtlSeconds = original.cacheTtl;
    env.weatherRouteRiskWeight = original.riskWeight;
    global.fetch = original.fetch;
    weather.clearCache();
  });

  test('normalizes current weather and computes bounded weather risk', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        weather: [{ id: 501, main: 'Rain', description: 'moderate rain' }],
        main: { temp: 27.5, feels_like: 29, humidity: 78 },
        visibility: 4500,
        wind: { speed: 7.5 },
        rain: { '1h': 3.2 },
        clouds: { all: 95 },
        dt: 1700000000,
      }),
    }));

    const result = await weather.currentAt(17.385, 78.4867);

    expect(result.provider).toBe('openweathermap');
    expect(result.weatherAvailable).toBe(true);
    expect(result.weatherRisk).toBeGreaterThan(0);
    expect(result.weatherRisk).toBeLessThanOrEqual(1);
    expect(result.visibilityMeters).toBe(4500);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const calledUrl = String(global.fetch.mock.calls[0][0]);
    expect(calledUrl).toContain('/weather?');
    expect(calledUrl).toContain('lat=17.385');
    expect(calledUrl).toContain('lon=78.4867');
    expect(calledUrl).toContain('appid=unit-test-key');
    expect(calledUrl).toContain('units=metric');
  });

  test('route annotation fails safely when the API key is unavailable', async () => {
    env.openWeatherApiKey = '';
    global.fetch = jest.fn();

    const result = await weather.annotate({
      id: 'route-1',
      coordinates: [{ lat: 17.38, lng: 78.48 }, { lat: 17.39, lng: 78.49 }],
    });

    expect(result.weatherAvailable).toBe(false);
    expect(result.weatherRisk).toBe(0);
    expect(result.weatherStatus).toBe('provider-unavailable');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
