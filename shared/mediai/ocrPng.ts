import { deflateSync, inflateSync } from "node:zlib";
import { ingestRaster, renderPrescription, type OcrIngest, type Raster } from "./ocr.ts";

const PNG_SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  return Uint8Array.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type.split("").map((ch) => ch.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const crc = u32(crc32(body));
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32(data.length), 0);
  out.set(body, 4);
  out.set(crc, 4 + body.length);
  return out;
}

export function encodeGrayPng(img: Raster): Uint8Array {
  const raw = new Uint8Array(img.height * (img.width + 1));
  for (let y = 0; y < img.height; y++) {
    raw[y * (img.width + 1)] = 0;
    raw.set(img.pixels.subarray(y * img.width, (y + 1) * img.width), y * (img.width + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(img.width), 0);
  ihdr.set(u32(img.height), 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const chunks = [
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function readU32(buf: Uint8Array, i: number): number {
  return ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
}

export function decodeGrayPng(bytes: Uint8Array): Raster | null {
  if (bytes.length < 8) return null;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) return null;
  let p = 8;
  let width = 0;
  let height = 0;
  const idats: Uint8Array[] = [];
  while (p + 8 <= bytes.length) {
    const len = readU32(bytes, p);
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      if (data[8] !== 8 || data[9] !== 0) return null;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!width || !height || !idats.length) return null;
  const merged = new Uint8Array(idats.reduce((s, d) => s + d.length, 0));
  let o = 0;
  for (const d of idats) {
    merged.set(d, o);
    o += d.length;
  }
  let raw: Uint8Array;
  try {
    raw = inflateSync(merged);
  } catch {
    return null;
  }
  const stride = width + 1;
  if (raw.length < height * stride) return null;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] !== 0) return null;
    pixels.set(raw.subarray(y * stride + 1, y * stride + 1 + width), y * width);
  }
  return { width, height, pixels };
}

export function pngToDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

export function ingestImageBase64(imageBase64: string, noiseCorpus = false): OcrIngest {
  const trimmed = imageBase64.replace(/^data:image\/png;base64,/, "").trim();
  if (!trimmed || trimmed.length < 32) {
    return {
      status: "incomplete",
      text: "",
      confidence: 0,
      mentions: [],
      reason: "not_an_image",
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(trimmed, "base64"));
  } catch {
    return {
      status: "incomplete",
      text: "",
      confidence: 0,
      mentions: [],
      reason: "not_an_image",
    };
  }
  const raster = decodeGrayPng(bytes);
  if (!raster) {
    return {
      status: "incomplete",
      text: "",
      confidence: 0,
      mentions: [],
      reason: "unreadable_image",
    };
  }
  void noiseCorpus;
  return ingestRaster(raster);
}

export function corpusPng(lines: string[], noise = 0.001, seed = 3): Uint8Array {
  return encodeGrayPng(renderPrescription(lines, noise, seed));
}
