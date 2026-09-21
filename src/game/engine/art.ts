/**
 * The sprite atlas: every frame the game draws, painted at boot.
 *
 * The atlas is assembled in a fixed order because `frame: 0` is the 1x1 white
 * pixel that the slot borders and the feedback pill are drawn with — index 0 is
 * pinned, new frames are appended.
 *
 * Frames are painted at a density matched to how large they are drawn, so the
 * scene is crisp at a phone's native resolution instead of being upscaled from
 * throwaway placeholder sizes (the old bands were 128 px wide and were stretched
 * across a 1080-px screen). See `scenery.ts` for the landscape itself and
 * `paint.ts` for the primitives.
 */
import { Band, clamp01, edge, hash, hex, mix, smooth, type FrameSpec } from './paint';
import { createSceneryFrames, SKY_FRAME } from './scenery';

export type SpriteFrameSpec = FrameSpec;

/**
 * The lighthouse tower's authored box, in CSS px, and its density. The aspect is
 * what the engine's `lw`/`lh` must match (all three tower states are the same
 * shape; only the lantern glass and the plinth differ).
 */
const LH_W = 28;
const LH_H = 100;
const LH_S = 3.2;

/**
 * How far above its foot a tower's lantern room sits, as a fraction of the drawn
 * height. Exported because the engine has to put the halo, the flame, the
 * fluency ring and the beam's pivot exactly there — they are separate sprites, so
 * the number is the only thing tying the light to the lantern.
 */
export const TOWER_LANTERN_ABOVE_FOOT = 0.849;

/** The tower's width:height ratio, so the engine can derive one from the other. */
export const TOWER_ASPECT = LH_W / LH_H;

/** The beam's authored box: apex at the bottom centre, fanning up. */
const BEAM_W = 132;
const BEAM_H = 80;
const BEAM_S = 2.0;

/** The halo's authored box, and the ring's, and the flame's, in CSS px. */
const HALO_CSS = 116;
const RING_CSS = 64;
const FLAME_CSS = 16;
const OBJ_S = 2.67;

/**
 * The three per-lamp light sprites. They cannot be baked into the scenery bands
 * because they belong to a lamp, and lamps do not pan with the scenery — and the
 * pool and the reflection are the two things the approved study is prettiest for.
 *
 * `LAMP_SHADOW_*` is authored for a tower of `LAMP_SHADOW_LW` CSS px half-width and
 * is stretched to whatever the live tower is; the other two are drawn at their
 * authored size.
 */
const LAMP_SHADOW_LW = 20;
const LAMP_POOL_CSS = 88;
const LAMP_REFLECT_W = 28;
const LAMP_REFLECT_H = 72;
const LAMP_S = 2.62;

// ---------------------------------------------------------------------------
// Lighthouses
// ---------------------------------------------------------------------------
function paintLighthouse(b: Band, lit: boolean) {
  // The sunset's "warm" tower palette: cream masonry with crimson bands, dark
  // slate roof, ironwork almost black against the sky.
  const cream = hex('#f6e6d4');
  const band = hex('#b4402c');
  const slate = hex('#3b2231');
  const iron = hex('#2e2130');
  const stone = hex('#4b3a3c');
  // Every tower is drawn from this one frame, so the sun is on the left of all of
  // them. In the live row the sun sits over lamp 3, so the four leftmost towers are
  // lit from the wrong side — a ~30% brightness swing on their side shading, and
  // the only way to fix it is a second frame, which is not worth the atlas space.
  const lightSide = -1;

  const lx = LH_W / 2;
  const footY = LH_H;
  // The finial is the tallest thing drawn, at 1.095 * lh above the foot, so the
  // tower exactly fills the frame when lh = LH_H / 1.095.
  const lh = LH_H / 1.095;
  const plinthH = lh * 0.07;
  const bodyBot = footY - plinthH;
  const deckY = footY - lh * 0.86;
  const glassTop = deckY - lh * 0.12;
  const glassBot = deckY - lh * 0.02;

  // Plinth
  b.box(lx - LH_W * 0.53, bodyBot, lx + LH_W * 0.53, footY + 1, (x, y) => {
    const cover = edge(y, bodyBot);
    if (cover <= 0) return null;
    const side = clamp01((x - (lx - LH_W * 0.53)) / (LH_W * 1.06));
    return [mix(stone, hex('#000000'), 0.15 + side * 0.3), cover];
  });

  // Tapered tower: 78% of its base width at the gallery, with two crimson bands.
  b.box(lx - LH_W * 0.5, deckY - 1, lx + LH_W * 0.5, bodyBot + 1, (x, y) => {
    const tt = clamp01((y - deckY) / (bodyBot - deckY));
    const halfW = LH_W * 0.5 * (0.78 + 0.22 * tt);
    if (Math.abs(x - lx) > halfW) return null;
    const cover = smooth(halfW, halfW - 0.5, Math.abs(x - lx));
    const side = clamp01((x - (lx - halfW)) / (halfW * 2));
    const light = 0.74 + 0.34 * (lightSide < 0 ? 1 - side : side);
    const banded = (tt > 0.2 && tt < 0.32) || (tt > 0.56 && tt < 0.68);
    const baseShade = mix(banded ? band : cream, hex('#000000'), tt * 0.14);
    return [[baseShade[0] * light, baseShade[1] * light, baseShade[2] * light], cover];
  });

  // Gallery deck (a thin iron disc that overhangs) and its railing.
  b.box(lx - LH_W * 0.62, deckY - 2.4, lx + LH_W * 0.62, deckY + 1.2, (x, y) => {
    const cover =
      smooth(1.8, 1.2, Math.abs(y - (deckY - 0.6))) *
      smooth(LH_W * 0.62, LH_W * 0.62 - 0.7, Math.abs(x - lx));
    return cover <= 0 ? null : [mix(iron, hex('#ffffff'), 0.18), cover];
  });
  for (let p = -2; p <= 2; p++) {
    const px = lx + p * LH_W * 0.245;
    b.box(px - 0.35, deckY - lh * 0.055, px + 0.35, deckY - 1.2, (x, y) => {
      if (Math.abs(x - px) > 0.35 || y > deckY - 1.2) return null;
      return [mix(iron, hex('#ffffff'), 0.22), 0.85];
    });
  }
  b.box(lx - LH_W * 0.58, deckY - lh * 0.055, lx + LH_W * 0.58, deckY - lh * 0.045, (x, y) => {
    if (Math.abs(y - (deckY - lh * 0.05)) > 0.4 || Math.abs(x - lx) > LH_W * 0.58) return null;
    return [mix(iron, hex('#ffffff'), 0.25), 0.8];
  });

  // Lantern room: narrower than the deck, dark mullions, warm glass.
  b.box(lx - LH_W * 0.34, glassTop, lx + LH_W * 0.34, glassBot, (x, y) => {
    const halfW = LH_W * 0.3;
    if (Math.abs(x - lx) > halfW) return null;
    const cover = smooth(halfW, halfW - 0.5, Math.abs(x - lx));
    if (Math.abs(Math.abs(x - lx) - halfW * 0.82) < 0.5) return [iron, cover * 0.9];
    if (!lit) return [mix(hex('#4a5c72'), hex('#7d90a6'), 0.4), cover];
    const core = 1 - smooth(0, halfW * 1.1, Math.abs(x - lx));
    return [mix(hex('#ffbe4d'), hex('#fffdf0'), core * 0.95), cover];
  });

  // Roof cone (apex up) + finial
  b.box(lx - LH_W * 0.46, glassTop - lh * 0.085, lx + LH_W * 0.46, glassTop + 0.5, (x, y) => {
    const py = (y - (glassTop - lh * 0.085)) / (lh * 0.085);
    if (py < 0 || py > 1.05) return null;
    const halfW = LH_W * 0.42 * py;
    if (halfW <= 0.05 || Math.abs(x - lx) > halfW) return null;
    const cover = smooth(halfW, halfW - 0.5, Math.abs(x - lx)) * smooth(-0.05, 0.06, py);
    if (cover <= 0) return null;
    const side = clamp01((x - (lx - halfW)) / (halfW * 2));
    return [mix(slate, hex('#ffffff'), (lightSide < 0 ? 1 - side : side) * 0.2), cover];
  });
  b.box(lx - 0.5, glassTop - lh * 0.115, lx + 0.5, glassTop - lh * 0.075, () => [
    mix(iron, hex('#ffffff'), 0.3),
    0.9,
  ]);
}

// ---------------------------------------------------------------------------
// Beacon light
// ---------------------------------------------------------------------------
/**
 * The beam is a wedge with its apex at the *bottom centre* of the frame, fanning
 * up and out, and its alpha reaches zero on all three open edges — so a rotating
 * quad can never show a cut edge. The engine pivots it about that apex with
 * `rotation`, which is why the apex has to be a fixed point of the art rather
 * than of the placement maths.
 *
 * Source-over, not additive: this frame is drawn as a sprite in its own right, so
 * it has to carry its own alpha. (Additive here would leave the frame fully
 * transparent — it was invisible in the first composite for exactly that reason.)
 */
function paintBeam(b: Band) {
  const apexX = BEAM_W / 2;
  const apexY = BEAM_H;
  b.box(0, 0, BEAM_W, BEAM_H, (x, y) => {
    const dy = apexY - y;
    if (dy < 4) return null;
    const dx = Math.abs(x - apexX);
    const spread = 0.34 + dy * 0.006;
    const reach = dy * spread + 8;
    if (dy > BEAM_H || dx > reach) return null;
    const a = (1 - clamp01(dy / BEAM_H)) * (1 - clamp01(dx / reach)) * 0.2;
    return a <= 0.012 ? null : [hex('#ffe9a8'), a];
  });
}

/**
 * The halo is the harness's two glows in one sprite: a wide amber bloom with a
 * near-white core, so a lit lamp reads as a lamp rather than as a bright disc.
 *
 * The core's alpha is deliberately *not* 1. This frame is drawn on the additive
 * layer, where the contribution is `colour * alpha` added to whatever is behind
 * it: an opaque near-white core (alpha 1 on a mid-bright background) saturates
 * to a flat white rectangle, which is exactly what the first additive composite
 * showed — twelve blown-out boxes instead of twelve lamps. Capping the peak at
 * ~0.6 keeps a hot core that still reads as blown-out at the very centre while
 * letting the tower's lantern glass and the sky show through around it.
 */
function paintHalo(b: Band) {
  const r = HALO_CSS / 2;
  const c = b.width / 2 / b.density;
  b.box(0, 0, HALO_CSS, HALO_CSS, (x, y) => {
    const d = Math.hypot(x - c, y - c) / r;
    if (d >= 1) return null;
    const bloom = Math.pow(1 - d, 2.0) * 0.85;
    const core = 1 - smooth(0, 0.3, d);
    const alpha = Math.min(0.6, bloom * 0.75 + core * 0.5);
    return [mix(hex('#ffb347'), hex('#fff8de'), core), alpha];
  });
}

/** The fluency ring: a thin gold arc that reads as a timer, not as a halo. */
function paintRing(b: Band) {
  const c = RING_CSS / 2;
  const radius = RING_CSS * 0.42;
  const thickness = 2;
  b.box(0, 0, RING_CSS, RING_CSS, (x, y) => {
    const d = Math.hypot(x - c, y - c);
    if (Math.abs(d - radius) > thickness) return null;
    return [hex('#fbbf24'), (1 - Math.abs(d - radius) / thickness) * 0.9];
  });
}

/** A teardrop flame: the flicker the engine animates inside the lantern glass. */
function paintFlame(b: Band) {
  const c = FLAME_CSS / 2;
  b.box(0, 0, FLAME_CSS, FLAME_CSS, (x, y) => {
    // A teardrop, widening downward then rounding off at the base.
    const t = clamp01((y - 1.5) / (FLAME_CSS - 3.5));
    const halfW = c * 0.78 * Math.pow(t, 0.55) * (1 - smooth(0.82, 1, t) * 0.35);
    const dx = Math.abs(x - c);
    if (dx > halfW) return null;
    const cover = smooth(halfW, halfW - 0.35, dx);
    const d = Math.hypot((x - c) / (c * 0.8), (y - (FLAME_CSS - 4)) / (c * 1.1));
    const core = 1 - smooth(0, 0.62, d);
    return [mix(mix(hex('#ea580c'), hex('#f59e0b'), t), hex('#fef3c7'), core), cover];
  });
}

/**
 * The shadow a tower casts on the causeway. Authored for `LAMP_SHADOW_LW` px of
 * half-width, so the engine stretches it to the live tower's width — without it the
 * towers sit *on* the road rather than *in* it.
 */
function paintLampShadow(b: Band) {
  const w = LAMP_SHADOW_LW * 2;
  const h = 8;
  b.box(0, 0, w, h, (x, y) => {
    const d = Math.hypot((x - w / 2) / LAMP_SHADOW_LW, (y - h / 2) / (h / 2));
    return d >= 1 ? null : [hex('#000000'), (1 - d) * 0.36];
  });
}

/** The warm pool a lit lamp throws on the causeway in front of it. */
function paintLampPool(b: Band) {
  const h = 22;
  b.box(0, 0, LAMP_POOL_CSS, h, (x, y) => {
    const d = Math.hypot((x - LAMP_POOL_CSS / 2) / (LAMP_POOL_CSS / 2 - 8), (y - h / 2) / (h / 2 - 2));
    return d >= 1 ? null : [hex('#ffbe5c'), Math.pow(1 - d, 1.5)];
  });
}

/**
 * A lit lamp's reflection on the water: a warm column under the tower, broken up by
 * the surface. Drawn by the engine as an additive sprite so twelve of them merge into
 * the broad glow the study has along the whole waterline.
 */
function paintLampReflection(b: Band) {
  b.box(0, 0, LAMP_REFLECT_W, LAMP_REFLECT_H, (x, y) => {
    const d = Math.abs(x - LAMP_REFLECT_W / 2) / (LAMP_REFLECT_W / 2);
    const sparkle = 0.6 + 0.4 * hash(Math.round(x / 2), Math.round(y / 2));
    const fade = Math.pow(1 - Math.min(1, d), 2) * (0.55 + 0.45 * (1 - y / LAMP_REFLECT_H));
    return [hex('#ffc257'), fade * sparkle];
  });
}

/**
 * Word cards. Both plates are painted with **horizontal features only** — the
 * frames are stretched horizontally to each word's natural width, so anything
 * with a vertical edge in it (a side border, a corner) would come out a different
 * thickness on every tile. The gold rule top and bottom is the whole decoration;
 * the slot's outline is drawn as four edge sprites by the engine.
 */
const PLATE_W = 512;
const PLATE_H = 96;
/** Rows of the 96-row frame taken by the top and bottom rules: ~1.9 CSS px when
 * a 36 px card is drawn from this frame, and still visible on a 52 px one. */
const PLATE_RULE = 5;

function paintPlate(b: Band, kind: 'tile' | 'slot') {
  const tile = kind === 'tile';
  const face = tile ? mix(hex('#fef3c7'), hex('#e9d9a8'), 0.5) : hex('#f59e0b');
  b.box(0, 0, PLATE_W, PLATE_H, (_x, y) => {
    if (y < PLATE_RULE) return [tile ? hex('#d97706') : hex('#fbbf24'), 1];
    if (y > PLATE_H - PLATE_RULE) return [tile ? hex('#b45309') : hex('#f59e0b'), 1];
    const t = (y - PLATE_RULE) / (PLATE_H - 2 * PLATE_RULE);
    return [mix(face, tile ? hex('#e9d9a8') : hex('#d97706'), t * 0.4), tile ? 1 : 0.22];
  });
}

// ---------------------------------------------------------------------------
// Frame assembly
// ---------------------------------------------------------------------------
export function createGameSpriteFrames(): SpriteFrameSpec[] {
  const frames: SpriteFrameSpec[] = [];

  // 0. 'w' — 1x1 white pixel. PINNED at index 0: the slot borders and the
  // feedback pill are drawn as `frame: 0` quads tinted by `color`.
  frames.push({ name: 'w', width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) });

  // 1-4. The scene: sky, then the three parallax bands. The engine draws these
  // in this order (sky behind far behind mid behind near).
  frames.push(...createSceneryFrames());

  // 5. 'lighthouse_unlit' / 'lighthouse_lit'
  {
    const b = new Band('lighthouse_unlit', 0, 0, LH_W, LH_H, LH_S);
    paintLighthouse(b, false);
    frames.push(b.frame());
  }
  {
    const b = new Band('lighthouse_lit', 0, 0, LH_W, LH_H, LH_S);
    paintLighthouse(b, true);
    frames.push(b.frame());
  }

  // 6. 'beacon_beam'
  {
    const b = new Band('beacon_beam', 0, 0, BEAM_W, BEAM_H, BEAM_S);
    paintBeam(b);
    frames.push(b.frame());
  }

  // 7. 'glow_halo'
  {
    const b = new Band('glow_halo', 0, 0, HALO_CSS, HALO_CSS, OBJ_S);
    paintHalo(b);
    frames.push(b.frame());
  }

  // 8. 'fluency_ring'
  {
    const b = new Band('fluency_ring', 0, 0, RING_CSS, RING_CSS, OBJ_S);
    paintRing(b);
    frames.push(b.frame());
  }

  // 9. 'flame'
  {
    const b = new Band('flame', 0, 0, FLAME_CSS, FLAME_CSS, 3);
    paintFlame(b);
    frames.push(b.frame());
  }

  // 10-12. The per-lamp light: the shadow it casts, the pool on the road, and the
  // reflection on the water.
  {
    const b = new Band('lamp_shadow', 0, 0, LAMP_SHADOW_LW * 2, 8, LAMP_S);
    paintLampShadow(b);
    frames.push(b.frame());
  }
  {
    const b = new Band('lamp_pool', 0, 0, LAMP_POOL_CSS, 22, LAMP_S);
    paintLampPool(b);
    frames.push(b.frame());
  }
  {
    const b = new Band('lamp_reflection', 0, 0, LAMP_REFLECT_W, LAMP_REFLECT_H, LAMP_S);
    paintLampReflection(b);
    frames.push(b.frame());
  }

  // 13. 'tile_bg' / 'slot_bg' — the word cards
  for (const kind of ['tile', 'slot'] as const) {
    const b = new Band(kind === 'tile' ? 'tile_bg' : 'slot_bg', 0, 0, PLATE_W, PLATE_H, 1);
    paintPlate(b, kind);
    frames.push(b.frame());
  }

  return frames;
}

/** Authoring constants the engine needs in order to place the art. */
export const ART_METRICS = {
  /** The sky frame's authored size; the engine stretches it across the canvas. */
  skyFrame: SKY_FRAME,
  /** The beam's authored box, in CSS px, with its apex at the bottom centre. */
  beam: { width: BEAM_W, height: BEAM_H },
  /** The halo's and the ring's authored boxes, in CSS px. */
  halo: HALO_CSS,
  ring: RING_CSS,
  /** The tower shadow's authored half-width — the engine stretches its box. */
  shadowHalfWidth: LAMP_SHADOW_LW,
  /** The reflection's authored height, which the engine stretches to the water. */
  reflectionHeight: LAMP_REFLECT_H,
} as const;
