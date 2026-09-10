import { verifyClaims } from "./verifier.ts";
import {
  applyColloquialMap,
  assertMappedSourcing,
  toClinicalText,
  type AppliedMapping,
} from "./colloquial.ts";

export interface TimelineEvent {
  t: number;
  text: string;
  source: string;
}

export function reconstructTimeline(
  fragments: string[],
  nowMs = Date.parse("2026-09-10T12:00:00Z"),
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let lastOffset = 0;
  for (const source of fragments) {
    let daysAgo = lastOffset;
    const numbered = source.match(/(\d+)\s+days?\s+ago/i);
    const past = source.match(/for the past\s+(\d+)\s+days?/i);
    if (numbered) daysAgo = Number(numbered[1]);
    else if (past) daysAgo = Number(past[1]);
    else if (/yesterday|since yesterday/i.test(source)) daysAgo = 1;
    else if (/last week/i.test(source)) daysAgo = 7;
    else if (/this morning|last night/i.test(source)) daysAgo = 0;
    else if (/then|after that|later/i.test(source)) daysAgo = Math.max(0, lastOffset - 0.5);
    lastOffset = daysAgo;
    events.push({
      t: nowMs - daysAgo * 86400000,
      text: source,
      source,
    });
  }
  return events.sort((a, b) => a.t - b.t);
}

export const SPECIALTY_HINTS: Record<string, string[]> = {
  dermatology: ["rash", "itch", "skin", "acne"],
  ent: ["throat", "ear", "sinus", "swallow"],
  cardiology: ["chest pain", "palpitation", "syncope"],
  urology: ["urine", "dysuria", "burning when"],
  general: [],
};

export function specialtyGuard(
  timelineText: string,
  bookedSpecialty: string,
): { mismatch: boolean; reason: string } {
  const text = `${timelineText} ${toClinicalText(timelineText)}`.toLowerCase();
  const booked = bookedSpecialty.toLowerCase();
  let best: { spec: string; hits: number } = { spec: "general", hits: 0 };
  for (const [spec, keys] of Object.entries(SPECIALTY_HINTS)) {
    const hits = keys.filter((k) => text.includes(k)).length;
    if (hits > best.hits) best = { spec, hits };
  }
  if (best.hits === 0) {
    return { mismatch: false, reason: "not enough signal to flag a mismatch" };
  }
  if (best.spec !== booked && booked !== "general") {
    return {
      mismatch: true,
      reason: `Symptoms look closer to ${best.spec} than ${booked}.`,
    };
  }
  return { mismatch: false, reason: "specialty matches leading symptom cluster" };
}

export interface PrepResult {
  labs: string[];
  fasting: boolean;
  state: "prep_needed" | "no_prep_needed";
  guideline: string;
}

const GUIDELINES: { match: RegExp; labs: string[]; fasting: boolean; guideline: string }[] = [
  {
    match: /chest pain|palpitation/,
    labs: ["ECG", "troponin if acute"],
    fasting: false,
    guideline: "Chest-pain workup: ECG; troponin if ongoing pain.",
  },
  {
    match: /polyuria|polydipsia|diabetes|glucose/,
    labs: ["fasting glucose", "HbA1c"],
    fasting: true,
    guideline: "Suspected diabetes: fasting glucose and HbA1c.",
  },
  {
    match: /sore throat|fever/,
    labs: [],
    fasting: false,
    guideline: "Uncomplicated pharyngitis: no routine labs before first visit.",
  },
];

export function comePrepared(presentation: string): PrepResult {
  const text = `${presentation} ${toClinicalText(presentation)}`;
  for (const g of GUIDELINES) {
    if (g.match.test(text)) {
      const prep = g.labs.length > 0 || g.fasting;
      return {
        labs: g.labs,
        fasting: g.fasting,
        state: prep ? "prep_needed" : "no_prep_needed",
        guideline: g.guideline,
      };
    }
  }
  return {
    labs: [],
    fasting: false,
    state: "no_prep_needed",
    guideline: "No guideline-indicated labs for this presentation.",
  };
}

export const RED_FLAGS = [
  "trouble breathing",
  "difficulty breathing",
  "can't breathe",
  "cannot breathe",
  "hard to breathe",
  "short of breath",
  "chest pain",
  "crushing chest",
  "pain radiating to the arm",
  "pain in the jaw",
  "anaphyla",
  "tongue swelling",
  "throat closing",
  "stiff neck",
  "neck stiffness",
  "photophobia",
  "can't look at lights",
  "worst headache",
  "sudden worst headache",
  "suicidal",
  "kill myself",
  "want to die",
  "stroke",
  "face droop",
  "arm weakness",
  "one-sided weakness",
  "slurred speech",
  "uncontrolled bleeding",
  "coughing blood",
  "vomiting blood",
  "black stools",
  "blood in stool",
  "seizure",
  "blue lips",
  "unresponsive",
  "passed out",
  "fainted",
  "confused",
  "purple rash",
  "non-blanching rash",
];

export const ESCALATION_DAYS = 3;

function isNegatedAt(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 28), index);
  return /\bno\b|\bnot\b|\bdenies\b|\bwithout\b|\bn't\b|\bnever\b|\babsent\b/.test(
    window,
  );
}

export function waitingWindowEscalation(input: {
  newText: string;
  appointmentDaysOut: number;
}): { escalate: boolean; flags: string[]; daysOut: number; thresholdDays: number } {
  const text = input.newText.toLowerCase();
  const flags = RED_FLAGS.filter((f) => {
    const idx = text.indexOf(f);
    if (idx < 0) return false;
    return !isNegatedAt(text, idx);
  });
  // Red flags always escalate. Waiting-window N is recorded so the UI can
  // explain a distant booking, but proximity must not suppress a red flag.
  const escalate = flags.length > 0;
  return {
    escalate,
    flags,
    daysOut: input.appointmentDaysOut,
    thresholdDays: ESCALATION_DAYS,
  };
}

export interface SourceSpan {
  statement: string;
  sourceText: string;
  mappingId?: string;
}

export interface HandoffBrief {
  id: string;
  chiefComplaint: string;
  timeline: TimelineEvent[];
  patientWords: string[];
  synthesis: string;
  traces: SourceSpan[];
  mappings: AppliedMapping[];
  medications: string[];
  differential: { condition: string; probability: number }[];
  /** Engine ranking. Labeled separately so it is never a patient-sourced claim. */
  triageSnapshot: string;
  patientReview: { status: "draft" | "approved" | "waived"; note?: string };
}

let briefSeq = 0;

function newBriefId(): string {
  briefSeq += 1;
  return `brief-${briefSeq}-${Date.now()}`;
}

/**
 * Clinical sentences in the synthesis layer must be supported by the
 * patient transcript. Triage ranking is kept off this string on purpose.
 */
export function assertTranscriptSupport(
  statements: string[],
  transcript: string[],
): void {
  const evidence = transcript.map((s) => s.trim()).filter(Boolean);
  if (!evidence.length) {
    throw new Error("unsourced_claim");
  }
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    const verbatimHit = evidence.some(
      (e) =>
        e.toLowerCase().includes(trimmed.toLowerCase()) ||
        trimmed.toLowerCase().includes(e.toLowerCase()),
    );
    if (verbatimHit) continue;
    const verdicts = verifyClaims(trimmed, evidence);
    if (!verdicts.length || verdicts.some((c) => c.status !== "supported")) {
      throw new Error("unsourced_claim");
    }
  }
}

export function buildHandoffBrief(input: {
  fragments: string[];
  medications: string[];
  differential: { condition: string; probability: number }[];
}): HandoffBrief {
  const fragments = input.fragments.map((s) => s.trim()).filter(Boolean);
  if (!fragments.length) {
    throw new Error("unsourced_claim");
  }
  const timelineRaw = reconstructTimeline(fragments);
  const mappings: AppliedMapping[] = [];
  const traces: SourceSpan[] = [];

  const timeline = timelineRaw.map((ev) => {
    const translated = applyColloquialMap(ev.text);
    mappings.push(...translated.mappings);
    traces.push({
      statement: translated.clinical,
      sourceText: translated.mappings[0]?.sourceSpan ?? ev.source,
      mappingId: translated.mappings[0]?.id,
    });
    return { ...ev, text: translated.clinical };
  });

  const chiefSource = timelineRaw[0];
  const chiefTranslated = applyColloquialMap(chiefSource.text);
  const chief = chiefTranslated.clinical;
  traces.unshift({
    statement: chief,
    sourceText: chiefTranslated.mappings[0]?.sourceSpan ?? chiefSource.source,
    mappingId: chiefTranslated.mappings[0]?.id,
  });

  assertMappedSourcing(
    traces.map((t) => t.statement).join(" "),
    fragments,
    mappings,
  );
  assertTranscriptSupport(
    traces.filter((t) => !t.mappingId).map((t) => t.statement),
    fragments,
  );

  const synthesis = timeline
    .map((e, i) => {
      const raw = timelineRaw[i];
      const translated = applyColloquialMap(raw.text);
      if (translated.mappings.length) {
        return `${translated.clinical} (patient: "${translated.mappings.map((m) => m.sourceSpan).join(", ")}")`;
      }
      return translated.clinical;
    })
    .join(" ");

  assertMappedSourcing(
    timeline.map((e) => e.text).join(" "),
    fragments,
    mappings,
  );

  const lead = input.differential[0];
  const triageSnapshot = lead
    ? `Triage ranking (engine, not a patient statement): ${lead.condition} ${Math.round(lead.probability * 100)}%. Ranking, not a diagnosis.`
    : "Triage ranking (engine, not a patient statement): undetermined.";

  return {
    id: newBriefId(),
    chiefComplaint: chief,
    timeline,
    patientWords: fragments,
    synthesis,
    traces,
    mappings,
    medications: input.medications,
    differential: input.differential,
    triageSnapshot,
    patientReview: { status: "draft" },
  };
}

/** Patient corrections become the new source text and reset review to draft. */
export function correctBrief(
  brief: HandoffBrief,
  fragments: string[],
): HandoffBrief {
  const next = buildHandoffBrief({
    fragments,
    medications: brief.medications,
    differential: brief.differential,
  });
  return { ...next, id: brief.id, patientReview: { status: "draft" } };
}

export function markReviewed(
  brief: HandoffBrief,
  status: "approved" | "waived",
  note?: string,
): HandoffBrief {
  assertMappedSourcing(
    brief.traces.map((t) => t.statement).join(" "),
    brief.patientWords,
    brief.mappings,
  );
  return { ...brief, patientReview: { status, note } };
}

export function doctorMayView(brief: HandoffBrief): boolean {
  return (
    brief.patientReview.status === "approved" ||
    brief.patientReview.status === "waived"
  );
}
