/**
 * Persist safety graph, briefs, and engine audit trail.
 * Firestore when the user is signed in; localStorage otherwise so a restart
 * on this machine still keeps the demo graph.
 */

import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { HandoffBrief } from "@shared/mediai/intake";
import type { ChatEngineResult } from "@shared/mediai/chatSafety";
import { emptySafetyGraph } from "@shared/mediai/chatSafety";
import type { SafetyGraph } from "@shared/mediai/medication";

const LS_GRAPH = "mediai.safetyGraph";
const LS_AUDITS = "mediai.engineAudits";
const LS_BRIEFS = "mediai.briefs";
export const HANDOFF_FRAGMENTS_KEY = "mediai.handoff.fragments";
export const HANDOFF_MEDS_KEY = "mediai.handoff.medications";

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
      console.warn("Firestore graph read failed, using local copy", err);
    }
  }
  return loadGraphLocal(patientId, allergies);
}

export async function saveGraph(uid: string | null, graph: SafetyGraph): Promise<void> {
  saveGraphLocal(graph);
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid, "mediai", "graph"), graph);
  } catch (err) {
    console.warn("Firestore graph write failed", err);
  }
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
  try {
    await addDoc(collection(db, "users", uid, "mediaiAudits"), payload);
  } catch (err) {
    console.warn("Firestore audit write failed", err);
  }
}

export async function saveBrief(uid: string | null, brief: HandoffBrief): Promise<void> {
  const prev = readLs<HandoffBrief[]>(LS_BRIEFS, []);
  writeLs(LS_BRIEFS, [...prev.filter((b) => b.id !== brief.id), brief].slice(-20));
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid, "mediaiBriefs", brief.id), brief);
  } catch (err) {
    console.warn("Firestore brief write failed", err);
  }
}

export function stashHandoffFromChat(userLines: string[], medications: string[]): void {
  writeLs(HANDOFF_FRAGMENTS_KEY, userLines);
  writeLs(HANDOFF_MEDS_KEY, medications);
}

export function takeStashedHandoff(): { fragments: string[]; medications: string[] } | null {
  const fragments = readLs<string[] | null>(HANDOFF_FRAGMENTS_KEY, null);
  const medications = readLs<string[]>(HANDOFF_MEDS_KEY, []);
  if (!fragments?.length) return null;
  localStorage.removeItem(HANDOFF_FRAGMENTS_KEY);
  return { fragments, medications };
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
