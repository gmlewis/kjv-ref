/**
 * Sunset Harbor — the painted scenery the Lamp of the Path puzzle sits on.
 *
 * The scene is a harbour at dusk: a graded indigo-to-amber sky with long
 * underlit cloud bands, a hazy ridge with a waterfall pouring through its
 * saddle, a wooded shoreline with a citadel on its headland, glossy water
 * carrying the sun's reflected column, and the cobbled causeway the twelve
 * lighthouses stand on.
 *
 * Everything is *painted*, not modelled: a few closed-form profiles (a ridge line
 * from six gaussian peaks, a two-sine hill line, a headland, a cobble grid)
 * sampled per pixel into RGBA frames. The engine then draws those frames as four
 * parallax bands — sky, far shore, water and causeway — so this module can stay a
 * pure function of its own constants.
 *
 * Two contracts matter to the rest of the game:
 *
 * 1. **One reference layout.** The bands are authored for a 412x915 CSS px phone
 *    (`REF_*` below, the same anchors `LampGame.buildPuzzle` uses at that size)
 *    and the engine stretches each one to the live viewport. Their *heights* are
 *    defined relative to `pathY`, so they are viewport-independent: the ridge is
 *    always 270 px above the road and the water always runs from just under the
 *    shoreline to the bottom of the canvas. Only the sky, a vertical gradient, is
 *    stretched on both axes.
 *
 * 2. **Bands are opaque where they have content.** Each band paints its own
 *    background (sky above the ridge, water below the shoreline) and blends its
 *    soft passes over that, so no band needs to know what is behind it — except
 *    the causeway, which really is a strip of stone over the water and keeps a
 *    transparent surround on all four sides.
 *
 * The densities are deliberately different: soft atmosphere (sky, clouds, haze,
 * water) is indistinguishable at low density, while the ridge crest, the cobble
 * grout and the lighthouse ironwork need more. Raising them raises atlas size and
 * boot time linearly.
 */
import {
  Band,
  clamp01,
  edge,
  hash,
  hex,
  mix,
  ramp,
  smooth,
  vnoise,
  type FrameSpec,
  type RGB,
} from './paint';

// ---------------------------------------------------------------------------
// Reference layout: the phone geometry `buildPuzzle` produces at W=412, H=915,
// isMobile (margin 12, parallax pan 80 + 24 px of edge slack).
// ---------------------------------------------------------------------------
const REF_W = 412;
const REF_H = 915;
const REF_PATH_Y = REF_H - 84; // 831 — the road the lamps stand on
const REF_LAYER_W = 620; // 412 + 2 * (80 + 24)
const LAYER_X = REF_W / 2 - REF_LAYER_W / 2; // -104

/** Authored pixels per CSS pixel for the three composite bands. */
const BAND_S = 2.62;
/** …and for the sky, whose features are all wider than 40 CSS px. */
const SKY_S = 0.95;

// Band extents in reference CSS px, all anchored to the road.
export const FAR_TOP = REF_PATH_Y - 270;
export const FAR_BOTTOM = REF_PATH_Y;
/** The shoreline sits 2 px above the road: the cobbles overhang it. */
export const WATER_TOP = REF_PATH_Y - 2;
export const MID_BOTTOM = REF_PATH_Y + 84;
const ROAD_TOP = REF_PATH_Y - 14;
export const ROAD_BOTTOM = REF_PATH_Y + 12;

const SKY_W = Math.round(REF_W * SKY_S); // 391
const SKY_H = Math.round(REF_H * SKY_S); // 869

// ---------------------------------------------------------------------------
// The palette. One look for both themes (the player's call: everyone gets the
// sunset); a light-mode grade would be an edit to `sky` and `haze` alone.
// ---------------------------------------------------------------------------
interface Look {
  sky: Array<[number, RGB]>;
  haze: RGB;
  sun: { x: number; y: number; r: number; core: RGB; glow: RGB; strength: number };
}

export const SUNSET: Look = {
  sky: [
    [0, hex('#0b1236')], // night still overhead
    [200, hex('#28265c')], // indigo
    [420, hex('#6f3c6b')], // mauve
    [560, hex('#b3555c')], // rose
    [650, hex('#e2804f')], // orange
    [700, hex('#ffb46a')], // amber
    [745, hex('#ffe1b0')], // the horizon itself
  ],
  haze: hex('#f0a874'),
  sun: { x: REF_W * 0.31, y: 736, r: 40, core: hex('#fff6d8'), glow: hex('#ff9a4a'), strength: 0.85 },
};

/** Where the horizon stop lands when the ramp is mapped over the reference height. */
const HORIZON_STOP = 745;
/** The ramp coordinate of reference CSS row `y`. */
export const skyStopFor = (y: number) => (y / REF_H) * HORIZON_STOP;
export const skyAt = (y: number) => ramp(SUNSET.sky, skyStopFor(y));

// ---------------------------------------------------------------------------
// Terrain profiles
// ---------------------------------------------------------------------------

/**
 * The ridge: six peaks and a saddle at u=38 (x≈80) that the waterfall pours
 * through. Narrower than the band, because a hump as wide as the band reads as a
 * hill rather than as a mountain.
 */
const PEAKS: Array<[number, number, number]> = [
  // [u centre, height, width]
  [10, 44, 15],
  [24, 30, 11],
  [38, 20, 8], // the saddle the waterfall drains through
  [62, 68, 16],
  [90, 46, 12],
  [116, 54, 15],
];
const RIDGE_BASE = 742;
const WATERFALL_X = LAYER_X + (38 / 128) * REF_LAYER_W; // 80.1
const CITY_CX = REF_W * 0.775;
const CITY_BASE = REF_PATH_Y - 18;
const HILLS_TOP = 748;

/**
 * Where the engine must place each band, in CSS px relative to the road, plus the
 * parallax factor to move it by. Keeping these numbers here — rather than in
 * `LampGame` — means the art and the placement cannot disagree about where the
 * ridge is.
 */
export const SCENERY_BANDS = {
  /** Sky: the whole canvas, top to bottom, never panned. */
  sky: { parallax: 0 },
  /** Ridge, woodland, waterfall and citadel — one picture, one parallax factor. */
  far: { top: FAR_TOP - REF_PATH_Y, bottom: FAR_BOTTOM - REF_PATH_Y, parallax: 0.5 },
  /** Water, from the shoreline to whatever the bottom of the canvas is. */
  mid: { top: WATER_TOP - REF_PATH_Y, parallax: 0.5 },
  /** The causeway itself, on the ground plane. */
  near: { top: ROAD_TOP - REF_PATH_Y, bottom: ROAD_BOTTOM - REF_PATH_Y, parallax: 1 },
} as const;

/** Width the bands are authored at, in reference CSS px. */
export const SCENERY_BAND_CSS_WIDTH = REF_LAYER_W;

function ridgeHeight(x: number): number {
  const uu = ((x - LAYER_X) / REF_LAYER_W) * 128;
  let h = 0;
  for (const [c, ph, pw] of PEAKS) h = Math.max(h, ph * Math.exp(-Math.pow((uu - c) / pw, 2)));
  h += (vnoise(x, 3) * 0.62 + vnoise(x * 2.1, 5, 11) * 0.38 - 0.5) * 15;
  return Math.max(0, h);
}
const ridgeY = (x: number) => RIDGE_BASE - ridgeHeight(x);

/** Rolling hills: gentle, large features. */
function hillsY(x: number): number {
  const uu = (x - LAYER_X) / REF_LAYER_W;
  const h = 26 + 12 * Math.sin(uu * Math.PI * 2.1 + 0.6) + 6 * Math.sin(uu * Math.PI * 5.3 + 1.2);
  return HILLS_TOP + (44 - h) * 1.5;
}

/** The headland the citadel sits on. */
function headlandY(x: number, cx: number): number {
  const t = clamp01((x - (cx - 96)) / 192);
  return CITY_BASE - 26 * Math.sin(t * Math.PI) ** 0.8;
}

/**
 * Per-column profile for a painter, computed once per frame instead of once per
 * pixel: the ridge line costs six exponentials and three sine-hashes, and the far
 * band asks for it at ~250k pixel positions.
 */
function columns(b: Band, fn: (x: number) => number): Float32Array {
  const out = new Float32Array(b.width);
  for (let px = 0; px < b.width; px++) out[px] = fn(b.cssX(px));
  return out;
}

// ---------------------------------------------------------------------------
// Sky: the ramp and the cloud bands, and nothing else. The sun is painted into
// the far band instead, where it shares the horizon's scale — this frame is
// stretched to fill the canvas, so a disc painted here would come out elliptical.
// ---------------------------------------------------------------------------
function paintSky(b: Band) {
  // One colour per row: fill rows, not pixels.
  for (let py = 0; py < b.height; py++) {
    const col = skyAt(b.cssY(py));
    const r = Math.round(col[0]);
    const g = Math.round(col[1]);
    const bl = Math.round(col[2]);
    for (let px = 0; px < b.width; px++) {
      const i = (py * b.width + px) * 4;
      b.pixels[i] = r;
      b.pixels[i + 1] = g;
      b.pixels[i + 2] = bl;
      b.pixels[i + 3] = 255;
    }
  }

  paintClouds(b);
}

/**
 * The long, soft, underlit cloud bands. A second smaller lobe above each keeps
 * them from reading as flat plates. Every box is the lobe's own full reach, so the
 * falloff is already zero at the edge and no fade is needed.
 *
 * Painted by the sky frame **and** by the far band's background pass, from the same
 * formulas in the same reference coordinates. The far band's top edge cuts the sky
 * at `pathY - 270`, which lands mid-cloud; repainting them there is what stops the
 * seam from being visible as a row of truncated lobes.
 */
function paintClouds(b: Band) {
  for (let i = 0; i < 6; i++) {
    const cy = 132 + i * 112 + hash(i, 3) * 54;
    const cx = -60 + hash(i, 1) * (REF_W + 120);
    const cw = 120 + hash(i, 2) * 150;
    const ch = 9 + hash(i, 5) * 17;
    const warm = mix(hex('#ff9a63'), hex('#ffd9a0'), hash(i, 7));
    b.box(cx - cw * 1.45, cy - ch * 2.6, cx + cw * 1.45, cy + ch * 2.4, (x, y) => {
      const wobble = 1 + 0.24 * Math.sin(x / 46 + i * 2.1) + 0.15 * Math.sin(x / 17 + i);
      const d = Math.hypot((x - cx) / (cw * wobble), (y - cy) / (ch * 2.2));
      const d2 = Math.hypot((x - cx + cw * 0.35) / (cw * 0.6), (y - (cy - ch * 0.9)) / (ch * 1.5));
      const near = Math.min(d, d2);
      if (near >= 1) return null;
      const a = Math.pow(1 - near, 1.15) * 0.42;
      const lit = smooth(-1, 1, (y - cy) / (ch * 2.2));
      return [mix(mix(warm, hex('#ffe9c8'), 0.5), warm, lit), a];
    });
  }
}

// ---------------------------------------------------------------------------
// Far band: sun, ridge with its mist, wooded hills, waterfall, citadel. One band
// because they are one picture — they share a parallax factor, so the fall cannot
// drift off its saddle when the camera pans.
// ---------------------------------------------------------------------------
function paintFar(b: Band) {
  const look = SUNSET;

  // Background: the same ramp as the sky frame, from the same formula, so the
  // seam between the two frames is a colour the ramp already has — and the same
  // cloud bands, so it is not a seam at all.
  b.box(LAYER_X, FAR_TOP, LAYER_X + REF_LAYER_W, FAR_BOTTOM, (_x, y) => [skyAt(y), 1]);
  paintClouds(b);

  paintSun(b, look);
  paintRidge(b, look);
  paintHills(b, look);
  paintWaterfall(b, look);
  paintCity(b, look);
}

function paintSun(b: Band, look: Look) {
  const c = look.sun;
  // The halo is painted with source-over, not added: adding warm light to a blue
  // sky goes green, which put a cold ring around the sun. The box is the halo's
  // own 7r reach; the fade only matters at the band's top edge, where the alpha
  // has already fallen to ~0.007.
  b.box(
    c.x - c.r * 7,
    FAR_TOP,
    c.x + c.r * 7,
    c.y + c.r * 7,
    (x, y) => {
      const d = Math.hypot(x - c.x, y - c.y) / (c.r * 7);
      if (d >= 1) return null;
      const a = Math.pow(1 - d, 2.3) * 0.6 * c.strength;
      return a <= 0.004 ? null : [mix(c.glow, hex('#ffdfae'), 0.3), a];
    },
    'over',
    40,
  );

  // The core: an inner glow plus a near-white disc.
  b.glow(c.x, c.y, c.r * 1.9, mix(c.glow, c.core, 0.6), c.strength * 0.5, 2.0);
  b.box(c.x - c.r - 1, c.y - c.r - 1, c.x + c.r + 1, c.y + c.r + 1, (x, y) => {
    const d = Math.hypot(x - c.x, y - c.y) / c.r;
    if (d >= 1) return null;
    return [mix(c.core, mix(c.core, c.glow, 0.5), smooth(0.35, 1, d)), 1 - smooth(0.72, 1, d)];
  }, 'add');
}

function paintRidge(b: Band, look: Look) {
  const ridge = columns(b, ridgeY);
  const sunX = look.sun.x;
  const toSun = (x: number) => clamp01(1 - Math.abs(x - sunX) / (REF_LAYER_W * 0.55));

  b.box(LAYER_X, FAR_TOP, LAYER_X + REF_LAYER_W, HILLS_TOP + 40, (x, y, px) => {
    const ry = ridge[px];
    const cover = edge(y, ry);
    if (cover <= 0) return null;
    const depth = clamp01((y - ry) / 110);
    const crest = 1 - smooth(0, 2.2, y - ry);

    // Hazy: distance, not stone — a soft silhouette with the sun's rim on it. No
    // snow line: an earlier pass mixed white into the crest and the ridge came out
    // with a pale outline the approved study does not have.
    let col = mix(hex('#5d3550'), hex('#3f2743'), clamp01(depth * 1.2));
    col = mix(col, look.haze, 0.18 + depth * 0.42);
    col = mix(col, hex('#ffcf92'), crest * (0.25 + 0.7 * toSun(x)));
    return [col, cover];
  });

  // The haze band along the hill line, which is what makes the ridge sit behind
  // the hills rather than on them.
  b.box(LAYER_X, HILLS_TOP - 46, LAYER_X + REF_LAYER_W, HILLS_TOP + 34, (x, y) => {
    const centre = HILLS_TOP - 14 + Math.sin(x / 62) * 6;
    const a = (1 - smooth(0, 26, Math.abs(y - centre))) * 0.16;
    return a <= 0.004 ? null : [look.haze, a];
  }, 'over', 10);
}

function paintHills(b: Band, look: Look) {
  const treeCol = hex('#3f2033');
  const hills = columns(b, hillsY);

  b.box(LAYER_X, HILLS_TOP - 6, LAYER_X + REF_LAYER_W, WATER_TOP + 2, (x, y, px) => {
    const hy = hills[px];
    const cover = edge(y, hy);
    if (cover <= 0) return null;
    const depth = clamp01((y - hy) / 70);
    let col = mix(hex('#22424b'), hex('#122834'), depth);
    col = mix(col, hex('#ffcf9a'), (1 - smooth(0, 2.6, y - hy)) * 0.5);
    return [mix(col, look.haze, depth * 0.1), cover];
  });

  // A wooded skyline: a jagged treeline band hugging the crest, then individual
  // firs poking out of it. A fir's silhouette is *concave*, so a row of them reads
  // as trees rather than as bunting.
  b.box(LAYER_X, HILLS_TOP - 34, LAYER_X + REF_LAYER_W, WATER_TOP, (x, y, px) => {
    const hy = hills[px] - 1.5;
    const top = hy - (3 + (vnoise(x, 23, 13) * 0.6 + vnoise(x, 29, 6) * 0.4) * 14);
    const cover = edge(y, top) * (1 - edge(y, hy + 1));
    if (cover <= 0) return null;
    const shade = mix(
      mix(treeCol, hex('#ffffff'), 0.16),
      mix(treeCol, hex('#000000'), 0.42),
      clamp01((y - top) / Math.max(1, hy - top)),
    );
    return [shade, cover * 0.88];
  });

  const fir = (tx: number, hy: number, th: number, bright: number) => {
    const tw = th * 0.36;
    b.box(tx - tw - 1, hy - th - 1, tx + tw + 1, hy + 3, (x, y) => {
      const py = (y - (hy - th)) / th;
      if (py < 0 || py > 1.06) return null;
      const width = Math.pow(1 - py, 1.35);
      if (width <= 0.01) return null;
      const cover = clamp01((width - Math.abs(x - tx) / tw) / 0.28 + 0.5) * smooth(0.02, 0.12, py);
      if (cover <= 0) return null;
      const shade = mix(
        mix(treeCol, hex('#ffffff'), 0.2 * bright),
        mix(treeCol, hex('#000000'), 0.5),
        clamp01(py * 0.85),
      );
      return [shade, cover];
    });
  };

  // A back row and a front row, both kept clear of the gorge and of the town.
  const back: Array<[number, number, number]> = [];
  const front: Array<[number, number, number]> = [];
  for (let i = 0; i < 30; i++) {
    const tx = LAYER_X + (i + 0.5) * (REF_LAYER_W / 30) + (hash(i, 61) - 0.5) * 14;
    if (Math.abs(tx - WATERFALL_X) < 20) continue;
    if (Math.abs(tx - CITY_CX) < 94) continue;
    const th = 13 + hash(i, 67) * 13;
    front.push([tx, hillsY(tx), th]);
    back.push([tx - 4, hillsY(tx - 4) - 2, th * 0.8]);
  }
  for (const [tx, hy, th] of back) fir(tx, hy, th, 0.5);
  for (const [tx, hy, th] of front) fir(tx, hy, th, 1);
}

/**
 * The waterfall and the gorge it has cut. Painted into whichever band's box
 * covers it, so the far band carries the part above the shoreline and the water
 * band carries the drop into the plunge pool; both call the same maths, so the
 * two halves line up to the pixel.
 */
function paintWaterfall(b: Band, look: Look) {
  const cx = WATERFALL_X;
  const top = ridgeY(cx) + 1;
  const foam = hex('#ffe6c8');
  const sprayCol = hex('#d8ecff');
  const rock = hex('#31242c');

  // The gorge: a rock channel, not a black smear. An earlier pass painted a flat
  // dark band here wide enough to read as a hole punched in the hillside.
  b.box(cx - 22, top, cx + 22, REF_PATH_Y + 2, (x, y) => {
    const t = clamp01((y - top) / (REF_PATH_Y - top));
    const halfGorge = 5 + t * 5;
    const rough = 1 + 0.22 * (vnoise(y * 3.1, 91, 9) - 0.5) * 2;
    const gorge = 1 - smooth(halfGorge * 0.5 * rough, halfGorge * rough, Math.abs(x - cx));
    if (gorge <= 0.012) return null;
    const side = clamp01(Math.abs(x - cx) / (halfGorge * rough));
    return [mix(rock, hex('#000000'), side * 0.35 + t * 0.2), gorge * 0.8];
  });

  // The fall: brightest at the lip, thinning and dimming as it drops, with a
  // wobbling centre line. An earlier pass was a ruled vertical column at ~96%
  // opacity, which read as a crack of light rather than as falling water.
  b.box(cx - 14, top - 1, cx + 14, WATER_TOP + 8, (x, y) => {
    const t = clamp01((y - top) / (WATER_TOP - top));
    const wobble = Math.sin(y / 11) * 1.6 + Math.sin(y / 4.3 + 1.7) * 0.7;
    const dx = Math.abs(x - (cx + wobble));
    const halfW = 5 + t * 4;
    const core = 1 - smooth(halfW * 0.4, halfW, dx);
    const body = 1 - smooth(halfW, halfW * 1.7, dx);
    if (core <= 0.01 && body <= 0.01) return null;
    const streak = 0.78 + 0.22 * Math.sin(y / 3.8 + hash(Math.round(x * 4), 13) * 3.1);
    const fade = 0.62 + 0.38 * (1 - t);
    return [mix(sprayCol, foam, core), Math.max(core * 0.85, body * 0.3) * streak * fade];
  });

  b.glow(cx, WATER_TOP + 2, 34, sprayCol, 0.3, 1.9, 0.45);
}

/** The plunge pool and the spray it throws up, painted over the water. */
function paintPool(b: Band) {
  const cx = WATERFALL_X;
  const sprayCol = hex('#d8ecff');

  // The churn where the fall lands: a squashed bright ellipse, brightest at its rim.
  b.box(cx - 44, WATER_TOP - 6, cx + 44, WATER_TOP + 30, (x, y) => {
    const d = Math.hypot((x - cx) / 38, (y - (WATER_TOP + 4)) / 15);
    if (d >= 1) return null;
    const ring = 1 - smooth(0.5, 0.95, d);
    return [mix(hex('#ffffff'), sprayCol, 1 - ring * 0.5), Math.pow(1 - d, 1.5) * 0.55];
  });

  // Spray specks hanging in the air above it.
  for (let i = 0; i < 16; i++) {
    const px = cx + (hash(i, 101) - 0.5) * 52;
    const py = WATER_TOP - 2 - hash(i, 103) * 22;
    const r = 1 + hash(i, 107) * 2.4;
    b.box(px - r, py - r, px + r, py + r, (x, y) => {
      const d = Math.hypot(x - px, y - py);
      return d > r ? null : [sprayCol, (1 - d / r) * 0.45];
    }, 'add');
  }

  // And the mist they drift in.
  b.box(cx - 46, WATER_TOP - 34, cx + 46, WATER_TOP + 6, (x, y) => {
    const a = (1 - smooth(0, 22, Math.abs(y - (WATER_TOP - 12)))) * 0.3;
    return a <= 0.004 ? null : [sprayCol, a];
  }, 'add');
}

function paintCity(b: Band, look: Look) {
  const cx = CITY_CX;
  const wall = hex('#5c3c46');
  const roof = hex('#43283a');
  const win = hex('#ffb347');

  b.box(cx - 100, CITY_BASE - 40, cx + 100, CITY_BASE + 10, (x, y) => {
    const hy = headlandY(x, cx);
    const cover = edge(y, hy);
    if (cover <= 0) return null;
    const col = mix(hex('#2b4a4a'), hex('#16302f'), clamp01((y - hy) / 30));
    return [mix(col, look.haze, 0.12), cover];
  });

  // Wall between the towers, then each tower with its conical roof.
  b.box(cx - 52, CITY_BASE - 34, cx + 52, CITY_BASE + 2, (x, y) => {
    const top = CITY_BASE - 13 + Math.sin(x / 13) * 1.5;
    const cover = edge(y, top);
    return cover <= 0 ? null : [mix(wall, hex('#000000'), clamp01((y - top) / 22) * 0.3), cover];
  });

  const towers = [
    { dx: -40, w: 12, h: 30, dome: 7 },
    { dx: -25, w: 13, h: 21, dome: 6 },
    { dx: -7, w: 20, h: 42, dome: 11 },
    { dx: 13, w: 13, h: 23, dome: 6 },
    { dx: 29, w: 12, h: 31, dome: 7 },
    { dx: 44, w: 10, h: 19, dome: 5 },
  ];
  for (const t of towers) {
    const tx = cx + t.dx;
    const top = CITY_BASE - 4 - t.h;
    b.box(tx - t.w / 2, top, tx + t.w / 2, CITY_BASE, (x, y) => {
      const cover = edge(y, top);
      if (cover <= 0) return null;
      const side = (x - (tx - t.w / 2)) / t.w;
      return [mix(wall, hex('#000000'), 0.12 + side * 0.22), cover];
    });
    // Conical roof, apex up: the width has to grow *with* py. Written the other
    // way round it renders as a funnel.
    b.box(tx - t.w * 0.8, top - t.dome - 2, tx + t.w * 0.8, top + 2, (x, y) => {
      const py = (y - (top - t.dome)) / t.dome;
      if (py < 0 || py > 1.05) return null;
      const cover =
        smooth(1, 0.92, Math.abs(x - tx) / Math.max(0.001, t.w * 0.72 * py)) *
        smooth(-0.05, 0.05, py);
      return cover <= 0 ? null : [mix(roof, hex('#ffffff'), (1 - py) * 0.12), cover];
    });
    // Lit windows, with a little bloom around each.
    for (let wy = top + 6; wy < CITY_BASE - 4; wy += 6) {
      for (let wx = tx - t.w / 2 + 2.5; wx < tx + t.w / 2 - 2; wx += 4.5) {
        if (hash(Math.round(wx), Math.round(wy), 79) <= 0.4) continue;
        b.box(wx, wy, wx + 2, wy + 2.6, () => [win, 0.95]);
        b.glow(wx + 1, wy + 1.3, 6, win, 0.22, 2.2);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Water band: the shoreline sea, the sun's reflected column, the plunge pool.
// ---------------------------------------------------------------------------
function paintWater(b: Band, look: Look) {
  const c = look.sun;
  const span = MID_BOTTOM - WATER_TOP;

  // Background: mirrored sky and depth in one pass, over the band's whole box.
  b.box(LAYER_X, WATER_TOP, LAYER_X + REF_LAYER_W, MID_BOTTOM, (x, y) => {
    const t = clamp01((y - WATER_TOP) / span);
    // Just beneath the surface the water still shows the horizon it is reflecting;
    // 1.6 is a foreshortening factor, not a physical one.
    const mirrored = ramp(look.sky, HORIZON_STOP - (y - WATER_TOP) * 1.6);
    let col = mix(mirrored, hex('#1c3f45'), 0.16 + t * 0.42);
    col = mix(col, hex('#8a4a52'), t * 0.2);
    col = mix(col, hex('#ffcf94'), (1 - t) * 0.16);
    // Wave lines, low contrast and jittered so they do not stripe.
    const wave = Math.sin(y * 1.9 + x / 7) * 0.5 + Math.sin(y * 3.7 - x / 4.5) * 0.5;
    const jitter = hash(Math.round(x / 5), Math.round(y / 3)) * 0.4 - 0.2;
    if (wave + jitter > 0.72) col = mix(col, look.haze, 0.13);
    else if (wave + jitter < -0.9) col = mix(col, hex('#000000'), 0.08);
    return [col, 1];
  });

  // The sun's column on the water. The `Math.max(0, …)` is what keeps the column's
  // own box edges from going NaN — see `Band.box`.
  const width = 52;
  b.box(c.x - width, WATER_TOP, c.x + width, MID_BOTTOM, (x, y) => {
    const d = Math.abs(x - c.x) / width;
    const fall = Math.pow(Math.max(0, 1 - d), 2.1) * (1 - clamp01((y - WATER_TOP) / span) * 0.3);
    const sparkle = 0.4 + 0.6 * hash(Math.round(x / 2), Math.round(y / 1.3));
    const a = fall * sparkle * 0.5;
    return a <= 0.012 ? null : [c.glow, a];
  }, 'add');

  // Foam right at the shoreline.
  b.box(LAYER_X, WATER_TOP - 2, LAYER_X + REF_LAYER_W, WATER_TOP + 3, (x, y) => {
    const a = (1 - smooth(0, 2.4, Math.abs(y - WATER_TOP))) * 0.35;
    return a <= 0.012 ? null : [hex('#ffffff'), a];
  });
}

// ---------------------------------------------------------------------------
// Causeway band: the cobbled road the lamps stand on, floating over the water.
// ---------------------------------------------------------------------------
function paintRoad(b: Band) {
  const mortar = hex('#3a2a2d');
  const stone = hex('#8b6153');
  const stone2 = hex('#c58a70');

  b.box(LAYER_X, ROAD_TOP, LAYER_X + REF_LAYER_W, ROAD_BOTTOM, (x, y) => {
    const t = clamp01((y - ROAD_TOP) / 26);
    let col = mix(mortar, mix(mortar, hex('#000000'), 0.5), t);
    // Cobbles: 18 x 8.5 CSS px, offset every other row, inset into their grout.
    const row = Math.floor((y - ROAD_TOP) / 8.5);
    const off = row % 2 === 0 ? 0 : 9;
    const cobble = Math.floor((x - off) / 18);
    const fx = x - off - cobble * 18;
    const fy = y - ROAD_TOP - row * 8.5;
    const inset = 1.15;
    const cover =
      smooth(inset - 0.6, inset + 0.6, fx) *
      (1 - smooth(18 - inset - 0.6, 18 - inset + 0.6, fx)) *
      smooth(inset - 0.5, inset + 0.5, fy) *
      (1 - smooth(8.5 - inset - 0.5, 8.5 - inset + 0.5, fy));
    if (cover > 0.01) {
      const shade = mix(stone, stone2, clamp01((7.5 - fy) / 7.5));
      const grain = 0.93 + 0.14 * hash(cobble, row);
      col = mix(col, [shade[0] * grain, shade[1] * grain, shade[2] * grain], cover);
    }
    // Warm rim where the light lands on the near edge, and a cool falloff behind.
    col = mix(col, hex('#ffd0a0'), (1 - smooth(0, 2.2, y - ROAD_TOP)) * 0.8);
    col = mix(col, hex('#000000'), smooth(ROAD_TOP + 19, ROAD_BOTTOM + 3, y) * 0.4);
    col = mix(col, hex('#231618'), smooth(ROAD_TOP - 2, ROAD_TOP, y) * 0.5);
    return [col, 1];
  });
}

/** Every scenery frame, in the order the engine draws them. */
export function createSceneryFrames(): FrameSpec[] {
  const sky = new Band('sky', 0, 0, REF_W, REF_H, SKY_S);
  paintSky(sky);

  const far = new Band('scenery_far', LAYER_X, FAR_TOP, REF_LAYER_W, FAR_BOTTOM - FAR_TOP, BAND_S);
  paintFar(far);

  const mid = new Band('scenery_mid', LAYER_X, WATER_TOP, REF_LAYER_W, MID_BOTTOM - WATER_TOP, BAND_S);
  paintWater(mid, SUNSET);
  paintWaterfall(mid, SUNSET); // the drop below the shoreline
  paintPool(mid);

  const near = new Band('scenery_near', LAYER_X, ROAD_TOP, REF_LAYER_W, ROAD_BOTTOM - ROAD_TOP, BAND_S);
  paintRoad(near);

  return [sky.frame(), far.frame(), mid.frame(), near.frame()];
}

/** The sizes the sky frame is authored at, exported for the placement maths. */
export const SKY_FRAME = { width: SKY_W, height: SKY_H } as const;
