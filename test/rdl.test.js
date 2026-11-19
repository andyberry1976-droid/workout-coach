import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deg } from '../src/math.js';
import { buildBody } from '../src/anthropometry.js';
import { segmentLengths, spineRelativeAngles } from '../src/skeleton.js';
import { solveRdl, evaluateForm, midfootXOf } from '../src/exercises/rdl.js';

const body = buildBody();
const SAMPLES = 41;

function sampleRep() {
  const poses = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    poses.push({ t, pose: solveRdl(body, t) });
  }
  return poses;
}

test('knee flexion stays between 10° and 25° across the whole rep', () => {
  for (const { t, pose } of sampleRep()) {
    const knee = pose.angles.kneeFlexionDeg;
    assert.ok(
      knee >= 10 && knee <= 25,
      `knee was ${knee.toFixed(2)}° at t=${t}`,
    );
  }
});

test('spine stays neutral: relative segment angles drift less than 5°', () => {
  const samples = sampleRep();
  const base = spineRelativeAngles(samples[0].pose);
  for (const { t, pose } of samples) {
    const now = spineRelativeAngles(pose);
    for (const key of ['lumbarRel', 'thoracicRel', 'neckRel', 'headRel']) {
      const drift = Math.abs(deg(now[key] - base[key]));
      assert.ok(
        drift < 5,
        `${key} drifted ${drift.toFixed(3)}° at t=${t}`,
      );
    }
  }
});

test('bar stays within ±3 cm of mid-foot all the way through the rep', () => {
  const mid = midfootXOf(body);
  for (const { t, pose } of sampleRep()) {
    const err = Math.abs(pose.bar.x - mid);
    assert.ok(err <= 0.03, `bar offset ${err * 100} cm at t=${t}`);
    assert.equal(pose.joints.midfoot.x, mid);
  }
});

test('hip flexion reaches at least 70° at the bottom', () => {
  const bottom = solveRdl(body, 1);
  assert.ok(
    bottom.angles.hipFlexionDeg >= 70,
    `hip flexion was ${bottom.angles.hipFlexionDeg.toFixed(2)}°`,
  );
  assert.ok(
    bottom.angles.spineFromVerticalDeg >= 65,
    `spine lean was only ${bottom.angles.spineFromVerticalDeg.toFixed(2)}°`,
  );
});

test('arms hang vertically within a few degrees', () => {
  for (const { t, pose } of sampleRep()) {
    const arm = Math.abs(pose.angles.armFromVerticalDeg);
    assert.ok(arm <= 10, `arms were ${arm.toFixed(2)}° off vertical at t=${t}`);
  }
});

test('shins stay within 10° of vertical and knees stay over the ankles', () => {
  for (const { t, pose } of sampleRep()) {
    const fromVert = pose.angles.shankFromVerticalDeg;
    assert.ok(
      Math.abs(fromVert) <= 10 + 1e-6,
      `shin was ${fromVert.toFixed(2)}° from vertical at t=${t}`,
    );
    const kneeTravel = Math.abs(pose.joints.knee.x - pose.joints.ankle.x);
    assert.ok(
      kneeTravel <= 0.09,
      `knee was ${(kneeTravel * 100).toFixed(1)} cm from the ankle at t=${t}`,
    );
  }
});

test('feet stay fixed and the near ankle does not travel', () => {
  const samples = sampleRep();
  const first = samples[0].pose.joints;
  for (const { t, pose } of samples) {
    const j = pose.joints;
    assert.ok(Math.abs(j.ankle.x - first.ankle.x) < 1e-12, `ankle x moved at t=${t}`);
    assert.ok(Math.abs(j.ankle.y - first.ankle.y) < 1e-12, `ankle y moved at t=${t}`);
    assert.ok(Math.abs(j.heel.x - first.heel.x) < 1e-12);
    assert.ok(Math.abs(j.heel.y - first.heel.y) < 1e-12);
    assert.ok(Math.abs(j.toe.x - first.toe.x) < 1e-12);
    assert.ok(Math.abs(j.farAnkle.x - first.farAnkle.x) < 1e-12);
    assert.equal(j.heel.y, 0);
    assert.equal(j.toe.y, 0);
  }
});

test('segment lengths stay constant through the hinge', () => {
  const samples = sampleRep();
  const expected = segmentLengths(samples[0].pose).expected;
  for (const { t, pose } of samples) {
    const now = segmentLengths(pose);
    for (const name of Object.keys(expected)) {
      assert.ok(
        Math.abs(now[name] - expected[name]) < 1e-9,
        `${name} changed at t=${t}: ${now[name]} vs ${expected[name]}`,
      );
    }
  }
});

test('the same progress value always produces the same pose', () => {
  const a = solveRdl(body, 0.37);
  const b = solveRdl(body, 0.37);
  assert.deepEqual(a.joints, b.joints);
  assert.deepEqual(a.bar, b.bar);
  assert.equal(a.angles.hipFlexion, b.angles.hipFlexion);
});

test('form metrics at the top look like a tall stance', () => {
  const form = evaluateForm(solveRdl(body, 0));
  assert.ok(form.torsoFromVerticalDeg < 20, 'top should be nearly upright');
  assert.ok(form.hipFlexionDeg < 30);
  assert.ok(Math.abs(form.barOffsetCm) < 1);
});
