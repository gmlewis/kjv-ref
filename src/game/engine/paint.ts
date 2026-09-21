/**
 * The pixel toolkit the atlas frames are painted with.
 *
 * Everything the game draws is painted here at boot rather than shipped as image
 * files: no assets to fetch, no backend, and the art is a pure function of a few
 * closed-form profiles. This module is the shared part — the RGBA frame being
 * painted into, and the handful of primitives (soft boxes, additive glow,
 * coverage edges, value noise) every painter is built from.
 *
 * The one convention worth knowing: a `Band` is addressed in the **reference CSS
 * coordinates** its painter was written in, not in frame pixels. A painter says
 * "paint the ridge from x=-104 to x=516, y=626 to y=788" and the frame's size and
 * density are nothing it has to think about. That is what lets the same ridge code
 * serve a 930-px composite band and a 90-px lighthouse tower.
 */

export type RGB = [number, number, number];

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Hermite ease over [a, b], clamped. */
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Deterministic hash → [0, 1). Any number of integer or float inputs. */
export function hash(...ns: number[]): number {
  let h = 0;
  for (const n of ns) h = Math.sin(h * 127.1 + n * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Piecewise colour ramp over ascending stops. */
export function ramp(stops: Array<[number, RGB]>, y: number): RGB {
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const t = (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix(stops[i - 1][1], stops[i][1], t);
    }
  }
  return stops[stops.length - 1][1];
}
/** Coverage of the half-plane below `edgeY`, with 0.9 CSS px of softness. */
export const edge = (y: number, edgeY: number) => clamp01((y - edgeY) / 0.9 + 0.5);
/** Smooth 1-D value noise in [0, 1], 1 at the lattice nodes. */
export function vnoise(x: number, seed: number, cell = 22): number {
  const g = x / cell;
  const i = Math.floor(g);
  const t = g - i;
  const s = t * t * (3 - 2 * t);
  return hash(i, seed) * (1 - s) + hash(i + 1, seed) * s;
}

export interface FrameSpec {
  name: string;
  width: number;
  height: number;
  pixels: Uint8Array;
}

/**
 * A frame under construction. `x0`/`y0` are the CSS coordinates of its top-left
 * corner and `s` is the authored pixels per CSS pixel, so a painter can paint at
 * `cssX`/`cssY` and never see a frame pixel index unless it wants one.
 */
export class Band {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  private readonly x0: number;
  private readonly y0: number;
  private readonly s: number;
  private readonly name: string;

  constructor(name: string, x0: number, y0: number, cssW: number, cssH: number, s: number) {
    this.name = name;
    this.x0 = x0;
    this.y0 = y0;
    this.s = s;
    this.width = Math.round(cssW * s);
    this.height = Math.round(cssH * s);
    this.pixels = new Uint8Array(this.width * this.height * 4);
  }

  /** CSS x of the centre of frame column `px`. */
  cssX(px: number): number {
    return this.x0 + (px + 0.5) / this.s;
  }
  /** CSS y of the centre of frame row `py`. */
  cssY(py: number): number {
    return this.y0 + (py + 0.5) / this.s;
  }
  /** Frame column holding CSS x, or -1 when x is outside this frame. */
  colOf(x: number): number {
    const px = Math.floor((x - this.x0) * this.s);
    return px < 0 || px >= this.width ? -1 : px;
  }
  /** Authored pixels per CSS pixel. */
  get density(): number {
    return this.s;
  }

  /**
   * Source-over, into a **straight-alpha** frame.
   *
   * The division by `aOut` is the whole point: compositing `col` at coverage `a`
   * over an empty pixel has to store *the colour* with alpha `a`, not the colour
   * already scaled by `a`. Storing `col*a` alongside `a` is premultiplied data in a
   * frame the engine treats as straight alpha, and the sprite shader multiplies by
   * the alpha it samples — so the pixel came out squared, and every soft effect in
   * the atlas (the beam at 17%, the halo's skirts, the slot plate at 22%) rendered
   * far darker than it was painted.
   */
  private over(px: number, py: number, col: RGB, a: number) {
    const i = (py * this.width + px) * 4;
    const aDst = this.pixels[i + 3] / 255;
    const aOut = a + aDst * (1 - a);
    if (aOut <= 0) return;
    const wSrc = a / aOut;
    const wDst = 1 - wSrc;
    this.pixels[i] = Math.round(this.pixels[i] * wDst + col[0] * wSrc);
    this.pixels[i + 1] = Math.round(this.pixels[i + 1] * wDst + col[1] * wSrc);
    this.pixels[i + 2] = Math.round(this.pixels[i + 2] * wDst + col[2] * wSrc);
    this.pixels[i + 3] = Math.round(aOut * 255);
  }

  /**
   * Additive, into an already-opaque region: light stacking on a backdrop.
   *
   * Only safe where the destination is opaque — this leaves the alpha channel alone,
   * so a pixel first touched by an additive pass stays transparent and the engine
   * would draw nothing there. The scenery's additive passes (the sun's core, the
   * water's reflection column, the spray, the lit windows) all paint over a
   * background the same painter has already filled; everything that has to carry its
   * own alpha is painted with `over` and added by the renderer's blend mode instead.
   */
  private add(px: number, py: number, col: RGB, a: number) {
    const i = (py * this.width + px) * 4;
    this.pixels[i] = Math.min(255, this.pixels[i] + col[0] * a);
    this.pixels[i + 1] = Math.min(255, this.pixels[i + 1] + col[1] * a);
    this.pixels[i + 2] = Math.min(255, this.pixels[i + 2] + col[2] * a);
  }

  /**
   * Paint a CSS rectangle. `cb` returns the colour and coverage at a pixel centre,
   * or null to leave the pixel alone; it is also handed the frame column and row so
   * a painter can index per-column profiles instead of recomputing them per row.
   *
   * `fade`, when set, ramps coverage to zero within that many CSS px of the box
   * edge — the escape hatch for a soft effect whose own falloff is wider than any
   * box that fits (the sun's halo).
   */
  box(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cb: (x: number, y: number, px: number, py: number) => [RGB, number] | null,
    mode: 'over' | 'add' = 'over',
    fade = 0,
  ) {
    const px0 = Math.max(0, Math.floor((x0 - this.x0) * this.s));
    const px1 = Math.min(this.width - 1, Math.ceil((x1 - this.x0) * this.s));
    const py0 = Math.max(0, Math.floor((y0 - this.y0) * this.s));
    const py1 = Math.min(this.height - 1, Math.ceil((y1 - this.y0) * this.s));
    for (let py = py0; py <= py1; py++) {
      const y = this.cssY(py);
      for (let px = px0; px <= px1; px++) {
        const hit = cb(this.cssX(px), y, px, py);
        if (!hit) continue;
        let a = hit[1];
        // `!(a > 0)` rather than `a <= 0`: a painter that computes its falloff as
        // Math.pow(1 - d, k) goes NaN just outside its own box (a negative base with
        // a fractional exponent) and NaN compares false to everything, so `a <= 0`
        // would let it through and write black — a one-pixel seam at every soft
        // effect's edge.
        if (!(a > 0)) continue;
        if (fade > 0) {
          const x = this.cssX(px);
          const k = Math.min((x - x0) / fade, (x1 - x) / fade, (y - y0) / fade, (y1 - y) / fade, 1);
          if (k <= 0) continue;
          a *= k;
        }
        if (mode === 'add') this.add(px, py, hit[0], a);
        else this.over(px, py, hit[0], a);
      }
    }
  }

  /** Additive radial light. `squishY` < 1 flattens the falloff vertically. */
  glow(cx: number, cy: number, radius: number, col: RGB, strength: number, power = 1.7, squishY = 1) {
    this.box(
      cx - radius,
      cy - radius * squishY,
      cx + radius,
      cy + radius * squishY,
      (x, y) => {
        const d = Math.hypot(x - cx, (y - cy) / squishY);
        if (d >= radius) return null;
        return [col, Math.pow(1 - d / radius, power) * strength];
      },
      'add',
    );
  }

  frame(): FrameSpec {
    return { name: this.name, width: this.width, height: this.height, pixels: this.pixels };
  }
}
