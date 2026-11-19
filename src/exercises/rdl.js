import { clamp, lerp, rad } from '../math.js';
import { computePose, attachCom, NEUTRAL_SPINE, UP } from '../skeleton.js';

/** Soft knees stay in this band; shins stay this close to vertical. */
export const MAX_SHANK_FROM_VERTICAL = rad(10);

/** Default RDL shape. Angles in radians. */
export const RDL_SHAPE = Object.freeze({
  // Soft knees, almost constant through the rep.
  kneeTop: rad(17),
  kneeBottom: rad(22),
  // Standing tall with soft knees needs a little hip flexion to keep
  // the torso nearly vertical. The bottom is a deep hinge, torso just
  // above parallel (about 70–75° from vertical along the spine).
  hipTop: rad(12),
  hipBottom: rad(108),
  barMass: 40,
  spine: NEUTRAL_SPINE,
});

export const rdl = {
  id: 'rdl',
  name: 'Romanian Deadlift',
  equipment: 'barbell',
  cues: {
    idle: 'Stand tall, bar over mid-foot, soft knees.',
    countdown: 'Set the back. Soft knees. Ready.',
    down: 'Hips back. Bar close to the legs. Long spine.',
    pauseBottom: 'Hold. Shins quiet. Spine neutral.',
    up: 'Drive the hips forward. Squeeze the glutes.',
    pauseTop: 'Tall. Ribs down. Glutes on.',
    resting: 'Shake out. Breathe. Next set coming.',
    complete: 'Work finished. Stack the bar and stand tall.',
  },
  phaseLabels: {
    idle: 'Ready',
    countdown: 'Get set',
    down: 'Lower — hips back',
    pauseBottom: 'Hold at the bottom',
    up: 'Drive hips forward',
    pauseTop: 'Stand tall',
    resting: 'Rest',
    complete: 'Session complete',
  },
  shape: RDL_SHAPE,
  /**
   * @param {object} body
   * @param {number} t  0 = standing, 1 = bottom of the hinge
   * @param {object} [shape]
   */
  solve(body, t, shape = RDL_SHAPE) {
    return solveRdl(body, t, shape);
  },
};

export function solveRdl(body, t, shape = RDL_SHAPE) {
  const u = clamp(t, 0, 1);
  const kneeFlexion = lerp(shape.kneeTop, shape.kneeBottom, u);
  const hipFlexion = lerp(shape.hipTop, shape.hipBottom, u);
  const midfootX = midfootXOf(body, 0);

  let shankAngle = solveShankAngle(body, {
    kneeFlexion,
    hipFlexion,
    spine: shape.spine,
    targetX: midfootX,
  });
  let armFromVertical = 0;

  // Keep the shins close to vertical (knees roughly over the ankles).
  // If that would push the bar forward, a small arm angle brings it back
  // onto the mid-foot line.
  const limit = MAX_SHANK_FROM_VERTICAL;
  if (Math.abs(shankAngle - UP) > limit) {
    shankAngle = clamp(shankAngle, UP - limit, UP + limit);
    armFromVertical = solveArmAngle(body, {
      shankAngle,
      kneeFlexion,
      hipFlexion,
      spine: shape.spine,
      targetX: midfootX,
    });
  }

  const pose = computePose(body, {
    shankAngle,
    kneeFlexion,
    hipFlexion,
    spine: shape.spine,
    armFromVertical,
    ankleX: 0,
  });
  attachCom(pose, shape.barMass ?? 0);
  pose.exercise = 'rdl';
  pose.progress = u;
  pose.midfootX = midfootX;
  return pose;
}

export function midfootXOf(body, ankleX = 0) {
  return ankleX + 0.24 * body.len.foot;
}

/**
 * Binary-search the shank angle so the grip (and therefore the bar)
 * stays on the mid-foot vertical. With arms hanging straight down,
 * that is the same as putting the shoulder over mid-foot and letting
 * the hips travel back as the torso leans.
 */
export function solveShankAngle(body, { kneeFlexion, hipFlexion, spine, targetX, ankleX = 0, armFromVertical = 0 }) {
  let lo = rad(40);
  let hi = rad(115);
  let best = (lo + hi) / 2;
  let bestErr = Infinity;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const pose = computePose(body, {
      shankAngle: mid,
      kneeFlexion,
      hipFlexion,
      spine,
      armFromVertical,
      ankleX,
    });
    const x = pose.joints.grip.x;
    const err = Math.abs(x - targetX);
    if (err < bestErr) {
      bestErr = err;
      best = mid;
    }
    if (x > targetX) {
      // Grip is too far forward: hips need to travel back, which means
      // a more backward (larger) shank/thigh orientation.
      lo = mid;
    } else {
      hi = mid;
    }
    if (err < 1e-6) return mid;
  }
  return best;
}

/**
 * With the shank held still, find the arm angle that puts the grip
 * on the mid-foot vertical. Positive is toward the toes.
 */
export function solveArmAngle(body, { shankAngle, kneeFlexion, hipFlexion, spine, targetX, ankleX = 0 }) {
  let lo = rad(-25);
  let hi = rad(25);
  let best = 0;
  let bestErr = Infinity;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const pose = computePose(body, {
      shankAngle,
      kneeFlexion,
      hipFlexion,
      spine,
      armFromVertical: mid,
      ankleX,
    });
    const err = pose.joints.grip.x - targetX;
    const abs = Math.abs(err);
    if (abs < bestErr) {
      bestErr = abs;
      best = mid;
    }
    if (err > 0) hi = mid;
    else lo = mid;
    if (abs < 1e-6) return mid;
  }
  return best;
}

/**
 * Sample the whole rep and return form metrics used by tests and the HUD.
 */
export function evaluateForm(pose) {
  const mid = pose.midfootX ?? pose.joints.midfoot.x;
  const barOffset = pose.bar.x - mid;
  const comOffset = pose.com.x - mid;
  const a = pose.angles;
  return {
    kneeFlexionDeg: a.kneeFlexionDeg,
    hipFlexionDeg: a.hipFlexionDeg,
    torsoFromVerticalDeg: a.torsoFromVerticalDeg,
    spineFromVerticalDeg: a.spineFromVerticalDeg,
    shankFromVerticalDeg: a.shankFromVerticalDeg,
    armFromVerticalDeg: a.armFromVerticalDeg,
    barOffset,
    comOffset,
    barOffsetCm: barOffset * 100,
    comOffsetCm: comOffset * 100,
  };
}
