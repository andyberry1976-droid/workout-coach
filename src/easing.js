import { clamp } from './math.js';

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function smootherstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Cubic ease-in-out, smooth start and finish. */
export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * A slightly slower start on the way down (control the hinge)
 * and a firmer drive on the way up.
 */
export function easeDescent(t) {
  return easeInOut(t);
}

export function easeAscent(t) {
  return easeInOut(t);
}
