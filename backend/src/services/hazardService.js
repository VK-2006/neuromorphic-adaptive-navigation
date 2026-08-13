const mongoose = require('mongoose');
const Hazard = require('../models/Hazard');
const Reputation = require('../models/UserReputation');
const { haversine } = require('../utils/geo');

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
async function dedupeAndUpsert({ userId, journeyId, deviceId, type, location, confidence, snnRiskScore, snnRiskLevel, metadata }) {
  if (!location || mongoose.connection.readyState !== 1) return null;
  const near = await Hazard.findOne({
    type,
    journeyId,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        $maxDistance: 35,
      },
    },
    lastSeenAt: { $gt: new Date(Date.now() - 120000) },
  });
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
    await near.save();
    near.$locals.wasCreated = false;
    return near;
  }
  const created = await Hazard.create({
    userId, journeyId, deviceId, type,
    location: { type: 'Point', coordinates: [location.lng, location.lat] },
    confidence, snnRiskScore, snnRiskLevel,
    reporterReputation: reputation,
    trustScore: t,
    metadata,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
  created.$locals.wasCreated = true;
  return created;
}

module.exports = { trust, getExposure, dedupeAndUpsert };
