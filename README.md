# Workout Coach

A follow-along workout app that runs entirely in the browser. A 2D side-view
stick figure performs a Romanian deadlift so you can copy the movement in time with
it. Press Start, set the number of sets and reps, and move with the coach.

The movement engine (skeleton, exercise poses, and the set/rep/tempo clock) lives in
plain JavaScript modules with no access to the page. The canvas only draws what
the engine already computed, which is why the form can be unit-tested.

## Limits

Everything runs locally and offline. There are no extra packages, no sound, no
WebGL, and no outside services. Node 22 or newer is enough: the static server
and the tests use only built-in modules.

## Run

```bash
npm start
```

Then open http://127.0.0.1:3000 in a browser. The default workout is 3 sets of
10 at a 3–0.5–1 tempo (three seconds down, a short pause, one second up), with
60 seconds of rest between sets.

Useful address options for still poses:

- `/?pose=top`, `/?pose=mid`, `/?pose=bottom`
- `/?progress=0.35` for a specific point in the hinge (0 = standing, 1 = bottom)
- `/?angles=1` to show joint angles
- `/?path=1` to show the bar path and a ghost trail

## Test

```bash
npm test
```

The tests check the shape of a whole rep (soft knees, shins near vertical, a
neutral spine, a bar path over mid-foot, enough hip flexion at the bottom,
nearly vertical arms, fixed feet, constant bone lengths) and the workout clock (reps, sets, rest, pause,
and that the same inputs always produce the same result).

## How the Romanian deadlift is built

The legs are solved so the bar stays on a vertical line over mid-foot while the
hips travel back. Knees stay softly bent (about 17–22°) and almost constant,
and the shins stay within about 10° of vertical so the knees stay over the
ankles. The movement is a hip hinge: the torso tilts as a unit to just above
parallel at the bottom, with the spine segments keeping the same relative
angles so the back does not round. The neck stays in line with the trunk. The
arms hang down from the shoulders; a slight arm angle at the bottom keeps the
bar over mid-foot once the shins are held quiet.

## Adding an exercise

1. Create a module in `src/exercises/`, modelled on `src/exercises/rdl.js`.
   It should export an object with `id`, `name`, `cues`, `phaseLabels`,
   `shape` (keyframe joint angles and any constraints), and a `solve(body, t)`
   function. `t` is 0 at the top of the movement and 1 at the bottom.
2. Register it in `src/exercises/index.js` with `registerExercise(...)`.
3. Drive it from the workout clock by setting `exerciseId` in the workout
   config (the Start button currently uses `rdl`).
4. Add tests that describe the form you care about, the same way
   `test/rdl.test.js` does for the hinge.

The shared skeleton in `src/skeleton.js` already knows how to build a pose
from shank angle, knee flexion, hip flexion and a fixed spine shape. Many
hinge and squat patterns can reuse that, and only need a different way of
choosing those angles (and, for a squat, a different knee path).

## Licence

MIT. See `LICENSE`.
