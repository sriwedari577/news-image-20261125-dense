// News image for Wednesday 25 November 2026.
// Draws a 1024x1024 PNG with a hand-rolled encoder and bitmap font.
// Node 22, standard library only, no network, deterministic output.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

function px(x: number, y: number, c: number[]): void {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, c);
}
function border(x: number, y: number, w: number, h: number, t: number, c: number[]): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function hline(x: number, y: number, w: number, c: number[]): void { rect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: number[]): void { rect(x, y, 1, h, c); }
function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: number[], fill: boolean): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (fill ? d <= r : Math.abs(d - r) < 0.9) px(cx + x, cy + y, c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
    const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
    const cc = 1 - a - b;
    if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
  }
}

// ---- 5x7 bitmap font (uppercase only; text is uppercased before drawing) ----
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
};
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: number[]): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
}
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (textWidth(test, scale) <= maxW || cur === "") cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, scale: number, maxW: number, c: number[], maxLines: number): number {
  const lines = wrap(s, scale, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(x, y + i * 9 * scale, ln, scale, c));
  return lines.length;
}

// ---- palette ----
const PAPER = [247, 243, 232];
const INK = [20, 20, 20];
const WHITE = [255, 255, 255];
const RED = [178, 34, 34];
const BLUE = [27, 58, 110];
const TEAL = [0, 105, 100];
const GOLD = [196, 141, 0];
const GREY = [90, 90, 86];
const LIGHT = [232, 226, 208];
const NAVY = [16, 32, 64];

// ---- icons (drawn with primitives, in a square box) ----
function icon(kind: string, x: number, y: number, s: number, fg: number[], bg: number[]): void {
  rect(x, y, s, s, bg);
  const cx = x + s / 2, cy = y + s / 2, u = s / 32;
  switch (kind) {
    case "rocket": {
      tri(cx, y + 3 * u, cx - 7 * u, y + 16 * u, cx + 7 * u, y + 16 * u, fg);
      rect(cx - 6 * u, y + 14 * u, 12 * u, 10 * u, fg);
      circle(cx, cy - u, 3 * u, bg, true);
      tri(cx - 6 * u, y + 20 * u, cx - 11 * u, y + 28 * u, cx - 4 * u, y + 24 * u, fg);
      tri(cx + 6 * u, y + 20 * u, cx + 11 * u, y + 28 * u, cx + 4 * u, y + 24 * u, fg);
      tri(cx - 3 * u, y + 24 * u, cx + 3 * u, y + 24 * u, cx, y + 31 * u, [255, 140, 0]);
      break;
    }
    case "port": {
      rect(x + 4 * u, y + 21 * u, 24 * u, 5 * u, fg);
      tri(x + 28 * u, y + 21 * u, x + 28 * u, y + 26 * u, x + 23 * u, y + 26 * u, fg);
      rect(x + 6 * u, y + 15 * u, 5 * u, 6 * u, fg);
      rect(x + 12 * u, y + 15 * u, 5 * u, 6 * u, fg);
      rect(x + 6 * u, y + 9 * u, 5 * u, 6 * u, [255, 190, 0]);
      rect(x + 23 * u, y + 4 * u, 3 * u, 17 * u, fg);
      rect(x + 18 * u, y + 4 * u, 11 * u, 3 * u, fg);
      line(x + 19 * u, y + 7 * u, x + 19 * u, y + 12 * u, fg);
      rect(x + 17 * u, y + 12 * u, 4 * u, 3 * u, fg);
      rect(x + 3 * u, y + 28 * u, 26 * u, 2 * u, [255, 255, 255]);
      break;
    }
    case "chart": {
      line(x + 5 * u, y + 26 * u, x + 27 * u, y + 26 * u, fg);
      line(x + 5 * u, y + 5 * u, x + 5 * u, y + 26 * u, fg);
      line(x + 7 * u, y + 10 * u, x + 14 * u, y + 16 * u, [178, 34, 34]);
      line(x + 14 * u, y + 16 * u, x + 20 * u, y + 13 * u, [178, 34, 34]);
      line(x + 20 * u, y + 13 * u, x + 27 * u, y + 22 * u, [178, 34, 34]);
      tri(x + 27 * u, y + 22 * u, x + 22 * u, y + 21 * u, x + 26 * u, y + 26 * u, [178, 34, 34]);
      break;
    }
    case "ship": {
      rect(x + 6 * u, y + 16 * u, 20 * u, 6 * u, fg);
      tri(x + 6 * u, y + 22 * u, x + 26 * u, y + 22 * u, x + 21 * u, y + 28 * u, fg);
      rect(x + 13 * u, y + 7 * u, 3 * u, 9 * u, fg);
      rect(x + 16 * u, y + 9 * u, 7 * u, 5 * u, fg);
      rect(x + 4 * u, y + 24 * u, 24 * u, 2 * u, [70, 130, 180]);
      break;
    }
    case "blast": {
      circle(cx, cy, 5 * u, fg, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        line(cx, cy, Math.round(cx + Math.cos(a) * 13 * u), Math.round(cy + Math.sin(a) * 13 * u), fg);
      }
      break;
    }
    case "jet": {
      tri(cx, y + 3 * u, cx - 4 * u, y + 18 * u, cx + 4 * u, y + 18 * u, fg);
      tri(cx - 4 * u, y + 14 * u, cx - 14 * u, y + 22 * u, cx - 3 * u, y + 19 * u, fg);
      tri(cx + 4 * u, y + 14 * u, cx + 14 * u, y + 22 * u, cx + 3 * u, y + 19 * u, fg);
      rect(cx - 2 * u, y + 18 * u, 4 * u, 8 * u, fg);
      break;
    }
    case "lock": {
      rect(x + 8 * u, y + 13 * u, 16 * u, 13 * u, fg);
      circle(cx, cy + 3 * u, 3 * u, bg, true);
      line(cx, cy + 3 * u, cx, cy + 8 * u, bg);
      rect(x + 10 * u, y + 6 * u, 12 * u, 8 * u, fg);
      rect(x + 13 * u, y + 9 * u, 6 * u, 5 * u, bg);
      break;
    }
    case "gavel": {
      line(x + 6 * u, y + 26 * u, x + 26 * u, y + 26 * u, fg);
      line(x + 8 * u, y + 8 * u, x + 22 * u, y + 20 * u, fg);
      rect(x + 16 * u, y + 4 * u, 9 * u, 7 * u, fg);
      break;
    }
    case "med": {
      rect(cx - 3 * u, y + 5 * u, 6 * u, 22 * u, fg);
      rect(x + 5 * u, cy - 3 * u, 22 * u, 6 * u, fg);
      break;
    }
    case "flame": {
      tri(cx, y + 4 * u, cx - 8 * u, y + 18 * u, cx + 8 * u, y + 18 * u, fg);
      tri(cx - 6 * u, y + 16 * u, cx + 6 * u, y + 16 * u, cx, y + 28 * u, [255, 140, 0]);
      break;
    }
    case "globe": {
      circle(cx, cy, 11 * u, fg, false);
      line(cx - 11 * u, cy, cx + 11 * u, cy, fg);
      line(cx, cy - 11 * u, cx, cy + 11 * u, fg);
      break;
    }
    case "flag": {
      line(x + 8 * u, y + 5 * u, x + 8 * u, y + 27 * u, fg);
      tri(x + 8 * u, y + 5 * u, x + 25 * u, y + 10 * u, x + 8 * u, y + 15 * u, [178, 34, 34]);
      break;
    }
    default: {
      circle(cx, cy, 9 * u, fg, false);
      circle(cx, cy, 3 * u, fg, true);
    }
  }
}
function tag(x: number, y: number, label: string, c: number[]): void {
  const w = textWidth(label, 2) + 12;
  rect(x, y, w, 18, c);
  drawText(x + 6, y + 2, label, 2, WHITE);
}

// ---- background ----
rect(0, 0, W, H, PAPER);

// ---- masthead ----
rect(0, 0, W, 118, INK);
drawText(24, 12, "THE WORLD IN ONE DAY  |  36 STORIES  |  ONE DATE", 2, [220, 200, 150]);
drawText(24, 36, "WEDNESDAY 25 NOVEMBER 2026", 4, WHITE);
drawText(24, 86, "HAPPENED OR FIRST REPORTED 25 NOV 2026", 2, WHITE);
// DATE CHECK box
rect(758, 12, 242, 94, WHITE);
border(758, 12, 242, 94, 3, RED);
drawText(774, 20, "DATE CHECK", 2, RED);
drawText(774, 42, "WED 25 NOV", 3, INK);
drawText(774, 74, "2026  -  VERIFIED", 2, INK);

// ---- UTC timeline strip ----
rect(24, 124, 976, 36, LIGHT);
border(24, 124, 976, 36, 2, INK);
const timeline: Array<[string, string]> = [
  ["00:18 UTC", "SHENZHOU-24 LAUNCH"],
  ["02:08 UTC", "KOREA SCRAMBLE"],
  ["MORNING", "ASIA MARKETS FALL"],
  ["WEDNESDAY", "HOUTHIS THREATEN"],
];
timeline.forEach(([t, s], i) => {
  const x = 24 + i * 244;
  drawText(x + 10, 129, t, 2, RED);
  drawText(x + 10, 145, s, 2, INK);
  if (i > 0) vline(x, 126, 32, INK);
});

// ---- main stories ----
type Main = { icon: string; bg: number[]; fg: number[]; tagLabel: string; tagC: number[]; head: string[]; deck: string };
const mains: Main[] = [
  {
    icon: "rocket", bg: NAVY, fg: WHITE, tagLabel: "CONFIRMED", tagC: TEAL,
    head: ["SHENZHOU-24", "LIFTS OFF"],
    deck: "FIRST PAKISTANI IN ORBIT, FIRST FOREIGNER ON TIANGONG.",
  },
  {
    icon: "port", bg: RED, fg: WHITE, tagLabel: "CONFIRMED", tagC: TEAL,
    head: ["HOUTHIS THREATEN", "JEDDAH PORTS"],
    deck: "IF HODEIDAH IS HIT, PORTS TARGETED. EVACUATE AT ONCE.",
  },
  {
    icon: "chart", bg: GOLD, fg: INK, tagLabel: "CONFIRMED", tagC: TEAL,
    head: ["ASIA STOCKS", "TUMBLE ON TARIFF", "THREAT"],
    deck: "KOREA -5.3%, TAIWAN -5.1%, NIKKEI -2.9% ON TARIFF FEARS.",
  },
];
mains.forEach((m, i) => {
  const x = 24 + i * 328;
  const y = 168;
  rect(x, y, 320, 250, WHITE);
  border(x, y, 320, 250, 2, INK);
  icon(m.icon, x + 12, y + 10, 72, m.fg, m.bg);
  tag(x + 96, y + 14, m.tagLabel, m.tagC);
  drawText(x + 96, y + 42, "LEAD STORY " + (i + 1), 2, GREY);
  m.head.forEach((ln, j) => drawText(x + 12, y + 92 + j * 30, ln, 3, INK));
  const dy = y + 92 + m.head.length * 30 + 4;
  drawWrapped(x + 12, dy, m.deck, 2, 296, INK, 3);
});

// ---- cards ----
type Card = { icon: string; bg: number[]; fg: number[]; tagLabel: string; tagC: number[]; head: string; deck: string };
const cards: Card[] = [
  { icon: "ship", bg: BLUE, fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "RUSSIA ACCUSES UKRAINE OF 'TERRORISM' AT SEA", deck: "BALTIC AND LIBYA STRIKES" },
  { icon: "blast", bg: RED, fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "ODESA STRIKE KILLS TWO", deck: "THREE HURT, INCLUDING A CHILD, GOVERNOR SAYS." },
  { icon: "blast", bg: [90, 40, 40], fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "GAZA STRIKE KILLS HAMAS SECURITY CHIEF", deck: "ABU NAHEL KILLED, 7 DEAD" },
  { icon: "flame", bg: GOLD, fg: INK, tagLabel: "CLAIM", tagC: RED, head: "IRAN TANKER MINE CLAIMS UNVERIFIED", deck: "IRGC CLAIM. NO PROOF." },
  { icon: "jet", bg: TEAL, fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "KOREA JETS SCRAMBLE OVER RUSSIAN PLANES", deck: "NO AIRSPACE VIOLATION." },
  { icon: "lock", bg: NAVY, fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "CIA / ODNI HACK REPORTED", deck: "UNCLASSIFIED SYSTEM HIT. NO CLASSIFIED DATA." },
  { icon: "gavel", bg: BLUE, fg: WHITE, tagLabel: "CONFIRMED", tagC: TEAL, head: "HUAWEI GUILTY ON 10 OF 12 COUNTS", deck: "FRAUD AND TRADE SECRETS." },
  { icon: "med", bg: TEAL, fg: WHITE, tagLabel: "CONFIRMED", tagC: TEAL, head: "EBOLA TEAMS EVACUATED IN CONGO", deck: "3 DAYS SHELTERED: ITURI" },
  { icon: "chart", bg: RED, fg: WHITE, tagLabel: "REPORTED", tagC: GREY, head: "MEASLES TALLY NEARS 6,000 IN US", deck: "14 DEATHS REPORTED." },
];
cards.forEach((c, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = 24 + col * 328;
  const y = 426 + row * 112;
  rect(x, y, 320, 106, WHITE);
  border(x, y, 320, 106, 2, INK);
  rect(x, y, 6, 106, c.bg);
  icon(c.icon, x + 14, y + 10, 30, c.fg, c.bg);
  tag(x + 52, y + 10, c.tagLabel, c.tagC);
  const hl = wrap(c.head, 2, 292);
  drawWrapped(x + 14, y + 48, c.head, 2, 292, INK, 2);
  const deckLines = hl.length > 1 ? 1 : 2;
  drawWrapped(x + 14, y + 48 + hl.length * 18, c.deck, 2, 292, GREY, deckLines);
});

// ---- ALSO ON list ----
drawText(24, 764, "ALSO ON 25 NOVEMBER", 3, INK);
hline(24, 790, 976, 3);
const also: Array<[string, string]> = [
  ["13", "PUTIN VOWS RETALIATION ON OIL"],
  ["14", "ZAPORIZHZHIA: 2 DEAD, 44 WOUNDED"],
  ["15", "NORWAY-UKRAINE ANTI-DRONE PACT"],
  ["16", "NATO TO SEND AWACS TO POLAND"],
  ["17", "KATZ CLAIMS IRAN CHEMICAL ARMS"],
  ["18", "IRAN CURRENCY HITS RECORD LOW"],
  ["19", "SAUDI 2027 BUDGET PREDICTS GROWTH"],
  ["20", "MALAYSIA TO RETURN 6,803 IN DEC"],
  ["21", "BJP, AKALI DAL REUNITE FOR 2027"],
  ["22", "INDIA: RS 15,000 CRORE FOR NEPAL"],
  ["23", "NEPAL QUAKE 5.6, NO DAMAGE"],
  ["24", "ENGLAND LEVEL T20 SERIES 1-1"],
  ["25", "DAVIS CUP: ITALY V S KOREA TODAY"],
  ["26", "UNAIDS WARNS HIV PROGRESS AT RISK"],
  ["27", "SHEIN TO PAY $100M IN FTC DEAL"],
  ["28", "US CONFIDENCE NEAR 2-YEAR HIGH"],
  ["29", "MICROSOFT 'CODE RED' AFTER OUTAGE"],
  ["30", "TURKEYS FREEDOM, FEATHERS PARDONED"],
  ["31", "DEMOCRATS CLINCH 259-SEAT MAJORITY"],
  ["32", "THOMAS MARKLE INDICTED, AP SAYS"],
  ["33", "OIL FALLS: BRENT $90.97"],
  ["34", "CITI WEIGHS RETURN TO VENEZUELA"],
  ["35", "CITI UK RISK CHIEF STANDS DOWN"],
  ["36", "INDIAN SHARES SET TO OPEN HIGHER"],
];
also.forEach(([n, s], i) => {
  const col = i < 12 ? 0 : 1;
  const row = i % 12;
  const x = 24 + col * 496;
  const y = 794 + row * 15;
  drawText(x, y, n + ".", 2, RED);
  drawText(x + 36, y, s, 2, INK);
  if (n === "17") {
    const w = textWidth(s, 2);
    drawText(x + 36 + w + 8, y, "CLAIM", 2, RED);
  }
});

// ---- footer ----
hline(24, 978, 976, 2);
drawText(24, 986, "ASIA-PAC 9 | MID EAST 7 | EUROPE 7 | N AMER 8 | AFRICA 1 | S AMER 1 | GLOBAL 3", 2, INK);
drawText(24, 1004, "SOURCES: REUTERS AP CNN DOJ FTC WHO UNAIDS. CLAIM = UNVERIFIED CLAIM.", 2, GREY);

// ---- PNG encode ----
function crc32(data: Uint8Array): number {
  let table: number[] | undefined = (crc32 as unknown as { table?: number[] }).table;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    (crc32 as unknown as { table: number[] }).table = table;
  }
  let c = 0xffffffff;
  for (const b of data) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc32(crcData));
  return out;
}
const raw = new Uint8Array(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const ihdr = new Uint8Array(13);
{
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.from(chunk("IHDR", ihdr)),
  Buffer.from(chunk("IDAT", idat)),
  Buffer.from(chunk("IEND", new Uint8Array(0))),
]);
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), png);
