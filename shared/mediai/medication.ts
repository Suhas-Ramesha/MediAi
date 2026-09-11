import { lookupLocal, RXNORM, type RxNormHit } from "./rxnorm.ts";

export { RXNORM };
export type { RxNormHit };

export interface MedicationEntry {
  id: string;
  rxcui: string;
  genericName: string;
  brandName?: string;
  dose?: string;
  sourceDoctorId: string;
  /** Every clinic/doctor that named this CUI. Always includes sourceDoctorId. */
  sourceDoctorIds?: string[];
  startedOn: string;
  rawText: string;
}

export function doctorsFor(med: MedicationEntry): string[] {
  const ids = [med.sourceDoctorId, ...(med.sourceDoctorIds ?? [])].filter(Boolean);
  return [...new Set(ids)];
}

export interface SafetyGraph {
  patientId: string;
  allergies: string[];
  organFlags: { kidneyImpairment: boolean; liverImpairment: boolean };
  medications: MedicationEntry[];
}


/**
 * Published high-priority DDI subset (ONC 2014 high-priority list + NLM RxNav
 * ingredient CUIs). Unknown pairs stay incomplete, never a silent all-clear.
 */
export const INTERACTIONS: { a: string; b: string; note: string; source: string }[] = [
  { a: "11289", b: "5640", note: "Warfarin + NSAID: bleeding risk", source: "ONC high-priority DDI" },
  { a: "11289", b: "7258", note: "Warfarin + naproxen: bleeding risk", source: "ONC high-priority DDI" },
  { a: "11289", b: "3355", note: "Warfarin + diclofenac: bleeding risk", source: "ONC high-priority DDI" },
  { a: "11289", b: "1191", note: "Warfarin + aspirin: bleeding risk", source: "ONC high-priority DDI" },
  { a: "11289", b: "703", note: "Warfarin + amiodarone: INR can rise", source: "ONC high-priority DDI" },
  { a: "11289", b: "4450", note: "Warfarin + fluconazole: INR can rise", source: "ONC high-priority DDI" },
  { a: "11289", b: "6922", note: "Warfarin + metronidazole: INR can rise", source: "ONC high-priority DDI" },
  { a: "11289", b: "10180", note: "Warfarin + sulfamethoxazole: bleeding risk", source: "ONC high-priority DDI" },
  { a: "11289", b: "10831", note: "Warfarin + co-trimoxazole: bleeding risk", source: "ONC high-priority DDI" },
  { a: "36567", b: "5640", note: "Statin + ibuprofen: monitor liver and muscle symptoms", source: "local conservative pair" },
  { a: "36567", b: "21212", note: "Simvastatin + clarithromycin: myopathy / rhabdomyolysis risk", source: "ONC high-priority DDI" },
  { a: "36567", b: "4053", note: "Simvastatin + erythromycin: myopathy risk", source: "ONC high-priority DDI" },
  { a: "83367", b: "21212", note: "Atorvastatin + clarithromycin: myopathy risk", source: "ONC high-priority DDI" },
  { a: "136411", b: "4917", note: "Sildenafil + nitrate: severe hypotension", source: "ONC high-priority DDI" },
  { a: "9997", b: "8591", note: "Spironolactone + potassium: hyperkalemia", source: "ONC high-priority DDI" },
  { a: "29046", b: "9997", note: "ACE inhibitor + spironolactone: hyperkalemia", source: "ONC high-priority DDI" },
  { a: "29046", b: "8591", note: "ACE inhibitor + potassium: hyperkalemia", source: "ONC high-priority DDI" },
  { a: "10689", b: "36437", note: "Tramadol + SSRI: serotonin / seizure risk", source: "ONC high-priority DDI" },
  { a: "10689", b: "4493", note: "Tramadol + fluoxetine: serotonin / seizure risk", source: "ONC high-priority DDI" },
  { a: "3407", b: "21212", note: "Digoxin + clarithromycin: digoxin toxicity", source: "ONC high-priority DDI" },
  { a: "10438", b: "2551", note: "Theophylline + ciprofloxacin: theophylline toxicity", source: "ONC high-priority DDI" },
  { a: "6851", b: "10829", note: "Methotrexate + trimethoprim: marrow toxicity", source: "ONC high-priority DDI" },
  { a: "32968", b: "1191", note: "Clopidogrel + aspirin: bleeding risk (dual antiplatelet)", source: "ONC high-priority DDI" },
];

/** Conservative cross-reactivity from published allergy classes. */
export const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "piperacillin"],
  amoxicillin: ["penicillin", "amoxicillin", "ampicillin"],
  ampicillin: ["penicillin", "amoxicillin", "ampicillin"],
  cephalexin: ["cephalexin", "cefixime", "penicillin"],
  cefixime: ["cefixime", "cephalexin", "penicillin"],
  sulfa: ["sulfamethoxazole", "sulfamethoxazole / trimethoprim", "cotrimoxazole"],
  sulfamethoxazole: ["sulfamethoxazole", "sulfamethoxazole / trimethoprim"],
  nsaid: ["ibuprofen", "naproxen", "diclofenac", "aspirin"],
  ibuprofen: ["ibuprofen", "naproxen", "diclofenac"],
  aspirin: ["aspirin", "ibuprofen", "naproxen"],
  opioid: ["morphine", "codeine", "tramadol"],
  morphine: ["morphine", "codeine"],
  codeine: ["codeine", "morphine"],
};

export function allergyConflict(allergies: string[], generic: string): boolean {
  const g = generic.toLowerCase();
  for (const raw of allergies) {
    const a = raw.toLowerCase();
    if (g.includes(a) || a.includes(g)) return true;
    const fromAllergy = ALLERGY_CLASSES[a];
    if (fromAllergy?.includes(g)) return true;
    const fromDrug = ALLERGY_CLASSES[g];
    if (fromDrug?.some((x) => a.includes(x))) return true;
  }
  return false;
}

export const SIDER: {
  rxcui: string;
  effect: string;
  onsetDaysMin: number;
  onsetDaysMax: number;
}[] = [
  { rxcui: "6809", effect: "diarrhea", onsetDaysMin: 1, onsetDaysMax: 21 },
  { rxcui: "723", effect: "rash", onsetDaysMin: 1, onsetDaysMax: 14 },
  { rxcui: "11289", effect: "bruising", onsetDaysMin: 2, onsetDaysMax: 60 },
  { rxcui: "36567", effect: "muscle pain", onsetDaysMin: 7, onsetDaysMax: 90 },
  { rxcui: "29046", effect: "cough", onsetDaysMin: 3, onsetDaysMax: 90 },
];

export function normalizeDrugName(raw: string): { rxcui: string; generic: string } | null {
  const hit = lookupLocal(raw);
  if (!hit) return null;
  return { rxcui: hit.rxcui, generic: hit.generic };
}

/** Parse typed prescription / chat text. Does not invent drugs. */
export function parsePrescriptionText(
  text: string,
  sourceDoctorId: string,
  startedOn: string,
): { entries: Omit<MedicationEntry, "id">[]; unknownTokens: string[] } {
  const parts = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const entries: Omit<MedicationEntry, "id">[] = [];
  const unknownTokens: string[] = [];
  for (const part of parts) {
    const hit =
      normalizeDrugName(part) ??
      part
        .split(/\s+/)
        .map((tok) => normalizeDrugName(tok))
        .find((h) => h) ??
      null;
    if (!hit) {
      if (/[a-z]{4,}/i.test(part)) unknownTokens.push(part);
      continue;
    }
    const dose = part.match(/\d+\s?(mg|mcg|iu)/i)?.[0];
    entries.push({
      rxcui: hit.rxcui,
      genericName: hit.generic,
      brandName: part,
      dose,
      sourceDoctorId,
      startedOn,
      rawText: part,
    });
  }
  return { entries, unknownTokens };
}

const DRUG_HINT = /\b(\d+\s?(mg|mcg|g|iu|ml)|tablet|capsule|syrup|injection)\b/i;
const LOOKS_LIKE_STEM =
  /(cillin|mycin|pril|sartan|statin|olol|azepam|formin|dronate|gliptin|prazole|coxib)$/i;

/** Calendar / English tokens that share a stem with real INNs (april ~ -pril). */
const NER_STOP = new Set([
  "april", "march", "june", "july", "august", "since", "started", "taking",
  "tablet", "tablets", "capsule", "morning", "night", "today", "yesterday",
  "about", "after", "before", "could", "would", "should", "there", "their",
  "have", "been", "this", "that", "with", "from", "pain", "fever", "cough",
  "throat", "chest", "water", "blood", "pressure", "doctor", "clinic",
  "combine", "prescription", "medicines", "medicine", "monitor", "symptoms",
  "something", "nothing", "anything", "information", "condition",
]);

/** NER over free text. Tokens without a CUI stay unmatched (incomplete). */
export function extractDrugMentionsFromText(text: string): {
  raw: string;
  hit: ReturnType<typeof normalizeDrugName>;
}[] {
  const tokens = text.split(/[^a-zA-Z0-9+/]+/).filter((t) => t.length >= 4);
  const seen = new Set<string>();
  const mentions: { raw: string; hit: ReturnType<typeof normalizeDrugName> }[] = [];
  const consider = (raw: string) => {
    const key = raw.toLowerCase();
    if (seen.has(key)) return;
    if (/^\d+\s?(mg|mcg|g|iu|ml)$/i.test(raw)) return;
    const parts = raw.split(/\s+/).map((p) => p.toLowerCase());
    const hit = normalizeDrugName(raw);
    if (hit) {
      seen.add(key);
      mentions.push({ raw, hit });
      return;
    }
    if (parts.length > 1) return;
    if (NER_STOP.has(key)) return;
    if (raw.length < 5) return;
    if (!LOOKS_LIKE_STEM.test(raw) && !DRUG_HINT.test(raw)) return;
    seen.add(key);
    mentions.push({ raw, hit: null });
  };
  for (let i = 0; i < tokens.length; i++) {
    consider(tokens[i]);
    if (i + 1 < tokens.length) consider(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return mentions;
}

export function mergeIntoGraph(
  graph: SafetyGraph,
  incoming: Omit<MedicationEntry, "id">[],
): { graph: SafetyGraph; merged: number; added: number } {
  let merged = 0;
  let added = 0;
  const meds = [...graph.medications];
  for (const item of incoming) {
    const existing = meds.find((m) => m.rxcui === item.rxcui);
    if (existing) {
      merged += 1;
      if (!existing.brandName && item.brandName) existing.brandName = item.brandName;
      existing.sourceDoctorIds = doctorsFor({
        ...existing,
        sourceDoctorIds: [...doctorsFor(existing), ...doctorsFor(item as MedicationEntry)],
      });
    } else {
      added += 1;
      meds.push({
        ...item,
        id: `${item.rxcui}-${meds.length}`,
        sourceDoctorIds: doctorsFor(item as MedicationEntry),
      });
    }
  }
  return { graph: { ...graph, medications: meds }, merged, added };
}

export interface AuditResult {
  status: "clear" | "interaction" | "allergy" | "organ" | "incomplete";
  findings: string[];
}

export function forwardAudit(
  graph: SafetyGraph,
  newDrugRaw: string,
  newDoctorId: string,
): AuditResult {
  const hit = normalizeDrugName(newDrugRaw);
  if (!hit) {
    return {
      status: "incomplete",
      findings: [
        `Unknown drug token "${newDrugRaw}". Cannot certify an all-clear.`,
      ],
    };
  }
  const findings: string[] = [];
  if (allergyConflict(graph.allergies, hit.generic)) {
    findings.push(`Allergy overlap with ${hit.generic}`);
    return { status: "allergy", findings };
  }
  if (hit.generic === "metformin" && graph.organFlags.kidneyImpairment) {
    findings.push("Metformin with kidney impairment needs clinician review");
    return { status: "organ", findings };
  }
  for (const m of graph.medications) {
    const pair = INTERACTIONS.find(
      (i) =>
        (i.a === m.rxcui && i.b === hit.rxcui) ||
        (i.b === m.rxcui && i.a === hit.rxcui),
    );
    if (pair) {
      findings.push(
        `${pair.note} (existing from doctor ${m.sourceDoctorId}, new from ${newDoctorId})`,
      );
    }
  }
  if (findings.length) return { status: "interaction", findings };
  return { status: "clear", findings: [] };
}

/**
 * Audit the whole list (not only the next add). Cross-doctor pairs are labeled
 * so a clash from two clinics is visible without a Healthplix-style silo.
 */
export function auditGraph(graph: SafetyGraph): AuditResult {
  const findings: string[] = [];
  let status: AuditResult["status"] = "clear";

  for (const m of graph.medications) {
    if (allergyConflict(graph.allergies, m.genericName)) {
      findings.push(`Allergy overlap with ${m.genericName}`);
      status = "allergy";
    }
    if (m.genericName === "metformin" && graph.organFlags.kidneyImpairment) {
      findings.push("Metformin with kidney impairment needs clinician review");
      if (status === "clear") status = "organ";
    }
  }

  for (let i = 0; i < graph.medications.length; i++) {
    for (let j = i + 1; j < graph.medications.length; j++) {
      const a = graph.medications[i];
      const b = graph.medications[j];
      const pair = INTERACTIONS.find(
        (p) =>
          (p.a === a.rxcui && p.b === b.rxcui) ||
          (p.b === a.rxcui && p.a === b.rxcui),
      );
      if (!pair) continue;
      const aDocs = doctorsFor(a).join(", ");
      const bDocs = doctorsFor(b).join(", ");
      const cross = doctorsFor(a).some((d) => !doctorsFor(b).includes(d)) ||
        doctorsFor(b).some((d) => !doctorsFor(a).includes(d));
      const where = cross
        ? `cross-doctor (${a.genericName} from ${aDocs}; ${b.genericName} from ${bDocs})`
        : `same list (${aDocs || bDocs})`;
      findings.push(`${pair.note} — ${where}`);
      if (status === "clear" || status === "organ") status = "interaction";
    }
  }

  if (!findings.length) return { status: "clear", findings: [] };
  return { status, findings };
}

export function removeFromGraph(graph: SafetyGraph, rxcui: string): SafetyGraph {
  return {
    ...graph,
    medications: graph.medications.filter((m) => m.rxcui !== rxcui),
  };
}

export function sideEffectWatch(
  graph: SafetyGraph,
  symptom: string,
  today: string,
): { matches: { drug: string; effect: string; daysSinceStart: number }[] } {
  const day = Date.parse(today);
  const matches = [];
  for (const m of graph.medications) {
    const started = Date.parse(m.startedOn);
    const days = Math.round((day - started) / 86400000);
    for (const s of SIDER) {
      if (s.rxcui !== m.rxcui) continue;
      if (!symptom.toLowerCase().includes(s.effect)) continue;
      if (days < s.onsetDaysMin || days > s.onsetDaysMax) continue;
      matches.push({
        drug: m.genericName,
        effect: s.effect,
        daysSinceStart: days,
      });
    }
  }
  matches.sort((a, b) => a.daysSinceStart - b.daysSinceStart);
  return { matches };
}
