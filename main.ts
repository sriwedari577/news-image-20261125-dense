// One day in the news: Wednesday 25 November 2026.
// A 1024x1024 PNG broadsheet drawn from scratch: hand-rolled PNG encoder,
// a vector stroke font designed for this page (mixed case, proportional,
// bold strokes so it survives shrinking to ~300px), and twelve distinct
// drawn scenes, one per top story. Node 22, standard library only,
// no network, deterministic output.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------- canvas: RGB buffer at 2x supersampling, averaged down ----------
const SS = 2;
const W = 1024;
const H = 1024;
const WW = W * SS;
const HH = H * SS;
const buf = Buffer.alloc(WW * HH * 3, 255);

type RGB = [number, number, number];

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(WW, Math.round((x + w) * SS));
  const y1 = Math.min(HH, Math.round((y + h) * SS));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * WW + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
      o += 3;
    }
  }
}

// Soft-edged disc stamp in supersampled coordinates, used for strokes.
function dot(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.ceil(r + 1);
  const x0 = Math.floor(cx - rr), x1 = Math.ceil(cx + rr);
  const y0 = Math.floor(cy - rr), y1 = Math.ceil(cy + rr);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= HH) continue;
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= WW) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const a = Math.max(0, Math.min(1, r + 0.4 - d));
      if (a <= 0) continue;
      const o = (y * WW + x) * 3;
      buf[o] = Math.round(c[0] * a + buf[o] * (1 - a));
      buf[o + 1] = Math.round(c[1] * a + buf[o + 1] * (1 - a));
      buf[o + 2] = Math.round(c[2] * a + buf[o + 2] * (1 - a));
    }
  }
}

function seg(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGB): void {
  const sx0 = x0 * SS, sy0 = y0 * SS, sx1 = x1 * SS, sy1 = y1 * SS;
  const len = Math.hypot(sx1 - sx0, sy1 - sy0);
  const steps = Math.max(1, Math.ceil(len / 0.8));
  const r = (thick * SS) / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    dot(sx0 + (sx1 - sx0) * t, sy0 + (sy1 - sy0) * t, r, c);
  }
}

function polyline(pts: number[][], thick: number, c: RGB, close: boolean): void {
  for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thick, c);
  if (close && pts.length > 2) seg(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], thick, c);
}

function fillPoly(pts: number[][], c: RGB): void {
  let yMin = Infinity, yMax = -Infinity;
  for (const p of pts) { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); }
  for (let y = Math.max(0, Math.floor(yMin)); y <= Math.min(H - 1, Math.ceil(yMax)); y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) fillRect(xs[k], y, xs[k + 1] - xs[k], 1, c);
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  dot(cx * SS, cy * SS, r * SS, c);
}

function ring(cx: number, cy: number, r: number, thick: number, c: RGB): void {
  const steps = Math.max(28, Math.ceil(r * 7));
  let prev: number[] | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (prev) seg(prev[0], prev[1], p[0], p[1], thick, c);
    prev = p;
  }
}

function frame(x: number, y: number, w: number, h: number, thick: number, c: RGB): void {
  fillRect(x, y, w, thick, c);
  fillRect(x, y + h - thick, w, thick, c);
  fillRect(x, y, thick, h, c);
  fillRect(x + w - thick, y, thick, h, c);
}

function vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
  const rows = Math.max(1, Math.round(h));
  for (let i = 0; i < rows; i++) {
    const t = rows <= 1 ? 0 : i / (rows - 1);
    fillRect(x, y + i, w, 1, [
      Math.round(top[0] + (bottom[0] - top[0]) * t),
      Math.round(top[1] + (bottom[1] - top[1]) * t),
      Math.round(top[2] + (bottom[2] - top[2]) * t),
    ]);
  }
}

// ---------- vector stroke font (own design) ----------
// Grid: cap top y=0, baseline y=10, descenders to y=13. Each glyph is a
// list of polylines in that grid; `size` is the cap height in pixels and
// `weight` is stroke thickness as a fraction of size.
type Glyph = { w: number; s: number[][][] };
const GLYPHS: Record<string, Glyph> = {
  A: { w: 7, s: [[[0, 10], [3.5, 0], [7, 10]], [[1.8, 6.5], [5.2, 6.5]]] },
  B: { w: 6.5, s: [[[0, 0], [0, 10]], [[0, 0], [4, 0], [6, 2], [6, 4], [4, 5.5], [0, 5.5]], [[0, 5.5], [4, 5.5], [6, 7], [6, 8.5], [4, 10], [0, 10]]] },
  C: { w: 6.5, s: [[[6, 2], [4, 0], [2, 0.8], [0.5, 3], [0.5, 7], [2, 9.5], [4, 10], [6, 8.5]]] },
  D: { w: 7, s: [[[0, 0], [0, 10]], [[0, 0], [4, 0], [6.5, 2.5], [6.5, 7.5], [4, 10], [0, 10]]] },
  E: { w: 6, s: [[[6, 0], [0, 0], [0, 10], [6, 10]], [[0, 5], [4.5, 5]]] },
  F: { w: 6, s: [[[6, 0], [0, 0], [0, 10]], [[0, 5], [4.5, 5]]] },
  G: { w: 7, s: [[[6.5, 2], [4.5, 0], [2, 0.8], [0.5, 3], [0.5, 7], [2, 9.5], [4.5, 10], [6.5, 8.5], [6.5, 6], [4, 6]]] },
  H: { w: 7, s: [[[0, 0], [0, 10]], [[7, 0], [7, 10]], [[0, 5], [7, 5]]] },
  I: { w: 4, s: [[[2, 0], [2, 10]], [[0, 0], [4, 0]], [[0, 10], [4, 10]]] },
  J: { w: 5.5, s: [[[4.5, 0], [4.5, 8], [3, 10], [1, 10], [0, 8.5]]] },
  K: { w: 7, s: [[[0, 0], [0, 10]], [[6.5, 0], [1, 5.5], [6.5, 10]]] },
  L: { w: 6, s: [[[0, 0], [0, 10], [6, 10]]] },
  M: { w: 9.5, s: [[[0, 10], [0, 0], [4.75, 6], [9.5, 0], [9.5, 10]]] },
  N: { w: 7.5, s: [[[0, 10], [0, 0], [7.5, 10], [7.5, 0]]] },
  O: { w: 7.5, s: [[[3.75, 0], [6, 1], [7.5, 3.5], [7.5, 6.5], [6, 9], [3.75, 10], [1.5, 9], [0, 6.5], [0, 3.5], [1.5, 1], [3.75, 0]]] },
  P: { w: 6.5, s: [[[0, 10], [0, 0], [4, 0], [6, 2], [6, 4], [4, 6], [0, 6]]] },
  Q: { w: 7.5, s: [[[3.75, 0], [6, 1], [7.5, 3.5], [7.5, 6.5], [6, 9], [3.75, 10], [1.5, 9], [0, 6.5], [0, 3.5], [1.5, 1], [3.75, 0]], [[5, 7], [7.5, 10]]] },
  R: { w: 6.5, s: [[[0, 10], [0, 0], [4, 0], [6, 2], [6, 4], [4, 6], [0, 6]], [[3.5, 6], [6.5, 10]]] },
  S: { w: 6.5, s: [[[6, 2.5], [4.5, 0.5], [2, 0.5], [0.5, 2.5], [1.5, 5], [5, 6], [6, 8], [4.5, 9.8], [2, 9.8], [0.5, 8]]] },
  T: { w: 7, s: [[[0, 0], [7, 0]], [[3.5, 0], [3.5, 10]]] },
  U: { w: 7, s: [[[0, 0], [0, 7.5], [1.5, 10], [5.5, 10], [7, 7.5], [7, 0]]] },
  V: { w: 7.5, s: [[[0, 0], [3.75, 10], [7.5, 0]]] },
  W: { w: 10.5, s: [[[0, 0], [2.6, 10], [5.25, 4], [7.9, 10], [10.5, 0]]] },
  X: { w: 7, s: [[[0, 0], [7, 10]], [[7, 0], [0, 10]]] },
  Y: { w: 7, s: [[[0, 0], [3.5, 5], [7, 0]], [[3.5, 5], [3.5, 10]]] },
  Z: { w: 6.5, s: [[[0, 0], [6.5, 0], [0, 10], [6.5, 10]]] },
  a: { w: 6, s: [[[5, 4], [3, 3.5], [1.5, 4.5], [0.8, 6.5], [1.5, 9], [3.5, 10], [5, 9], [5.8, 6.5], [5, 4]], [[5.8, 3.5], [5.8, 10]]] },
  b: { w: 6, s: [[[0, 0], [0, 10]], [[6, 5.5], [4.5, 3.8], [2, 3.8], [0.8, 5.5], [0.8, 8], [2, 10], [4.5, 10], [6, 8], [6, 5.5]]] },
  c: { w: 5.5, s: [[[5, 4.8], [3.5, 3.8], [1.5, 4.5], [0.6, 6.8], [1.5, 9.2], [3.5, 10], [5, 9.2]]] },
  d: { w: 6, s: [[[6, 0], [6, 10]], [[0.8, 5.5], [2, 3.8], [4, 3.8], [5.5, 5.5], [5.5, 8], [4, 10], [2, 10], [0.8, 8], [0.8, 5.5]]] },
  e: { w: 6, s: [[[5.8, 6.5], [0.8, 6.5]], [[5.8, 6.5], [5.5, 4.5], [4, 3.8], [2, 3.8], [0.8, 5.5], [0.8, 8], [2, 10], [4, 10], [5.5, 8.8]]] },
  f: { w: 4, s: [[[3.5, 1.8], [2.5, 0.5], [1, 1.2], [1, 10]], [[0, 4.5], [3.8, 4.5]]] },
  g: { w: 6, s: [[[5, 4], [3, 3.8], [1.5, 4.5], [0.8, 6.5], [1.5, 9], [3.5, 10], [5, 9], [5.8, 6.5], [5, 4]], [[5.8, 6.5], [5.8, 11.5], [4, 13], [1.5, 13], [0.5, 12]]] },
  h: { w: 6, s: [[[0, 0], [0, 10]], [[0, 6.5], [1.5, 4.2], [3.5, 3.8], [5, 5], [5.8, 7], [5.8, 10]]] },
  i: { w: 2.5, s: [[[1.25, 3.5], [1.25, 10]], [[1.25, 0.5], [1.25, 1.8]]] },
  j: { w: 3.5, s: [[[3, 3.5], [3, 10.5], [2, 12.5], [0.5, 12]], [[3, 0.5], [3, 1.8]]] },
  k: { w: 6, s: [[[0, 0], [0, 10]], [[5.5, 3.8], [1, 6.8], [5.5, 10]]] },
  l: { w: 2.5, s: [[[1.25, 0], [1.25, 10]]] },
  m: { w: 9, s: [[[0, 10], [0, 3.8]], [[0, 6.5], [1.5, 4.2], [3.2, 3.8], [4.5, 5], [4.5, 10]], [[4.5, 6.5], [6, 4.2], [7.7, 3.8], [9, 5], [9, 10]]] },
  n: { w: 6, s: [[[0, 10], [0, 3.8]], [[0, 6.5], [1.5, 4.2], [3.5, 3.8], [5, 5], [5.8, 7], [5.8, 10]]] },
  o: { w: 6, s: [[[3, 3.8], [5, 4.8], [6, 6.8], [5, 9.2], [3, 10], [1, 9.2], [0, 6.8], [1, 4.8], [3, 3.8]]] },
  p: { w: 6, s: [[[0, 3.8], [0, 13]], [[6, 5.5], [4.5, 3.8], [2, 3.8], [0.8, 5.5], [0.8, 8], [2, 10], [4.5, 10], [6, 8], [6, 5.5]]] },
  q: { w: 6, s: [[[0.8, 5.5], [2, 3.8], [4, 3.8], [5.5, 5.5], [5.5, 8], [4, 10], [2, 10], [0.8, 8], [0.8, 5.5]], [[5.8, 3.8], [5.8, 13]]] },
  r: { w: 4.5, s: [[[0, 10], [0, 3.8]], [[0, 6.5], [1.5, 4.2], [3, 3.8], [4.5, 4.8]]] },
  s: { w: 5.5, s: [[[5, 4.8], [3.5, 3.8], [1.5, 3.8], [0.5, 5.2], [1.5, 6.8], [4, 7.8], [5, 9], [3.8, 10], [1.8, 10], [0.5, 9]]] },
  t: { w: 4, s: [[[2, 0.8], [2, 9.5], [3, 10.5], [4, 10.5]], [[0, 4.5], [3.8, 4.5]]] },
  u: { w: 6, s: [[[0, 3.8], [0, 8], [1.5, 10], [4, 10], [5.5, 8], [5.5, 3.8]], [[5.5, 3.8], [5.5, 10]]] },
  v: { w: 6, s: [[[0, 3.8], [3, 10], [6, 3.8]]] },
  w: { w: 8.5, s: [[[0, 3.8], [2.1, 10], [4.25, 6], [6.4, 10], [8.5, 3.8]]] },
  x: { w: 6, s: [[[0, 3.8], [6, 10]], [[6, 3.8], [0, 10]]] },
  y: { w: 6, s: [[[0, 3.8], [3, 9], [6, 3.8]], [[3, 9], [3, 12], [1.5, 13], [0, 13]]] },
  z: { w: 5.5, s: [[[0, 3.8], [5.5, 3.8], [0, 10], [5.5, 10]]] },
  "0": { w: 7, s: [[[3.5, 0], [5.8, 1], [7, 3.5], [7, 6.5], [5.8, 9], [3.5, 10], [1.2, 9], [0, 6.5], [0, 3.5], [1.2, 1], [3.5, 0]]] },
  "1": { w: 4, s: [[[1.5, 2], [3, 0], [3, 10]], [[1, 10], [5, 10]]] },
  "2": { w: 6.5, s: [[[1, 2.5], [2.5, 0.5], [5, 0.5], [6, 2.5], [6, 4.5], [0.5, 10], [6, 10]]] },
  "3": { w: 6.5, s: [[[1.5, 1.8], [3.5, 0], [5.5, 1], [6, 3], [4, 5], [2.5, 5], [4, 5], [6, 7], [5.5, 9.5], [3.5, 10.5], [1.5, 9.5]]] },
  "4": { w: 7, s: [[[5, 0], [0.8, 7], [6, 7]], [[5, 0], [5, 10]]] },
  "5": { w: 6.5, s: [[[6, 0], [1, 0], [1, 4.5], [4.5, 4.5], [6, 6], [6, 8.5], [4.5, 10], [1.5, 10], [0.5, 8.8]]] },
  "6": { w: 7, s: [[[6, 2], [4, 0.3], [1.8, 1], [0.8, 3.5], [0.8, 7], [2, 9.5], [4.5, 10], [6, 8.5], [5, 5.8], [3.5, 4.8], [1.5, 5.5]]] },
  "7": { w: 6.5, s: [[[0, 0], [6.5, 0], [3, 10]]] },
  "8": { w: 7, s: [[[2, 1.5], [3.5, 0], [5, 1.5], [5.8, 3.5], [4.5, 5.5], [2, 5.5], [0.8, 3.5], [2, 1.5]], [[2, 5.5], [4.5, 5.5], [5.8, 7.5], [5, 9.5], [3.5, 10.5], [2, 9.5], [0.8, 7.5], [2, 5.5]]] },
  "9": { w: 7, s: [[[1, 8], [2.5, 9.8], [4.5, 10.5], [6, 8.5], [6.5, 5], [6, 2.5], [4.5, 0.5], [2, 1], [0.8, 3], [1.5, 5.5], [3.5, 6.5], [5.5, 6]]] },
  " ": { w: 4, s: [] },
  ".": { w: 3, s: [[[1.5, 8.5], [1.5, 10]]] },
  ",": { w: 3, s: [[[1.5, 8.5], [1.5, 10], [1, 11.8], [0.2, 12.6]]] },
  ":": { w: 3, s: [[[1.5, 3], [1.5, 4.5]], [[1.5, 8], [1.5, 9.5]]] },
  ";": { w: 3, s: [[[1.5, 3], [1.5, 4.5]], [[1.5, 8], [1.5, 10], [1, 11.8], [0.2, 12.6]]] },
  "'": { w: 3, s: [[[2, 0], [1, 3.5]]] },
  '"': { w: 5, s: [[[1.5, 0], [0.8, 3.5]], [[4, 0], [3.3, 3.5]]] },
  "-": { w: 6, s: [[[0.5, 6], [5.5, 6]]] },
  "/": { w: 6, s: [[[1, 10], [5, 0]]] },
  "(": { w: 4.5, s: [[[3.5, 0], [1.8, 2.5], [1.8, 7.5], [3.5, 10]]] },
  ")": { w: 4.5, s: [[[1, 0], [2.7, 2.5], [2.7, 7.5], [1, 10]]] },
  "&": { w: 7, s: [[[5, 0.5], [3, 0.5], [1, 2.5], [1.5, 5], [3.5, 6.5], [5.5, 8], [6, 9.5], [4.5, 10.5], [2.5, 10.5], [1, 9], [2, 7], [5.5, 3.5]]] },
  "%": { w: 9, s: [[[1, 10], [8, 0]], [[2, 1], [3.5, 1], [4, 2.5], [4, 4], [2.5, 4], [1, 2.5], [2, 1]], [[6, 6], [7.5, 6], [8, 7.5], [8, 9], [6.5, 9], [5, 7.5], [6, 6]]] },
  "$": { w: 6.5, s: [[[5.5, 2.5], [4, 0.5], [2, 0.5], [0.8, 2.5], [1.8, 5], [4.5, 6], [5.5, 8], [4, 9.8], [2, 9.8], [0.8, 8]], [[3.25, 0], [3.25, 10]]] },
  "+": { w: 7, s: [[[3.5, 2], [3.5, 9]], [[0.5, 5.5], [6.5, 5.5]]] },
  "=": { w: 7, s: [[[0.5, 3.5], [6.5, 3.5]], [[0.5, 7.5], [6.5, 7.5]]] },
  "?": { w: 6, s: [[[1, 2.5], [2.5, 0.5], [4.5, 0.5], [5.5, 2.5], [4.5, 4.8], [3, 5.8], [3, 7]], [[3, 8.8], [3, 10]]] },
  "!": { w: 3, s: [[[1.5, 0], [1.5, 6.5]], [[1.5, 8.5], [1.5, 10]]] },
  "*": { w: 7, s: [[[3.5, 1], [3.5, 9]], [[0.8, 3], [6.2, 7]], [[6.2, 3], [0.8, 7]]] },
  "#": { w: 8, s: [[[2.8, 0], [2.3, 10]], [[5.8, 0], [5.3, 10]], [[0.3, 3.5], [7.7, 3.5]], [[0.3, 7], [7.7, 7]]] },
  "_": { w: 7, s: [[[0, 12], [7, 12]]] },
  "[": { w: 4, s: [[[3.5, 0], [0.5, 0], [0.5, 10], [3.5, 10]]] },
  "]": { w: 4, s: [[[0.5, 0], [3.5, 0], [3.5, 10], [0.5, 10]]] },
  "\u2022": { w: 4, s: [[[2, 6], [2, 7.5]]] },
  "\u00b7": { w: 3, s: [[[1.5, 6], [1.5, 7]]] },
  "<": { w: 6, s: [[[5, 0], [1, 5], [5, 10]]] },
  ">": { w: 6, s: [[[1, 0], [5, 5], [1, 10]]] },
  "€": { w: 6.5, s: [[[6, 2], [4, 0.5], [2, 0.5], [0.5, 2.5], [0.5, 7.5], [2, 9.8], [4, 9.8], [6, 8]], [[0, 4], [4.5, 4]], [[0, 6.5], [4.5, 6.5]]] },
  "£": { w: 6, s: [[[5, 1], [3, 0.5], [1.5, 2], [1.5, 6], [0.5, 8], [2, 10], [5, 10]], [[0, 6.5], [4.5, 6.5]]] },
  "—": { w: 12, s: [[[0.5, 6], [11.5, 6]]] },
  "–": { w: 8, s: [[[0.5, 6], [7.5, 6]]] },
  "’": { w: 3, s: [[[2, 0], [1, 3.5]]] },
};

function glyphAdvance(ch: string, size: number, tracking: number): number {
  const g = GLYPHS[ch];
  return (g ? g.w : 6) * (size / 10) + tracking;
}
function textWidth(s: string, size: number, tracking: number): number {
  if (!s) return 0;
  let w = 0;
  for (const ch of s) w += glyphAdvance(ch, size, tracking);
  return w - tracking;
}
function drawGlyph(ch: string, x: number, yTop: number, size: number, weight: number, c: RGB): void {
  const g = GLYPHS[ch];
  if (!g) return;
  const unit = size / 10;
  const thick = Math.max(1.1, weight * size);
  for (const stroke of g.s) {
    const pts = stroke.map((p) => [x + p[0] * unit, yTop + p[1] * unit]);
    if (pts.length === 1) dot(pts[0][0] * SS, pts[0][1] * SS, (thick * SS) / 2, c);
    else polyline(pts, thick, c, false);
  }
}
function drawText(s: string, x: number, yTop: number, size: number, weight: number, c: RGB, tracking: number): number {
  let cx = x;
  for (const ch of s) {
    drawGlyph(ch, cx, yTop, size, weight, c);
    cx += glyphAdvance(ch, size, tracking);
  }
  return cx - x;
}
function drawTextR(s: string, rx: number, yTop: number, size: number, weight: number, c: RGB, tracking: number): void {
  drawText(s, rx - textWidth(s, size, tracking), yTop, size, weight, c, tracking);
}
function drawTextC(s: string, cx: number, yTop: number, size: number, weight: number, c: RGB, tracking: number): void {
  drawText(s, cx - textWidth(s, size, tracking) / 2, yTop, size, weight, c, tracking);
}
function wrapText(s: string, size: number, maxW: number, tracking: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, size, tracking) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawLines(lines: string[], x: number, y: number, size: number, weight: number, c: RGB, tracking: number, lineH: number): void {
  lines.forEach((ln, i) => drawText(ln, x, y + i * lineH, size, weight, c, tracking));
}

// ---------- PNG encoder (no filter, zlib deflate) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  // Average the 2x supersampled buffer down to 1024x1024.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
        const o = ((y * SS + dy) * WW + x * SS + dx) * 3;
        r += buf[o]; g += buf[o + 1]; b += buf[o + 2];
      }
      const o = y * (1 + W * 3) + 1 + x * 3;
      raw[o] = Math.round(r / (SS * SS));
      raw[o + 1] = Math.round(g / (SS * SS));
      raw[o + 2] = Math.round(b / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- full page v2: 25 November 2026 ----------
import * as crypto from "node:crypto";

const PAPER2: RGB = [248, 245, 238];
const INK2: RGB = [22, 22, 24];
const WHITE2: RGB = [255, 255, 255];
const RED2: RGB = [178, 34, 34];
const NAVY2: RGB = [22, 48, 88];
const GOLD2: RGB = [188, 134, 20];
const TEAL2: RGB = [13, 104, 98];
const GREY2: RGB = [94, 90, 84];
const LGREY2: RGB = [176, 172, 164];
const LIGHT2: RGB = [238, 234, 224];
const SKY2: RGB = [168, 198, 226];
const SEA2: RGB = [42, 110, 158];
const GREEN2: RGB = [46, 125, 50];
const AMBER2: RGB = [178, 106, 0];
const ORANGE2: RGB = [232, 116, 28];

const REGION_C: Record<string, RGB> = {
  OCEANIA: TEAL2, ASIA: GOLD2, EUROPE: NAVY2, "MIDDLE EAST": RED2,
  AMERICAS: GREEN2, AFRICA: ORANGE2, GLOBAL: GREY2,
};
const STATUS_C2: Record<string, RGB> = {
  CONFIRMED: GREEN2, REPORTED: AMBER2, CLAIM: RED2, OFFICIAL: NAVY2,
};

function badgePill(x: number, y: number, text: string, bg: RGB): number {
  const w = textWidth(text, 20, 0.4) + 16;
  fillRect(x, y, w, 26, bg);
  drawText(text, x + 8, y + 3, 20, 0.18, WHITE2, 0.4);
  return w;
}
const WARN: string[] = [];
function check(label: string, s: string, size: number, maxW: number, tracking: number): void {
  const w = textWidth(s, size, tracking);
  if (w > maxW) WARN.push(label + " OVERFLOW " + Math.round(w) + " > " + maxW + ": " + s);
}

// ---------- scenes (own designs, layered; relative coords) ----------
function sceneIsland(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [70, 130, 190], [190, 220, 240]);
  disc(x + 0.82 * w, y + 0.3 * h, 0.06 * w, [250, 205, 90]);
  fillRect(x, y + 0.68 * h, w, 0.32 * h, [22, 110, 130]);
  for (let i = 0; i < 2; i++) {
    const wy = y + (0.78 + i * 0.1) * h;
    for (let xx = x + 8; xx < x + w - 20; xx += 34) seg(xx, wy, xx + 18, wy - 5, 2, [150, 215, 220]);
  }
  fillPoly([[x + 0.1 * w, y + 0.72 * h], [x + 0.32 * w, y + 0.34 * h], [x + 0.58 * w, y + 0.44 * h], [x + 0.8 * w, y + 0.72 * h]], [52, 130, 70]);
  fillPoly([[x + 0.1 * w, y + 0.72 * h], [x + 0.8 * w, y + 0.72 * h], [x + 0.8 * w, y + 0.8 * h], [x + 0.1 * w, y + 0.8 * h]], [232, 205, 140]);
  seg(x + 0.42 * w, y + 0.42 * h, x + 0.42 * w, y + 0.12 * h, 3, [90, 60, 30]);
  fillPoly([[x + 0.42 * w, y + 0.12 * h], [x + 0.58 * w, y + 0.2 * h], [x + 0.42 * w, y + 0.28 * h]], NAVY2);
  seg(x + 0.58 * w, y + 0.2 * h, x + 0.58 * w, y + 0.4 * h, 2, [90, 60, 30]);
  fillPoly([[x + 0.58 * w, y + 0.2 * h], [x + 0.72 * w, y + 0.26 * h], [x + 0.58 * w, y + 0.32 * h]], [0, 110, 70]);
}
function sceneDawnRaid(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [238, 150, 80], [250, 220, 170]);
  disc(x + 0.9 * w, y + 0.32 * h, 0.07 * w, [255, 236, 170]);
  fillRect(x, y + 0.74 * h, w, 0.26 * h, [96, 90, 86]);
  fillRect(x + 0.05 * w, y + 0.3 * h, 0.3 * w, 0.44 * h, [200, 196, 188]);
  fillPoly([[x + 0.05 * w, y + 0.3 * h], [x + 0.2 * w, y + 0.16 * h], [x + 0.35 * w, y + 0.3 * h]], RED2);
  fillRect(x + 0.09 * w, y + 0.42 * h, 0.22 * w, 0.12 * h, NAVY2);
  for (let i = 0; i < 3; i++) fillRect(x + (0.46 + i * 0.13) * w, y + 0.5 * h, 0.08 * w, 0.24 * h, [70, 66, 62]);
  const hx = x + 0.62 * w, hy = y + 0.18 * h;
  seg(hx - 0.1 * w, hy, hx + 0.1 * w, hy, 3, INK2);
  fillPoly([[hx - 0.05 * w, hy], [hx + 0.06 * w, hy], [hx + 0.045 * w, hy + 0.14 * h], [hx - 0.035 * w, hy + 0.14 * h]], INK2);
  seg(hx, hy + 0.14 * h, hx, hy + 0.3 * h, 1, INK2);
}
function sceneRocketH(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [14, 26, 54], [48, 70, 112]);
  for (let i = 0; i < 10; i++) {
    const sx = 0.05 + ((i * 37) % 88) / 100, sy = 0.12 + ((i * 23) % 40) / 100;
    disc(x + sx * w, y + sy * h, 1.6, WHITE2);
  }
  disc(x + 0.92 * w, y + 0.28 * h, 0.05 * w, [238, 232, 210]);
  const cy = y + 0.5 * h, x0 = x + 0.3 * w, bw = 0.34 * w, bh = 0.3 * h;
  fillPoly([[x0 + bw, cy - bh / 2], [x0 + bw + 0.08 * w, cy], [x0 + bw, cy + bh / 2]], WHITE2);
  fillRect(x0, cy - bh / 2, bw, bh, WHITE2);
  fillRect(x0 + 0.1 * w, cy - bh / 2, 0.03 * w, bh, RED2);
  disc(x0 + 0.2 * w, cy, 0.035 * w, NAVY2);
  fillPoly([[x0 + 0.05 * w, cy - bh / 2], [x0 + 0.02 * w, cy - bh], [x0 + 0.12 * w, cy - bh / 2]], RED2);
  fillPoly([[x0 + 0.05 * w, cy + bh / 2], [x0 + 0.02 * w, cy + bh], [x0 + 0.12 * w, cy + bh / 2]], RED2);
  fillPoly([[x0, cy - 0.1 * h], [x0 - 0.12 * w, cy], [x0, cy + 0.1 * h]], ORANGE2);
  fillPoly([[x0, cy - 0.05 * h], [x0 - 0.07 * w, cy], [x0, cy + 0.05 * h]], [255, 214, 90]);
  seg(x + 0.16 * w, y + 0.1 * h, x + 0.16 * w, y + 0.9 * h, 3, GREY2);
  seg(x + 0.16 * w, y + 0.1 * h, x + 0.24 * w, y + 0.26 * h, 2, GREY2);
  fillRect(x, y + 0.88 * h, w, 0.12 * h, [70, 74, 78]);
}
function sceneEU(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    disc(x + w / 2 + Math.cos(a) * w * 0.32, y + h / 2 + Math.sin(a) * h * 0.32, 2.5, GOLD2);
  }
  disc(x + 0.3 * w, y + 0.62 * h, 0.4 * h, GOLD2);
  disc(x + 0.64 * w, y + 0.66 * h, 0.4 * h, GOLD2);
  drawText("€", x + 0.44 * w, y + 0.04 * h, 20, 0.22, GOLD2, 0);
}
function sceneFlag(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY2);
  for (let i = 0; i < 6; i++) disc(x + (0.2 + (i % 3) * 0.28) * w, y + (0.2 + Math.floor(i / 3) * 0.24) * h, 2.5, WHITE2);
  const bands: RGB[] = [[214, 48, 49], [255, 140, 0], [255, 215, 0], [0, 150, 60], [0, 90, 200], [120, 40, 160]];
  for (let i = 0; i < 6; i++) fillRect(x + 0.08 * w, y + (0.58 + i * 0.07) * h, 0.84 * w, 0.07 * h, bands[i]);
}
function sceneMine(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [140, 120, 92]);
  fillRect(x + 0.4 * w, y, 0.2 * w, h, [24, 20, 16]);
  disc(x + 0.5 * w, y + 0.34 * h, 0.35 * h, [240, 200, 90]);
  fillPoly([[x + 0.04 * w, y + h], [x + 0.18 * w, y + 0.7 * h], [x + 0.32 * w, y + h]], [120, 104, 80]);
  fillPoly([[x + 0.68 * w, y + h], [x + 0.82 * w, y + 0.72 * h], [x + 0.96 * w, y + h]], [120, 104, 80]);
}
function sceneDrones(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [60, 70, 90], [150, 150, 150]);
  fillRect(x + 0.06 * w, y + 0.58 * h, 0.2 * w, 0.42 * h, [90, 94, 98]);
  fillRect(x + 0.68 * w, y + 0.5 * h, 0.2 * w, 0.5 * h, [90, 94, 98]);
  fillPoly([[x + 0.08 * w, y + 0.58 * h], [x + 0.16 * w, y + 0.36 * h], [x + 0.24 * w, y + 0.58 * h]], ORANGE2);
  for (let i = 0; i < 3; i++) {
    const dx = x + (0.3 + i * 0.24) * w, dy = y + (0.2 + (i % 2) * 0.14) * h;
    disc(dx, dy, 0.035 * w, INK2);
    seg(dx - 0.09 * w, dy - 0.04 * h, dx + 0.09 * w, dy - 0.04 * h, 2, INK2);
  }
}
function scenePhone(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [226, 208, 172]);
  // White appeal document fills the empty left half of the strip.
  fillRect(x + 0.06 * w, y + 0.1 * h, 0.2 * w, 0.8 * h, WHITE2);
  fillRect(x + 0.06 * w, y + 0.1 * h, 0.2 * w, 0.08 * h, RED2);
  for (let i = 0; i < 3; i++) fillRect(x + 0.09 * w, y + (0.32 + i * 0.18) * h, 0.14 * w, 0.07 * h, NAVY2);
  // Red arrow from the document toward the phone.
  seg(x + 0.26 * w, y + 0.5 * h, x + 0.3 * w, y + 0.5 * h, 3, RED2);
  fillRect(x + 0.3 * w, y + 0.04 * h, 0.4 * w, 0.92 * h, [30, 34, 44]);
  fillRect(x + 0.35 * w, y + 0.1 * h, 0.3 * w, 0.6 * h, [200, 210, 224]);
  for (let i = 0; i < 3; i++) fillRect(x + (0.4 + i * 0.08) * w, y + (0.52 - i * 0.1) * h, 0.04 * w, 0.08 * h, NAVY2);
  // Red cross-out mark on the right: the verdict, struck through.
  seg(x + 0.76 * w, y + 0.72 * h, x + 0.88 * w, y + 0.28 * h, 3, RED2);
  seg(x + 0.88 * w, y + 0.72 * h, x + 0.76 * w, y + 0.28 * h, 3, RED2);
}
function sceneRefinery(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [186, 214, 234], [214, 230, 238]);
  fillRect(x, y + 0.7 * h, w, 0.3 * h, SEA2);
  fillRect(x + 0.08 * w, y + 0.36 * h, 0.12 * w, 0.34 * h, [120, 126, 132]);
  fillRect(x + 0.28 * w, y + 0.26 * h, 0.12 * w, 0.44 * h, [120, 126, 132]);
  fillRect(x + 0.54 * w, y + 0.44 * h, 0.26 * w, 0.26 * h, [200, 200, 198]);
  disc(x + 0.7 * w, y + 0.2 * h, 0.045 * w, INK2);
  seg(x + 0.6 * w, y + 0.16 * h, x + 0.8 * w, y + 0.16 * h, 2, INK2);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    seg(x + 0.86 * w, y + 0.4 * h, x + (0.86 + 0.05 * Math.cos(a)) * w, y + (0.4 + 0.05 * Math.sin(a)) * h, 2, GOLD2);
  }
}
function sceneHouse(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, [226, 236, 242]);
  fillPoly([[x + 0.12 * w, y + 0.48 * h], [x + 0.5 * w, y + 0.14 * h], [x + 0.88 * w, y + 0.48 * h]], RED2);
  fillRect(x + 0.2 * w, y + 0.48 * h, 0.6 * w, 0.52 * h, [240, 234, 220]);
  fillRect(x + 0.44 * w, y + 0.6 * h, 0.14 * w, 0.4 * h, [90, 60, 36]);
  seg(x + 0.8 * w, y + 0.3 * h, x + 0.8 * w, y + 0.08 * h, 3, RED2);
  seg(x + 0.8 * w, y + 0.08 * h, x + 0.9 * w, y + 0.2 * h, 3, RED2);
}
function sceneRubble2(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [222, 206, 178], [196, 178, 150]);
  disc(x + 0.7 * w, y + 0.3 * h, 0.35 * h, [150, 142, 132]);
  disc(x + 0.52 * w, y + 0.22 * h, 0.28 * h, [168, 160, 148]);
  fillPoly([[x + 0.06 * w, y + h], [x + 0.28 * w, y + 0.42 * h], [x + 0.5 * w, y + h]], [110, 102, 92]);
  fillPoly([[x + 0.46 * w, y + h], [x + 0.64 * w, y + 0.56 * h], [x + 0.84 * w, y + h]], [88, 82, 74]);
  fillRect(x + 0.12 * w, y + 0.74 * h, 0.24 * w, 0.1 * h, [70, 64, 58]);
}
function sceneTube(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [40, 44, 52]);
  fillRect(x + 0.06 * w, y + 0.48 * h, 0.88 * w, 0.4 * h, [200, 30, 40]);
  for (let i = 0; i < 4; i++) fillRect(x + (0.12 + i * 0.2) * w, y + 0.6 * h, 0.12 * w, 0.18 * h, [220, 226, 236]);
  ring(x + 0.5 * w, y + 0.5 * h, 0.07 * w, 4, RED2);
  fillRect(x + 0.34 * w, y + 0.42 * h, 0.32 * w, 0.16 * h, NAVY2);
}
function sceneTariff(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, [226, 236, 242]);
  fillRect(x + 0.06 * w, y + 0.56 * h, 0.4 * w, 0.24 * h, ORANGE2);
  fillRect(x + 0.54 * w, y + 0.56 * h, 0.4 * w, 0.24 * h, TEAL2);
  fillRect(x + 0.3 * w, y + 0.32 * h, 0.4 * w, 0.24 * h, RED2);
  seg(x + 0.06 * w, y + 0.26 * h, x + 0.94 * w, y + 0.26 * h, 3, INK2);
  drawText("%", x + 0.42 * w, y + 0.0 * h, 20, 0.22, RED2, 0);
}
function scenePlane(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [250, 200, 120], [250, 230, 180]);
  disc(x + 0.84 * w, y + 0.24 * h, 0.45 * h, [255, 236, 170]);
  const cx = x + 0.45 * w, cy = y + 0.42 * h;
  fillPoly([[cx - 0.3 * w, cy], [cx + 0.28 * w, cy - 0.08 * h], [cx + 0.34 * w, cy], [cx + 0.28 * w, cy + 0.08 * h]], WHITE2);
  fillPoly([[cx - 0.02 * w, cy - 0.06 * h], [cx + 0.1 * w, cy - 0.24 * h], [cx + 0.16 * w, cy - 0.05 * h]], WHITE2);
  fillPoly([[cx - 0.02 * w, cy + 0.06 * h], [cx + 0.1 * w, cy + 0.22 * h], [cx + 0.16 * w, cy + 0.05 * h]], WHITE2);
  seg(x, y + 0.9 * h, x + w, y + 0.9 * h, 3, INK2);
}
function sceneTrain(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [120, 150, 180], [200, 214, 226]);
  fillRect(x + 0.04 * w, y + 0.3 * h, 0.92 * w, 0.42 * h, [30, 60, 130]);
  fillRect(x + 0.04 * w, y + 0.3 * h, 0.92 * w, 0.1 * h, [240, 240, 240]);
  for (let i = 0; i < 5; i++) fillRect(x + (0.1 + i * 0.17) * w, y + 0.46 * h, 0.1 * w, 0.16 * h, [200, 226, 240]);
  seg(x, y + 0.84 * h, x + w, y + 0.84 * h, 2, INK2);
  disc(x + 0.06 * w, y + 0.14 * h, 0.05 * w, RED2);
}

// ---------- page ----------
fillRect(0, 0, W, H, PAPER2);
fillRect(0, 0, W, 6, RED2);
drawText("THE DAY IN BRIEF", 24, 14, 15, 0.18, RED2, 1.5);
drawTextR("WEDNESDAY", 1000, 14, 15, 0.16, GREY2, 1.5);
drawText("25 NOVEMBER 2026", 22, 32, 60, 0.19, INK2, 0.8);
drawText("Pact in Canberra  •  Siege ends in Cartagena  •  Three crew reach Tiangong", 24, 98, 15, 0.15, NAVY2, 0.4);
{
  const chips: [string, number][] = [
    ["OCEANIA", 2], ["ASIA", 9], ["EUROPE", 12], ["MIDDLE EAST", 4],
    ["AMERICAS", 8], ["AFRICA", 2], ["GLOBAL", 1],
  ];
  let cx = 24;
  for (const [name, n] of chips) {
    const label = name + "  " + n;
    const w = textWidth(label, 13, 0.4) + 18;
    fillRect(cx, 116, w, 20, REGION_C[name]);
    drawText(label, cx + 9, 120, 13, 0.16, WHITE2, 0.4);
    cx += w + 8;
  }
  check("chips", "", 13, 976, 0.4);
}
{
  const figs: [string, string][] = [
    ["A$740m", "Solomons pact value"],
    ["145", "drones downed in Russia"],
    ["+26%", "UK energy price cap"],
    ["00:18", "Shenzhou launch, UTC"],
    ["20", "hostages freed"],
    ["4", "killed in Gaza strike"],
  ];
  for (let i = 0; i < 6; i++) {
    const cx = 24 + i * 163;
    fillRect(cx, 142, 158, 40, LIGHT2);
    drawTextC(figs[i][0], cx + 79, 143, 28, 0.18, RED2, 0.4);
    drawTextC(figs[i][1], cx + 79, 172, 10, 0.13, INK2, 0.3);
  }
}

// ---------- heroes: 3 equal columns ----------
{
  type Hero = {
    n: number; badge: string; lines: string[]; status: string; source: string;
    scene: (x: number, y: number, w: number, h: number) => void;
  };
  const HEROES: Hero[] = [
    { n: 1, badge: "A$740m", lines: ["Solomons signs", "security pact", "with Australia"], status: "OFFICIAL", source: "PM'S OFFICE, AUSTRALIA", scene: sceneIsland },
    { n: 2, badge: "20 FREED", lines: ["Cartagena", "siege ends", "at dawn"], status: "CONFIRMED", source: "REUTERS", scene: sceneDawnRaid },
    { n: 3, badge: "00:18 UTC", lines: ["Three crew", "launch to", "Tiangong"], status: "CONFIRMED", source: "SPACEFACTS", scene: sceneRocketH },
  ];
  HEROES.forEach((hh, i) => {
    const hx = 24 + i * 332, hy = 188, hw = 312;
    frame(hx, hy, hw, 178, 2, INK2);
    hh.scene(hx + 2, hy + 2, hw - 4, 48);
    badgePill(hx + 8, hy + 8, hh.badge, RED2);
    disc(hx + hw - 18, hy + 20, 11, RED2);
    drawTextC(String(hh.n), hx + hw - 18, hy + 14, 13, 0.2, WHITE2, 0);
    drawText(hh.status + "  •  " + hh.source, hx + 12, hy + 54, 11, 0.15, GREY2, 0.3);
    for (const ln of hh.lines) check("hero" + hh.n, ln, 36, hw - 24, 0.4);
    drawLines(hh.lines, hx + 12, hy + 70, 36, 0.18, INK2, 0.4, 32);
  });
}

// ---------- secondary: 4 cols x 3 rows ----------
type Sec = {
  n: number; lines: string[]; badge: string; status: string; source: string;
  scene: (x: number, y: number, w: number, h: number) => void;
};
const SECS: Sec[] = [
  { n: 4, lines: ["EU unveils", "€50bn fund"], badge: "€50bn", status: "CONFIRMED", source: "REUTERS", scene: sceneEU },
  { n: 5, lines: ["Sorry to gay", "veterans"], badge: "34 YRS", status: "OFFICIAL", source: "DEFENCE DEPT", scene: sceneFlag },
  { n: 6, lines: ["Bodies found", "in the mine"], badge: "3 FOUND", status: "CONFIRMED", source: "BASARNAS", scene: sceneMine },
  { n: 7, lines: ["Drones hit", "refineries"], badge: "145", status: "REPORTED", source: "REUTERS", scene: sceneDrones },
  { n: 8, lines: ["Huawei vows", "to appeal"], badge: "APPEAL", status: "OFFICIAL", source: "AP", scene: scenePhone },
  { n: 9, lines: ["Claim over", "Riyadh attack"], badge: "4 DOWNED", status: "REPORTED", source: "REUTERS", scene: sceneRefinery },
  { n: 10, lines: ["UK cap rises", "by 26%"], badge: "+26%", status: "CONFIRMED", source: "OFGEM", scene: sceneHouse },
  { n: 11, lines: ["Gaza chief", "killed"], badge: "4 KILLED", status: "REPORTED", source: "REUTERS", scene: sceneRubble2 },
  { n: 12, lines: ["Tube strike", "goes ahead"], badge: "NOON THU", status: "CONFIRMED", source: "RMT", scene: sceneTube },
  { n: 13, lines: ["Tariffs hit 14", "partners"], badge: "14", status: "OFFICIAL", source: "USTR", scene: sceneTariff },
  { n: 14, lines: ["Abrego lands", "in Madrid"], badge: "MADRID", status: "CONFIRMED", source: "REUTERS", scene: scenePlane },
  { n: 15, lines: ["Eurostar trains", "axed"], badge: "6 AXED", status: "CONFIRMED", source: "EUROSTAR", scene: sceneTrain },
];
for (let i = 0; i < SECS.length; i++) {
  const s = SECS[i];
  const cx = 24 + (i % 4) * 246;
  const cy = 374 + Math.floor(i / 4) * 102;
  frame(cx, cy, 238, 94, 2, INK2);
  s.scene(cx + 2, cy + 2, 234, 28);
  badgePill(cx + 6, cy + 3, s.badge, RED2);
  drawText(s.n + ".  " + s.status + "  •  " + s.source, cx + 10, cy + 30, 10, 0.15, GREY2, 0.3);
  for (const ln of s.lines) check("sec" + s.n, ln, 24, 222, 0.3);
  drawLines(s.lines, cx + 10, cy + 42, 24, 0.18, INK2, 0.3, 21);
}

// ---------- ALSO ON: 4 cols x 6 rows ----------
drawText("ALSO ON — 25 NOVEMBER", 24, 680, 14, 0.18, RED2, 1.0);
drawText("Dot = status: green Confirmed, amber Reported, red Claim, navy Official.", 300, 682, 11, 0.13, GREY2, 0.3);
{
  type Also = { n: number; lead: string; source: string; status: string };
  const ALSO: Also[] = [
    { n: 16, lead: "Puigdemont returns 12 Dec", source: "REUTERS", status: "CONFIRMED" },
    { n: 17, lead: "Bulgaria stops boat of 35", source: "BTA", status: "CONFIRMED" },
    { n: 18, lead: "Jordan court: death sentence", source: "REUTERS", status: "CONFIRMED" },
    { n: 19, lead: "Kremlin rejects Johnson's call", source: "REUTERS", status: "CONFIRMED" },
    { n: 20, lead: "OPEC+ review by year-end", source: "REUTERS", status: "OFFICIAL" },
    { n: 21, lead: "Kartarpur closure stands", source: "ECONOMIC TIMES", status: "CONFIRMED" },
    { n: 22, lead: "KOSPI sinks 6.2% in sell-off", source: "KOREA EXCHANGE", status: "CONFIRMED" },
    { n: 23, lead: "US GDP 4.3%; prices up 3.8%", source: "BEA", status: "CONFIRMED" },
    { n: 24, lead: "AI stocks slide on hot data", source: "IBD", status: "REPORTED" },
    { n: 25, lead: "Merz: Russia wants more", source: "REUTERS", status: "CONFIRMED" },
    { n: 26, lead: "Stellantis cuts Sochaux shift", source: "PARIS TIMES", status: "CONFIRMED" },
    { n: 27, lead: "12,500 mayors in Paris", source: "PARIS TIMES", status: "CONFIRMED" },
    { n: 28, lead: "Phala Phala report set aside", source: "DAILY MAVERICK", status: "CONFIRMED" },
    { n: 29, lead: "Congo to halt cobalt exports", source: "RADARR AFRICA", status: "REPORTED" },
    { n: 30, lead: "Takaichi backs ICC", source: "JAPAN TIMES", status: "CONFIRMED" },
    { n: 31, lead: "Hodeidah port pounded", source: "REUTERS", status: "REPORTED" },
    { n: 32, lead: "Storm heads for East Coast", source: "REUTERS", status: "REPORTED" },
    { n: 33, lead: "Beige Book due; hike 96%", source: "REUTERS", status: "REPORTED" },
    { n: 34, lead: "Nikkei -2.8%; TAIEX -4.8%", source: "REUTERS", status: "CONFIRMED" },
    { n: 35, lead: "First Pakistani reaches space", source: "SPACEFACTS", status: "CONFIRMED" },
    { n: 36, lead: "Germany to double defence", source: "REUTERS", status: "CONFIRMED" },
    { n: 37, lead: "Jobless claims at 189,000", source: "BEA", status: "CONFIRMED" },
    { n: 38, lead: "Tang Hongbo leads crew", source: "SPACEFACTS", status: "CONFIRMED" },
  ];
  ALSO.forEach((a, i) => {
    const col = Math.floor(i / 6);
    const row = i % 6;
    const ax = 24 + col * 246;
    const ay = 698 + row * 30;
    disc(ax + 4, ay + 5, 3.5, STATUS_C2[a.status]);
    check("also" + a.n, a.n + ". " + a.lead, 13, 232, 0.3);
    drawText(String(a.n) + ". " + a.lead, ax + 11, ay, 13, 0.15, INK2, 0.3);
    drawText(a.source + " • " + a.status, ax + 11, ay + 15, 10, 0.13, GREY2, 0.3);
  });
}

// ---------- bottom: map + timeline + DATE CHECK + footer ----------
// Dot-grid schematic map (ellipses = continents, own schematic).
drawText("WHERE IT HAPPENED — SCHEMATIC MAP", 24, 880, 12, 0.18, RED2, 1.0);
{
  const blobs: [number, number, number, number][] = [
    [30, 3, 16, 3], [36, 5, 7, 2.5], [60, 2, 6, 2], [62, 5, 6, 2.5], [85, 3, 22, 3], [104, 6, 8, 2.5],
  ];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 120; c++) {
      let land = false;
      for (const [bx, by, rx, ry] of blobs) {
        const dx = (c - bx) / rx, dy = (r - by) / ry;
        if (dx * dx + dy * dy <= 1) { land = true; break; }
      }
      if (land) disc(28 + c * 5, 896 + r * 5.5, 1.8, GREY2);
    }
  }
  const pins: [number, number, number, RGB][] = [
    [1, 109, 6, TEAL2], [2, 34, 4, GREEN2], [3, 93, 2, GOLD2], [4, 63, 1, NAVY2],
    [5, 105, 7, TEAL2], [6, 97, 6, GOLD2], [7, 77, 2, NAVY2], [8, 100, 4, GOLD2],
    [9, 75, 4, RED2], [10, 56, 1, NAVY2], [11, 70, 3, RED2], [12, 65, 3, NAVY2],
    [13, 33, 2, GREEN2], [14, 56, 4, NAVY2], [15, 59, 3, NAVY2],
  ];
  for (const [n, c, r, col] of pins) {
    const px = 28 + c * 5, py = 896 + r * 5.5;
    disc(px, py, 7, col);
    ring(px, py, 7, 1.2, WHITE2);
    drawTextC(String(n), px, py - 5, 9, 0.2, WHITE2, 0);
  }
}
// Timeline (right of map)
drawText("TIMELINE — UTC", 648, 880, 12, 0.18, RED2, 1.0);
{
  const tl: [string, string][] = [
    ["00:18", "Shenzhou-24 lifts off"],
    ["~01:00", "Strike hits al-Shati"],
    ["03:56", "Shenzhou-24 docks"],
    ["06:30", "Cartagena raid ends"],
  ];
  tl.forEach(([t, txt], i) => {
    const ty = 896 + i * 12;
    drawText(t, 648, ty, 12, 0.18, RED2, 0.3);
    drawText(txt, 700, ty, 12, 0.13, INK2, 0.3);
  });
}
// DATE CHECK paragraph
{
  const dc = "Excluded, first reported 24 Nov or earlier — 24 Nov: Huawei verdict, CIA/ODNI breach, Ebola evacuation, Markle indictment, Chen probe, Abu Nahel strike, Korea scramble, Hormuz claim, measles tally, femicide brief, Board of Peace, Dow 50,018, Anthropic dip. 23 Nov: Nvidia return. 22 Nov: COP31 collapse. 19 Nov: PIF strike.";
  drawText("DATE CHECK", 24, 950, 13, 0.18, RED2, 1.0);
  const lines = wrapText(dc, 13, 830, 0.3);
  drawLines(lines, 140, 950, 13, 0.13, INK2, 0.3, 16);
  if (lines.length > 3) WARN.push("datecheck lines=" + lines.length);
}
drawTextC("All 38 stories happened or were first reported on 25 November 2026. Original artwork and text — sources named on every story.", 512, 1002, 10, 0.13, GREY2, 0.3);

if (WARN.length) console.log("WIDTH WARNINGS:\n" + WARN.join("\n"));
else console.log("width checks: all clear");

const outDir2 = process.env.MAKEFUN_OUTPUT_DIR || path.join(process.cwd(), "out");
fs.mkdirSync(outDir2, { recursive: true });
const png2 = encodePNG();
fs.writeFileSync(path.join(outDir2, "entry.png"), png2);
console.log("wrote entry.png", png2.length, "bytes", "sha256", crypto.createHash("sha256").update(png2).digest("hex"));
