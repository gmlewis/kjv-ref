/**
 * Render the game's scenery to a PNG, without a GPU.
 *
 * This is the review harness for `src/game/engine/scenery.ts` and `art.ts`. The
 * artwork is the one part of the game that cannot be checked by reading code and
 * cannot be checked by the test suite either, because the engine (`@babylonjs/lite`)
 * is WebGPU-only: it does not run under jsdom at all, and headless Chrome's default
 * (Metal) backend boots the engine but composites nothing, so a screenshot comes back
 * pure black. This script is the workaround — it imports the real
 * `createGameSpriteFrames()` and composites the frames in the same order and at the
 * same coordinates as `LampGame.buildPuzzle`, using nothing but `node:zlib`.
 *
 * So: change the art, run this, and look at the picture. What it draws is the
 * engine's placement, not a guess at it — the scene, the lamp row and the glow
 * layer are transcribed from `buildPuzzle` and `getResponsiveMetrics`, and should be
 * kept in step with them (a divergence here is a silent lie about the game, which is
 * worse than no harness at all).
 *
 * Default output geometry is the author's device: 1080x2404 device px, i.e. 412 CSS
 * px wide at DPR 2.6214. Note the resulting height is 917.1 CSS px, deliberately not
 * the 915 the art is authored against — the real panel is 2404 device px tall, which
 * is not 915 x 2.6214, and the difference is exactly the sort of thing worth seeing.
 *
 *   bun run render-scenery [outDir]     # default outDir: $TMPDIR/kjv-ref-scenery
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { deflateSync } from 'node:zlib';
import { createGameSpriteFrames, TOWER_ASPECT, TOWER_LANTERN_ABOVE_FOOT } from '../src/game/engine/art';
import { SCENERY_BANDS, SCENERY_BAND_CSS_WIDTH } from '../src/game/engine/scenery';

const S = 1080 / 412; // device px per CSS px (DPR 2.6214)
const W = 412; // CSS
const H = 2404 / S; // 917.2 CSS
const PATH_Y = H - 84;

const frames = new Map(createGameSpriteFrames().map((f) => [f.name, f]));
const OUT_W = Math.round(W * S);
const OUT_H = Math.round(H * S);
const buf = new Float32Array(OUT_W * OUT_H * 3);

function tint(col: [number, number, number, number], rgb: [number, number, number]) {
  return [rgb[0] * col[0], rgb[1] * col[1], rgb[2] * col[2]] as const;
}

/** Draw a frame into a CSS-space box, nearest-sampled, source-over. */
const glowQueue: Array<() => void> = [];
function draw(
  name: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: [number, number, number, number] = [1, 1, 1, 1],
  rotation = 0,
  additive = false,
) {
  if (additive) {
    // The engine's glow layer draws after the whole base layer, so queue it.
    glowQueue.push(() => blit(name, x0, y0, w, h, color, rotation, true));
    return;
  }
  blit(name, x0, y0, w, h, color, rotation, false);
}
function blit(
  name: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: [number, number, number, number],
  rotation: number,
  additive: boolean,
) {
  const f = frames.get(name);
  if (!f) throw new Error(`no frame ${name}`);
  // Rotation pivots about the box centre.
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const d0x = Math.floor(x0 * S);
  const d1x = Math.ceil((x0 + w) * S);
  const d0y = Math.floor(y0 * S);
  const d1y = Math.ceil((y0 + h) * S);
  // A rotated quad's bounding box: expand by the radius.
  const pad = rotation === 0 ? 1 : Math.ceil(Math.hypot(w, h) * S);
  for (let dy = d0y - pad; dy <= d1y + pad; dy++) {
    if (dy < 0 || dy >= OUT_H) continue;
    for (let dx = d0x - pad; dx <= d1x + pad; dx++) {
      if (dx < 0 || dx >= OUT_W) continue;
      // Device px → CSS px → box-local, un-rotated about the centre.
      const gx = (dx + 0.5) / S - cx;
      const gy = (dy + 0.5) / S - cy;
      const lx = gx * cos - gy * sin + w / 2;
      const ly = gx * sin + gy * cos + h / 2;
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
      const sx = Math.min(f.width - 1, Math.floor((lx / w) * f.width));
      const sy = Math.min(f.height - 1, Math.floor((ly / h) * f.height));
      const si = (sy * f.width + sx) * 4;
      const a = (f.pixels[si + 3] / 255) * color[3];
      if (a <= 0) continue;
      const [r, g, b] = tint(color, [f.pixels[si], f.pixels[si + 1], f.pixels[si + 2]]);
      const di = (dy * OUT_W + dx) * 3;
      if (additive) {
        // spriteBlendAdditive: dst = src*alpha + dst, per channel.
        buf[di] += r * a;
        buf[di + 1] += g * a;
        buf[di + 2] += b * a;
      } else {
        const inv = 1 - a;
        buf[di] = buf[di] * inv + r * a;
        buf[di + 1] = buf[di + 1] * inv + g * a;
        buf[di + 2] = buf[di + 2] * inv + b * a;
      }
    }
  }
}

// ─── The scene, exactly as buildPuzzle places it at cameraScrollX = 0 ─────────
// Every expression below is copied from LampGame.buildPuzzle / getResponsiveMetrics
// so the composite is the engine's placement, not a guess at it.
const MARGIN = 12; // isMobile (W < 560)
const PAN = 80; // PARALLAX_PAN_MOBILE
const LAYER_W = Math.max(W + 2 * (PAN + 24), SCENERY_BAND_CSS_WIDTH);
const scroll = 0;
const camX = W / 2;
draw('sky', 0, 0, W, H);
// far: [W/2, pathY + (top+bottom)/2], size [layerW, bottom-top]
draw(
  'scenery_far',
  camX - LAYER_W / 2 - scroll * SCENERY_BANDS.far.parallax,
  PATH_Y + SCENERY_BANDS.far.top,
  LAYER_W,
  SCENERY_BANDS.far.bottom - SCENERY_BANDS.far.top,
);
// mid: [W/2, pathY + top], size [layerW, H - (pathY + top)]
draw(
  'scenery_mid',
  camX - LAYER_W / 2 - scroll * SCENERY_BANDS.mid.parallax,
  PATH_Y + SCENERY_BANDS.mid.top,
  LAYER_W,
  H - (PATH_Y + SCENERY_BANDS.mid.top),
);
// near: [W/2, pathY + top], size [layerW, bottom-top]
draw(
  'scenery_near',
  camX - LAYER_W / 2 - scroll * SCENERY_BANDS.near.parallax,
  PATH_Y + SCENERY_BANDS.near.top,
  LAYER_W,
  SCENERY_BANDS.near.bottom - SCENERY_BANDS.near.top,
);

// ─── The lamp row, exactly as buildPuzzle lays it out ────────────────────────
const lampCount = 12;
const lampStep = (W - 4 * MARGIN) / (lampCount - 1);
const activeIndex = 3;
const FOOT_Y = PATH_Y + 6;
const TOWER_H = { current: 96, lit: 78, unlit: 74 }; // isMobile
for (let i = 0; i < lampCount; i++) {
  const isCurrent = i === activeIndex;
  const lit = i < activeIndex || isCurrent;
  const lx = 2 * MARGIN + i * lampStep;
  const lh = isCurrent ? TOWER_H.current : lit ? TOWER_H.lit : TOWER_H.unlit;
  const lw = lh * TOWER_ASPECT;
  const lanternY = FOOT_Y - TOWER_LANTERN_ABOVE_FOOT * lh;

  // The contact shadow, on the causeway under the foot.
  draw('lamp_shadow', lx - lw, FOOT_Y + 0.5 - 3.5, lw * 2, 7, [1, 1, 1, 0.9]);

  if (lit) {
    const halo = isCurrent ? 116 : 80;
    draw(
      'glow_halo',
      lx - halo / 2,
      lanternY - halo / 2,
      halo,
      halo,
      isCurrent ? [1, 0.85, 0.2, 0.95] : [0.95, 0.75, 0.2, 0.65],
      0,
      true,
    );
    // The beam pivots about the apex at its bottom centre, which sits on the lantern.
    const bw = isCurrent ? 132 : 104;
    const bh = isCurrent ? 80 : 62;
    const sweep = (i % 2 === 0 ? -1 : 1) * (isCurrent ? 0.3 : 0.2);
    const apexX = lx;
    const apexY = lanternY - 4;
    draw(
      'beacon_beam',
      apexX + Math.sin(sweep) * (bh / 2) - bw / 2,
      apexY - Math.cos(sweep) * (bh / 2) - bh / 2,
      bw,
      bh,
      isCurrent ? [1, 0.95, 0.5, 0.9] : [1, 0.85, 0.3, 0.6],
      sweep,
      true,
    );
  }
  if (isCurrent) {
    const ring = 64;
    draw('fluency_ring', lx - ring / 2, lanternY - ring / 2, ring, ring, [1, 0.85, 0.2, 0.95], 0, true);
  }
  draw(lit ? 'lighthouse_lit' : 'lighthouse_unlit', lx - lw / 2, FOOT_Y - lh, lw, lh);
  if (lit) {
    // The flame sits *inside* the lantern glass (10% of the tower's height).
    const flame = lh * 0.1;
    draw('flame', lx - flame / 2, lanternY - flame / 2, flame, flame, [1, 0.9, 0.3, 0.9], 0, true);
    // The warm pool on the road, and the reflection below the causeway.
    draw('lamp_pool', lx - 44, PATH_Y + 14 - 11, 88, 22, [1, 1, 1, 0.22 * 0.85], 0, true);
    draw('lamp_reflection', lx - 14, PATH_Y + 16, 28, H - (PATH_Y + 16), [1, 1, 1, 0.24 * 0.85], 0, true);
  }
}

// ─── The glow layer, in the engine's order: after every base-layer draw ──────
for (const g of glowQueue) g();

// ─── A couple of word cards, to check the plate art at real size ─────────────
const CELL_H = 36;
for (const [x, w, kind] of [
  [24, 92, 'tile_bg'],
  [122, 118, 'tile_bg'],
  [246, 76, 'slot_bg'],
  [328, 64, 'tile_bg'],
] as const) {
  draw(kind, x, 300, w, CELL_H, [1, 1, 1, 0.95]);
  // Greeked ink, to judge contrast rather than type.
  for (let bx = x + 6; bx < x + w - 6; bx += 7) {
    draw('w', bx, 306, 4, 24, [0.059, 0.09, 0.165, 0.9]);
  }
}

// ─── PNG out ─────────────────────────────────────────────────────────────────
function crc32(data: Uint8Array): number {
  let c = ~0;
  for (const byte of data) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(path: string, w: number, h: number, rgb: Float32Array) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      raw[o++] = Math.max(0, Math.min(255, Math.round(rgb[i])));
      raw[o++] = Math.max(0, Math.min(255, Math.round(rgb[i + 1])));
      raw[o++] = Math.max(0, Math.min(255, Math.round(rgb[i + 2])));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

const outDir = process.argv[2] ?? `${tmpdir()}/kjv-ref-scenery`;
mkdirSync(outDir, { recursive: true });
const path = `${outDir}/scenery-in-game.png`;
console.log(
  `${path}  ${writePng(path, OUT_W, OUT_H, buf)} bytes  ${OUT_W}x${OUT_H}  (CSS ${W}x${H.toFixed(1)} @ DPR ${S.toFixed(4)})`,
);

// Composite probes: what the finished picture actually is, row by row, in CSS px.
const at = (cx: number, cy: number) => {
  const dx = Math.round(cx * S);
  const dy = Math.round(cy * S);
  const i = (dy * OUT_W + dx) * 3;
  return `${Math.round(buf[i])},${Math.round(buf[i + 1])},${Math.round(buf[i + 2])}`;
};
console.log('\ncolumn x=40 (left of the row):');
for (const cy of [0, 200, 400, 500, 560, 565, 600, 700, 800, 830, 835, 850, 880, 900, 915]) {
  console.log(`  css y${String(cy).padStart(4)}: ${at(40, cy)}`);
}
console.log('column x=206 (mid, through the sun column):');
for (const cy of [560, 600, 700, 800, 830, 840, 860, 890, 910]) {
  console.log(`  css y${String(cy).padStart(4)}: ${at(206, cy)}`);
}
console.log(`\nrow css y=600 (far band): ${[10, 60, 100, 140, 200, 260, 320, 380, 400].map((x) => `${x}:${at(x, 600)}`).join('  ')}`);
console.log(`row css y=800 (shoreline): ${[10, 100, 200, 300, 400].map((x) => `${x}:${at(x, 800)}`).join('  ')}`);
console.log(`row css y=860 (water):     ${[10, 100, 200, 300, 400].map((x) => `${x}:${at(x, 860)}`).join('  ')}`);
console.log(`row css y=890 (water low): ${[10, 100, 200, 300, 400].map((x) => `${x}:${at(x, 890)}`).join('  ')}`);
for (const f of frames.values()) console.log(`  frame ${f.name.padEnd(20)} ${f.width}x${f.height}`);
