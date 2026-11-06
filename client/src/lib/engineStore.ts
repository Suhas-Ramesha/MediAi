/**
 * Persist safety graph, briefs, and engine audit trail.
 * Firestore when the user is signed in; localStorage otherwise so a restart
 * on this machine still keeps the demo graph.
 */

import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { HandoffBrief } from "@shared/mediai/intake";
import { dedupePatientFragments } from "@shared/mediai/intake";
import type { ChatEngineResult } from "@shared/mediai/chatSafety";
import { emptySafetyGraph } from "@shared/mediai/chatSafety";
import type { SafetyGraph } from "@shared/mediai/medication";

const LS_GRAPH = "mediai.safetyGraph";
const LS_AUDITS = "mediai.engineAudits";
const LS_BRIEFS = "mediai.briefs";
export const HANDOFF_FRAGMENTS_KEY = "mediai.handoff.fragments";
export const HANDOFF_MEDS_KEY = "mediai.handoff.medications";
export const PENDING_BOOK_KEY = "mediai.pendingSlotBook";

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLs(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadGraphLocal(patientId: string, allergies: string[] = []): SafetyGraph {
  const g = readLs<SafetyGraph | null>(LS_GRAPH, null);
  if (g && g.patientId) return g;
  return emptySafetyGraph(patientId, allergies);
}

export function saveGraphLocal(graph: SafetyGraph): void {
  writeLs(LS_GRAPH, graph);
}

/**
 * Firestore can be unavailable for reasons the app cannot fix: deployed rules
 * that deny writes, offline mode, or a browser extension blocking
 * firestore.googleapis.com (net::ERR_BLOCKED_BY_CLIENT). Local storage is the
 * source of truth in this demo, so after the first cloud failure we stop
 * retrying and keep the console clean.
 */
const LS_CLOUD_BLOCKED_UNTIL = "mediai.cloudBlockedUntil";

function cloudRecentlyBlocked(): boolean {
  try {
    const until = Number(localStorage.getItem(LS_CLOUD_BLOCKED_UNTIL) || 0);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

let cloudSyncBlocked = cloudRecentlyBlocked();

function markCloudBlocked(): void {
  try {
    localStorage.setItem(LS_CLOUD_BLOCKED_UNTIL, String(Date.now() + 60 * 60 * 1000));
  } catch {
    /* private mode */
  }
}

function shouldStopRetrying(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || "");
  const message = String((err as { message?: string })?.message || "");
  return (
    code === "permission-denied" ||
    code === "unavailable" ||
    code === "failed-precondition" ||
    /insufficient permissions|blocked_by_client|network|offline/i.test(message)
  );
}

async function tryCloudWrite(label: string, run: () => Promise<unknown>): Promise<void> {
  if (cloudSyncBlocked) return;
  try {
    await run();
  } catch (err) {
    if (shouldStopRetrying(err)) {
      cloudSyncBlocked = true;
      markCloudBlocked();
      console.info(
        `[MediAI] Cloud sync unavailable (${label}). Continuing with local storage only.`,
      );
      return;
    }
    console.warn(`Firestore ${label} failed`, err);
  }
}

export function isCloudSyncBlocked(): boolean {
  return cloudSyncBlocked;
}

export async function loadGraph(
  uid: string | null,
  patientId: string,
  allergies: string[] = [],
): Promise<SafetyGraph> {
  if (uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid, "mediai", "graph"));
      if (snap.exists()) return snap.data() as SafetyGraph;
    } catch (err) {
      if (shouldStopRetrying(err)) {
        cloudSyncBlocked = true;
        console.info("[MediAI] Cloud sync unavailable (graph read). Using local storage only.");
      } else {
        console.warn("Firestore graph read failed, using local copy", err);
      }
    }
  }
  return loadGraphLocal(patientId, allergies);
}

export async function saveGraph(uid: string | null, graph: SafetyGraph): Promise<void> {
  saveGraphLocal(graph);
  if (!uid) return;
  await tryCloudWrite("graph write", () =>
    setDoc(doc(db, "users", uid, "mediai", "graph"), graph),
  );
}

export async function appendAudit(
  uid: string | null,
  payload: {
    consultationId?: string;
    userText: string;
    assistantText: string;
    result: ChatEngineResult;
    at: string;
  },
): Promise<void> {
  const prev = readLs<unknown[]>(LS_AUDITS, []);
  writeLs(LS_AUDITS, [...prev, payload].slice(-80));
  if (!uid) return;
  await tryCloudWrite("audit write", () =>
    addDoc(collection(db, "users", uid, "mediaiAudits"), payload),
  );
}

export async function saveBrief(uid: string | null, brief: HandoffBrief): Promise<void> {
  const prev = readLs<HandoffBrief[]>(LS_BRIEFS, []);
  writeLs(LS_BRIEFS, [...prev.filter((b) => b.id !== brief.id), brief].slice(-20));
  if (!uid) return;
  await tryCloudWrite("brief write", () =>
    setDoc(doc(db, "users", uid, "mediaiBriefs", brief.id), brief),
  );
}

export function stashHandoffFromChat(userLines: string[], medications: string[]): void {
  writeLs(HANDOFF_FRAGMENTS_KEY, dedupePatientFragments(userLines));
  writeLs(HANDOFF_MEDS_KEY, medications);
}

export function takeStashedHandoff(): { fragments: string[]; medications: string[] } | null {
  const fragments = readLs<string[] | null>(HANDOFF_FRAGMENTS_KEY, null);
  const medications = readLs<string[]>(HANDOFF_MEDS_KEY, []);
  if (!fragments?.length) return null;
  localStorage.removeItem(HANDOFF_FRAGMENTS_KEY);
  return { fragments, medications };
}

export function loadBriefsLocal(): HandoffBrief[] {
  return readLs<HandoffBrief[]>(LS_BRIEFS, []);
}

export function loadAuditsLocal(): Array<{
  userText?: string;
  assistantText?: string;
  result?: ChatEngineResult;
  at?: string;
}> {
  return readLs(LS_AUDITS, []);
}

export type PendingSlotBook = {
  doctor: unknown;
  afterBrief: boolean;
};

export function stashPendingSlotBook(payload: PendingSlotBook): void {
  writeLs(PENDING_BOOK_KEY, payload);
}

export function takePendingSlotBook(): PendingSlotBook | null {
  const v = readLs<PendingSlotBook | null>(PENDING_BOOK_KEY, null);
  if (!v) return null;
  localStorage.removeItem(PENDING_BOOK_KEY);
  return v;
}

export function peekPendingSlotBook(): PendingSlotBook | null {
  return readLs<PendingSlotBook | null>(PENDING_BOOK_KEY, null);
}

const LS_CHAT = "mediai.chatSession";

export function persistChatSession(consultationId: string, messages: unknown[]): void {
  writeLs(LS_CHAT, { consultationId, messages });
}

export function restoreChatSession(): {
  consultationId: string;
  messages: unknown[];
} | null {
  const raw = readLs<{ consultationId?: string; messages?: unknown[] } | null>(
    LS_CHAT,
    null,
  );
  if (!raw?.consultationId || !Array.isArray(raw.messages)) return null;
  return { consultationId: raw.consultationId, messages: raw.messages };
}
