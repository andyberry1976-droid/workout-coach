/** Small vector and angle helpers. Engine uses metres, y-up, 0 rad = +x, counter-clockwise. */

export const TAU = Math.PI * 2;

export function deg(radians) {
  return (radians * 180) / Math.PI;
}

export function rad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smallest signed angle from a to b, in (-π, π]. */
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function lerpAngle(a, b, t) {
  return a + angDiff(a, b) * t;
}

export function vec(x, y) {
  return { x, y };
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function polar(angle, length) {
  return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
}

export function hypot(v) {
  return Math.hypot(v.x, v.y);
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(v) {
  const L = Math.hypot(v.x, v.y);
  if (L < 1e-12) return { x: 0, y: 0 };
  return { x: v.x / L, y: v.y / L };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function angleOf(v) {
  return Math.atan2(v.y, v.x);
}

/** Unsigned angle between two directions, in [0, π]. */
export function angBetween(a, b) {
  return Math.abs(angDiff(a, b));
}

/** Interior angle at pivot between points pa-pivot-pb, in [0, π]. */
export function jointAngle(pa, pivot, pb) {
  const a = normalize(sub(pa, pivot));
  const b = normalize(sub(pb, pivot));
  return Math.acos(clamp(dot(a, b), -1, 1));
}

export function signedAreaDirection(from, to) {
  return angleOf(sub(to, from));
}

/** Distance from point p to the infinite line through a-b. */
export function pointLineDistance(p, a, b) {
  const ab = sub(b, a);
  const L = hypot(ab);
  if (L < 1e-12) return dist(p, a);
  return Math.abs((p.x - a.x) * ab.y - (p.y - a.y) * ab.x) / L;
}

/** Distance from point p to segment a-b, and the closest point. */
export function closestOnSegment(p, a, b) {
  const ab = sub(b, a);
  const L2 = ab.x * ab.x + ab.y * ab.y;
  if (L2 < 1e-16) return { point: { ...a }, t: 0, distance: dist(p, a) };
  const t = clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2, 0, 1);
  const point = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { point, t, distance: dist(p, point) };
}
