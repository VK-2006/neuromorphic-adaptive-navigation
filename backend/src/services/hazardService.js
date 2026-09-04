const mongoose = require('mongoose');
const Hazard = require('../models/Hazard');
const Reputation = require('../models/UserReputation');
const { haversine } = require('../utils/geo');

const DEDUPE_DISTANCE_METERS = 35;
const DEDUPE_WINDOW_MS = 120000;
const { detectionSimilarity, boxSimilarity, DETECTION_SIMILARITY_THRESHOLD } = require('./hazardSimilarity');

function trust({ confidence = 0.5, reputation = 0.5, confirmations = 0, snnRisk = 0.5, adminVerified = false }) {
  return Math.max(0, Math.min(1,
    0.30 * confidence +
    0.20 * reputation +
    0.15 * Math.min(1, confirmations / 5) +
    0.20 * snnRisk +
    0.15 * (adminVerified ? 1 : 0)
  ));
}

async function getExposure(route, { journeyId = null } = {}) {
  const empty={exposure:0,snnRisk:0,hazardCount:0,verifiedHazardCount:0,pendingLocalHazardCount:0};
  if (mongoose.connection.readyState !== 1) return empty;
  try {
    const active = { expiresAt: { $gt: new Date() } };
    const visibility = journeyId ? { $or: [{ status: 'VERIFIED' }, { journeyId, status: 'PENDING' }] } : { status: 'VERIFIED' };
    const docs = await Hazard.find({ ...active, ...visibility }).lean();
    let trustSum = 0, snnSum=0, count = 0, verified=0, pendingLocal=0;
    for (const h of docs) {
      const p = { lat: h.location.coordinates[1], lng: h.location.coordinates[0] };
      let d = Infinity;
      for (const c of route.coordinates) d = Math.min(d, haversine(p, c));
      if (d < 100) {
        trustSum += h.trustScore ?? h.snnRiskScore ?? 0.5;
        snnSum += h.snnRiskScore ?? 0;
        count += 1;
        if(h.status==='VERIFIED')verified+=1;else if(journeyId&&String(h.journeyId)===String(journeyId))pendingLocal+=1;
      }
    }
    return {exposure:Math.min(1,count?trustSum/Math.max(2,count):0),snnRisk:Math.min(1,count?snnSum/count:0),hazardCount:count,verifiedHazardCount:verified,pendingLocalHazardCount:pendingLocal};
  } catch {
    return empty;
  }
}

async function findDedupeCandidate({ type, journeyId, location, metadata }) {
  const query = {
    type,
    journeyId: journeyId || null,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        $maxDistance: DEDUPE_DISTANCE_METERS,
      },
    },
    lastSeenAt: { $gt: new Date(Date.now() - DEDUPE_WINDOW_MS) },
  };
  const candidates = await Hazard.find(query).limit(12);
  if (!candidates.length) return { hazard: null, similarity: null };

  // Community/manual reports have no per-frame visual evidence, so the original
  // type + proximity + time + journey dedupe rule remains appropriate for them.
  if (metadata?.source !== 'camera') return { hazard: candidates[0], similarity: null };

  let best = null;
  let bestSimilarity = -1;
  for (const candidate of candidates) {
    const similarity = detectionSimilarity(candidate.metadata || {}, metadata || {});
    if (similarity != null && similarity > bestSimilarity) {
      best = candidate;
      bestSimilarity = similarity;
    }
  }
  return best && bestSimilarity >= DETECTION_SIMILARITY_THRESHOLD
    ? { hazard: best, similarity: bestSimilarity }
    : { hazard: null, similarity: bestSimilarity >= 0 ? bestSimilarity : null };
}

async function dedupeAndUpsert({ userId, journeyId, type, location, confidence, snnRiskScore, snnRiskLevel, metadata }) {
  if (!location || mongoose.connection.readyState !== 1) return null;
  const { hazard: near, similarity } = await findDedupeCandidate({ type, journeyId, location, metadata });
  const rep = userId ? await Reputation.findOne({ userId }) : null;
  const reputation = rep?.reputationScore ?? 0.5;
  const t = trust({ confidence, reputation, confirmations: near?.nearbyConfirmations || 0, snnRisk: snnRiskScore });
  if (near) {
    near.lastSeenAt = new Date();
    near.detectionCount += 1;
    near.confidence = Math.max(near.confidence || 0, confidence || 0);
    near.snnRiskScore = Math.max(near.snnRiskScore || 0, snnRiskScore || 0);
    near.snnRiskLevel = snnRiskLevel;
    near.trustScore = t;
    near.metadata = {
      ...(near.metadata || {}),
      ...(metadata || {}),
      dedupe: {
        strategy: metadata?.source === 'camera'
          ? 'type+geography+time+journey+detection-similarity'
          : 'type+geography+time+journey',
        similarity,
        threshold: metadata?.source === 'camera' ? DETECTION_SIMILARITY_THRESHOLD : null,
        mergedAt: new Date().toISOString(),
      },
    };
    await near.save();
    near.$locals.wasCreated = false;
    near.$locals.detectionSimilarity = similarity;
    return near;
  }
  const created = await Hazard.create({
    userId, journeyId, type,
    location: { type: 'Point', coordinates: [location.lng, location.lat] },
    confidence, snnRiskScore, snnRiskLevel,
    reporterReputation: reputation,
    trustScore: t,
    metadata: {
      ...(metadata || {}),
      dedupe: {
        strategy: metadata?.source === 'camera'
          ? 'type+geography+time+journey+detection-similarity'
          : 'type+geography+time+journey',
        similarity: null,
        threshold: metadata?.source === 'camera' ? DETECTION_SIMILARITY_THRESHOLD : null,
      },
    },
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
  created.$locals.wasCreated = true;
  created.$locals.detectionSimilarity = similarity;
  return created;
}

module.exports = {
  trust,
  getExposure,
  dedupeAndUpsert,
  detectionSimilarity,
  boxSimilarity,
  DETECTION_SIMILARITY_THRESHOLD,
};
