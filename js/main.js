import { buildBody } from '../src/anthropometry.js';
import { getExercise, listExercises } from '../src/exercises/index.js';
import { rdl } from '../src/exercises/rdl.js';
import {
  applyConfig,
  createWorkout,
  describeState,
  pause as pauseWorkout,
  poseForState,
  poseProgress,
  reset as resetWorkout,
  start as startWorkout,
  tick,
} from '../src/workout.js';
import { computeBarPath, renderFrame, resizeCanvas } from './render.js';

const body = buildBody();
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const els = {
  name: document.getElementById('exercise-name'),
  setNow: document.getElementById('set-now'),
  setTotal: document.getElementById('set-total'),
  repNow: document.getElementById('rep-now'),
  repTotal: document.getElementById('rep-total'),
  phaseLabel: document.getElementById('phase-label'),
  phaseCue: document.getElementById('phase-cue'),
  phaseBar: document.getElementById('phase-bar'),
  phaseMeta: document.getElementById('phase-meta'),
  restClock: document.getElementById('rest-clock'),
  countdown: document.getElementById('countdown-overlay'),
  start: document.getElementById('btn-start'),
  pause: document.getElementById('btn-pause'),
  reset: document.getElementById('btn-reset'),
  sets: document.getElementById('in-sets'),
  reps: document.getElementById('in-reps'),
  down: document.getElementById('in-down'),
  pauseIn: document.getElementById('in-pause'),
  up: document.getElementById('in-up'),
  top: document.getElementById('in-top'),
  rest: document.getElementById('in-rest'),
  path: document.getElementById('tog-path'),
  angles: document.getElementById('tog-angles'),
};

let state = createWorkout(readConfig());
let frozenProgress = null;
let showAngles = false;
let showPath = false;
let lastTs = 0;
const barPath = computeBarPath((b, t) => rdl.solve(b, t), body, 32);

function readConfig() {
  return {
    exerciseId: 'rdl',
    sets: Number(els.sets.value),
    reps: Number(els.reps.value),
    tempo: {
      down: Number(els.down.value),
      pauseBottom: Number(els.pauseIn.value),
      up: Number(els.up.value),
      pauseTop: Number(els.top.value),
    },
    rest: Number(els.rest.value),
    countdown: 3,
  };
}

function syncConfigFromForm() {
  state = applyConfig(state, readConfig());
}

for (const input of [els.sets, els.reps, els.down, els.pauseIn, els.up, els.top, els.rest]) {
  input.addEventListener('change', syncConfigFromForm);
}

els.start.addEventListener('click', () => {
  syncConfigFromForm();
  frozenProgress = null;
  state = startWorkout(state);
});

els.pause.addEventListener('click', () => {
  state = pauseWorkout(state);
});

els.reset.addEventListener('click', () => {
  syncConfigFromForm();
  frozenProgress = null;
  state = resetWorkout(state);
});

els.path.addEventListener('change', () => {
  showPath = els.path.checked;
});
els.angles.addEventListener('change', () => {
  showAngles = els.angles.checked;
});

function ghostsFor(progress) {
  if (!showPath) return [];
  const frames = [];
  const n = 7;
  const top = Math.max(progress, 0.02);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * top;
    frames.push(rdl.solve(body, t));
  }
  return frames;
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.ceil((s - m * 60) * 10) / 10;
  if (m <= 0) return `${r.toFixed(r < 10 && r % 1 !== 0 ? 1 : 0)}s`;
  const whole = Math.ceil(s - m * 60);
  return `${m}:${String(whole).padStart(2, '0')}`;
}

function updateUi(view, progress) {
  els.name.textContent = getExercise(state.config.exerciseId).name;
  els.setNow.textContent = String(view.set);
  els.setTotal.textContent = String(view.sets);
  els.repNow.textContent = String(view.rep);
  els.repTotal.textContent = String(view.reps);
  els.phaseLabel.textContent = view.phaseLabel;
  els.phaseCue.textContent = view.cue;

  let bar = 0;
  if (state.status === 'working') {
    const dur = state.config.tempo[state.phase] || 1;
    bar = Math.min(1, state.phaseElapsed / dur);
  } else if (state.status === 'resting') {
    bar = 1 - state.restRemaining / Math.max(state.config.rest, 0.001);
  } else if (state.status === 'countdown') {
    bar = 1 - state.countdownRemaining / Math.max(state.config.countdown, 0.001);
  } else if (state.status === 'complete') {
    bar = 1;
  }
  els.phaseBar.style.width = `${Math.round(bar * 100)}%`;

  if (state.status === 'countdown') {
    els.countdown.textContent = String(view.countdown);
    els.countdown.classList.add('show');
  } else {
    els.countdown.classList.remove('show');
    els.countdown.textContent = '';
  }

  if (state.status === 'resting') {
    els.restClock.hidden = false;
    els.restClock.textContent = formatTime(state.restRemaining);
    els.phaseMeta.textContent = 'Rest between sets.';
  } else {
    els.restClock.hidden = true;
    if (state.status === 'idle') els.phaseMeta.textContent = 'Press Start when you are ready.';
    else if (state.status === 'complete') els.phaseMeta.textContent = 'All sets done.';
    else if (state.paused) els.phaseMeta.textContent = 'Paused.';
    else if (state.status === 'working') {
      const left = Math.max(0, (state.config.tempo[state.phase] ?? 0) - state.phaseElapsed);
      els.phaseMeta.textContent = `${left.toFixed(1)}s in this phase`;
    } else {
      els.phaseMeta.textContent = '';
    }
  }

  const running = state.status === 'working' || state.status === 'countdown' || state.status === 'resting';
  els.start.disabled = running && !state.paused;
  els.pause.disabled = !running || state.paused;
  els.start.textContent = state.paused || state.status === 'idle' || state.status === 'complete' ? (state.status === 'complete' ? 'Start' : state.paused ? 'Resume' : 'Start') : 'Start';
}

function currentPose(progressOverride) {
  if (progressOverride != null) return rdl.solve(body, progressOverride);
  return poseForState(state, body);
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.08, (ts - lastTs) / 1000);
  lastTs = ts;
  if (frozenProgress == null) {
    state = tick(state, dt);
  }
  const size = resizeCanvas(canvas);
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  const progress = frozenProgress != null ? frozenProgress : poseProgress(state);
  const pose = currentPose(frozenProgress);
  const view = describeState(state);
  renderFrame(ctx, pose, size.width, size.height, {
    ghosts: ghostsFor(progress),
    showAngles,
    showPath,
    barPath,
  });
  updateUi(view, progress);
  requestAnimationFrame(frame);
}

function applyQuery() {
  const q = new URLSearchParams(location.search);
  if (q.has('angles')) {
    showAngles = q.get('angles') !== '0';
    els.angles.checked = showAngles;
  }
  if (q.has('path')) {
    showPath = q.get('path') !== '0';
    els.path.checked = showPath;
  }
  const pose = q.get('pose');
  if (pose === 'top') frozenProgress = 0;
  else if (pose === 'mid') frozenProgress = 0.5;
  else if (pose === 'bottom') frozenProgress = 1;
  if (q.has('progress')) {
    const n = Number(q.get('progress'));
    if (Number.isFinite(n)) frozenProgress = Math.max(0, Math.min(1, n));
  }
  if (q.get('sets')) els.sets.value = q.get('sets');
  if (q.get('reps')) els.reps.value = q.get('reps');
  syncConfigFromForm();
}

applyQuery();

window.__workoutCoach = {
  setProgress(t) {
    frozenProgress = t == null ? null : Math.max(0, Math.min(1, Number(t)));
  },
  getProgress() {
    return frozenProgress != null ? frozenProgress : poseProgress(state);
  },
  setShowAngles(v) {
    showAngles = Boolean(v);
    els.angles.checked = showAngles;
  },
  setShowPath(v) {
    showPath = Boolean(v);
    els.path.checked = showPath;
  },
  getPose() {
    return currentPose(frozenProgress);
  },
  getState() {
    return { ...state };
  },
  listExercises,
  start() {
    frozenProgress = null;
    state = startWorkout(state);
  },
  reset() {
    frozenProgress = null;
    state = resetWorkout(state);
  },
};

requestAnimationFrame(frame);
