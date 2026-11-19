import { rdl } from './rdl.js';

const registry = new Map();

export function registerExercise(exercise) {
  registry.set(exercise.id, exercise);
  return exercise;
}

export function getExercise(id) {
  const exercise = registry.get(id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}

export function listExercises() {
  return [...registry.values()];
}

registerExercise(rdl);

export { rdl };
