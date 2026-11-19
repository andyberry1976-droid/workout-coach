/** Canvas renderer. Converts engine poses (metres, y-up) into a 2D stick figure. */

export const THEME = {
  bgTop: '#14171f',
  bgBottom: '#0b0d12',
  floor: '#2c303a',
  floorEdge: '#4a5060',
  mat: '#1b1e27',
  matStripe: 'rgba(255,255,255,0.04)',
  line: '#f3efe6',
  lineFar: 'rgba(243, 239, 230, 0.38)',
  joint: '#e8c45c',
  jointFar: 'rgba(232, 196, 92, 0.4)',
  jointStroke: '#1a1c22',
  headFill: 'rgba(243, 239, 230, 0.08)',
  plateStroke: '#f3efe6',
  plateFill: 'rgba(243, 239, 230, 0.06)',
  barDot: '#f3efe6',
  ghost: 'rgba(210, 200, 185, 0.22)',
  path: 'rgba(232, 196, 92, 0.55)',
  guide: 'rgba(255, 255, 255, 0.16)',
  text: '#f0eeea',
  muted: 'rgba(240, 238, 234, 0.62)',
  accent: '#e8c45c',
};

export function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width: rect.width, height: rect.height, dpr };
}

function cameraFor(cssWidth, cssHeight, pose) {
  const worldH = pose.body.height + 0.18;
  const scale = (cssHeight * 0.92) / worldH;
  const mid = pose.joints.midfoot.x;
  return {
    scale,
    ox: cssWidth * 0.42 - mid * scale,
    oy: cssHeight * 0.90,
  };
}

function S(cam, p) {
  return { x: cam.ox + p.x * cam.scale, y: cam.oy - p.y * cam.scale };
}

function R(cam, metres) {
  return metres * cam.scale;
}

function dir(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function nudge(p, dx, dy = 0) {
  return { x: p.x + dx, y: p.y + dy };
}

function drawFloor(ctx, cam, cssWidth, cssHeight, pose, options) {
  const floorY = cam.oy;
  const bg = ctx.createLinearGradient(0, 0, 0, cssHeight);
  bg.addColorStop(0, THEME.bgTop);
  bg.addColorStop(0.7, THEME.bgBottom);
  bg.addColorStop(1, '#08090c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const mid = S(cam, pose.joints.midfoot);
  const lamp = ctx.createRadialGradient(mid.x, floorY - R(cam, 1.1), R(cam, 0.1), mid.x, floorY - R(cam, 0.4), R(cam, 1.4));
  lamp.addColorStop(0, 'rgba(80, 90, 110, 0.16)');
  lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, cssWidth, floorY);

  ctx.fillStyle = THEME.floor;
  ctx.fillRect(0, floorY, cssWidth, cssHeight - floorY);
  ctx.strokeStyle = THEME.floorEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(cssWidth, floorY);
  ctx.stroke();

  const matLeft = mid.x - R(cam, 0.7);
  const matRight = mid.x + R(cam, 0.75);
  ctx.fillStyle = THEME.mat;
  ctx.beginPath();
  ctx.moveTo(matLeft, floorY);
  ctx.lineTo(matRight, floorY);
  ctx.lineTo(matRight + R(cam, 0.08), floorY + 18);
  ctx.lineTo(matLeft - R(cam, 0.08), floorY + 18);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = THEME.guide;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mid.x, floorY);
  ctx.lineTo(mid.x, floorY - R(cam, pose.body.height + 0.05));
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = THEME.muted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('mid-foot', mid.x, floorY + 32);

  if (options.showPath && options.barPath?.length) {
    ctx.save();
    ctx.strokeStyle = THEME.path;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    options.barPath.forEach((p, i) => {
      const s = S(cam, p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  }
}

function setStroke(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function joint(ctx, p, radius, fill, stroke) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function limbWidth(cam) {
  return Math.max(8, R(cam, 0.028));
}

function spineWidth(cam) {
  return Math.max(10, R(cam, 0.034));
}

function jointRadius(cam) {
  return Math.max(5.5, R(cam, 0.018));
}

function drawFoot(ctx, heel, toe, ankle, cam, color, width) {
  setStroke(ctx, color, width);
  line(ctx, S(cam, heel), S(cam, toe));
  line(ctx, S(cam, heel), S(cam, ankle));
  line(ctx, S(cam, toe), S(cam, ankle));
}

function drawFarLimbs(ctx, pose, cam) {
  const color = THEME.lineFar;
  const jFill = THEME.jointFar;
  const j = pose.joints;
  const w = limbWidth(cam);
  const jr = jointRadius(cam);
  // A small forward shift so the far arm is visible beside the near arm.
  const armShift = 0.03;

  drawFoot(ctx, j.farHeel, j.farToe, j.farAnkle, cam, color, Math.max(6, w * 0.7));
  const ankle = S(cam, j.farAnkle);
  const knee = S(cam, j.farKnee);
  const hip = S(cam, j.farHip);
  setStroke(ctx, color, w);
  line(ctx, ankle, knee);
  line(ctx, knee, hip);

  const shoulder = S(cam, nudge(j.shoulder, armShift));
  const elbow = S(cam, nudge(j.elbow, armShift));
  const wrist = S(cam, nudge(j.wrist, armShift));
  const neck = S(cam, j.neck);
  setStroke(ctx, color, w);
  line(ctx, neck, shoulder);
  line(ctx, shoulder, elbow);
  line(ctx, elbow, wrist);

  const stroke = 'rgba(26, 28, 34, 0.4)';
  for (const p of [ankle, knee, hip, shoulder, elbow, wrist]) {
    joint(ctx, p, jr, jFill, stroke);
  }
}

function drawNearFigure(ctx, pose, cam) {
  const color = THEME.line;
  const j = pose.joints;
  const w = limbWidth(cam);
  const sw = spineWidth(cam);
  const jr = jointRadius(cam);

  drawFoot(ctx, j.heel, j.toe, j.ankle, cam, color, Math.max(6, w * 0.7));

  const ankle = S(cam, j.ankle);
  const knee = S(cam, j.knee);
  const hip = S(cam, j.hip);
  const neck = S(cam, j.neck);
  const shoulder = S(cam, j.shoulder);
  const elbow = S(cam, j.elbow);
  const wrist = S(cam, j.wrist);
  const head = S(cam, j.headCenter);

  setStroke(ctx, color, w);
  line(ctx, ankle, knee);
  line(ctx, knee, hip);

  // Spine as a single straight line so a neutral back is obvious.
  setStroke(ctx, color, sw);
  line(ctx, hip, neck);

  setStroke(ctx, color, w);
  line(ctx, neck, shoulder);
  line(ctx, shoulder, elbow);
  line(ctx, elbow, wrist);

  const headR = R(cam, pose.body.depth.headH * 0.42);
  setStroke(ctx, color, Math.max(5, w * 0.7));
  line(ctx, neck, head);
  ctx.beginPath();
  ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
  ctx.fillStyle = THEME.headFill;
  ctx.fill();
  ctx.stroke();

  for (const p of [ankle, knee, hip, shoulder, elbow, wrist, neck]) {
    joint(ctx, p, jr, THEME.joint, THEME.jointStroke);
  }
}

function drawBarbell(ctx, pose, cam) {
  const g = S(cam, pose.joints.grip);
  const pr = R(cam, pose.bar.plateRadius);
  ctx.beginPath();
  ctx.arc(g.x, g.y, pr, 0, Math.PI * 2);
  ctx.fillStyle = THEME.plateFill;
  ctx.fill();
  ctx.strokeStyle = THEME.plateStroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(g.x, g.y, pr * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(243, 239, 230, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Bar as a solid dot at the grip.
  ctx.beginPath();
  ctx.arc(g.x, g.y, Math.max(5, R(cam, 0.016)), 0, Math.PI * 2);
  ctx.fillStyle = THEME.barDot;
  ctx.fill();
  ctx.strokeStyle = THEME.jointStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawGhost(ctx, pose, cam) {
  const j = pose.joints;
  setStroke(ctx, THEME.ghost, Math.max(4, limbWidth(cam) * 0.55));
  line(ctx, S(cam, j.farAnkle), S(cam, j.farKnee));
  line(ctx, S(cam, j.farKnee), S(cam, j.farHip));
  line(ctx, S(cam, j.ankle), S(cam, j.knee));
  line(ctx, S(cam, j.knee), S(cam, j.hip));
  line(ctx, S(cam, j.hip), S(cam, j.neck));
  line(ctx, S(cam, j.shoulder), S(cam, j.wrist));
  ctx.beginPath();
  const c = S(cam, j.headCenter);
  ctx.arc(c.x, c.y, R(cam, pose.body.depth.headH * 0.42), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  const g = S(cam, j.grip);
  ctx.arc(g.x, g.y, R(cam, pose.bar.plateRadius), 0, Math.PI * 2);
  ctx.stroke();
}

function pill(ctx, x, y, text, color, align = 'left') {
  ctx.font = '12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 10;
  const h = 18;
  const px = align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
  ctx.beginPath();
  ctx.roundRect(px, y - 13, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(text, px + 5, y);
}

function drawAngles(ctx, pose, cam) {
  const j = pose.joints;
  const a = pose.angles;
  const knee = S(cam, j.knee);
  const hip = S(cam, j.hip);
  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.lineWidth = 1.6;
  labelArc(ctx, knee, S(cam, j.ankle), S(cam, j.hip), `Knee ${a.kneeFlexionDeg.toFixed(0)}°`, THEME.accent, 32);
  labelArc(ctx, hip, S(cam, j.knee), S(cam, j.shoulder), `Hip ${a.hipFlexionDeg.toFixed(0)}°`, '#7ec8e8', 36);

  const spineA = S(cam, j.hip);
  const spineB = S(cam, j.neck);
  ctx.strokeStyle = '#9ad89a';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(spineA.x, spineA.y);
  ctx.lineTo(spineB.x, spineB.y);
  ctx.stroke();
  ctx.setLineDash([]);
  pill(ctx, spineB.x + 16, spineB.y - 10, `Spine ${a.spineFromVerticalDeg.toFixed(0)}° from vertical`, '#9ad89a');

  const bar = S(cam, j.grip);
  const offsetCm = (pose.bar.x - pose.joints.midfoot.x) * 100;
  pill(
    ctx,
    bar.x + 22,
    bar.y - 14,
    `Bar ${offsetCm >= 0 ? '+' : ''}${offsetCm.toFixed(1)} cm vs mid-foot`,
    THEME.accent,
  );
  ctx.restore();
}

function labelArc(ctx, pivot, pA, pB, text, color, radius) {
  const a1 = dir(pivot, pA);
  const a2 = dir(pivot, pB);
  let start = a1;
  let diff = a2 - a1;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radius, start, start + diff, diff < 0);
  ctx.stroke();
  const midA = start + diff / 2;
  const lx = pivot.x + Math.cos(midA) * (radius + 18);
  const ly = pivot.y + Math.sin(midA) * (radius + 18);
  const side = Math.cos(midA) < 0 ? 'right' : 'left';
  pill(ctx, lx, ly, text, color, side);
}

export function computeBarPath(solveFn, body, steps = 24) {
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const pose = solveFn(body, i / steps);
    path.push({ x: pose.bar.x, y: pose.bar.y });
  }
  return path;
}

/**
 * Draw one frame.
 * @param {object} options
 * @param {object[]} [options.ghosts]
 * @param {boolean} [options.showAngles]
 * @param {boolean} [options.showPath]
 * @param {{x,y}[]} [options.barPath]
 */
export function renderFrame(ctx, pose, cssWidth, cssHeight, options = {}) {
  const cam = cameraFor(cssWidth, cssHeight, pose);
  drawFloor(ctx, cam, cssWidth, cssHeight, pose, options);

  if (options.ghosts) {
    for (const g of options.ghosts) drawGhost(ctx, g, cam);
  }

  drawFarLimbs(ctx, pose, cam);
  drawNearFigure(ctx, pose, cam);
  drawBarbell(ctx, pose, cam);

  if (options.showAngles) drawAngles(ctx, pose, cam);
  return cam;
}
