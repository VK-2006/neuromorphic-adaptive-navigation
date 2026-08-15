const DETECTION_SIMILARITY_THRESHOLD = 0.45;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function validBox(box) {
  return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0;
}

function boxSimilarity(a, b) {
  if (!validBox(a) || !validBox(b)) return null;
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const ax2 = ax + aw, ay2 = ay + ah, bx2 = bx + bw, by2 = by + bh;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay, by));
  const intersection = ix * iy;
  const union = aw * ah + bw * bh - intersection;
  const iou = union > 0 ? intersection / union : 0;
  const acx = ax + aw / 2, acy = ay + ah / 2;
  const bcx = bx + bw / 2, bcy = by + bh / 2;
  const centerDistance = Math.hypot(acx - bcx, acy - bcy);
  const centerSimilarity = 1 - Math.min(1, centerDistance / 0.5);
  const sizeDelta = Math.abs(aw - bw) + Math.abs(ah - bh);
  const sizeScale = Math.max(0.05, aw + ah, bw + bh);
  const sizeSimilarity = 1 - Math.min(1, sizeDelta / sizeScale);
  return clamp01(0.30 * iou + 0.45 * centerSimilarity + 0.25 * sizeSimilarity);
}

function relativeSimilarity(a, b, floor = 1) {
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return clamp01(1 - Math.abs(x - y) / Math.max(floor, Math.abs(x), Math.abs(y)));
}

function detectionSimilarity(existingMetadata = {}, incomingMetadata = {}) {
  const previous = existingMetadata?.detection;
  const current = incomingMetadata?.detection;
  if (!previous || !current) return null;

  const parts = [];
  const box = boxSimilarity(previous.boundingBox, current.boundingBox);
  if (box != null) parts.push([0.55, box]);

  const distance = relativeSimilarity(previous.approximateDistance, current.approximateDistance, 5);
  if (distance != null) parts.push([0.25, distance]);

  const confidence = relativeSimilarity(previous.confidence, current.confidence, 1);
  if (confidence != null) parts.push([0.15, confidence]);

  if (previous.detectorMode && current.detectorMode) {
    parts.push([0.03, previous.detectorMode === current.detectorMode ? 1 : 0]);
  }
  if (previous.detectorVersion && current.detectorVersion) {
    parts.push([0.02, previous.detectorVersion === current.detectorVersion ? 1 : 0]);
  }

  if (!parts.length) return null;
  const totalWeight = parts.reduce((sum, [weight]) => sum + weight, 0);
  return clamp01(parts.reduce((sum, [weight, score]) => sum + weight * score, 0) / totalWeight);
}

module.exports = {
  detectionSimilarity,
  boxSimilarity,
  DETECTION_SIMILARITY_THRESHOLD,
};
