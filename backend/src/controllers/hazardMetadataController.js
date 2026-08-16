// NAVORA_V11_5_LOCAL_METADATA
const ai = require('../services/aiClient');
const env = require('../config/env');
const Hazard = require('../models/Hazard');
const Journey = require('../models/Journey');
const hazards = require('../services/hazardService');
const riskFeatures = require('../services/riskFeatureService');
const { ok } = require('../utils/response');
const logger = require('../config/logger');

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, Number(v) || 0));
const finite = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

const EARTH_RADIUS_METERS = 6378100;
const VERIFIED_REPORT_RADIUS_METERS = 1200;

async function verifiedNearby(location) {
  const lat = finite(location?.lat, NaN);
  const lng = finite(location?.lng, NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;

  try {
    return await Hazard.countDocuments({
      status: 'VERIFIED',
      expiresAt: { $gt: new Date() },
      location: {
        $geoWithin: {
          $centerSphere: [
            [lng, lat],
            VERIFIED_REPORT_RADIUS_METERS / EARTH_RADIUS_METERS,
          ],
        },
      },
    });
  } catch (error) {
    logger.warn({
      event: 'verified_hazard_count_failed',
      message: error.message,
    });
    return 0;
  }
}

exports.analyze = async (req, res) => {
  let journey = null;
  if (req.body.journeyId) {
    journey = await Journey.findOne({ _id: req.body.journeyId, userId: req.user._id });
    if (!journey) {
      return res.status(403).json({ success: false, message: 'Journey unavailable for this user' });
    }
    if (journey.status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        message: 'Journey-linked perception requires an active journey',
      });
    }
  }

  const detections = (Array.isArray(req.body.detections) ? req.body.detections : [])
    .map((d) => ({
      objectClass: String(d?.objectClass || 'unknown').slice(0, 80),
      confidence: clamp(d?.confidence),
      boundingBox: Array.isArray(d?.boundingBox)
        ? d.boundingBox.slice(0, 4).map((x) => clamp(x))
        : undefined,
      approximateDistance: Math.max(0, finite(d?.estimatedDistance, 10)),
      relativeSpeed: finite(d?.relativeSpeed, 0),
      objectPersistence: clamp(d?.objectPersistence),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = detections[0] || null;
  const verifiedReports = await verifiedNearby(req.body.location);
  const hydrated = await riskFeatures.hydrateContext(req.body.context || {}, req.body.location);
  const features = riskFeatures.buildFeatures(
    top,
    hydrated.context,
    req.body.location,
    verifiedReports,
  );

  const risk = await ai.predictRisk(features);
  const detectorValidated = false;
  const riskValidated = risk?.validated === true;
  const safetyEligible = detectorValidated && riskValidated;
  const canAffectLive =
    journey?.mode !== 'LIVE' ||
    !env.liveRequireValidatedAi ||
    safetyEligible;

  const score = Number(risk?.score);
  const locationValid = riskFeatures.validLocation(req.body.location);
  const researchPersistenceAllowed = Boolean(
    journey &&
    journey.mode !== 'LIVE' &&
    canAffectLive
  );

  let hazard = null;
  if (
    researchPersistenceAllowed &&
    top &&
    locationValid &&
    Number.isFinite(score) &&
    score >= 0.45
  ) {
    hazard = await hazards.dedupeAndUpsert({
      userId: req.user._id,
      journeyId: journey._id,
      deviceId: req.body.deviceId || null,
      type: features.objectClass,
      location: {
        lat: Number(req.body.location.lat),
        lng: Number(req.body.location.lng),
      },
      confidence: top.confidence,
      snnRiskScore: clamp(score),
      snnRiskLevel: risk.level || 'LOW',
      metadata: {
        source: 'camera',
        detectorProvider: 'browser',
        detectorMode: 'browser-local-coco-ssd',
        detectorVersion: 'coco-ssd-2.2.3-lite_mobilenet_v2',
        validated: false,
        frameTransmitted: false,
        weatherSource: hydrated.weather.weatherSource,
        detection: {
          boundingBox: top.boundingBox,
          approximateDistance: top.approximateDistance,
          confidence: top.confidence,
          detectorMode: 'browser-local-coco-ssd',
          detectorVersion: 'coco-ssd-2.2.3-lite_mobilenet_v2',
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
      type: 'LOCAL_METADATA_RISK',
      at: new Date(),
      hazardId: hazard?._id || null,
      hazardType: features.objectClass,
      riskScore: normalizedScore,
      riskLevel: risk.level,
      modelVersion: risk.modelVersion,
      aiMode: risk.mode,
      frameTransmitted: false,
      detector: 'browser-local-coco-ssd',
      weatherSource: hydrated.weather.weatherSource,
    });

    await journey.save();

    req.app.get('io')?.to(`journey:${journey._id}`).emit('snn:risk', {
      score: normalizedScore,
      riskLevel: risk.level,
      modelVersion: risk.modelVersion,
      mode: risk.mode,
      safetyEligible,
      frameTransmitted: false,
      hazardId: hazard?._id || null,
    });
  }

  ok(res, {
    detections,
    risk,
    hazardId: hazard?._id || null,
    aiMode: risk?.mode || 'unknown',
    detectorValidated,
    riskValidated,
    safetyEligible,
    canAffectLive,
    researchPersistenceAllowed,
    featuresUsed: features,
    riskContext: hydrated.weather,
    privacy: {
      frameTransmitted: false,
      detectorLocation: 'browser',
      detector: 'coco-ssd',
      networkPayload: 'metadata-only',
    },
  });
};
