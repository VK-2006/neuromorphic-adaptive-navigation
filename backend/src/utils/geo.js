const R = 6371000;
const rad = x => x * Math.PI / 180;

function haversine(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lng - a.lng);
  const la1 = rad(a.lat), la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function cumulative(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

function projectToRoute(p, coords) {
  if (!coords?.length) return { index: 0, distanceFromRoute: Infinity, distanceAlong: 0, total: 0 };
  if (coords.length === 1) return { index: 0, distanceFromRoute: haversine(p, coords[0]), distanceAlong: 0, total: 0, projected: coords[0] };

  const cum = cumulative(coords);
  let best = { index: 0, distanceFromRoute: Infinity, distanceAlong: 0, projected: coords[0] };

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const lat0 = rad((a.lat + b.lat + p.lat) / 3);
    const metersPerLat = Math.PI * R / 180;
    const metersPerLng = metersPerLat * Math.cos(lat0);
    const bx = (b.lng - a.lng) * metersPerLng;
    const by = (b.lat - a.lat) * metersPerLat;
    const px = (p.lng - a.lng) * metersPerLng;
    const py = (p.lat - a.lat) * metersPerLat;
    const denom = bx * bx + by * by;
    const t = denom ? Math.max(0, Math.min(1, (px * bx + py * by) / denom)) : 0;
    const qx = bx * t, qy = by * t;
    const dx = px - qx, dy = py - qy;
    const distanceFromRoute = Math.hypot(dx, dy);
    if (distanceFromRoute < best.distanceFromRoute) {
      const segmentLength = cum[i + 1] - cum[i];
      best = {
        index: i,
        distanceFromRoute,
        distanceAlong: cum[i] + segmentLength * t,
        projected: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t },
      };
    }
  }
  return { ...best, total: cum.at(-1) || 0 };
}

function bearing(a,b){const p1=rad(a.lat),p2=rad(b.lat),dl=rad(b.lng-a.lng);const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return (Math.atan2(y,x)*180/Math.PI+360)%360}
function angularDiff(a,b){if(!Number.isFinite(Number(a))||!Number.isFinite(Number(b)))return 0;const d=Math.abs(Number(a)-Number(b))%360;return Math.min(d,360-d)}

function routeBoundingBox(coords, pad = 0.01) {
  const lats = coords.map(x => x.lat), lngs = coords.map(x => x.lng);
  return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad };
}

module.exports = { haversine, cumulative, projectToRoute, bearing, angularDiff, routeBoundingBox };
