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

function setPixel(
  buf: Uint8Array,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number = 255,
) {
  if (x < 0 || x >= w || y < 0) return;
  const idx = (y * w + x) * 4;
  if (idx < 0 || idx >= buf.length) return;
  buf[idx] = Math.min(255, Math.max(0, Math.round(r)));
  buf[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
  buf[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
  buf[idx + 3] = Math.min(255, Math.max(0, Math.round(a)));
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

  // 1. 'sky_dark' — 64x128 gradient sky (deep navy to twilight violet/amber horizon)
  {
    const { spec, buf } = createBlankFrame('sky_dark', 64, 128);
    for (let y = 0; y < 128; y++) {
      const t = y / 128;
      // Top: #0f172a (15, 23, 42) -> Mid: #2e1065 (46, 16, 101) -> Bottom: #4c1d95 (76, 29, 149)
      const r = 15 + t * 61;
      const g = 23 + t * 6;
      const b = 42 + t * 107;
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, r, g, b, 255);
      }
    }
    frames.push(spec);
  }

  // 2. 'sky_light' — 64x128 dawn sky gradient (soft blue to golden rose dawn)
  {
    const { spec, buf } = createBlankFrame('sky_light', 64, 128);
    for (let y = 0; y < 128; y++) {
      const t = y / 128;
      // Top: sky blue #38bdf8 (56, 189, 248) -> Bottom: warm amber dawn #fef08a (254, 240, 138)
      const r = 56 + t * 198;
      const g = 189 + t * 51;
      const b = 248 - t * 110;
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, r, g, b, 255);
      }
    }
    frames.push(spec);
  }

  // 3. 'moon' — 32x32 glowing crescent moon
  {
    const { spec, buf } = createBlankFrame('moon', 32, 32);
    // Outer circle
    drawCircle(buf, 32, 32, 16, 16, 12, 254, 240, 138, 255);
    // Subtract inner circle offset to form a crescent
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - 20;
        const dy = y - 13;
        if (dx * dx + dy * dy <= 10 * 10) {
          setPixel(buf, 32, x, y, 0, 0, 0, 0);
        }
      }
    }
    frames.push(spec);
  }

  // 4. 'lamp_unlit' — 48x48 detailed oil lamp on pedestal
  {
    const { spec, buf } = createBlankFrame('lamp_unlit', 48, 48);
    // Base pedestal
    drawRect(buf, 48, 48, 12, 38, 24, 6, 71, 85, 105);
    drawRect(buf, 48, 48, 15, 34, 18, 4, 100, 116, 139);
    // Lamp body (bowl)
    drawCircle(buf, 48, 48, 24, 26, 11, 148, 163, 184);
    drawCircle(buf, 48, 48, 24, 24, 8, 203, 213, 225);
    // Handle
    for (let y = 18; y <= 32; y++) {
      setPixel(buf, 48, 11, y, 100, 116, 139);
      setPixel(buf, 48, 12, y, 148, 163, 184);
    }
    // Neck & spout
    drawRect(buf, 48, 48, 21, 13, 6, 9, 100, 116, 139);
    drawRect(buf, 48, 48, 22, 10, 4, 4, 51, 65, 85);
    frames.push(spec);
  }

  // 5. 'lamp_lit' — 48x48 glowing golden oil lamp
  {
    const { spec, buf } = createBlankFrame('lamp_lit', 48, 48);
    // Base pedestal
    drawRect(buf, 48, 48, 12, 38, 24, 6, 180, 83, 9);
    drawRect(buf, 48, 48, 15, 34, 18, 4, 217, 119, 6);
    // Lamp body (bronze gold)
    drawCircle(buf, 48, 48, 24, 26, 11, 245, 158, 11);
    drawCircle(buf, 48, 48, 24, 24, 8, 251, 191, 36);
    // Handle
    for (let y = 18; y <= 32; y++) {
      setPixel(buf, 48, 11, y, 180, 83, 9);
      setPixel(buf, 48, 12, y, 245, 158, 11);
    }
    // Neck
    drawRect(buf, 48, 48, 21, 13, 6, 9, 217, 119, 6);
    // Flame core
    drawCircle(buf, 48, 48, 24, 10, 6, 249, 115, 22, 230);
    drawCircle(buf, 48, 48, 24, 8, 3, 254, 240, 138, 255);
    setPixel(buf, 48, 24, 4, 255, 255, 255);
    frames.push(spec);
  }

  // 6. 'flame' — 16x16 teardrop flame tip
  {
    const { spec, buf } = createBlankFrame('flame', 16, 16);
    drawCircle(buf, 16, 16, 8, 10, 5, 234, 88, 12, 220);
    drawCircle(buf, 16, 16, 8, 8, 3, 245, 158, 11, 240);
    drawCircle(buf, 16, 16, 8, 6, 2, 254, 240, 138, 255);
    setPixel(buf, 16, 8, 3, 255, 255, 255);
    frames.push(spec);
  }

  // 7. 'glow_halo' — 64x64 soft radial golden glow halo
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
          const alpha = Math.floor(Math.pow(factor, 1.5) * 235);
          setPixel(buf, 64, x, y, 251, 191, 36, alpha);
        }
      }
    }
    frames.push(spec);
  }

  // 8. 'star' — 16x16 celestial 4-point star
  {
    const { spec, buf } = createBlankFrame('star', 16, 16);
    const cx = 8;
    const cy = 8;
    for (let i = 0; i < 16; i++) {
      const dist = Math.abs(i - 8);
      const alpha = Math.max(0, 255 - dist * 32);
      setPixel(buf, 16, i, cy, 255, 255, 255, alpha);
      setPixel(buf, 16, cx, i, 255, 255, 255, alpha);
    }
    drawCircle(buf, 16, 16, 8, 8, 2, 255, 255, 255, 255);
    frames.push(spec);
  }

  // 9. 'mountain' — 128x64 layered mountain peaks silhouette
  {
    const { spec, buf } = createBlankFrame('mountain', 128, 64);
    for (let x = 0; x < 128; x++) {
      const h1 = 44 * Math.exp(-Math.pow((x - 35) / 22, 2));
      const h2 = 52 * Math.exp(-Math.pow((x - 85) / 28, 2));
      const peakY = 64 - Math.floor(Math.max(h1, h2));
      for (let y = peakY; y < 64; y++) {
        const factor = (y - peakY) / (64 - peakY || 1);
        const r = Math.floor(45 + factor * 30);
        const g = Math.floor(35 + factor * 35);
        const b = Math.floor(80 + factor * 40);
        setPixel(buf, 128, x, y, r, g, b, 240);
      }
    }
    frames.push(spec);
  }

  // 10. 'hills' — 128x64 midland green rolling hills
  {
    const { spec, buf } = createBlankFrame('hills', 128, 64);
    for (let x = 0; x < 128; x++) {
      const hillH = 26 + 12 * Math.sin((x / 128) * Math.PI * 2.5);
      const topY = 64 - Math.floor(hillH);
      for (let y = topY; y < 64; y++) {
        const factor = (y - topY) / (64 - topY || 1);
        const r = Math.floor(20 + factor * 25);
        const g = Math.floor(80 + factor * 40);
        const b = Math.floor(60 + factor * 30);
        setPixel(buf, 128, x, y, r, g, b, 245);
      }
    }
    frames.push(spec);
  }

  // 11. 'city' — 128x64 illuminated City on a Hill citadel skyline
  {
    const { spec, buf } = createBlankFrame('city', 128, 64);
    for (let x = 0; x < 128; x++) {
      // Hill top
      const hillH = 22 + Math.floor(12 * Math.sin((x / 128) * Math.PI));
      const hillY = 64 - hillH;

      // Citadel structures & towers
      const isCentralTower = x >= 56 && x <= 72;
      const isLeftTower = x >= 32 && x <= 42;
      const isRightTower = x >= 86 && x <= 96;
      const isBuilding = x >= 24 && x <= 104;

      let wallY = hillY;
      if (isBuilding) wallY = hillY - 8;
      if (isLeftTower || isRightTower) wallY = hillY - 18;
      if (isCentralTower) wallY = hillY - 26;

      for (let y = wallY; y < 64; y++) {
        const r = y < hillY ? 217 : 30;
        const g = y < hillY ? 119 : 41;
        const b = y < hillY ? 6 : 59;
        setPixel(buf, 128, x, y, r, g, b, 250);
      }

      // Golden dome on central citadel
      if (x >= 58 && x <= 70) {
        const dx = x - 64;
        const domeY = hillY - 26;
        for (let dy = -6; dy <= 0; dy++) {
          if (dx * dx + dy * dy <= 36) {
            setPixel(buf, 128, x, domeY + dy, 245, 158, 11, 255);
          }
        }
      }

      // Bright glowing windows in towers
      if ((isCentralTower || isLeftTower || isRightTower) && x % 4 === 0) {
        setPixel(buf, 128, x, wallY + 4, 254, 240, 138, 255);
        setPixel(buf, 128, x, wallY + 8, 254, 240, 138, 255);
      }
    }
    frames.push(spec);
  }

  // 12. 'path_stone' — 64x32 rich cobblestone path texture
  {
    const { spec, buf } = createBlankFrame('path_stone', 64, 32);
    drawRect(buf, 64, 32, 0, 0, 64, 32, 120, 113, 108, 255); // earth slate base
    // Cobblestone stones & grout pattern
    for (let y = 0; y < 32; y += 8) {
      const shift = (y / 8) % 2 === 0 ? 0 : 8;
      for (let x = shift; x < 64; x += 16) {
        drawRect(buf, 64, 32, x + 1, y + 1, 14, 6, 168, 162, 158, 255); // stone block
        drawRect(buf, 64, 32, x + 2, y + 2, 12, 2, 214, 211, 209, 255); // highlight
      }
    }
    drawRect(buf, 64, 32, 0, 0, 64, 2, 245, 158, 11, 255); // gold top path edge
    frames.push(spec);
  }

  // 13. 'tile_bg' — 64x32 parchment word card background
  {
    const { spec, buf } = createBlankFrame('tile_bg', 64, 32);
    // Warm rich parchment gradient card fill
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, 254, 243, 199, 255);
      }
    }
    // Gold bevel border
    drawRect(buf, 64, 32, 0, 0, 64, 2, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 0, 30, 64, 2, 180, 83, 9, 255);
    drawRect(buf, 64, 32, 0, 0, 2, 32, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 62, 0, 2, 32, 180, 83, 9, 255);
    frames.push(spec);
  }

  // 14. 'slot_bg' — 64x32 word slot drop target card
  {
    const { spec, buf } = createBlankFrame('slot_bg', 64, 32);
    // Soft amber transparent glass fill
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, 245, 158, 11, 45);
      }
    }
    // Golden border
    drawRect(buf, 64, 32, 0, 0, 64, 2, 245, 158, 11, 200);
    drawRect(buf, 64, 32, 0, 30, 64, 2, 245, 158, 11, 200);
    drawRect(buf, 64, 32, 0, 0, 2, 32, 245, 158, 11, 200);
    drawRect(buf, 64, 32, 62, 0, 2, 32, 245, 158, 11, 200);
    frames.push(spec);
  }

  return frames;
}
