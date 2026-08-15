// NAVORA_ROBOFLOW_SNN_V11_5
const env = require('../config/env');
const roboflow = require('./roboflowService');
const ai = require('./aiClient');
const hazards = require('./hazardService');
const riskFeatures = require('./riskFeatureService');
const Journey = require('../models/Journey');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));

function topDetection(detections = []) {
  return [...(Array.isArray(detections) ? detections : [])]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0] || null;
}

function buildFeatures(detections = [], context = {}, location = {}) {
  return riskFeatures.buildFeatures(
    topDetection(detections),
    context,
    location,
    context?.verifiedReports || 0,
  );
}

async function analyze({
  userId = null,
  journeyId = null,
  deviceId = null,
  image,
  classes,
  location = null,
  context = {},
  persist = true,
} = {}) {
  let journey = null;
  if (journeyId) {
    if (!userId) {
      const error = new Error('Authenticated user is required for journey analysis');
      error.status = 401;
      error.expose = true;
      throw error;
    }
    journey = await Journey.findOne({ _id: journeyId, userId });
    if (!journey) {
      const error = new Error('Journey unavailable for this user');
      error.status = 403;
      error.expose = true;
      throw error;
    }
  }

  const inference = await roboflow.infer({ image, classes });
  const top = topDetection(inference.detections);
  const hydrated = await riskFeatures.hydrateContext(context || {}, location || null);
  const features = riskFeatures.buildFeatures(
    top,
    hydrated.context,
    location || {},
    context?.verifiedReports || 0,
  );

  const risk = await ai.predictRiskResilient(features);

  const detectorValidated = false;
  const riskValidated = risk?.validated === true;
  const safetyEligible = detectorValidated && riskValidated;
  const canAffectLive =
    !journey ||
    journey.mode !== 'LIVE' ||
    !env.liveRequireValidatedAi ||
    safetyEligible;

  const score = Number(risk?.score);
  const researchPersistenceAllowed = Boolean(
    journey &&
    journey.mode !== 'LIVE' &&
    canAffectLive
  );

  let hazard = null;
  if (
    persist &&
    researchPersistenceAllowed &&
    top &&
    riskFeatures.validLocation(location) &&
    Number.isFinite(score) &&
    score >= 0.45
  ) {
    hazard = await hazards.dedupeAndUpsert({
      userId,
      journeyId: journey._id,
      deviceId,
      type: features.objectClass,
      location: {
        lat: Number(location.lat),
        lng: Number(location.lng),
      },
      confidence: top.confidence,
      snnRiskScore: clamp(score),
      snnRiskLevel: risk.level || 'LOW',
      metadata: {
        source: 'camera',
        detectorProvider: 'roboflow',
        detectorMode: 'roboflow-cloud-yolo-world',
        detectorVersion: env.roboflowWorkflowId || 'unknown',
        validated: false,
        cloudProcessed: true,
        weatherSource: hydrated.weather.weatherSource,
        detection: {
          approximateDistance: features.estimatedDistance,
          confidence: top.confidence,
          detectorMode: 'roboflow-cloud-yolo-world',
          detectorVersion: env.roboflowWorkflowId || 'unknown',
          providerBox: {
            x: top.x,
            y: top.y,
            width: top.width,
            height: top.height,
          },
          detectionId: top.detectionId,
        },
      },
    });
  }

  if (journey && Number.isFinite(score) && canAffectLive) {
    const normalizedScore = clamp(score);
    journey.averageRisk =
      ((journey.averageRisk || 0) * (journey.riskSamples || 0) + normalizedScore) /
      ((journey.riskSamples || 0) + 1);
    journey.maximumRisk = Math.max(journey.maximumRisk || 0, normalizedScore);
    journey.riskSamples = (journey.riskSamples || 0) + 1;
    if (hazard?.$locals?.wasCreated) {
      journey.hazardCount = (journey.hazardCount || 0) + 1;
    }

    journey.decisionEvents.push({
      type: 'ROBOFLOW_SNN_RISK',
      at: new Date(),
      hazardId: hazard?._id || null,
      hazardType: features.objectClass,
      riskScore: normalizedScore,
      riskLevel: risk.level,
      modelVersion: risk.modelVersion,
      aiMode: risk.mode,
      detector: 'roboflow-cloud-yolo-world',
      detectorValidated: false,
      cloudProcessed: true,
      weatherSource: hydrated.weather.weatherSource,
    });
    await journey.save();
  }

  return {
    inference,
    topDetection: top,
    featuresUsed: features,
    riskContext: hydrated.weather,
    risk,
    aiDegraded: risk?.degraded === true,
    aiError: risk?.error || null,
    hazardId: hazard?._id || null,
    detectorValidated,
    riskValidated,
    safetyEligible,
    canAffectLive,
    researchOnly: !safetyEligible,
    researchPersistenceAllowed,
    persistenceRequested: Boolean(persist),
    persisted: Boolean(hazard),
    journeyUpdated: Boolean(journey && Number.isFinite(score) && canAffectLive),
  };
}

module.exports = { topDetection, buildFeatures, analyze };
