import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBody } from '../src/anthropometry.js';
import { computePose, segmentLengths, NEUTRAL_SPINE } from '../src/skeleton.js';
import { rad } from '../src/math.js';

const body = buildBody();

test('segment lengths match the anthropometric model at a standing pose', () => {
  const pose = computePose(body, {
    shankAngle: rad(85),
    kneeFlexion: rad(17),
    hipFlexion: rad(12),
    spine: NEUTRAL_SPINE,
  });
  const lengths = segmentLengths(pose);
  for (const name of Object.keys(lengths.expected)) {
    assert.ok(
      Math.abs(lengths[name] - lengths.expected[name]) < 1e-12,
      `${name} was ${lengths[name]}, expected ${lengths.expected[name]}`,
    );
  }
});

test('knee and hip flexion measurements match the input angles', () => {
  const knee = rad(20);
  const hip = rad(70);
  const pose = computePose(body, {
    shankAngle: rad(95),
    kneeFlexion: knee,
    hipFlexion: hip,
    spine: NEUTRAL_SPINE,
  });
  assert.ok(Math.abs(pose.angles.kneeFlexion - knee) < 1e-9);
  // Hip flexion is measured to the shoulder, slightly larger than the
  // mean-torso input because the shoulder sits in front of the spine.
  assert.ok(pose.angles.hipFlexion > hip - rad(2));
  assert.ok(pose.angles.hipFlexion < hip + rad(15));
});

test('two feet stay on the floor', () => {
  const pose = computePose(body, {
    shankAngle: rad(90),
    kneeFlexion: rad(18),
    hipFlexion: rad(40),
    spine: NEUTRAL_SPINE,
  });
  assert.equal(pose.joints.heel.y, 0);
  assert.equal(pose.joints.toe.y, 0);
  assert.equal(pose.joints.farHeel.y, 0);
  assert.equal(pose.joints.farToe.y, 0);
  assert.ok(pose.joints.ankle.y > 0);
});
