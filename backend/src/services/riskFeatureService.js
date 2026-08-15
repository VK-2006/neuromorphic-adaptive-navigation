// NAVORA_V11_5_RISK_FEATURES
const weather = require('./weatherService');

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number(value) || 0));

const CLASS_ALIASES = Object.freeze({
  'road debris': 'road blockage',
  'debris': 'road blockage',
  'road barrier': 'barrier',
  'fallen tree': 'road blockage',
  'construction equipment': 'construction',
  'construction vehicle': 'construction',
});

const ROAD_CONDITION_PRIOR = Object.freeze({
  pothole: 0.80,
  'road damage': 0.72,
  'road blockage': 0.88,
  barrier: 0.62,
  construction: 0.60,
});

function canonicalizeObjectClass(value) {
  const raw = String(value || 'unknown').trim().toLowerCase();
  return CLASS_ALIASES[raw] || raw || 'unknown';
}

function explicitNumber(value) {
  return value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value));
}

function validLocation(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

async function hydrateContext(context = {}, location = null) {
  const next = { ...(context || {}) };
  const meta = {
    weatherAvailable: false,
    weatherSource: 'unavailable',
    weatherCondition: null,
  };

  if (explicitNumber(next.weatherRisk)) {
    next.weatherRisk = clamp(next.weatherRisk);
    meta.weatherSource = 'request-context';
    return { context: next, weather: meta };
  }

  if (!validLocation(location)) {
    next.weatherRisk = 0;
    meta.weatherSource = 'no-location';
    return { context: next, weather: meta };
  }

  try {
    const current = await weather.currentAt(Number(location.lat), Number(location.lng));
    next.weatherRisk = clamp(current.weatherRisk);
    meta.weatherAvailable = true;
    meta.weatherSource = current.cacheHit ? 'openweathermap-cache' : 'openweathermap-live';
    meta.weatherCondition = current.condition || null;
    return { context: next, weather: meta };
  } catch (error) {
    next.weatherRisk = 0;
    meta.weatherSource = 'provider-unavailable';
    meta.weatherError = error.message;
    return { context: next, weather: meta };
  }
}

function buildFeatures(detection = null, context = {}, location = null, verifiedReports = 0) {
  const objectClass = canonicalizeObjectClass(detection?.objectClass);
  const roadCondition = explicitNumber(context?.roadCondition)
    ? clamp(context.roadCondition)
    : (ROAD_CONDITION_PRIOR[objectClass] ?? 0.20);

  const distance = explicitNumber(detection?.approximateDistance)
    ? Math.max(0, Number(detection.approximateDistance))
    : explicitNumber(detection?.estimatedDistance)
      ? Math.max(0, Number(detection.estimatedDistance))
      : explicitNumber(context?.estimatedDistance)
        ? Math.max(0, Number(context.estimatedDistance))
        : 10;

  return {
    objectClass,
    confidence: clamp(detection?.confidence),
    estimatedDistance: distance,
    relativeSpeed: explicitNumber(detection?.relativeSpeed)
      ? Number(detection.relativeSpeed)
      : (explicitNumber(context?.relativeSpeed) ? Number(context.relativeSpeed) : 0),
    userSpeed: Math.max(
      0,
      explicitNumber(location?.speed)
        ? Number(location.speed)
        : (explicitNumber(context?.userSpeed) ? Number(context.userSpeed) : 0),
    ),
    objectPersistence: clamp(
      explicitNumber(detection?.objectPersistence)
        ? detection.objectPersistence
        : context?.objectPersistence,
    ),
    trafficDensity: clamp(context?.trafficDensity),
    hazardFrequency: clamp(context?.hazardFrequency),
    visibility: clamp(explicitNumber(context?.visibility) ? context.visibility : 1),
    weatherRisk: clamp(context?.weatherRisk),
    roadCondition,
    verifiedReports: Math.max(0, Number(verifiedReports) || 0),
  };
}

module.exports = {
  CLASS_ALIASES,
  ROAD_CONDITION_PRIOR,
  canonicalizeObjectClass,
  explicitNumber,
  validLocation,
  hydrateContext,
  buildFeatures,
};
