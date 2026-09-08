export type LatLng = { lat: number; lng: number };

const EARTH_M = 6_371_000;

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Compass heading in degrees: 0 = north, 90 = east. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destination(start: LatLng, bearingDeg: number, distM: number): LatLng {
  const ang = distM / EARTH_M;
  const br = toRad(bearingDeg);
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lon2) + 540) % 360) - 180 };
}

export function formatCoord(n: number, digits = 6) {
  return n.toFixed(digits);
}

export function formatPair(p: LatLng, digits = 6) {
  return `${formatCoord(p.lat, digits)}, ${formatCoord(p.lng, digits)}`;
}

export function formatSpeed(kmh: number) {
  if (kmh < 0.05) return "0.0 km/h";
  return `${kmh.toFixed(1)} km/h`;
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
}

export function formatHeading(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${dirs[i]}`;
}

export function parseCoords(input: string): LatLng | null {
  const m = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export type RoutePoint = LatLng & { distFromStart: number };

export function decorateRoute(points: LatLng[]): { pts: RoutePoint[]; total: number } {
  const pts: RoutePoint[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i > 0) total += haversine(points[i - 1]!, p);
    pts.push({ ...p, distFromStart: total });
  }
  return { pts, total };
}

export function pointAlongRoute(
  pts: RoutePoint[],
  traveled: number,
): { pos: LatLng; heading: number; done: boolean } {
  if (pts.length === 0) {
    return { pos: { lat: 0, lng: 0 }, heading: 0, done: true };
  }
  const last = pts[pts.length - 1]!;
  if (pts.length === 1 || traveled >= last.distFromStart) {
    const prev = pts[Math.max(0, pts.length - 2)]!;
    return {
      pos: { lat: last.lat, lng: last.lng },
      heading: pts.length > 1 ? bearing(prev, last) : 0,
      done: true,
    };
  }
  if (traveled <= 0) {
    const a = pts[0]!;
    const b = pts[1] ?? a;
    return { pos: { lat: a.lat, lng: a.lng }, heading: bearing(a, b), done: false };
  }
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    if (traveled <= b.distFromStart) {
      const a = pts[i - 1]!;
      const span = b.distFromStart - a.distFromStart;
      const t = span <= 0 ? 1 : (traveled - a.distFromStart) / span;
      return {
        pos: {
          lat: a.lat + (b.lat - a.lat) * t,
          lng: a.lng + (b.lng - a.lng) * t,
        },
        heading: bearing(a, b),
        done: false,
      };
    }
  }
  return { pos: { lat: last.lat, lng: last.lng }, heading: 0, done: true };
}

export function straightLine(a: LatLng, b: LatLng, steps = 48): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
