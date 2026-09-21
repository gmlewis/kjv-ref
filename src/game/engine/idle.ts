// When may the engine stop rendering?
//
// The Lamp of the Path scene is expensive on purpose: it renders at the phone's
// native pixel density (1080x2403 on a Pixel 10 XL), and `@babylonjs/lite`'s loop
// has no dirty check — `startEngine` re-arms itself every frame (`engine.js:188`)
// and re-renders whether or not anything moved. So the only way to stop paying
// for the pixels is to stop the engine, and the only question this module answers
// is when that is safe.
//
// It is a separate pure module for the same reason `layout.ts` is: the engine
// itself cannot run in jsdom (WebGPU), so arithmetic like this gets no coverage at
// all unless it lives outside `LampGame.ts`. `LampGame.ts` keeps the wiring — the
// `requestAnimationFrame` handle, `startEngine`/`stopEngine` — and asks here.

/**
 * The ambient pulse — flame flicker, beam sweep, the reflections breathing on the
 * water — is slow: the flame's own period is 8 rad/s, so about 1.25 s. Running it
 * at 60 fps buys nothing a player can see, and it is the one animation that runs
 * for the entire time a verse is on screen.
 */
export const AMBIENT_INTERVAL_MS = 1000 / 30;

/**
 * How long the ambient pulse keeps running after the player's last interaction.
 *
 * This is the knob that decides how much battery the scene costs, and it is worth
 * being explicit about the trade: while a verse is on screen and the player is
 * reading it — which is most of a session's wall-clock time — 12 flames, 12 beams
 * and 12 reflections would otherwise animate at 60 fps with nothing else moving.
 * After this window the scene holds still (a lit flame is a still flame) and the
 * engine stops; the next touch, tap, drag or verse transition brings the motion
 * back. 5 s is long enough that the stillness is never seen while the player is
 * playing and short enough that a phone set down on the puzzle stops drawing.
 */
export const AMBIENT_IDLE_MS = 5000;

/**
 * How long the loop keeps producing frames after the last thing that changed.
 *
 * Every visual mutation goes through `addSprite2D`/`updateSprite2D`/`placeSprite`/
 * `placeText`, each of which wakes the loop. That wake is a *window*, not a single
 * frame, because the engine's own `startEngine` resolves only after its first frame
 * and because a one-off change (a banner, a tile snapping home) is often followed
 * by another a few milliseconds later. It is the safety net that makes the settle
 * check safe to write as "nothing is moving": a mutation that this module cannot
 * see still gets its frames.
 */
export const WAKE_MS = 150;

export interface IdleState {
  /** The camera is still easing toward its target. */
  panning: boolean;
  /** Celebration / spark sprites are alive. */
  particles: number;
  /** Ambient sprites exist on the canvas (flames, beams, reflections). */
  ambientSprites: number;
  /** The host's `prefers-reduced-motion`. */
  reducedMotion: boolean;
  /** `performance.now()` of the last wake. */
  lastActivityAt: number;
  now: number;
}

/** True while the ambient pulse is worth running: sprites exist, motion is wanted, and the player has not gone quiet. */
export function ambientActive(state: IdleState): boolean {
  if (state.reducedMotion) return false;
  if (state.ambientSprites <= 0) return false;
  return state.now - state.lastActivityAt < AMBIENT_IDLE_MS;
}

/**
 * Whether the render loop should produce another frame.
 *
 * Note what is deliberately *not* here: the state of the puzzle. `teardownPuzzle`
 * removes the flames, beams and reflections along with everything else, so the
 * summary screen and the "No verses available" screen fall out of this predicate
 * with no flag of their own — `ambientSprites` reaches 0, the wake window expires,
 * and the engine stops with the last frame still on the canvas.
 */
export function shouldKeepRendering(state: IdleState): boolean {
  if (state.panning) return true;
  if (state.particles > 0) return true;
  if (state.now - state.lastActivityAt < WAKE_MS) return true;
  return ambientActive(state);
}
