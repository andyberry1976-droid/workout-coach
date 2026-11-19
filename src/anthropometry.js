/**
 * Adult side-view proportions as fractions of stature, drawn from
 * standard Drillis–Contini / Winter anthropometric ratios.
 * Lengths are in metres. Mass fractions are of total body mass.
 */

export const DEFAULT_HEIGHT = 1.78;
export const DEFAULT_MASS = 78;

export function buildBody(height = DEFAULT_HEIGHT, mass = DEFAULT_MASS) {
  const H = height;
  const len = {
    foot: 0.152 * H,
    ankleHeight: 0.039 * H,
    shank: 0.246 * H,
    thigh: 0.245 * H,
    pelvis: 0.050 * H,
    lumbar: 0.103 * H,
    thoracic: 0.135 * H,
    neck: 0.052 * H,
    head: 0.130 * H,
    upperArm: 0.186 * H,
    forearm: 0.146 * H,
    hand: 0.055 * H,
    // Shoulder joint sits anterior to the cervical/thoracic spine.
    shoulderOffset: 0.048 * H,
  };

  // Side-view depths (full thickness of the soft tissue + bone).
  const depth = {
    foot: 0.055 * H,
    shank: 0.108 * H,
    thigh: 0.148 * H,
    glute: 0.180 * H,
    pelvis: 0.200 * H,
    waist: 0.155 * H,
    chest: 0.210 * H,
    upperChest: 0.180 * H,
    neck: 0.070 * H,
    headW: 0.105 * H,
    headH: 0.130 * H,
    upperArm: 0.090 * H,
    forearm: 0.070 * H,
    hand: 0.045 * H,
  };

  // Winter / Dempster segment mass fractions (one side for limbs).
  const massFrac = {
    foot: 0.0145,
    shank: 0.0465,
    thigh: 0.1000,
    pelvis: 0.1420,
    abdomen: 0.1390,
    thorax: 0.1590,
    neck: 0.0120,
    head: 0.0690,
    upperArm: 0.0280,
    forearm: 0.0160,
    hand: 0.0060,
  };

  return { height: H, mass, len, depth, massFrac };
}

/** COM location along a segment, as a fraction from the proximal end. */
export const COM_FROM_PROXIMAL = {
  foot: 0.50,
  shank: 0.433,
  thigh: 0.433,
  pelvis: 0.50,
  abdomen: 0.50,
  thorax: 0.50,
  neck: 0.50,
  head: 0.50,
  upperArm: 0.436,
  forearm: 0.430,
  hand: 0.506,
};
