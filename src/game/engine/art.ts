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

  // 1. 'sky_dark' — 64x128 serene royal midnight indigo & deep violet gradient (zero red/foreboding)
  {
    const { spec, buf } = createBlankFrame('sky_dark', 64, 128);
    for (let y = 0; y < 128; y++) {
      const t = y / 128;
      // Top: deep midnight navy #020617 (2, 6, 23) -> Mid: royal indigo #1e1b4b (30, 27, 75) -> Horizon violet #3730a3 (55, 48, 163)
      const r = 2 + t * 53;
      const g = 6 + t * 42;
      const b = 23 + t * 140;
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, r, g, b, 255);
      }
    }
    frames.push(spec);
  }

  // 2. 'sky_light' — 64x128 clear radiant morning sky gradient
  {
    const { spec, buf } = createBlankFrame('sky_light', 64, 128);
    for (let y = 0; y < 128; y++) {
      const t = y / 128;
      // Top: ocean sky blue #0284c7 (2, 132, 199) -> Bottom: warm morning sky #e0f2fe (224, 242, 254)
      const r = 2 + t * 222;
      const g = 132 + t * 110;
      const b = 199 + t * 55;
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, r, g, b, 255);
      }
    }
    frames.push(spec);
  }

  // 3. 'moon' — 32x32 glowing golden crescent moon
  {
    const { spec, buf } = createBlankFrame('moon', 32, 32);
    drawCircle(buf, 32, 32, 16, 16, 13, 254, 240, 138, 255);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = x - 21;
        const dy = y - 12;
        if (dx * dx + dy * dy <= 11 * 11) {
          setPixel(buf, 32, x, y, 0, 0, 0, 0);
        }
      }
    }
    frames.push(spec);
  }

  // 4. 'ocean_water' — 128x32 shimmering blue & cyan coastal water surface
  {
    const { spec, buf } = createBlankFrame('ocean_water', 128, 32);
    for (let y = 0; y < 32; y++) {
      const t = y / 32;
      const r = 2 + t * 10;
      const g = 132 - t * 40;
      const b = 199 - t * 20;
      for (let x = 0; x < 128; x++) {
        setPixel(buf, 128, x, y, r, g, b, 240);
      }
    }
    // Water ripples & sea foam lines
    for (let x = 0; x < 128; x += 16) {
      drawRect(buf, 128, 32, x, 4, 8, 2, 224, 242, 254, 200);
      drawRect(buf, 128, 32, x + 6, 12, 10, 2, 186, 230, 253, 180);
      drawRect(buf, 128, 32, x + 2, 20, 6, 2, 224, 242, 254, 160);
    }
    frames.push(spec);
  }

  // 5. 'forest_hills' — 128x64 lush emerald green rolling hills with pine trees
  {
    const { spec, buf } = createBlankFrame('forest_hills', 128, 64);
    for (let x = 0; x < 128; x++) {
      const hillH = 32 + 14 * Math.sin((x / 128) * Math.PI * 2.2);
      const topY = 64 - Math.floor(hillH);
      for (let y = topY; y < 64; y++) {
        const factor = (y - topY) / (64 - topY || 1);
        const r = Math.floor(5 + factor * 20);
        const g = Math.floor(150 + factor * 40);
        const b = Math.floor(105 + factor * 30);
        setPixel(buf, 128, x, y, r, g, b, 250);
      }
      // Pine tree silhouettes along ridge
      if (x % 14 === 0 && topY > 8) {
        const tx = x;
        const ty = topY;
        for (let i = 0; i < 10; i++) {
          const tw = Math.max(1, 5 - Math.floor(i / 2));
          drawRect(buf, 128, 64, tx - Math.floor(tw / 2), ty - i, tw, 1, 4, 120, 87, 255);
        }
      }
    }
    frames.push(spec);
  }

  // 6. 'waterfall' — 16x48 cascading white/cyan foam waterfall stream
  {
    const { spec, buf } = createBlankFrame('waterfall', 16, 48);
    for (let y = 0; y < 48; y++) {
      const wave = Math.floor(2 * Math.sin(y / 4));
      const wx = 8 + wave;
      drawRect(buf, 16, 48, wx - 3, y, 6, 1, 240, 253, 244, 240); // bright foam core
      drawRect(buf, 16, 48, wx - 5, y, 10, 1, 56, 189, 248, 160); // cyan spray
    }
    frames.push(spec);
  }

  // 7. 'lighthouse_unlit' — 48x96 coastal lighthouse tower
  {
    const { spec, buf } = createBlankFrame('lighthouse_unlit', 48, 96);
    // Stone foundation base
    drawRect(buf, 48, 96, 8, 80, 32, 16, 51, 65, 85);
    drawRect(buf, 48, 96, 10, 76, 28, 4, 71, 85, 105);

    // Tapered tower body (white with crimson bands)
    for (let y = 24; y < 76; y++) {
      const progress = (y - 24) / 52;
      const wAtY = Math.round(18 + progress * 8);
      const startX = Math.round(24 - wAtY / 2);

      const isCrimsonBand = (y >= 32 && y <= 44) || (y >= 56 && y <= 66);
      const cr = isCrimsonBand ? 185 : 241;
      const cg = isCrimsonBand ? 28 : 245;
      const cb = isCrimsonBand ? 28 : 249;

      for (let x = startX; x < startX + wAtY; x++) {
        const sideFactor = (x - startX) / wAtY;
        const shade = 1 - sideFactor * 0.25;
        setPixel(buf, 48, x, y, cr * shade, cg * shade, cb * shade, 255);
      }
    }

    // Balcony walkway platform & railing
    drawRect(buf, 48, 96, 12, 22, 24, 3, 30, 41, 59);
    drawRect(buf, 48, 96, 11, 18, 26, 4, 71, 85, 105);
    for (let x = 12; x <= 36; x += 4) {
      setPixel(buf, 48, x, 19, 15, 23, 42);
      setPixel(buf, 48, x, 20, 15, 23, 42);
    }

    // Lantern room glass & cupola dome roof
    drawRect(buf, 48, 96, 15, 8, 18, 10, 100, 116, 139);
    drawRect(buf, 48, 96, 17, 9, 14, 8, 148, 163, 184, 180);
    drawCircle(buf, 48, 96, 24, 8, 8, 185, 28, 28);
    setPixel(buf, 48, 24, 0, 245, 158, 11);
    setPixel(buf, 48, 24, 1, 245, 158, 11);
    frames.push(spec);
  }

  // 8. 'lighthouse_lit' — 48x96 lit coastal lighthouse tower with glowing lantern room
  {
    const { spec, buf } = createBlankFrame('lighthouse_lit', 48, 96);
    // Stone foundation base
    drawRect(buf, 48, 96, 8, 80, 32, 16, 180, 83, 9);
    drawRect(buf, 48, 96, 10, 76, 28, 4, 217, 119, 6);

    // Tapered tower body (white with bright crimson bands)
    for (let y = 24; y < 76; y++) {
      const progress = (y - 24) / 52;
      const wAtY = Math.round(18 + progress * 8);
      const startX = Math.round(24 - wAtY / 2);

      const isCrimsonBand = (y >= 32 && y <= 44) || (y >= 56 && y <= 66);
      const cr = isCrimsonBand ? 225 : 255;
      const cg = isCrimsonBand ? 29 : 251;
      const cb = isCrimsonBand ? 72 : 235;

      for (let x = startX; x < startX + wAtY; x++) {
        const sideFactor = (x - startX) / wAtY;
        const shade = 1 - sideFactor * 0.2;
        setPixel(buf, 48, x, y, cr * shade, cg * shade, cb * shade, 255);
      }
    }

    // Balcony walkway platform & railing
    drawRect(buf, 48, 96, 12, 22, 24, 3, 217, 119, 6);
    drawRect(buf, 48, 96, 11, 18, 26, 4, 245, 158, 11);

    // Lantern room: BRILLIANT GOLDEN/WHITE GLOWING BEACON
    drawRect(buf, 48, 96, 15, 8, 18, 10, 245, 158, 11);
    drawRect(buf, 48, 96, 16, 9, 16, 8, 254, 240, 138, 255);
    drawCircle(buf, 48, 96, 24, 13, 5, 255, 255, 255, 255);

    // Crimson dome cupola
    drawCircle(buf, 48, 96, 24, 8, 8, 225, 29, 72);
    setPixel(buf, 48, 24, 0, 254, 240, 138);
    setPixel(buf, 48, 24, 1, 254, 240, 138);
    frames.push(spec);
  }

  // 9. 'beacon_beam' — 128x64 radiant lighthouse light beam
  {
    const { spec, buf } = createBlankFrame('beacon_beam', 128, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const angle = Math.atan2(y - 32, x);
        const dist = Math.hypot(x, y - 32);
        if (Math.abs(angle) < 0.35 && dist > 2) {
          const angleFactor = 1 - Math.abs(angle) / 0.35;
          const distFactor = Math.max(0, 1 - dist / 128);
          const alpha = Math.floor(angleFactor * distFactor * 220);
          setPixel(buf, 128, x, y, 254, 240, 138, alpha);
        }
      }
    }
    frames.push(spec);
  }

  // 10. 'lamp_unlit' & 'lamp_lit' (backward compatibility)
  {
    const { spec, buf } = createBlankFrame('lamp_unlit', 32, 32);
    drawCircle(buf, 32, 32, 16, 16, 8, 100, 116, 139);
    frames.push(spec);
  }
  {
    const { spec, buf } = createBlankFrame('lamp_lit', 32, 32);
    drawCircle(buf, 32, 32, 16, 16, 8, 245, 158, 11);
    frames.push(spec);
  }

  // 11. 'flame' — 16x16 teardrop flame
  {
    const { spec, buf } = createBlankFrame('flame', 16, 16);
    drawCircle(buf, 16, 16, 8, 10, 5, 234, 88, 12, 220);
    drawCircle(buf, 16, 16, 8, 8, 3, 245, 158, 11, 240);
    drawCircle(buf, 16, 16, 8, 6, 2, 254, 240, 138, 255);
    setPixel(buf, 16, 8, 3, 255, 255, 255);
    frames.push(spec);
  }

  // 12. 'glow_halo' — 96x96 large radiant golden beacon halo
  {
    const { spec, buf } = createBlankFrame('glow_halo', 96, 96);
    const cx = 48;
    const cy = 48;
    const maxR = 46;
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= maxR) {
          const factor = 1 - dist / maxR;
          const alpha = Math.floor(Math.pow(factor, 1.4) * 240);
          setPixel(buf, 96, x, y, 251, 191, 36, alpha);
        }
      }
    }
    frames.push(spec);
  }

  // 12b. 'fluency_ring' — 64x64 glowing ring arc for Task C-5 fluency timer
  {
    const { spec, buf } = createBlankFrame('fluency_ring', 64, 64);
    const cx = 32;
    const cy = 32;
    const outerR = 30;
    const innerR = 24;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist >= innerR && dist <= outerR) {
          const ringFactor = 1 - Math.abs(dist - 27) / 3;
          const alpha = Math.floor(ringFactor * 255);
          setPixel(buf, 64, x, y, 245, 158, 11, alpha);
        }
      }
    }
    frames.push(spec);
  }

  // 13. 'star' — 16x16 4-point star
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

  // 14. 'mountain' — 128x64 layered mountain peaks
  {
    const { spec, buf } = createBlankFrame('mountain', 128, 64);
    for (let x = 0; x < 128; x++) {
      const h1 = 44 * Math.exp(-Math.pow((x - 35) / 22, 2));
      const h2 = 52 * Math.exp(-Math.pow((x - 85) / 28, 2));
      const peakY = 64 - Math.floor(Math.max(h1, h2));
      for (let y = peakY; y < 64; y++) {
        const factor = (y - peakY) / (64 - peakY || 1);
        const r = Math.floor(45 + factor * 30);
        const g = Math.floor(55 + factor * 35);
        const b = Math.floor(120 + factor * 40);
        setPixel(buf, 128, x, y, r, g, b, 245);
      }
    }
    frames.push(spec);
  }

  // 15. 'hills' — 128x64 coastal green rolling hills (alias for forest_hills)
  {
    const { spec, buf } = createBlankFrame('hills', 128, 64);
    for (let x = 0; x < 128; x++) {
      const hillH = 28 + 14 * Math.sin((x / 128) * Math.PI * 2.5);
      const topY = 64 - Math.floor(hillH);
      for (let y = topY; y < 64; y++) {
        const factor = (y - topY) / (64 - topY || 1);
        const r = Math.floor(5 + factor * 25);
        const g = Math.floor(150 + factor * 45);
        const b = Math.floor(100 + factor * 35);
        setPixel(buf, 128, x, y, r, g, b, 250);
      }
    }
    frames.push(spec);
  }

  // 16. 'city' — 128x64 illuminated City on a Hill citadel skyline
  {
    const { spec, buf } = createBlankFrame('city', 128, 64);
    for (let x = 0; x < 128; x++) {
      const hillH = 22 + Math.floor(12 * Math.sin((x / 128) * Math.PI));
      const hillY = 64 - hillH;

      const isCentralTower = x >= 56 && x <= 72;
      const isLeftTower = x >= 32 && x <= 42;
      const isRightTower = x >= 86 && x <= 96;
      const isBuilding = x >= 24 && x <= 104;

      let wallY = hillY;
      if (isBuilding) wallY = hillY - 8;
      if (isLeftTower || isRightTower) wallY = hillY - 18;
      if (isCentralTower) wallY = hillY - 26;

      for (let y = wallY; y < 64; y++) {
        const r = y < hillY ? 245 : 30;
        const g = y < hillY ? 158 : 41;
        const b = y < hillY ? 11 : 59;
        setPixel(buf, 128, x, y, r, g, b, 250);
      }

      if (x >= 58 && x <= 70) {
        const dx = x - 64;
        const domeY = hillY - 26;
        for (let dy = -6; dy <= 0; dy++) {
          if (dx * dx + dy * dy <= 36) {
            setPixel(buf, 128, x, domeY + dy, 251, 191, 36, 255);
          }
        }
      }

      if ((isCentralTower || isLeftTower || isRightTower) && x % 4 === 0) {
        setPixel(buf, 128, x, wallY + 4, 254, 240, 138, 255);
        setPixel(buf, 128, x, wallY + 8, 254, 240, 138, 255);
      }
    }
    frames.push(spec);
  }

  // 17. 'path_stone' — 64x32 rich cobblestone path texture
  {
    const { spec, buf } = createBlankFrame('path_stone', 64, 32);
    drawRect(buf, 64, 32, 0, 0, 64, 32, 120, 113, 108, 255);
    for (let y = 0; y < 32; y += 8) {
      const shift = (y / 8) % 2 === 0 ? 0 : 8;
      for (let x = shift; x < 64; x += 16) {
        drawRect(buf, 64, 32, x + 1, y + 1, 14, 6, 178, 172, 168, 255);
        drawRect(buf, 64, 32, x + 2, y + 2, 12, 2, 224, 221, 219, 255);
      }
    }
    drawRect(buf, 64, 32, 0, 0, 64, 2, 245, 158, 11, 255);
    frames.push(spec);
  }

  // 18. 'tile_bg' — 64x32 warm golden parchment word card
  {
    const { spec, buf } = createBlankFrame('tile_bg', 64, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, 254, 243, 199, 255);
      }
    }
    drawRect(buf, 64, 32, 0, 0, 64, 2, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 0, 30, 64, 2, 180, 83, 9, 255);
    drawRect(buf, 64, 32, 0, 0, 2, 32, 217, 119, 6, 255);
    drawRect(buf, 64, 32, 62, 0, 2, 32, 180, 83, 9, 255);
    frames.push(spec);
  }

  // 19. 'slot_bg' — 64x32 word slot drop target card
  {
    const { spec, buf } = createBlankFrame('slot_bg', 64, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 64; x++) {
        setPixel(buf, 64, x, y, 245, 158, 11, 55);
      }
    }
    drawRect(buf, 64, 32, 0, 0, 64, 2, 245, 158, 11, 220);
    drawRect(buf, 64, 32, 0, 30, 64, 2, 245, 158, 11, 220);
    drawRect(buf, 64, 32, 0, 0, 2, 32, 245, 158, 11, 220);
    drawRect(buf, 64, 32, 62, 0, 2, 32, 245, 158, 11, 220);
    frames.push(spec);
  }

  return frames;
}
