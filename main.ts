// World news of Wednesday 25 November 2026, drawn as one newspaper page.
// Node 22, standard library only. No network, no randomness, no dates:
// the same bytes are written on every run. Writes entry.png to
// $MAKEFUN_OUTPUT_DIR (or /output). All drawing, including the letterforms,
// is done here from scratch: a vector stroke font defined below as
// polylines on a 0..6 by 0..10 grid (cap top 0, baseline 7, descender 10).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas

type RGB = [number, number, number];
const W = 1024;
const H = 1024;
const img = new Uint8Array(W * H * 3);

function rgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
const PAPER = rgb('#F6F1E5');
const PANEL = rgb('#FFFEF8');
const INK = rgb('#1B1712');
const MUTED = rgb('#6E6455');
const RED = rgb('#A9231A');
const RULE = rgb('#1B1712');
const SKY = rgb('#D9E6EE');
const SEA = rgb('#2E6E6A');
const NAVY = rgb('#16283C');
const GOLD = rgb('#C9971C');
const DAWN1 = rgb('#EFC493');
const DAWN2 = rgb('#D08052');
const GROUND = rgb('#5A3A34');

for (let i = 0; i < W * H; i++) { img[i * 3] = PAPER[0]; img[i * 3 + 1] = PAPER[1]; img[i * 3 + 2] = PAPER[2]; }

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) setPx(x, y, c);
  }
}
function seg(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / Math.max(0.5, w * 0.35)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + dx * t, y0 + dy * t, w / 2, c);
  }
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x)), x1 = Math.min(W, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y)), y1 = Math.min(H, Math.round(y + h));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(x, y, c);
}
function poly(pts: number[][], c: RGB): void {
  let minY = 1e9, maxY = -1e9;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) setPx(x, y, c);
    }
  }
}

// ------------------------------------------------------- vector stroke font
// Each glyph: width in grid units, then strokes; a stroke is a polyline of
// "x,y" points. Grid: x 0..~8, y 0 = cap top, 7 = baseline, 10 = descender.

const RAW: Record<string, string> = {
  A: '6.6|0,7 3,0 6,7|1.7,4.4 4.3,4.4',
  B: '6.4|0,7 0,0 4,0 6,1.8 4,3.5 0,3.5|4,3.5 6,5.2 4,7 0,7',
  C: '6.4|6,1.6 4,0 2,0 0,2 0,5 2,7 4,7 6,5.4',
  D: '6.6|0,7 0,0 3.4,0 6,2.4 6,4.6 3.4,7 0,7',
  E: '6.0|6,0 0,0 0,7 6,7|0,3.5 4.4,3.5',
  F: '6.0|0,7 0,0 6,0|0,3.5 4.4,3.5',
  G: '6.6|6,1.6 4,0 2,0 0,2 0,5 2,7 4,7 6,5 6,3.6 3.6,3.6',
  H: '6.6|0,0 0,7|6,0 6,7|0,3.5 6,3.5',
  I: '4.2|2.1,0 2.1,7|0.4,0 3.8,0|0.4,7 3.8,7',
  J: '5.6|5,0 5,5 3.4,7 1.4,7 0,5.4|2.6,0 5.6,0',
  K: '6.6|0,0 0,7|5.8,0 0,3.9|2.2,2.6 6,7',
  L: '6.0|0,0 0,7 6,7',
  M: '7.4|0,7 0,0 3.7,3.6 7.4,0 7.4,7',
  N: '6.8|0,7 0,0 6.8,7 6.8,0',
  O: '6.8|2,0 4.6,0 6.8,2 6.8,5 4.6,7 2,7 0,5 0,2 2,0',
  P: '6.4|0,7 0,0 4,0 6,1.8 4,3.5 0,3.5',
  Q: '6.8|2,0 4.6,0 6.8,2 6.8,5 4.6,7 2,7 0,5 0,2 2,0|3.8,5 6.8,7.6',
  R: '6.4|0,7 0,0 4,0 6,1.8 4,3.5 0,3.5|2.6,3.5 6,7',
  S: '6.4|6,1.6 4,0 2,0 0.8,1.6 1.8,3.2 4.4,3.8 5.8,5.2 4,7 2,7 0.6,5.4',
  T: '6.6|0,0 6.6,0|3.3,0 3.3,7',
  U: '6.6|0,0 0,5 2,7 4.6,7 6.6,5 6.6,0',
  V: '6.6|0,0 3.3,7 6.6,0',
  W: '8.4|0,0 1.8,7 4.2,3.2 6.6,7 8.4,0',
  X: '6.6|0,0 6.6,7|6.6,0 0,7',
  Y: '6.6|0,0 3.3,3.5 6.6,0|3.3,3.5 3.3,7',
  Z: '6.4|0,0 6.4,0 0,7 6.4,7',
  a: '6.2|6.2,3.2 6.2,7 2.6,7 1,5.6 1,4.4 2.6,3 4.6,3 6.2,4.4',
  b: '6.2|0,0 0,7|0,7 0,3.2 2.8,3 4.8,4.4 4.8,5.6 2.8,7 0,7',
  c: '5.8|6,3.9 4.2,3 2.2,3 0.8,4.4 0.8,5.8 2.2,7 4.2,7 6,6.1',
  d: '6.2|6.2,0 6.2,7|6.2,7 6.2,3.2 3.4,3 1.4,4.4 1.4,5.6 3.4,7 6.2,7',
  e: '6.0|0.8,5.2 5.4,5.2|6,4.6 5,3.1 3,3 1.2,4.4 1.2,5.6 2.8,7 4.8,7 6,5.6',
  f: '4.6|3.4,0 1.2,0.8 1.2,7|0,3.4 3.4,3.4',
  g: '6.2|6.2,3.2 6.2,7 2.6,7 1,5.6 1,4.4 2.6,3 4.6,3 6.2,4.4|6.2,4.4 6.2,8.4 4.6,10 2.2,10 0.8,8.8',
  h: '6.0|0,0 0,7|0,7 0,3.4 2.8,3 5,4 5,7',
  i: '3.0|1.5,3 1.5,7|1.5,0.6 1.5,1.4',
  j: '3.6|2.4,3 2.4,8 1.4,10 0.2,9.6|2.4,0.6 2.4,1.4',
  k: '6.0|0,0 0,7|5.4,3 0,5.2|2,4.2 5.8,7',
  l: '3.0|1.5,0 1.5,7',
  m: '9.4|0,7 0,3.4 2.4,3 4.2,4.4 4.2,7|4.2,4.4 6.4,3 8.6,4.2 8.6,7',
  n: '6.0|0,7 0,3.4 2.8,3 5,4 5,7',
  o: '6.0|2,3 4,3 5.4,4.4 5.4,5.6 4,7 2,7 0.6,5.6 0.6,4.4 2,3',
  p: '6.2|0,3 0,10|0,7 0,3.2 2.8,3 4.8,4.4 4.8,5.6 2.8,7 0,7',
  q: '6.2|6.2,3 6.2,10|6.2,7 6.2,3.2 3.4,3 1.4,4.4 1.4,5.6 3.4,7 6.2,7',
  r: '4.6|0,7 0,3.2|0,4.2 2.4,3 3.8,3.8 4.2,5',
  s: '5.8|5.4,3.9 3.8,3 2,3 0.8,4 1.8,5 3.8,5.2 5,6 3.8,7 2,7 0.8,6.1',
  t: '4.4|2.4,1 2.4,7 1.6,8.4 0.4,8.2|0,3.4 4.2,3.4',
  u: '6.0|0,3 0,5.4 2,7 4,7 5.4,5.4 5.4,3|5.4,3 5.4,7',
  v: '5.8|0,3 2.9,7 5.8,3',
  w: '8.6|0,3 1.6,7 4.3,4.2 7,7 8.6,3',
  x: '5.8|0,3 5.8,7|5.8,3 0,7',
  y: '5.8|0,3 2.9,7 5.8,3|2.9,7 2.6,9.8 0.8,10',
  z: '5.8|0,3 5.8,3 0,7 5.8,7',
  '0': '6.6|2,0 4.6,0 6.6,2 6.6,5 4.6,7 2,7 0,5 0,2 2,0',
  '1': '4.4|3.2,0 3.2,7|3.2,0 1,1.8|1.2,7 5.2,7',
  '2': '6.4|0.8,1.8 2.6,0 4.6,0 6.2,1.8 6.2,3.4 0,7 6.4,7',
  '3': '6.4|0.8,1.6 2.6,0 4.6,0 6.2,1.8 4.2,3.5|4.2,3.5 6.2,4 6.2,5.4 4.4,7 2.4,7 0.8,5.6',
  '4': '6.6|3.8,0 3.8,7|0,4.5 6,4.5|0,4.5 3.8,0',
  '5': '6.4|5.8,0 0,0 0,3.4 3.6,3.4 5.8,4.8 5.8,5.6 3.6,7 1.2,7 0,6.2',
  '6': '6.6|6.2,1.6 4.2,0 2,0 0,2 0,5 2,7 4.2,7 6.2,5 6.2,3.8 4.2,3 2.2,3.2 0.8,4.6',
  '7': '6.4|0,0 6.4,0 2.6,7',
  '8': '6.6|2,0 4.4,0 6,1.6 4.4,3.4 2,3.4 0.6,1.6 2,0|4.4,3.4 6.4,4.8 6.4,5.6 4.4,7 2,7 0.2,5.6 0.2,4.8 2,3.4',
  '9': '6.6|0.4,5.4 2.2,7 4.4,7 6.4,5 6.4,2 4.4,0 2.2,0 0.2,2 0.2,3.4 2.2,4 4.4,3.8 5.8,2.6',
  '.': '3.0|1.5,6.2 1.5,7',
  ',': '3.0|1.5,6.2 1.5,7.6 0.8,9.4 0,9.7',
  "'": '3.0|1.8,0 1,2.2',
  '-': '6.0|0,4.6 6,4.6',
  ':': '3.0|1.5,2.2 1.5,3|1.5,5.6 1.5,6.4',
  ';': '3.0|1.5,2.2 1.5,3|1.5,5.6 1.5,7.2 0.8,9.2 0,9.5',
  '(': '4.6|3.8,0 2,2 2,5 3.8,7',
  ')': '4.6|0.8,0 2.6,2 2.6,5 0.8,7',
  '%': '8.0|0,0 8,7|1,0.8 2.6,0.8 2.6,2.6 1,2.6 1,0.8|5.4,4.4 7,4.4 7,6.2 5.4,6.2 5.4,4.4',
  '€': '6.6|6,1.6 4,0 2,0 0,2 0,5 2,7 4,7 6,5.4|0,2.8 5.2,2.8|0,4.8 5.2,4.8',
  '£': '6.2|5.6,0.4 1,0.4 1,7 5.6,7|0.6,3.8 4.4,3.8|1,0.4 2.6,2 1,3.8',
  $: '6.2|3.1,-0.6 3.1,7.6|5.6,1.8 4,0.2 2,0.2 0.6,1.8 1.8,3.4 4.4,3.8 5.6,5.2 4,6.8 2,6.8 0.6,5.4',
  '+': '6.0|3,1.4 3,6.4|0.6,3.9 5.4,3.9',
  '/': '6.0|5,0 1,7',
  '&': '6.6|4.6,6.6 2,7 0.6,5.4 2,3.6 5,1.8 5.8,0.6 4.6,0 2.6,0.6 1.6,2.4 3.4,4.6 5.4,6.2 6.4,7',
  '?': '6.0|1,2 2.4,0.4 4.2,0.4 5.4,2 4,3.6 3,4.6 3,5.4|3,6.4 3,7',
  '!': '3.0|1.5,0 1.5,4.8|1.5,6.2 1.5,7',
  '"': '5.0|1.4,0 0.8,2|3.8,0 3.2,2',
  '*': '6.0|3,0.6 3,6.4|0.6,2 5.4,5|5.4,2 0.6,5',
  '=': '6.0|0,2.6 6,2.6|0,5.4 6,5.4',
  '•': 'DOT',
  _: '6.0|0,8.2 6,8.2',
};

type GlyphDef = { w: number; strokes: number[][][]; dot: boolean };
const FONT: Record<string, GlyphDef> = {};
for (const ch of Object.keys(RAW)) {
  const def = RAW[ch];
  if (def === 'DOT') { FONT[ch] = { w: 4, strokes: [], dot: true }; continue; }
  const parts = def.split('|');
  const w = parseFloat(parts[0]);
  const strokes: number[][][] = parts.slice(1).map((s) =>
    s.split(' ').map((pt) => { const q = pt.split(','); return [parseFloat(q[0]), parseFloat(q[1])]; }));
  FONT[ch] = { w, strokes, dot: false };
}
FONT[' '] = { w: 3.6, strokes: [], dot: false };
FONT['–'] = { w: 7.5, strokes: [[[0, 4.6], [7.5, 4.6]]], dot: false };
FONT['—'] = { w: 11, strokes: [[[0, 4.6], [11, 4.6]]], dot: false };
FONT['·'] = FONT['•'];

function clean(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/·/g, '•');
}
function glyphAdvance(ch: string, unit: number, tracking: number): number {
  const g = FONT[ch];
  const w = g ? g.w : 3.6;
  return (w + 1.15) * unit + tracking;
}
function textWidth(s: string, capPx: number, bold: boolean, tracking: number): number {
  const unit = capPx / 7;
  let w = 0;
  for (const ch of clean(s)) w += glyphAdvance(ch, unit, tracking);
  return w;
}
function drawGlyph(ch: string, x: number, yTop: number, capPx: number, c: RGB, bold: boolean): void {
  const g = FONT[ch];
  if (!g) return;
  const unit = capPx / 7;
  if (g.dot) { disc(x + 2 * unit, yTop + (4.8 / 7) * capPx, Math.max(1, 1.05 * unit), c); return; }
  const sw = (bold ? 1.3 : 0.8) * unit;
  for (const stroke of g.strokes) {
    for (let i = 0; i + 1 < stroke.length; i++) {
      const a = stroke[i], b = stroke[i + 1];
      seg(x + a[0] * unit, yTop + (a[1] / 7) * capPx, x + b[0] * unit, yTop + (b[1] / 7) * capPx, sw, c);
    }
  }
}
function drawText(s: string, x: number, yTop: number, capPx: number, c: RGB, bold: boolean, tracking: number): number {
  const unit = capPx / 7;
  let cx = x;
  for (const ch of clean(s)) {
    drawGlyph(ch, cx, yTop, capPx, c, bold);
    cx += glyphAdvance(ch, unit, tracking);
  }
  return cx - x;
}
function wrap(s: string, maxW: number, capPx: number, bold: boolean): string[] {
  const words = clean(s).split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? cur + ' ' + word : word;
    if (textWidth(trial, capPx, bold, 0) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- PNG writer

const CRC_TABLE = ((): number[] => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(): Uint8Array {
  const stride = W * 3;
  const raw = new Uint8Array(H * (1 + stride));
  let prev = new Uint8Array(stride);
  for (let y = 0; y < H; y++) {
    const row = img.subarray(y * stride, (y + 1) * stride);
    const cands: Uint8Array[] = [];
    for (let f = 0; f <= 2; f++) {
      const out = new Uint8Array(stride);
      for (let i = 0; i < stride; i++) {
        const left = i >= 3 ? row[i - 3] : 0;
        const up = prev[i];
        const v = f === 0 ? row[i] : f === 1 ? row[i] - left : row[i] - up;
        out[i] = v & 0xff;
      }
      cands.push(out);
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f <= 2; f++) {
      let s = 0;
      const cd = cands[f];
      for (let i = 0; i < stride; i++) { const b = cd[i]; s += b < 128 ? b : 256 - b; }
      if (s < bestScore) { bestScore = s; best = f; }
    }
    raw[y * (1 + stride)] = best;
    raw.set(cands[best], y * (1 + stride) + 1);
    prev = row;
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ------------------------------------------------------------------- content

const REGION_COLOR: Record<string, RGB> = {
  OCEANIA: rgb('#2E6E6A'), 'S. AMERICA': rgb('#C05621'), 'E. ASIA': rgb('#A9231A'),
  'S. ASIA': rgb('#6C3483'), 'SE ASIA': rgb('#2E7D32'), 'MID EAST': rgb('#9A7B00'),
  AFRICA: rgb('#8D5524'), 'W. EUROPE': rgb('#1F4E79'), 'E. EUROPE': rgb('#546E7A'),
  'N. AMERICA': rgb('#283593'),
};
const REGIONS: [string, number][] = [
  ['OCEANIA', 6], ['S. AMERICA', 1], ['E. ASIA', 5], ['S. ASIA', 2], ['SE ASIA', 1],
  ['MID EAST', 4], ['AFRICA', 5], ['W. EUROPE', 7], ['E. EUROPE', 4], ['N. AMERICA', 13],
];
const BADGE_COLOR: Record<string, RGB> = {
  CONFIRMED: rgb('#2E7D32'), REPORTED: rgb('#9A7B00'), CLAIM: rgb('#A9231A'),
};

type Hero = { region: string; scene: string; head: string; body: string; badge: string; tag: string; chip: string };
const HEROES: Hero[] = [
  { region: 'OCEANIA', scene: 'pact', head: 'Solomons signs A$740m pact',
    body: 'Signed in Canberra; bars foreign bases; China pact unconfirmed.',
    badge: 'CONFIRMED', tag: 'CANBERRA', chip: 'A$740M' },
  { region: 'S. AMERICA', scene: 'siege', head: 'Cartagena siege ends: 20 freed',
    body: 'Police stormed a house at dawn; 20 freed, 1 gunman killed.',
    badge: 'CONFIRMED', tag: 'CARTAGENA', chip: '20 FREED' },
  { region: 'E. ASIA', scene: 'rocket', head: 'Shenzhou-24 docks; Pakistani aboard',
    body: 'Launched 00:19 UTC, docked 03:56 UTC; first Pakistani in orbit.',
    badge: 'CONFIRMED', tag: 'TIANGONG', chip: '00:19 UTC' },
];
type Card = { region: string; head: string; body: string; badge: string };
const CARDS: Card[] = [
  { region: 'W. EUROPE', head: 'EU proposes €45bn loan fund for Ukraine', body: '€20bn budget, €25bn defence.', badge: 'REPORTED' },
  { region: 'N. AMERICA', head: 'US jobless claims fall to 189,000', body: 'Claims fell 13,000, Labor Dept says.', badge: 'CONFIRMED' },
  { region: 'OCEANIA', head: 'M5.2 quake off Hicks Bay', body: 'USGS: 175 km north; 25 km deep; no damage.', badge: 'CONFIRMED' },
  { region: 'N. AMERICA', head: 'US sets new tariffs on 14 partners', body: 'China 20%, Vietnam 35%, India 25%.', badge: 'REPORTED' },
  { region: 'W. EUROPE', head: 'Eurostar cancels 8 trains in strike', body: '8 trains cancelled in surprise walkout.', badge: 'CONFIRMED' },
  { region: 'E. EUROPE', head: 'Kremlin rejects Johnson force idea', body: 'Moscow calls it "unacceptable".', badge: 'REPORTED' },
  { region: 'S. ASIA', head: 'Court refuses Kartarpur reopening order', body: 'Delhi court: shut since 7 May 2025.', badge: 'CONFIRMED' },
  { region: 'E. ASIA', head: 'Seoul stocks plunge 6.2% in AI sell-off', body: 'KOSPI at 10-month low; Samsung -9.9%.', badge: 'CONFIRMED' },
  { region: 'N. AMERICA', head: 'US economy grew 4.3% in third quarter', body: 'Growth up from 3.4%; fastest in 3 years.', badge: 'CONFIRMED' },
  { region: 'W. EUROPE', head: 'Merz: Russia wants more than Ukraine', body: 'Defence to €200bn by 2030, 3.7% of GDP.', badge: 'REPORTED' },
  { region: 'W. EUROPE', head: 'Stellantis to end Sochaux night shift', body: '500 interim jobs not renewed.', badge: 'REPORTED' },
  { region: 'AFRICA', head: 'Court voids Ramaphosa impeachment report', body: 'Section 89 report is void.', badge: 'CONFIRMED' },
];
const ALSO: string[] = [
  "Nor'easter: 60-70 mph gusts, Thanksgiving.",
  'Sudan drone strikes kill 19 in Blue Nile.',
  'Gaza security chief killed in al-Shati.',
  '145 drones downed over Samara; 1 killed.',
  'Huawei to appeal verdict; sentence 2027.',
  'Drones downed at Ras Tanura; Brent $93+.',
  'UK energy cap up 26% to £2,166 in Jan.',
  'Australia apologises to gay veterans.',
  '31 killed in Giza fuel-tanker fire.',
  '3 bodies found, 26 trapped in mine.',
  'Iran tanker-mine claim unconfirmed.',
  'Poland presses NATO case; AWACS sent.',
  'CIA, ODNI systems hit; cause unknown.',
  'Saipem wins $650m Aramco offshore work.',
  'EU budget summit looms; cuts of 10%.',
  'Dell shares fall despite record sales.',
  'N. Korea expels Swiss diplomat.',
  'Anthropic dips below $1tn, recovers.',
  'US PCE inflation 3.8%; hike priced in.',
  'Australia passes duty-of-care law.',
  'Australia, Singapore sign carbon deal.',
  'Canada sets 50% tariff on vegetables.',
  "Canada: 'We don't report to US.'",
  'Bangladesh workers clash with police.',
  'NZ save Wellington Test in final draw.',
  'Mexico protests deportation to Spain.',
  'Ebola responders trapped in Congo.',
  'Motegi meets ICC chief; funds early.',
  'Puigdemont to return on 12 December.',
  'Abrego Garcia lands in Madrid.',
  'Nasdaq steadies after 4.6% plunge.',
  'Senegal raises FCFA 55bn at auction.',
  'Bulgaria stops migrant boat; 35 aboard.',
];
const TIMELINE: [string, string][] = [
  ['00:19', 'Liftoff'], ['01:00', 'Gaza strike'], ['03:56', 'Docking'],
  ['06:30', 'Freed'], ['07:30', 'Motegi / ICC'], ['13:30', 'US data'],
  ['16:08', 'Giza fire'],
];
const MAP_ROWS = [
  '                                            ',
  '    ####          ###   ########   #####     ',
  '  ########      ########################      ',
  '   #######       #######################      ',
  '    ######        #################  ##      ',
  '     ####          #######   ####            ',
  '     ###            ######    ##             ',
  '     ##              ####     #       ##     ',
  '     ###             ###      ###    ####    ',
  '      ##                      ##      ##     ',
  '      #                        #              ',
  '                                            ',
];
const MAP_DOTS: [number, number][] = [[5, 2], [6, 7], [20, 2], [24, 2], [21, 6], [24, 4], [27, 4], [33, 3], [31, 6], [38, 8]];

// ------------------------------------------------------------------ helpers

function chipWidth(text: string, capPx: number): number {
  return textWidth(text, capPx, true, 0) + 12;
}
function drawChip(x: number, y: number, text: string, fg: RGB, capPx: number, fillC: RGB): number {
  const w = chipWidth(text, capPx);
  rect(x, y, w, capPx + 8, fillC);
  seg(x, y, x + w, y, 1, INK); seg(x, y + capPx + 8, x + w, y + capPx + 8, 1, INK);
  seg(x, y, x, y + capPx + 8, 1, INK); seg(x + w, y, x + w, y + capPx + 8, 1, INK);
  drawText(text, x + 6, y + 4, capPx, fg, true, 0);
  return w;
}
function drawScene(x: number, y: number, w: number, h: number, kind: string, chipText: string): void {
  if (kind === 'pact') {
    rect(x, y, w, 28, SKY);
    rect(x, y + 28, w, h - 28, SEA);
    poly([[x + 30, y + 36], [x + 78, y + 27], [x + 118, y + 34], [x + 96, y + 43], [x + 48, y + 44]], PANEL);
    poly([[x + 170, y + 30], [x + 210, y + 23], [x + 246, y + 30], [x + 226, y + 41], [x + 186, y + 41]], PANEL);
    seg(x + 118, y + 34, x + 170, y + 30, 1.4, PANEL);
    disc(x + 262, y + 10, 6, GOLD);
  } else if (kind === 'siege') {
    rect(x, y, w, 19, DAWN1);
    rect(x, y + 19, w, 15, DAWN2);
    rect(x, y + 34, w, h - 34, GROUND);
    disc(x + w - 30, y + 10, 7, GOLD);
    const fx = x + 30, fy = y + 12, fw = 88, fh = 28;
    rect(fx, fy, fw, fh, INK);
    for (let i = 0; i < 4; i++) rect(fx + i * 23, fy - 5, 11, 5, INK);
    poly([[fx + 34, fy + fh], [fx + 34, fy + fh - 11], [fx + 44, fy + fh - 16], [fx + 54, fy + fh - 11], [fx + 54, fy + fh]], PAPER);
    rect(x + w - 88, y + 20, 26, 20, INK);
    rect(x + w - 88, y + 15, 26, 5, INK);
  } else {
    rect(x, y, w, h, NAVY);
    for (let i = 0; i < 26; i++) {
      const sx = x + 12 + ((i * 97) % (w - 24));
      const sy = y + 6 + ((i * 53) % (h - 12));
      disc(sx, sy, i % 5 === 0 ? 1.6 : 1, PANEL);
    }
    // Orbit arc.
    for (let a = 0; a <= 60; a++) {
      const t = (a / 60) * Math.PI;
      disc(x + w * 0.5 + Math.cos(t) * w * 0.42, y + h * 0.87 - Math.sin(t) * h * 0.62, 1.2, GOLD);
    }
    // Rocket: body, nose, fins, flame.
    const rx = x + w * 0.5 - 7, ry = y + 10;
    poly([[rx, ry + 10], [rx + 7, ry], [rx + 14, ry + 10]], PANEL);
    rect(rx, ry + 10, 14, 20, PANEL);
    poly([[rx, ry + 22], [rx - 7, ry + 31], [rx, ry + 27]], RED);
    poly([[rx + 14, ry + 22], [rx + 21, ry + 31], [rx + 14, ry + 27]], RED);
    poly([[rx + 4, ry + 30], [rx + 7, ry + 36], [rx + 10, ry + 30]], GOLD);
    // Station at the arc end.
    rect(x + w - 52, y + 8, 26, 7, PANEL);
    rect(x + w - 62, y + 10, 9, 3, GOLD);
    rect(x + w - 26, y + 10, 9, 3, GOLD);
  }
  const cw = chipWidth(chipText, 10.5);
  drawChip(x + w - cw - 6, y + h - 19, chipText, RED, 10.5, PANEL);
}

// ------------------------------------------------------------------- render

function render(): void {
  const MX = 24, CW = 976;
  // Masthead.
  drawText('THE WORLD IN ONE DAY', MX, 14, 12, RED, true, 1.5);
  drawText('25 NOVEMBER 2026', MX, 30, 40, INK, true, 0);
  drawText('Wednesday  •  48 stories  •  10 regions  •  Verified to this day', MX, 78, 13.5, MUTED, false, 0);
  // Dot-grid world map, top right.
  const mapX = 800, mapY = 8;
  for (let r = 0; r < MAP_ROWS.length; r++) {
    for (let c = 0; c < MAP_ROWS[r].length; c++) {
      if (MAP_ROWS[r][c] === '#') disc(mapX + c * 4.3 + 2, mapY + r * 4.4 + 2, 1.6, INK);
    }
  }
  for (const [dc, dr] of MAP_DOTS) disc(mapX + dc * 4.3 + 2, mapY + dr * 4.4 + 2, 2.7, RED);
  drawText('10 REGIONS', mapX + 6, 64, 9.5, MUTED, true, 1);
  rect(MX, 94, CW, 3, RULE);
  rect(MX, 99, CW, 1, RULE);
  // Region bar: names only; counts live in the research note.
  const slot = CW / REGIONS.length;
  for (let i = 0; i < REGIONS.length; i++) {
    const name = REGIONS[i][0];
    const cx = MX + i * slot;
    disc(cx + 8, 109, 4, REGION_COLOR[name]);
    drawText(name, cx + 16, 104, 9, INK, true, 0);
    if (i > 0) seg(cx, 102, cx, 117, 1, MUTED);
  }
  // Heroes.
  const heroY = 122, heroH = 180, heroW = 318, heroGap = 11;
  for (let i = 0; i < HEROES.length; i++) {
    const hx = MX + i * (heroW + heroGap);
    const hs = HEROES[i];
    rect(hx, heroY, heroW, heroH, PANEL);
    seg(hx, heroY, hx + heroW, heroY, 1, INK);
    seg(hx, heroY + heroH, hx + heroW, heroY + heroH, 1, INK);
    seg(hx, heroY, hx, heroY + heroH, 1, INK);
    seg(hx + heroW, heroY, hx + heroW, heroY + heroH, 1, INK);
    drawScene(hx + 1, heroY + 1, heroW - 2, 46, hs.scene, hs.chip);
    rect(hx, heroY + 47, heroW, 4, REGION_COLOR[hs.region]);
    const headLines = wrap(hs.head, heroW - 24, 17, true);
    let hy = heroY + 54;
    for (const ln of headLines.slice(0, 2)) { drawText(ln, hx + 12, hy, 17, INK, true, 0); hy += 25; }
    const bodyLines = wrap(hs.body, heroW - 24, 13, false);
    hy = heroY + 106;
    for (const ln of bodyLines.slice(0, 3)) { drawText(ln, hx + 12, hy, 13, INK, false, 0); hy += 18.5; }
    const bc = BADGE_COLOR[hs.badge];
    drawChip(hx + 12, heroY + 162, hs.badge, bc, 9.5, PANEL);
    const tagW = textWidth(hs.tag, 9.5, true, 1);
    drawText(hs.tag, hx + heroW - 12 - tagW, heroY + 164, 9.5, MUTED, true, 1);
  }
  // UTC timeline.
  const tlY = 326;
  seg(MX, tlY, MX + CW, tlY, 1.6, INK);
  for (let i = 0; i < TIMELINE.length; i++) {
    const tx = MX + (i * CW) / (TIMELINE.length - 1);
    disc(tx, tlY, 3.2, RED);
    const [t, label] = TIMELINE[i];
    const tw = textWidth(t, 10.5, true, 0);
    const txx = Math.max(MX, Math.min(MX + CW - tw, tx - tw / 2));
    drawText(t, txx, 308, 10.5, INK, true, 0);
    const lw = textWidth(label, 10, false, 0);
    const lxx = Math.max(MX, Math.min(MX + CW - lw, tx - lw / 2));
    drawText(label, lxx, 330, 10, MUTED, false, 0);
  }
  // Cards: 3 columns x 4 rows. Body width reserves the badge zone at right.
  const cardY0 = 350, cardW = 318, cardH = 86, cardGapX = 11, cardGapY = 5;
  for (let i = 0; i < CARDS.length; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const cx = MX + col * (cardW + cardGapX);
    const cy = cardY0 + row * (cardH + cardGapY);
    const cd = CARDS[i];
    rect(cx, cy, cardW, cardH, PANEL);
    seg(cx, cy, cx + cardW, cy, 1, INK);
    seg(cx, cy + cardH, cx + cardW, cy + cardH, 1, INK);
    seg(cx, cy, cx, cy + cardH, 1, INK);
    seg(cx + cardW, cy, cx + cardW, cy + cardH, 1, INK);
    rect(cx, cy, 5, cardH, REGION_COLOR[cd.region]);
    const headLines = wrap(cd.head, cardW - 26, 14.5, true);
    let ty = cy + 6;
    for (const ln of headLines.slice(0, 2)) { drawText(ln, cx + 12, ty, 14.5, INK, true, 0); ty += 21.75; }
    const bodyLines = wrap(cd.body, cardW - 96, 11, false);
    for (const ln of bodyLines.slice(0, 2)) { drawText(ln, cx + 12, ty + 1, 11, MUTED, false, 0); ty += 16; }
    const bc = BADGE_COLOR[cd.badge];
    const bw = chipWidth(cd.badge, 8);
    drawChip(cx + cardW - bw - 7, cy + cardH - 17, cd.badge, bc, 8, PANEL);
  }
  // Also On: two columns.
  const alsoY = 715;
  drawText('ALSO ON', MX, alsoY, 15, INK, true, 2);
  const alsoNote = '33 MORE STORIES FROM 25 NOVEMBER';
  const anW = textWidth(alsoNote, 10, false, 1);
  drawText(alsoNote, MX + CW - anW, alsoY + 3, 10, MUTED, false, 1);
  rect(MX, alsoY + 22, CW, 2, RULE);
  const colW = 488, rowH = 14, rowsPerCol = 17;
  for (let i = 0; i < ALSO.length; i++) {
    const col = Math.floor(i / rowsPerCol), row = i % rowsPerCol;
    const ax = MX + col * colW;
    const ay = alsoY + 30 + row * rowH;
    const num = String(16 + i) + '.';
    drawText(num, ax, ay, 9.5, RED, true, 0);
    const text = ALSO[i];
    const cut = text.indexOf(':');
    if (cut > 0 && cut < 42) {
      const lead = text.slice(0, cut + 1);
      const leadW = drawText(lead, ax + 30, ay, 9.5, INK, true, 0);
      drawText(text.slice(cut + 1), ax + 30 + leadW, ay, 9.5, INK, false, 0);
    } else {
      drawText(text, ax + 30, ay, 9.5, INK, false, 0);
    }
  }
  // Footer: date check, two lines.
  rect(MX, 994, CW, 1, RULE);
  drawText('DATE CHECK — 24 NOV, NOT 25 NOV: femicide report • Takaichi-ICC talks • Huawei verdict • siege began', MX, 998, 9, MUTED, false, 0);
  drawText('Dell results • CIA hack first reported • Canada-Qatar deal signed • Acas talks failed', MX, 1011, 9, MUTED, false, 0);
}

render();

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const png = encodePNG();
writeFileSync(join(outDir, 'entry.png'), png);
console.log('wrote entry.png ' + png.length + ' bytes');
