/**
 * Disk backup for the Express safety graph / briefs / audit trail.
 * Firebase + localStorage hold the signed-in chat UI. This file keeps the
 * HTTP `/api/mediai` maps alive across a process restart. Vitest stays
 * in-memory so cases do not leak across files.
 */

import fs from "node:fs";
import path from "node:path";

import type { HandoffBrief } from "../shared/mediai/intake.ts";
import type { SafetyGraph } from "../shared/mediai/medication.ts";

export interface MediaiDiskStore {
  graphs: Record<string, SafetyGraph>;
  briefs: Record<string, HandoffBrief>;
  audits: unknown[];
}

const DEFAULT_PATH = path.join(process.cwd(), "data", "mediai-store.json");

function storePath(): string {
  return process.env.MEDIAI_STORE_PATH || DEFAULT_PATH;
}

function persistEnabled(): boolean {
  return !process.env.VITEST;
}

export function loadMediaiStore(): MediaiDiskStore {
  const empty: MediaiDiskStore = { graphs: {}, briefs: {}, audits: [] };
  if (!persistEnabled()) return empty;
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as MediaiDiskStore;
    return {
      graphs: parsed.graphs ?? {},
      briefs: parsed.briefs ?? {},
      audits: Array.isArray(parsed.audits) ? parsed.audits : [],
    };
  } catch {
    return empty;
  }
}

export function saveMediaiStore(store: MediaiDiskStore): void {
  if (!persistEnabled()) return;
  const file = storePath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(store, null, 2));
  } catch (err) {
    console.warn("mediai disk persist failed", err);
  }
}
