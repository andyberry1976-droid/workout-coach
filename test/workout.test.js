import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createWorkout,
  start,
  pause,
  reset,
  tick,
  poseProgress,
  displayRep,
  displaySet,
  describeState,
  normalizeConfig,
} from '../src/workout.js';
import { buildBody } from '../src/anthropometry.js';
import { poseForState } from '../src/workout.js';

const shortConfig = {
  exerciseId: 'rdl',
  sets: 2,
  reps: 3,
  tempo: { down: 3, pauseBottom: 0.5, up: 1, pauseTop: 0.4 },
  rest: 60,
  countdown: 3,
};

function run(state, seconds, step = 0.05) {
  let s = state;
  let left = seconds;
  while (left > 1e-12) {
    const dt = Math.min(step, left);
    s = tick(s, dt);
    left -= dt;
  }
  return s;
}

test('normalizeConfig rejects empty sets and negative tempo', () => {
  const cfg = normalizeConfig({ sets: 0, reps: -2, tempo: { down: -1, up: 1 }, rest: -5 });
  assert.equal(cfg.sets, 1);
  assert.equal(cfg.reps, 1);
  assert.ok(cfg.tempo.down >= 0);
  assert.equal(cfg.rest, 0);
});

test('start begins with a countdown, then the first descent', () => {
  let s = start(createWorkout(shortConfig));
  assert.equal(s.status, 'countdown');
  assert.equal(displaySet(s), 1);
  assert.equal(displayRep(s), 1);
  s = run(s, 2.99);
  assert.equal(s.status, 'countdown');
  assert.equal(describeState(s).countdown, 1);
  s = tick(s, 0.02);
  assert.equal(s.status, 'working');
  assert.equal(s.phase, 'down');
  assert.ok(poseProgress(s) < 0.05);
});

test('one rep follows the tempo: 3 down, 0.5 pause, 1 up, 0.4 top', () => {
  let s = start(createWorkout(shortConfig));
  s = run(s, 3); // countdown
  assert.equal(s.phase, 'down');
  s = run(s, 2.99);
  assert.equal(s.phase, 'down');
  assert.ok(poseProgress(s) > 0.95);
  s = tick(s, 0.02);
  assert.equal(s.phase, 'pauseBottom');
  assert.equal(poseProgress(s), 1);
  s = run(s, 0.5);
  assert.equal(s.phase, 'up');
  s = run(s, 1);
  assert.equal(s.phase, 'pauseTop');
  assert.equal(poseProgress(s), 0);
  assert.equal(displayRep(s), 1);
  s = run(s, 0.4);
  assert.equal(s.phase, 'down');
  assert.equal(displayRep(s), 2);
  assert.equal(s.completedRepsInSet, 1);
});

test('finishing a set starts the rest timer, then the next set', () => {
  const oneSetRep = { ...shortConfig, sets: 2, reps: 1, tempo: { down: 1, pauseBottom: 0, up: 1, pauseTop: 0 }, countdown: 0, rest: 10 };
  let s = start(createWorkout(oneSetRep));
  assert.equal(s.status, 'working');
  s = run(s, 2);
  assert.equal(s.status, 'resting');
  assert.ok(Math.abs(s.restRemaining - 10) < 1e-9);
  assert.equal(displayRep(s), 1);
  assert.equal(displaySet(s), 1);
  s = run(s, 10);
  assert.equal(s.status, 'working');
  assert.equal(s.setIndex, 1);
  assert.equal(displaySet(s), 2);
  assert.equal(s.phase, 'down');
  s = run(s, 2);
  assert.equal(s.status, 'complete');
  assert.equal(poseProgress(s), 0);
});

test('pause freezes the clock and resume continues from the same place', () => {
  let s = start(createWorkout(shortConfig));
  s = run(s, 3 + 1.2);
  assert.equal(s.phase, 'down');
  const progress = poseProgress(s);
  const elapsed = s.phaseElapsed;
  s = pause(s);
  s = run(s, 5);
  assert.equal(s.paused, true);
  assert.equal(s.phaseElapsed, elapsed);
  assert.equal(poseProgress(s), progress);
  s = start(s);
  assert.equal(s.paused, false);
  s = tick(s, 0.1);
  assert.ok(s.phaseElapsed > elapsed);
});

test('reset returns to a ready top position', () => {
  let s = start(createWorkout(shortConfig));
  s = run(s, 8);
  s = reset(s);
  assert.equal(s.status, 'idle');
  assert.equal(poseProgress(s), 0);
  assert.equal(displayRep(s), 0);
});

test('the state machine is deterministic', () => {
  const go = () => {
    let s = start(createWorkout(shortConfig));
    s = run(s, 20, 0.07);
    return s;
  };
  const a = go();
  const b = go();
  assert.equal(a.status, b.status);
  assert.equal(a.phase, b.phase);
  assert.equal(a.setIndex, b.setIndex);
  assert.equal(a.repIndex, b.repIndex);
  assert.equal(a.phaseElapsed, b.phaseElapsed);
  assert.equal(a.totalElapsed, b.totalElapsed);
  assert.equal(poseProgress(a), poseProgress(b));
});

test('zero-length pauses are skipped and leftover time carries over', () => {
  let s = start(createWorkout({
    ...shortConfig,
    countdown: 0,
    tempo: { down: 2, pauseBottom: 0, up: 2, pauseTop: 0 },
    reps: 2,
    sets: 1,
  }));
  s = tick(s, 2);
  assert.equal(s.phase, 'up');
  assert.ok(s.phaseElapsed < 1e-9);
  s = tick(s, 2);
  assert.equal(s.phase, 'down');
  assert.equal(displayRep(s), 2);
});

test('poseForState is deterministic and stays at the top while idle', () => {
  const body = buildBody();
  const s = createWorkout(shortConfig);
  const a = poseForState(s, body);
  const b = poseForState(s, body);
  assert.deepEqual(a.joints, b.joints);
  assert.ok(a.angles.torsoFromVerticalDeg < 20);
});
