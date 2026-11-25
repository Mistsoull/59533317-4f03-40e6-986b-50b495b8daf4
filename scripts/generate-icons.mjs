/**
 * Generates clean PNG PWA icons (180 apple-touch, 192, 512, 512 maskable)
 * using Node's built-in zlib (zero native binary dependencies).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ICONS_DIR = path.resolve('public/icons');
fs.mkdirSync(ICONS_DIR, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderKitchenIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const scale = maskable ? 0.72 : 0.86;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const nx = (x - cx) / (size * 0.5);
      const ny = (y - cy) / (size * 0.5);
      const dist = Math.hypot(nx, ny);

      // Warm dark espresso gradient background
      let r = 34 + Math.round((1 - Math.min(1, dist)) * 22);
      let g = 28 + Math.round((1 - Math.min(1, dist)) * 16);
      let b = 24 + Math.round((1 - Math.min(1, dist)) * 12);

      // Cozy terracotta emblem ring
      if (dist < 0.82 * scale && dist > 0.72 * scale) {
        r = 224;
        g = 122;
        b = 95;
      } else if (dist <= 0.72 * scale) {
        r = 49;
        g = 41;
        b = 35;
      }

      // Stylized chef hat silhouette in cream/white
      const hx = nx / scale;
      const hy = ny / scale;
      const inBrim = Math.abs(hx) < 0.32 && hy > 0.05 && hy < 0.34;
      const inRibbon = Math.abs(hx) < 0.32 && hy >= 0.24 && hy < 0.33;
      const inPuffCenter = Math.hypot(hx, hy + 0.14) < 0.26;
      const inPuffLeft = Math.hypot(hx + 0.22, hy + 0.04) < 0.2;
      const inPuffRight = Math.hypot(hx - 0.22, hy + 0.04) < 0.2;

      if (inRibbon) {
        r = 242;
        g = 204;
        b = 143;
      } else if (inBrim || inPuffCenter || inPuffLeft || inPuffRight) {
        r = 250;
        g = 245;
        b = 239;
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = 255;
    }
  }

  return encodePng(size, size, buf);
}

const targets = [
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const t of targets) {
  const out = path.join(ICONS_DIR, t.name);
  fs.writeFileSync(out, renderKitchenIcon(t.size, t.maskable));
  console.log(`Generated ${t.name} (${t.size}x${t.size})`);
}
