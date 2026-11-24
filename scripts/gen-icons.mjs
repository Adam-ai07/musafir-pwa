// Генерирует PNG-заглушки иконок (полумесяц на изумрудном фоне) без внешних зависимостей.
// Повторяет рисунок public/icon.svg. Запуск: npm run icons
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const BG = [0x06, 0x4e, 0x3b];
const MOON = [0x10, 0xb9, 0x81];
const STAR = [0xd1, 0xfa, 0xe5];

// Звезда — тот же многоугольник, что и в public/icon.svg
const STAR_POLY = [
  [360, 150], [372, 186], [410, 186], [379, 208], [391, 244],
  [360, 222], [329, 244], [341, 208], [310, 186], [348, 186],
];
function inStar(x, y) {
  let inside = false;
  for (let i = 0, j = STAR_POLY.length - 1; i < STAR_POLY.length; j = i++) {
    const [xi, yi] = STAR_POLY[i];
    const [xj, yj] = STAR_POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function render(size) {
  const s = size / 512;
  const SS = 3; // суперсэмплинг для сглаживания
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const radius = 112 * s;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / s;
          const py = (y + (sy + 0.5) / SS) / s;
          // скруглённый квадрат
          const rr = radius / s;
          const qx = Math.max(rr - px, px - (512 - rr), 0);
          const qy = Math.max(rr - py, py - (512 - rr), 0);
          if (Math.hypot(qx, qy) > rr) continue;
          let c = BG;
          const inOuter = Math.hypot(px - 240, py - 256) <= 150;
          const inInner = Math.hypot(px - 295, py - 220) <= 130;
          if (inOuter && !inInner) c = MOON;
          if (inStar(px, py)) c = STAR;
          r += c[0]; g += c[1]; b += c[2]; a += 255;
        }
      }
      const n = SS * SS;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const cov = a / 255;
      raw[o] = cov ? Math.round(r / cov) : 0;
      raw[o + 1] = cov ? Math.round(g / cov) : 0;
      raw[o + 2] = cov ? Math.round(b / cov) : 0;
      raw[o + 3] = Math.round(a / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), render(size));
  console.log(`public/icon-${size}.png`);
}
writeFileSync(new URL(`../public/apple-touch-icon.png`, import.meta.url), render(180));
console.log("public/apple-touch-icon.png");
