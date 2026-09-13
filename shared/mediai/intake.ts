import { verifyClaims } from "./verifier.ts";
import {
  applyColloquialMap,
  assertMappedSourcing,
  toClinicalText,
  type AppliedMapping,
} from "./colloquial.ts";
import { answersFromTranscript, inferTriageFromTranscript } from "./triage.ts";

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
  cardiology: [
    "chest pain",
    "chestpain",
    "crushing chest",
    "palpitation",
    "palpitations",
    "syncope",
    "pain radiating to the arm",
    "heart racing",
  ],
  urology: ["urine", "dysuria", "burning when"],
  general: [],
};

/** Directory search strings that typically match a cluster (tried in order). */
export const SPECIALTY_DIRECTORY_QUERIES: Record<string, string[]> = {
  cardiology: ["Cardiologist", "Cardiology"],
  dermatology: ["Dermatologist", "Dermatology"],
  ent: ["ENT", "Otolaryngologist"],
  urology: ["Urologist", "Urology"],
  endocrinology: ["Endocrinologist"],
  hepatology: ["Hepatologist"],
  nephrology: ["Nephrologist"],
};

export function normalizeSpecialtyLabel(raw: string): string {
  const t = raw.toLowerCase().replace(/[^a-z]/g, " ").replace(/\s+/g, " ").trim();
  if (/cardio|heart/.test(t)) return "cardiology";
  if (/derm|skin/.test(t)) return "dermatology";
  if (/\bent\b|otolaryng/.test(t)) return "ent";
  if (/uro/.test(t)) return "urology";
  if (/hepato/.test(t)) return "hepatology";
  if (/nephro/.test(t)) return "nephrology";
  if (/endocrin/.test(t)) return "endocrinology";
  if (/general|family|internal|gp\b/.test(t)) return "general";
  return t.replace(/ologist$/, "ology");
}

export function inferSpecialtyHint(text: string): {
  cluster: string;
  directoryQueries: string[];
  hits: number;
} | null {
  const hay = `${text} ${toClinicalText(text)}`.toLowerCase();
  let best: { spec: string; hits: number } = { spec: "general", hits: 0 };
  for (const [spec, keys] of Object.entries(SPECIALTY_HINTS)) {
    const hits = keys.filter((k) => hay.includes(k.toLowerCase())).length;
    if (hits > best.hits) best = { spec, hits };
  }
  if (best.hits === 0 || best.spec === "general") return null;
  return {
    cluster: best.spec,
    directoryQueries: SPECIALTY_DIRECTORY_QUERIES[best.spec] ?? [best.spec],
    hits: best.hits,
  };
}

export function specialtyGuard(
  timelineText: string,
  bookedSpecialty: string,
): { mismatch: boolean; reason: string; expected?: string } {
  const hinted = inferSpecialtyHint(timelineText);
  if (!hinted) {
    return { mismatch: false, reason: "not enough signal to flag a mismatch" };
  }
  const booked = normalizeSpecialtyLabel(bookedSpecialty);
  if (booked !== hinted.cluster) {
    return {
      mismatch: true,
      expected: hinted.cluster,
      reason: `Symptoms look closer to ${hinted.cluster} than ${booked || "an unmatched specialty"}. Do not book until a matching specialist is available.`,
    };
  }
  return { mismatch: false, reason: "specialty matches leading symptom cluster" };
}

export interface PrepResult {
  /** Existing items only. Never a shopping list of new labs. */
  bring: string[];
  /** What to say in the first 30 seconds. */
  tell: string[];
  /** Questions for the doctor, not self-ordered tests. */
  ask: string[];
  doNot: string[];
  urgent?: string;
  guideline: string;
  /** Always empty. Kept so older callers do not read leftover lab advice. */
  labs: string[];
  /** True only if the treating doctor already asked the patient to fast. */
  fasting: boolean;
  state: "prep_needed" | "no_prep_needed";
}

type PrepRule = {
  match: RegExp;
  bring: string[];
  tell: string[];
  ask: string[];
  doNot: string[];
  urgent?: string;
  guideline: string;
  state: PrepResult["state"];
};

const VISIT_SCRIPTS: PrepRule[] = [
  {
    match: /chest pain|crushing chest|pain radiating to the arm/,
    bring: [
      "The bottles or a photo of medicines you already take",
      "Any ECG or discharge paper you already have from an earlier visit",
    ],
    tell: [
      "When the pain started, and whether it is still going",
      "Where it sits and whether it moves to an arm, jaw, or back",
      "What you were doing when it began",
    ],
    ask: [
      "Should I go to emergency care now, or is this slot still appropriate?",
      "Which of my current medicines should I keep taking today?",
    ],
    doNot: [
      "Do not book a private ECG or blood test on the way. If this is an emergency, go in now; the doctor orders tests after they see you.",
    ],
    urgent:
      "New chest pain, crushing pain, or pain into an arm or jaw is a reason not to wait for a routine slot.",
    guideline:
      "For chest pain, the useful prep is a clear story and your current medicines — not a lab you ordered yourself.",
    state: "prep_needed",
  },
  {
    match: /polyuria|polydipsia|diabetes|glucose/,
    bring: [
      "Home sugar readings only if you already keep them",
      "Diabetes or blood-pressure medicines you already take",
    ],
    tell: [
      "How often you are thirsty or passing urine, and since when",
      "Any home sugar numbers you already wrote down",
    ],
    ask: [
      "Do I need any blood work after you examine me, or is this visit enough to decide?",
      "What should I track at home until then?",
    ],
    doNot: [
      "Do not fast or pay for HbA1c / fasting glucose before the visit unless this doctor already asked you to.",
    ],
    guideline:
      "Bring the log you already have and the story. Let the doctor decide if a test is worth another trip.",
    state: "prep_needed",
  },
  {
    match: /headache|head(?:'s| is) pounding|migraine|photophobia/,
    bring: ["A list of pain medicines you already tried, with whether they helped"],
    tell: [
      "Where the pain sits (one side, both, behind the eyes)",
      "When it started and the worst it has been",
      "Whether light, sound, or neck stiffness is present",
    ],
    ask: ["What would make this urgent enough not to wait for the booked slot?"],
    doNot: ["Do not get a scan or blood test on your own before this visit."],
    guideline:
      "A headache visit is won by location, timing, and what you already tried — not a pre-ordered scan.",
    state: "prep_needed",
  },
  {
    match: /sore throat|fever|cough|vomiting|diarrhea/,
    bring: ["Any temperature numbers you already measured at home"],
    tell: [
      "First day of illness and what showed up in what order",
      "Whether you can swallow, keep fluids down, or breathe comfortably",
    ],
    ask: ["If this gets worse tonight, when should I skip the slot and go in?"],
    doNot: ["Do not buy a panel of blood tests before the first look."],
    guideline:
      "Write the timeline and what you can still do (drink, swallow, breathe). Skip self-ordered labs.",
    state: "no_prep_needed",
  },
];

export function comePrepared(presentation: string): PrepResult {
  const text = `${presentation} ${toClinicalText(presentation)}`;
  for (const g of VISIT_SCRIPTS) {
    if (g.match.test(text)) {
      return {
        bring: g.bring,
        tell: g.tell,
        ask: g.ask,
        doNot: g.doNot,
        urgent: g.urgent,
        guideline: g.guideline,
        labs: [],
        fasting: false,
        state: g.state,
      };
    }
  }
  return {
    bring: ["A written list of medicines and allergies you already have"],
    tell: ["What started, when, and what changed since"],
    ask: ["What should I watch for after I leave?"],
    doNot: ["Do not get lab tests on your own unless this doctor already ordered them."],
    guideline:
      "Walk in able to tell the story. Do not spend on tests the doctor may never use.",
    labs: [],
    fasting: false,
    state: "no_prep_needed",
  };
}

export function formatVisitPrep(prep: PrepResult): string {
  const parts = [prep.guideline];
  if (prep.urgent) parts.push(prep.urgent);
  if (prep.tell.length) parts.push(`Be ready to say: ${prep.tell.join("; ")}.`);
  if (prep.bring.length) {
    parts.push(`Bring only what you already have: ${prep.bring.join("; ")}.`);
  }
  if (prep.doNot.length) parts.push(prep.doNot.join(" "));
  return parts.join(" ");
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

function normalizeUtterance(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeUtterance(s).split(" ").filter((w) => w.length > 1));
}

function similarUtterance(a: string, b: string): boolean {
  const na = normalizeUtterance(a);
  const nb = normalizeUtterance(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length < nb.length ? na : nb;
    if (shorter.split(" ").length >= 4) return true;
  }
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const j = inter / new Set([...A, ...B]).size;
  return j >= 0.86;
}

/** Collapse a single bubble that pasted the same speech twice. */
export function collapseRepeatedSpeech(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 24) return text.trim();
  const mid = Math.floor(t.length / 2);
  for (const split of [mid, t.indexOf(". ", mid - 20) + 1, t.indexOf("? ", mid - 20) + 1]) {
    if (split <= 8 || split >= t.length - 8) continue;
    const left = t.slice(0, split).trim();
    const right = t.slice(split).trim();
    if (similarUtterance(left, right)) return left;
  }
  return text.trim();
}

export function dedupePatientFragments(fragments: string[]): string[] {
  const collapsed = fragments
    .map((s) => collapseRepeatedSpeech(s))
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const f of collapsed) {
    if (out.some((p) => similarUtterance(p, f))) continue;
    out.push(f);
  }
  return out;
}

function flaggedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return RED_FLAGS.filter((f) => {
    const idx = lower.indexOf(f);
    return idx >= 0 && !isNegatedAt(lower, idx);
  });
}

const FACT_LABELS: Record<string, string> = {
  fever: "fever",
  sore_throat: "sore throat",
  cough: "cough",
  dyspnea: "shortness of breath",
  headache: "headache",
  photophobia: "photophobia",
  dysuria: "dysuria",
  reflux: "post-meal chest burning",
  vomiting: "vomiting",
  diarrhea: "diarrhea",
  rash: "rash",
  neck_stiffness: "neck stiffness",
};

function isQuestionOrFiller(s: string): boolean {
  const t = s.trim();
  if (/\?/.test(t)) return true;
  return /what do you think|do you think|i guess|\big\b/i.test(t) &&
    !/\bfever\b|\bheadache\b|\bpain\b|\bvomit|\bcough|\brash\b/i.test(t);
}

function composeClinicalSynthesis(input: {
  timeline: { text: string }[];
  mappings: AppliedMapping[];
  medications: string[];
  flags: string[];
  sourceText: string;
}): string {
  const answers = answersFromTranscript(input.sourceText);
  const reported = Object.entries(answers)
    .filter(([, v]) => v === "yes")
    .map(([id]) => FACT_LABELS[id] ?? id.replace(/_/g, " "));
  const mapped = [
    ...new Set(input.mappings.map((m) => m.clinical).filter(Boolean)),
  ];
  const events: string[] = [];
  const seen = new Set<string>();
  for (const ev of input.timeline) {
    if (isQuestionOrFiller(ev.text)) continue;
    const phrase = ev.text.replace(/\s+/g, " ").trim();
    const key = normalizeUtterance(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    events.push(phrase);
  }
  const parts: string[] = [];
  if (reported.length) {
    parts.push(`Patient reports: ${[...new Set([...reported, ...mapped])].join(", ")}.`);
  } else if (events.length) {
    parts.push(`Patient-reported picture, in time order: ${events.join("; ")}.`);
  } else if (mapped.length) {
    parts.push(`Patient reports: ${mapped.join(", ")}.`);
  }
  if (input.medications.length) {
    parts.push(`Medicines named: ${input.medications.join(", ")}.`);
  } else {
    parts.push("No medicines were named in the submitted words.");
  }
  if (input.flags.length) {
    parts.push(`Red-flag phrases present: ${input.flags.join(", ")}.`);
  }
  return parts.join(" ");
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
  differential?: { condition: string; probability: number }[];
}): HandoffBrief {
  const fragments = dedupePatientFragments(input.fragments);
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

  const flags = flaggedPhrases(fragments.join(" "));
  const synthesis = composeClinicalSynthesis({
    timeline,
    mappings,
    medications: input.medications,
    flags,
    sourceText: fragments.join(" "),
  });

  assertMappedSourcing(
    timeline.map((e) => e.text).join(" "),
    fragments,
    mappings,
  );

  const joined = fragments.join("\n");
  const differential =
    input.differential && input.differential.length
      ? input.differential
      : inferTriageFromTranscript(joined).slice(0, 5);
  const ranked = differential
    .slice(0, 4)
    .map((d) => `${d.condition.replace(/_/g, " ")} ${Math.round(d.probability * 100)}%`)
    .join("; ");
  const triageSnapshot = differential[0]
    ? `Engine ranking: ${ranked}.`
    : "Engine ranking: undetermined.";

  return {
    id: newBriefId(),
    chiefComplaint: chief,
    timeline,
    patientWords: fragments,
    synthesis,
    traces,
    mappings,
    medications: input.medications,
    differential,
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
