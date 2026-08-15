// NAVORA_OPENWEATHER_V11_2
const env = require('../config/env');
const logger = require('../config/logger');

const cache = new Map();
const providerCalls = [];
const PROVIDER_CALLS_PER_MINUTE = 55;

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function status() {
  return {
    provider: env.weatherProvider,
    configured: env.weatherProvider === 'openweathermap' && Boolean(env.openWeatherApiKey),
    cacheTtlSeconds: env.weatherCacheTtlSeconds,
    routeRiskWeight: env.weatherRouteRiskWeight,
    riskMethod: 'deterministic-observation-heuristic-v1',
  };
}

function assertCoordinates(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || a < -90 || a > 90 || !Number.isFinite(b) || b < -180 || b > 180) {
    const error = new Error('Valid latitude and longitude are required');
    error.status = 422;
    error.expose = true;
    throw error;
  }
  return { lat: a, lng: b };
}

function conditionRisk(id, rain1h, snow1h) {
  const code = Number(id) || 800;
  if (code >= 200 && code < 300) return 0.95;
  if (code >= 300 && code < 400) return 0.35;
  if (code >= 500 && code < 600) return clamp(0.42 + (rain1h / 10));
  if (code >= 600 && code < 700) return clamp(0.60 + (snow1h / 12));
  if (code >= 700 && code < 800) return 0.70;
  if (code === 800) return 0.05;
  if (code > 800) return 0.15;
  return 0.20;
}

function normalize(payload, lat, lng) {
  const visibility = Number.isFinite(Number(payload.visibility)) ? Number(payload.visibility) : 10000;
  const windSpeed = Number(payload.wind?.speed) || 0;
  const rain1h = Number(payload.rain?.['1h']) || 0;
  const snow1h = Number(payload.snow?.['1h']) || 0;
  const conditionId = Number(payload.weather?.[0]?.id) || 800;

  const visibilityRisk = 1 - clamp(visibility / 10000);
  const precipitationRisk = clamp((rain1h + snow1h) / 8);
  const windRisk = clamp(windSpeed / 20);
  const observedConditionRisk = conditionRisk(conditionId, rain1h, snow1h);
  const weatherRisk = clamp(
    0.35 * visibilityRisk +
    0.30 * precipitationRisk +
    0.20 * observedConditionRisk +
    0.15 * windRisk
  );

  return {
    provider: 'openweathermap',
    weatherAvailable: true,
    weatherRisk,
    weatherRiskMethod: 'deterministic-observation-heuristic-v1',
    location: { lat, lng },
    conditionId,
    condition: payload.weather?.[0]?.main || 'Unknown',
    description: payload.weather?.[0]?.description || 'unknown',
    temperatureC: Number.isFinite(Number(payload.main?.temp)) ? Number(payload.main.temp) : null,
    feelsLikeC: Number.isFinite(Number(payload.main?.feels_like)) ? Number(payload.main.feels_like) : null,
    humidity: Number.isFinite(Number(payload.main?.humidity)) ? Number(payload.main.humidity) : null,
    visibilityMeters: visibility,
    windSpeedMps: windSpeed,
    rain1hMm: rain1h,
    snow1hMm: snow1h,
    cloudPercent: Number(payload.clouds?.all) || 0,
    observedAt: payload.dt ? new Date(Number(payload.dt) * 1000).toISOString() : new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
}

function trimProviderBudget() {
  const cutoff = Date.now() - 60_000;
  while (providerCalls.length && providerCalls[0] < cutoff) providerCalls.shift();
  if (providerCalls.length >= PROVIDER_CALLS_PER_MINUTE) {
    const error = new Error('Weather provider request budget temporarily exhausted');
    error.status = 503;
    error.expose = true;
    throw error;
  }
  providerCalls.push(Date.now());
}

async function currentAt(lat, lng, { force = false } = {}) {
  const point = assertCoordinates(lat, lng);
  if (env.weatherProvider !== 'openweathermap') {
    const error = new Error('OpenWeatherMap provider is not active');
    error.status = 503;
    error.expose = true;
    throw error;
  }
  if (!env.openWeatherApiKey) {
    const error = new Error('OpenWeatherMap API key is not configured');
    error.status = 503;
    error.expose = true;
    throw error;
  }

  const cacheKey = `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  const ttlMs = Math.max(30, Number(env.weatherCacheTtlSeconds) || 300) * 1000;
  if (!force && cached && Date.now() - cached.cachedAt < ttlMs) {
    return { ...cached.data, cacheHit: true };
  }

  trimProviderBudget();
  const base = String(env.openWeatherApiUrl || 'https://api.openweathermap.org/data/2.5').replace(/\/+$/, '');
  const url = new URL(`${base}/weather`);
  url.searchParams.set('lat', String(point.lat));
  url.searchParams.set('lon', String(point.lng));
  url.searchParams.set('appid', env.openWeatherApiKey);
  url.searchParams.set('units', 'metric');

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Navora/1.0' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (cause) {
    const error = new Error('OpenWeatherMap request failed');
    error.status = 503;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`OpenWeatherMap returned HTTP ${response.status}`);
    error.status = 503;
    throw error;
  }

  const payload = await response.json();
  const data = normalize(payload, point.lat, point.lng);
  cache.set(cacheKey, { cachedAt: Date.now(), data });
  return { ...data, cacheHit: false };
}

function unavailable(reason = 'unavailable') {
  return {
    weatherAvailable: false,
    weatherRisk: 0,
    weatherRiskMethod: 'deterministic-observation-heuristic-v1',
    weatherProvider: env.weatherProvider || null,
    weatherCondition: null,
    weatherDescription: null,
    weatherVisibilityMeters: null,
    weatherWindSpeedMps: null,
    weatherRain1hMm: null,
    weatherTemperatureC: null,
    weatherObservedAt: null,
    weatherStatus: reason,
  };
}

async function annotate(route) {
  const coordinates = Array.isArray(route?.coordinates) ? route.coordinates : [];
  if (!coordinates.length) return unavailable('route-has-no-coordinates');
  const point = coordinates[Math.floor(coordinates.length / 2)];
  if (!point) return unavailable('route-has-no-midpoint');

  try {
    const data = await currentAt(point.lat, point.lng);
    return {
      weatherAvailable: true,
      weatherRisk: data.weatherRisk,
      weatherRiskMethod: data.weatherRiskMethod,
      weatherProvider: data.provider,
      weatherCondition: data.condition,
      weatherDescription: data.description,
      weatherVisibilityMeters: data.visibilityMeters,
      weatherWindSpeedMps: data.windSpeedMps,
      weatherRain1hMm: data.rain1hMm,
      weatherTemperatureC: data.temperatureC,
      weatherObservedAt: data.observedAt,
      weatherStatus: data.cacheHit ? 'cache-hit' : 'live',
    };
  } catch (error) {
    logger.warn({
      event: 'weather_annotation_unavailable',
      message: error.message,
      routeId: route?.id || null,
    });
    return unavailable('provider-unavailable');
  }
}

function clearCache() {
  cache.clear();
  providerCalls.splice(0, providerCalls.length);
}

module.exports = {
  status,
  currentAt,
  annotate,
  normalize,
  clearCache,
};
