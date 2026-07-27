export interface SpriteFrameSpec {
  name: string;
  width: number;
  height: number;
  pixels: Uint8Array;
}

function createBlankFrame(name: string, width: number, height: number): {
  spec: SpriteFrameSpec;
  buf: Uint8Array;
} {
  const buf = new Uint8Array(width * height * 4);
  return { spec: { name, width, height, pixels: buf }, buf };
}

function setPixel(buf: Uint8Array, w: number, x: number, y: number, r: number, g: number, b: number, a: number = 255) {
  if (x < 0 || x >= w || y < 0) return;
  const idx = (y * w + x) * 4;
  if (idx < 0 || idx >= buf.length) return;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function drawRect(
  buf: Uint8Array,
  w: number,
  h: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  r: number,
  g: number,
  b: number,
  a: number = 255,
) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      setPixel(buf, w, x, y, r, g, b, a);
    }
  }
}

function drawCircle(
  buf: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  a: number = 255,
) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(buf, w, x, y, r, g, b, a);
      }
    }
  }
}

export function createGameSpriteFrames(): SpriteFrameSpec[] {
  const frames: SpriteFrameSpec[] = [];

  // 0. 'w' — 1x1 white pixel
  frames.push({
    name: 'w',
    width: 1,
    height: 1,
    pixels: new Uint8Array([255, 255, 255, 255]),
  });

  // 1. 'lamp_unlit' — 32x32 oil lamp on pedestal
  {
    const { spec, buf } = createBlankFrame('lamp_unlit', 32, 32);
    // Pedestal base
    drawRect(buf, 32, 32, 8, 26, 16, 4, 71, 85, 105);
    drawRect(buf, 32, 32, 10, 24, 12, 2, 100, 116, 139);
    // Lamp body (bowl)
    drawCircle(buf, 32, 32, 16, 18, 7, 148, 163, 184);
    drawCircle(buf, 32, 32, 16, 17, 5, 203, 213, 225);
    // Handle
    for (let y = 14; y <= 22; y++) {
      setPixel(buf, 32, 7, y, 100, 116, 139);
      setPixel(buf, 32, 8, y, 148, 163, 184);
    }
    // Spout & wick neck
    drawRect(buf, 32, 32, 14, 10, 4, 6, 100, 116, 139);
    drawRect(buf, 32, 32, 15, 8, 2, 3, 51, 65, 85);
    frames.push(spec);
  }

  // 2. 'lamp_lit' — 32x32 oil lamp with golden flame & glow
  {
    const { spec, buf } = createBlankFrame('lamp_lit', 32, 32);
    // Pedestal base
    drawRect(buf, 32, 32, 8, 26, 16, 4, 180, 83, 9);
    drawRect(buf, 32, 32, 10, 24, 12, 2, 217, 119, 6);
    // Lamp body (golden bronze)
    drawCircle(buf, 32, 32, 16, 18, 7, 245, 158, 11);
    drawCircle(buf, 32, 32, 16, 17, 5, 251, 191, 36);
    // Handle
    for (let y = 14; y <= 22; y++) {
      setPixel(buf, 32, 7, y, 180, 83, 9);
      setPixel(buf, 32, 8, y, 245, 158, 11);
    }
    // Spout & wick neck
    drawRect(buf, 32, 32, 14, 10, 4, 6, 217, 119, 6);
    // Flame
    drawCircle(buf, 32, 32, 16, 7, 4, 249, 115, 22, 220); // outer flame orange
    drawCircle(buf, 32, 32, 16, 6, 2, 254, 240, 138, 255); // inner core bright yellow
    setPixel(buf, 32, 16, 3, 255, 255, 255); // tip
    frames.push(spec);
  }

  // 3. 'flame' — 16x16 bright teardrop flame
  {
    const { spec, buf } = createBlankFrame('flame', 16, 16);
    drawCircle(buf, 16, 16, 8, 10, 5, 234, 88, 12, 200);
    drawCircle(buf, 16, 16, 8, 9, 3, 245, 158, 11, 230);
    drawCircle(buf, 16, 16, 8, 8, 2, 254, 240, 138, 255);
    setPixel(buf, 16, 8, 4, 255, 255, 255);
    setPixel(buf, 16, 8, 3, 255, 255, 255);
    frames.push(spec);
  }

  // 4. 'glow_halo' — 64x64 radial glow
  {
    const { spec, buf } = createBlankFrame('glow_halo', 64, 64);
    const cx = 32;
    const cy = 32;
    const maxR = 30;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= maxR) {
          const factor = 1 - dist / maxR;
          const alpha = Math.floor(Math.pow(factor, 1.8) * 220);
          setPixel(buf, 64, x, y, 251, 191, 36, alpha);
        }
      }
    }
    frames.push(spec);
  }

  // 5. 'star' — 16x16 celestial 4-point star
  {
    const { spec, buf } = createBlankFrame('star', 16, 16);
    const cx = 8;
    const cy = 8;
    for (let i = 0; i < 16; i++) {
      const dist = Math.abs(i - 8);
      const alpha = Math.max(0, 255 - dist * 30);
      setPixel(buf, 16, i, cy, 255, 255, 255, alpha);
      setPixel(buf, 16, cx, i, 255, 255, 255, alpha);
    }
    drawCircle(buf, 16, 16, 8, 8, 2, 255, 255, 255, 255);
    frames.push(spec);
  }

  // 6. 'mountain' — 128x64 mountain range silhouette
  {
    const { spec, buf } = createBlankFrame('mountain', 128, 64);
    for (let x = 0; x < 128; x++) {
      // Dual mountain peak profile
      const h1 = 38 * Math.exp(-Math.pow((x - 40) / 25, 2));
      const h2 = 46 * Math.exp(-Math.pow((x - 90) / 30, 2));
      const peakY = 64 - Math.floor(Math.max(h1, h2));
      for (let y = peakY; y < 64; y++) {
        const factor = (y - peakY) / (64 - peakY || 1);
        const r = Math.floor(30 + factor * 20);
        const g = Math.floor(41 + factor * 25);
        const b = Math.floor(59 + factor * 30);
        setPixel(buf, 128, x, y, r, g, b, 230);
      }
    }
    frames.push(spec);
  }

  // 7. 'city' — 128x48 City on a Hill skyline
  {
    const { spec, buf } = createBlankFrame('city', 128, 48);
    // Hill base silhouette
    for (let x = 0; x < 128; x++) {
      const hillH = 18 + Math.floor(10 * Math.sin((x / 128) * Math.PI));
      const hillY = 48 - hillH;

      // Buildings & towers on top of hill
      let isTower = (x >= 40 && x <= 48) || (x >= 60 && x <= 72) || (x >= 85 && x <= 92);
      let isDome = x >= 62 && x <= 70;
      let wallY = hillY - (isTower ? (isDome ? 16 : 12) : 4);

      for (let y = wallY; y < 48; y++) {
        setPixel(buf, 128, x, y, 51, 65, 85, 240);
      }
      // Illuminated windows
      if (isTower && (x === 44 || x === 66 || x === 88)) {
        setPixel(buf, 128, x, hillY - 6, 251, 191, 36, 255);
        setPixel(buf, 128, x, hillY - 10, 251, 191, 36, 255);
      }
    }
    frames.push(spec);
  }

  // 8. 'path_stone' — 64x16 cobblestone textured path bar
  {
    const { spec, buf } = createBlankFrame('path_stone', 64, 16);
    drawRect(buf, 64, 16, 0, 0, 64, 16, 100, 116, 139, 255);
    // Cobblestone grooves
    for (let x = 0; x < 64; x += 12) {
      for (let y = 0; y < 16; y++) {
        setPixel(buf, 64, x, y, 71, 85, 105, 255);
      }
    }
    drawRect(buf, 64, 16, 0, 0, 64, 2, 148, 163, 184, 255); // top accent highlight
    frames.push(spec);
  }

  // 9. 'tile_bg' — 64x32 parchment tile background frame
  {
    const { spec, buf } = createBlankFrame('tile_bg', 64, 32);
    drawRect(buf, 64, 32, 0, 0, 64, 32, 254, 243, 199, 255); // warm parchment
    // Border inset line
    drawRect(buf, 64, 32, 0, 0, 64, 2, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 0, 30, 64, 2, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 0, 0, 2, 32, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 62, 0, 2, 32, 217, 119, 6, 255);
    frames.push(spec);
  }

  return frames;
}
