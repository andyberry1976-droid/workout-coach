import { add, polar, dist, angleOf, jointAngle, clamp, deg, vec, sub, dot, normalize } from './math.js';
import { COM_FROM_PROXIMAL } from './anthropometry.js';

const DOWN = -Math.PI / 2;
const UP = Math.PI / 2;

/**
 * Neutral spine: small lordosis and kyphosis, held constant through a hinge
 * so the back does not round. Values are offsets from the mean torso angle,
 * in radians, added along the chain.
 */
export const NEUTRAL_SPINE = Object.freeze({
  lumbar: 0.10,     // extension (lordosis)
  thoracic: -0.14,  // slight kyphosis
  neck: 0.08,       // in line with the trunk, not poking or tucked
  head: 0.02,
});

/**
 * Forward-kinematics pose of a right-facing figure, standing on a flat floor
 * at y = 0. Angles are world orientations (radians, y-up, 0 = +x).
 *
 * @param {object} body  from buildBody()
 * @param {object} params
 * @param {number} params.shankAngle   ankle → knee
 * @param {number} params.kneeFlexion  0 = straight
 * @param {number} params.hipFlexion   0 = thigh and torso colinear in extension
 * @param {object} [params.spine]      relative spine offsets, defaults to NEUTRAL_SPINE
 * @param {number} [params.armFromVertical]  0 = hanging straight down
 * @param {number} [params.ankleX]
 * @param {number} [params.farFootOffset]  small x shift of the far foot
 */
export function computePose(body, params) {
  const {
    shankAngle,
    kneeFlexion,
    hipFlexion,
    spine = NEUTRAL_SPINE,
    armFromVertical = 0,
    ankleX = 0,
    farFootOffset = 0.06,
  } = params;

  const L = body.len;
  const ankle = vec(ankleX, L.ankleHeight);
  const heel = vec(ankle.x - 0.26 * L.foot, 0);
  const midfoot = vec(ankle.x + 0.24 * L.foot, 0);
  const toe = vec(ankle.x + 0.74 * L.foot, 0);

  const thighAngle = shankAngle + kneeFlexion; // knee → hip
  const knee = add(ankle, polar(shankAngle, L.shank));
  const hip = add(knee, polar(thighAngle, L.thigh));

  // Mean torso axis, sacrum toward the head.
  const torsoAngle = thighAngle - hipFlexion;
  const back = torsoAngle + Math.PI / 2;
  const anterior = torsoAngle - Math.PI / 2;

  // Sacrum sits above and slightly behind the femoral head.
  const sacrum = add(
    hip,
    add(polar(torsoAngle, L.pelvis * 0.55), polar(back, L.pelvis * 0.75)),
  );

  const lumbarAngle = torsoAngle + spine.lumbar;
  const lumbar = add(sacrum, polar(lumbarAngle, L.lumbar));

  const thoracicAngle = torsoAngle + spine.thoracic;
  const tSpine = add(lumbar, polar(thoracicAngle, L.thoracic * 0.5));
  const c7 = add(tSpine, polar(thoracicAngle, L.thoracic * 0.5));

  const shoulder = add(c7, polar(anterior, L.shoulderOffset));

  const neckAngle = thoracicAngle + spine.neck;
  const neck = add(c7, polar(neckAngle, L.neck));
  const headAngle = neckAngle + spine.head;
  const headCenter = add(neck, polar(headAngle, L.head * 0.42));
  const crown = add(neck, polar(headAngle, L.head * 0.92));
  const chin = add(headCenter, polar(anterior, L.head * 0.22));

  const armAngle = DOWN + armFromVertical;
  const elbow = add(shoulder, polar(armAngle, L.upperArm));
  const wrist = add(elbow, polar(armAngle, L.forearm));
  const grip = add(wrist, polar(armAngle, L.hand));

  const farAnkle = vec(ankle.x + farFootOffset, ankle.y);
  const farHeel = vec(farAnkle.x - 0.26 * L.foot, 0);
  const farToe = vec(farAnkle.x + 0.74 * L.foot, 0);
  const farKnee = add(farAnkle, polar(shankAngle, L.shank));
  const farHip = add(farKnee, polar(thighAngle, L.thigh));

  const joints = {
    heel,
    midfoot,
    toe,
    ankle,
    knee,
    hip,
    sacrum,
    lumbar,
    tSpine,
    c7,
    shoulder,
    elbow,
    wrist,
    grip,
    neck,
    headCenter,
    crown,
    chin,
    farHeel,
    farToe,
    farAnkle,
    farKnee,
    farHip,
  };

  const bar = {
    x: grip.x,
    y: grip.y,
    shaftRadius: 0.014,
    plateRadius: 0.145,
  };

  const angles = measureAngles(joints, {
    shankAngle,
    kneeFlexion,
    hipFlexion,
    torsoAngle,
    armFromVertical,
    spine,
  });

  return {
    joints,
    bar,
    angles,
    com: computeCom(body, joints, bar, 0),
    params: {
      shankAngle,
      kneeFlexion,
      hipFlexion,
      torsoAngle,
      armFromVertical,
      ankleX,
      spine,
    },
    body,
  };
}

export function measureAngles(joints, raw) {
  const kneeInternal = jointAngle(joints.ankle, joints.knee, joints.hip);
  const kneeFlexion = Math.PI - kneeInternal;

  const hipInternal = jointAngle(joints.knee, joints.hip, joints.shoulder);
  const hipFlexion = Math.PI - hipInternal;

  const pelvisDir = angleOf(sub(joints.sacrum, joints.hip));
  const lumbarDir = angleOf(sub(joints.lumbar, joints.sacrum));
  const thoracicDir = angleOf(sub(joints.c7, joints.lumbar));
  const neckDir = angleOf(sub(joints.neck, joints.c7));
  const headDir = angleOf(sub(joints.crown, joints.neck));
  const spineDir = angleOf(sub(joints.c7, joints.sacrum));

  const armDir = angleOf(sub(joints.grip, joints.shoulder));
  const armFromVertical = armDir - DOWN;

  const shankDir = angleOf(sub(joints.knee, joints.ankle));
  const thighDir = angleOf(sub(joints.hip, joints.knee));
  const torsoDir = angleOf(sub(joints.shoulder, joints.hip));

  return {
    kneeFlexion,
    hipFlexion,
    kneeFlexionDeg: deg(kneeFlexion),
    hipFlexionDeg: deg(hipFlexion),
    torsoFromVerticalDeg: deg(UP - torsoDir),
    spineFromVerticalDeg: deg(UP - spineDir),
    shankFromVerticalDeg: deg(UP - shankDir),
    armFromVerticalDeg: deg(armFromVertical),
    shankDeg: deg(shankDir),
    thighDeg: deg(thighDir),
    spine: {
      pelvisDir,
      lumbarDir,
      thoracicDir,
      neckDir,
      headDir,
      spineDir,
      lumbarRel: lumbarDir - pelvisDir,
      thoracicRel: thoracicDir - lumbarDir,
      neckRel: neckDir - thoracicDir,
      headRel: headDir - neckDir,
    },
    raw,
  };
}

function comPoint(a, b, fractionFromA) {
  return {
    x: a.x + (b.x - a.x) * fractionFromA,
    y: a.y + (b.y - a.y) * fractionFromA,
  };
}

/**
 * Whole-body centre of mass, counting both legs and both arms, plus an
 * optional barbell mass (kg). Returns body-only and combined COM.
 */
export function computeCom(body, joints, bar, barMass = 0) {
  const f = body.massFrac;
  const m = body.mass;
  const c = COM_FROM_PROXIMAL;
  const parts = [];

  const addSeg = (frac, a, b, fromProx, sides = 1) => {
    const p = comPoint(a, b, fromProx);
    parts.push({ x: p.x, y: p.y, mass: frac * m * sides });
  };

  addSeg(f.foot, joints.heel, joints.toe, c.foot, 2);
  addSeg(f.shank, joints.ankle, joints.knee, c.shank, 2);
  addSeg(f.thigh, joints.knee, joints.hip, c.thigh, 2);
  addSeg(f.pelvis, joints.hip, joints.sacrum, c.pelvis, 1);
  addSeg(f.abdomen, joints.sacrum, joints.lumbar, c.abdomen, 1);
  addSeg(f.thorax, joints.lumbar, joints.c7, c.thorax, 1);
  addSeg(f.neck, joints.c7, joints.neck, c.neck, 1);
  addSeg(f.head, joints.neck, joints.crown, c.head, 1);
  addSeg(f.upperArm, joints.shoulder, joints.elbow, c.upperArm, 2);
  addSeg(f.forearm, joints.elbow, joints.wrist, c.forearm, 2);
  addSeg(f.hand, joints.wrist, joints.grip, c.hand, 2);

  let mass = 0;
  let x = 0;
  let y = 0;
  for (const p of parts) {
    mass += p.mass;
    x += p.x * p.mass;
    y += p.y * p.mass;
  }
  const bodyCom = { x: x / mass, y: y / mass, mass };

  if (barMass > 0 && bar) {
    x += bar.x * barMass;
    y += bar.y * barMass;
    mass += barMass;
  }
  return {
    x: x / mass,
    y: y / mass,
    mass,
    body: bodyCom,
  };
}

export function attachCom(pose, barMass) {
  pose.com = computeCom(pose.body, pose.joints, pose.bar, barMass);
  return pose;
}

/** Check that every named bone still has its designed length. */
export function segmentLengths(pose) {
  const j = pose.joints;
  const L = pose.body.len;
  return {
    shank: dist(j.ankle, j.knee),
    thigh: dist(j.knee, j.hip),
    lumbar: dist(j.sacrum, j.lumbar),
    thoracic: dist(j.lumbar, j.c7),
    neck: dist(j.c7, j.neck),
    upperArm: dist(j.shoulder, j.elbow),
    forearm: dist(j.elbow, j.wrist),
    hand: dist(j.wrist, j.grip),
    expected: {
      shank: L.shank,
      thigh: L.thigh,
      lumbar: L.lumbar,
      thoracic: L.thoracic,
      neck: L.neck,
      upperArm: L.upperArm,
      forearm: L.forearm,
      hand: L.hand,
    },
  };
}

export function spineRelativeAngles(pose) {
  return { ...pose.angles.spine };
}

export { DOWN, UP, clamp, dot, normalize };
