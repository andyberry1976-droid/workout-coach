import { clamp } from './math.js';
import { easeAscent, easeDescent } from './easing.js';
import { getExercise } from './exercises/index.js';

export const PHASES = ['down', 'pauseBottom', 'up', 'pauseTop'];

export const DEFAULT_TEMPO = Object.freeze({
  down: 3,
  pauseBottom: 0.5,
  up: 1,
  pauseTop: 0.4,
});

export const DEFAULT_CONFIG = Object.freeze({
  exerciseId: 'rdl',
  sets: 3,
  reps: 10,
  tempo: DEFAULT_TEMPO,
  rest: 60,
  countdown: 3,
});

export function normalizeConfig(input = {}) {
  const tempoIn = input.tempo ?? {};
  const sets = Math.max(1, Math.round(Number(input.sets ?? DEFAULT_CONFIG.sets)));
  const reps = Math.max(1, Math.round(Number(input.reps ?? DEFAULT_CONFIG.reps)));
  const tempo = {
    down: Math.max(0, Number(tempoIn.down ?? DEFAULT_TEMPO.down)),
    pauseBottom: Math.max(0, Number(tempoIn.pauseBottom ?? DEFAULT_TEMPO.pauseBottom)),
    up: Math.max(0, Number(tempoIn.up ?? DEFAULT_TEMPO.up)),
    pauseTop: Math.max(0, Number(tempoIn.pauseTop ?? DEFAULT_TEMPO.pauseTop)),
  };
  if (tempo.down + tempo.up <= 0) {
    tempo.down = DEFAULT_TEMPO.down;
    tempo.up = DEFAULT_TEMPO.up;
  }
  return {
    exerciseId: input.exerciseId ?? DEFAULT_CONFIG.exerciseId,
    sets,
    reps,
    tempo,
    rest: Math.max(0, Number(input.rest ?? DEFAULT_CONFIG.rest)),
    countdown: Math.max(0, Number(input.countdown ?? DEFAULT_CONFIG.countdown)),
  };
}

export function createWorkout(config = {}) {
  const cfg = normalizeConfig(config);
  return {
    status: 'idle',
    setIndex: 0,
    repIndex: 0,
    completedRepsInSet: 0,
    phase: null,
    phaseElapsed: 0,
    countdownRemaining: cfg.countdown,
    restRemaining: cfg.rest,
    totalElapsed: 0,
    paused: false,
    config: cfg,
  };
}

export function start(state) {
  if (state.status === 'idle' || state.status === 'complete') {
    const fresh = createWorkout(state.config);
    if (fresh.config.countdown > 0) {
      return { ...fresh, status: 'countdown', countdownRemaining: fresh.config.countdown };
    }
    return beginSet(fresh, 0);
  }
  if (state.paused) return { ...state, paused: false };
  return state;
}

export function pause(state) {
  if (state.status === 'working' || state.status === 'countdown' || state.status === 'resting') {
    return { ...state, paused: true };
  }
  return state;
}

export function togglePause(state) {
  if (state.status === 'idle' || state.status === 'complete') return start(state);
  if (state.paused) return { ...state, paused: false };
  return pause(state);
}

export function reset(state) {
  return createWorkout(state.config);
}

export function applyConfig(state, config) {
  const cfg = normalizeConfig({ ...state.config, ...config, tempo: { ...state.config.tempo, ...(config.tempo ?? {}) } });
  if (state.status === 'idle' || state.status === 'complete') {
    return { ...createWorkout(cfg), status: state.status };
  }
  return { ...state, config: cfg };
}

function beginSet(state, setIndex) {
  return {
    ...state,
    status: 'working',
    setIndex,
    repIndex: 0,
    completedRepsInSet: 0,
    phase: 'down',
    phaseElapsed: 0,
    countdownRemaining: 0,
    restRemaining: 0,
  };
}

function phaseDuration(state, phase = state.phase) {
  if (!phase) return 0;
  return state.config.tempo[phase] ?? 0;
}

/**
 * Advance a workout by dt seconds. Pure: returns a new state object.
 * Leftover time carries into the next phase so long ticks stay accurate.
 */
export function tick(state, dt) {
  const step = Number(dt);
  if (!Number.isFinite(step) || step <= 0) return state;
  if (state.paused) return state;
  if (state.status === 'idle' || state.status === 'complete') return state;

  let s = { ...state, totalElapsed: state.totalElapsed + step, config: state.config };
  let leftover = step;
  let guard = 0;
  const eps = 1e-9;

  while (leftover > 1e-12 && guard++ < 64) {
    if (s.status === 'countdown') {
      if (leftover + eps < s.countdownRemaining) {
        s.countdownRemaining -= leftover;
        leftover = 0;
        break;
      }
      leftover = Math.max(0, leftover - s.countdownRemaining);
      s = beginSet(s, s.setIndex);
      continue;
    }

    if (s.status === 'resting') {
      if (leftover + eps < s.restRemaining) {
        s.restRemaining -= leftover;
        leftover = 0;
        break;
      }
      leftover = Math.max(0, leftover - s.restRemaining);
      const nextSet = s.setIndex + 1;
      if (s.config.countdown > 0) {
        s = {
          ...s,
          status: 'countdown',
          setIndex: nextSet,
          repIndex: 0,
          completedRepsInSet: 0,
          phase: null,
          phaseElapsed: 0,
          countdownRemaining: s.config.countdown,
          restRemaining: 0,
        };
      } else {
        s = beginSet(s, nextSet);
      }
      continue;
    }

    if (s.status === 'working') {
      const dur = phaseDuration(s);
      if (dur <= 0) {
        s = advancePhase(s);
        if (s.status !== 'working') continue;
        continue;
      }
      const remain = dur - s.phaseElapsed;
      if (leftover + eps < remain) {
        s.phaseElapsed += leftover;
        leftover = 0;
        break;
      }
      leftover -= remain;
      s = { ...s, phaseElapsed: dur };
      s = advancePhase(s);
      continue;
    }

    break;
  }
  return s;
}

function advancePhase(state) {
  const order = PHASES;
  const idx = order.indexOf(state.phase);
  for (let i = 1; i <= order.length; i++) {
    const next = order[(idx + i) % order.length];
    const wrapped = idx + i >= order.length;
    if (wrapped) {
      return completeRep(state);
    }
    if (state.config.tempo[next] > 0) {
      return { ...state, phase: next, phaseElapsed: 0 };
    }
  }
  return completeRep(state);
}

function completeRep(state) {
  const completed = state.completedRepsInSet + 1;
  if (completed < state.config.reps) {
    return {
      ...state,
      completedRepsInSet: completed,
      repIndex: completed,
      phase: 'down',
      phaseElapsed: 0,
    };
  }
  const lastSet = state.setIndex + 1 >= state.config.sets;
  if (lastSet) {
    return {
      ...state,
      status: 'complete',
      completedRepsInSet: completed,
      repIndex: completed - 1,
      phase: 'pauseTop',
      phaseElapsed: 0,
      restRemaining: 0,
    };
  }
  return {
    ...state,
    status: 'resting',
    completedRepsInSet: completed,
    repIndex: completed - 1,
    phase: null,
    phaseElapsed: 0,
    restRemaining: state.config.rest,
  };
}

/** Hinge depth in [0, 1]: 0 at the top, 1 at the bottom. */
export function poseProgress(state) {
  if (state.status !== 'working' || !state.phase) return 0;
  const dur = phaseDuration(state);
  const u = dur <= 0 ? 1 : clamp(state.phaseElapsed / dur, 0, 1);
  switch (state.phase) {
    case 'down':
      return easeDescent(u);
    case 'pauseBottom':
      return 1;
    case 'up':
      return 1 - easeAscent(u);
    case 'pauseTop':
      return 0;
    default:
      return 0;
  }
}

export function poseForState(state, body) {
  const exercise = getExercise(state.config.exerciseId);
  return exercise.solve(body, poseProgress(state), exercise.shape);
}

export function displayRep(state) {
  if (state.status === 'idle') return 0;
  if (state.status === 'resting' || state.status === 'complete') {
    return state.config.reps;
  }
  return state.repIndex + 1;
}

export function displaySet(state) {
  if (state.status === 'idle') return 1;
  return state.setIndex + 1;
}

export function phaseLabel(state) {
  const exercise = getExercise(state.config.exerciseId);
  const key =
    state.status === 'working' ? state.phase : state.status;
  return exercise.phaseLabels[key] ?? '';
}

export function phaseCue(state) {
  const exercise = getExercise(state.config.exerciseId);
  const key =
    state.status === 'working' ? state.phase : state.status;
  return exercise.cues[key] ?? '';
}

export function countdownDisplay(state) {
  if (state.status !== 'countdown') return 0;
  return Math.max(1, Math.ceil(state.countdownRemaining - 1e-9));
}

export function describeState(state) {
  return {
    status: state.status,
    phase: state.status === 'working' ? state.phase : state.status,
    phaseLabel: phaseLabel(state),
    cue: phaseCue(state),
    set: displaySet(state),
    sets: state.config.sets,
    rep: displayRep(state),
    reps: state.config.reps,
    progress: poseProgress(state),
    phaseElapsed: state.phaseElapsed,
    countdown: countdownDisplay(state),
    restRemaining: state.status === 'resting' ? state.restRemaining : 0,
    paused: state.paused,
    complete: state.status === 'complete',
  };
}
