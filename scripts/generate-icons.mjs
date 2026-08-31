// Renders the toolbar icons (a "no entry" sign) straight to PNG — no image
// dependencies, no binary assets checked into the repo.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const SIZES = [16, 32, 48, 128];
const BG = [79, 70, 229]; // indigo, matches the popup accent
const FG = [255, 255, 255];
const SAMPLES = 3;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded square centred on the unit square. */
function roundedSquare(px, py, half, radius) {
  const dx = Math.abs(px) - (half - radius);
  const dy = Math.abs(py) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Colour + coverage for one sub-sample, in normalised [0,1] coordinates. */
function sample(u, v) {
  const px = u - 0.5;
  const py = v - 0.5;
  if (roundedSquare(px, py, 0.5, 0.22) > 0) return null;

  const r = Math.hypot(px, py);
  const ring = r <= 0.325 && r >= 0.235;
  // The slash: rotate 45° and take a thin horizontal band inside the ring.
  const rx = (px + py) * Math.SQRT1_2;
  const ry = (py - px) * Math.SQRT1_2;
  const slash = r <= 0.325 && Math.abs(ry) <= 0.048 && Math.abs(rx) <= 0.33;

  return ring || slash ? FG : BG;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const colour = sample((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
        rgba[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
      }
    }
  }
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), encodePng(size, rgba));
}

console.log(`icons written to public/icons (${SIZES.join(', ')})`);
