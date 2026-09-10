/**
 * Reviewed OCR for prescription rasters.
 *
 * Characters are read by template match against a known 5x7 Latin glyph set.
 * Drug identity is never inferred from pixels: NER tokens must resolve through
 * the RxNorm lexicon (or an explicit RxNav CUI). Unreadable images and tokens
 * that do not resolve return incomplete rather than a guessed medication.
 */

import { lookupLocal, type RxNormHit } from "./rxnorm.ts";

export const OCR_MIN_CONFIDENCE = 0.72;
export const SCALE = 3;

/** 5x7 glyphs, rows as 5-bit masks. */
export const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b00100, 0b00100],
  ",": [0, 0, 0, 0, 0b00100, 0b00100, 0b01000],
  ":": [0, 0b00100, 0, 0, 0, 0b00100, 0],
  "-": [0, 0, 0, 0b11111, 0, 0, 0],
  "/": [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  "?": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0, 0b00100],
};

export interface Raster {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export function renderPrescription(
  lines: string[],
  noise = 0,
  seed = 1,
): Raster {
  const pad = 8;
  const lineH = 7 * SCALE + 8;
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  const width = pad * 2 + maxLen * (5 * SCALE + 2);
  const height = pad * 2 + lines.length * lineH;
  const pixels = new Uint8Array(width * height).fill(255);

  const set = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    pixels[y * width + x] = v;
  };

  lines.forEach((line, li) => {
    const y0 = pad + li * lineH;
    let x = pad;
    for (const ch of line.toUpperCase()) {
      const glyph = FONT[ch] ?? FONT["?"];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          const on = ((glyph[r] >> (4 - c)) & 1) === 1;
          if (!on) continue;
          for (let dy = 0; dy < SCALE; dy++) {
            for (let dx = 0; dx < SCALE; dx++) {
              set(x + c * SCALE + dx, y0 + r * SCALE + dy, 0);
            }
          }
        }
      }
      x += 5 * SCALE + 2;
    }
  });

  if (noise > 0) {
    let s = seed >>> 0;
    const n = Math.floor(pixels.length * noise);
    for (let i = 0; i < n; i++) {
      s = (1664525 * s + 1013904223) >>> 0;
      const idx = s % pixels.length;
      pixels[idx] = pixels[idx] > 127 ? 0 : 255;
    }
  }

  return { width, height, pixels };
}

function inkAt(img: Raster, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
  return img.pixels[y * img.width + x] < 128;
}

function glyphScore(window: number[], glyph: number[]): number {
  let same = 0;
  for (let i = 0; i < 7; i++) {
    for (let b = 0; b < 5; b++) {
      const bit = (window[i] >> (4 - b)) & 1;
      const g = (glyph[i] >> (4 - b)) & 1;
      if (bit === g) same += 1;
    }
  }
  return same / 35;
}

function sampleGlyph(img: Raster, x0: number, y0: number, w: number, h: number): number[] {
  const rows: number[] = [];
  for (let r = 0; r < 7; r++) {
    let mask = 0;
    for (let c = 0; c < 5; c++) {
      let ink = 0;
      const x1 = x0 + Math.floor((c * w) / 5);
      const x2 = x0 + Math.floor(((c + 1) * w) / 5);
      const y1 = y0 + Math.floor((r * h) / 7);
      const y2 = y0 + Math.floor(((r + 1) * h) / 7);
      let n = 0;
      for (let y = y1; y < Math.max(y1 + 1, y2); y++) {
        for (let x = x1; x < Math.max(x1 + 1, x2); x++) {
          n += 1;
          if (inkAt(img, x, y)) ink += 1;
        }
      }
      if (ink * 2 >= n) mask |= 1 << (4 - c);
    }
    rows.push(mask);
  }
  return rows;
}

function bestChar(window: number[]): { ch: string; score: number } {
  let best = { ch: "?", score: 0 };
  for (const [ch, glyph] of Object.entries(FONT)) {
    if (ch === " ") continue;
    const score = glyphScore(window, glyph);
    if (score > best.score) best = { ch, score };
  }
  const spaceScore = glyphScore(window, FONT[" "]);
  if (spaceScore > best.score && spaceScore > 0.9) return { ch: " ", score: spaceScore };
  return best;
}

function lineBoxes(img: Raster): { y0: number; y1: number }[] {
  const rows: boolean[] = [];
  for (let y = 0; y < img.height; y++) {
    let ink = false;
    for (let x = 0; x < img.width; x++) {
      if (inkAt(img, x, y)) {
        ink = true;
        break;
      }
    }
    rows.push(ink);
  }
  const boxes: { y0: number; y1: number }[] = [];
  let start = -1;
  for (let y = 0; y <= rows.length; y++) {
    const on = y < rows.length && rows[y];
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      if (y - start >= SCALE) boxes.push({ y0: start, y1: y });
      start = -1;
    }
  }
  return boxes;
}

function charBoxes(img: Raster, y0: number, y1: number): { x0: number; x1: number }[] {
  const cols: boolean[] = [];
  for (let x = 0; x < img.width; x++) {
    let ink = false;
    for (let y = y0; y < y1; y++) {
      if (inkAt(img, x, y)) {
        ink = true;
        break;
      }
    }
    cols.push(ink);
  }
  const boxes: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let x = 0; x <= cols.length; x++) {
    const on = x < cols.length && cols[x];
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start >= 2) boxes.push({ x0: start, x1: x });
      start = -1;
    }
  }
  return boxes;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export function ocrPixels(img: Raster): OcrResult {
  const lines = lineBoxes(img);
  if (!lines.length) return { text: "", confidence: 0 };
  const out: string[] = [];
  const scores: number[] = [];
  for (const line of lines) {
    const chars = charBoxes(img, line.y0, line.y1);
    let buf = "";
    let prevX1 = -100;
    for (const box of chars) {
      const gap = box.x0 - prevX1;
      if (prevX1 >= 0 && gap > SCALE * 3) buf += " ";
      const sampled = sampleGlyph(
        img,
        box.x0,
        line.y0,
        Math.max(1, box.x1 - box.x0),
        Math.max(1, line.y1 - line.y0),
      );
      const hit = bestChar(sampled);
      if (hit.score < 0.62) {
        prevX1 = box.x1;
        continue;
      }
      buf += hit.ch;
      scores.push(hit.score);
      prevX1 = box.x1;
    }
    out.push(buf.trim());
  }
  const confidence =
    scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
  return { text: out.join("\n"), confidence };
}

export interface NerSpan {
  raw: string;
  dose?: string;
  hit: RxNormHit | null;
}

const DOSE_RE = /\d+\s?(mg|mcg|g|iu|ml)\b/i;

/** Medical NER over OCR/typed text. Does not invent drugs. */
export function extractDrugMentions(text: string): NerSpan[] {
  const parts = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  return parts.map((raw) => ({
    raw,
    dose: raw.match(DOSE_RE)?.[0],
    hit: lookupLocal(raw),
  }));
}

export interface OcrIngest {
  status: "ok" | "incomplete";
  text: string;
  confidence: number;
  mentions: NerSpan[];
  reason?: string;
}

export function ingestOcrText(text: string, confidence: number): OcrIngest {
  if (confidence < OCR_MIN_CONFIDENCE || !text.trim()) {
    return {
      status: "incomplete",
      text,
      confidence,
      mentions: [],
      reason: "ocr_unreadable",
    };
  }
  const mentions = extractDrugMentions(text);
  if (!mentions.some((m) => m.hit)) {
    return {
      status: "incomplete",
      text,
      confidence,
      mentions,
      reason: "no_rxnorm_match",
    };
  }
  return { status: "ok", text, confidence, mentions };
}

export function ingestRaster(img: Raster): OcrIngest {
  const ocr = ocrPixels(img);
  return ingestOcrText(ocr.text, ocr.confidence);
}
