import { toClinicalText } from "./colloquial.ts";
import { answersFromTranscript } from "./triage.ts";
import { RED_FLAGS } from "./intake.ts";

export type BodyRegionId =
  | "head"
  | "throat"
  | "chest"
  | "abdomen"
  | "pelvis"
  | "left_arm"
  | "right_arm"
  | "skin";

export interface BodyRegion {
  id: BodyRegionId;
  label: string;
  /** Center of the marker in a 200×480 viewBox. */
  x: number;
  y: number;
}

export const BODY_REGIONS: Record<BodyRegionId, BodyRegion> = {
  head: { id: "head", label: "Head", x: 100, y: 42 },
  throat: { id: "throat", label: "Throat", x: 100, y: 82 },
  chest: { id: "chest", label: "Chest", x: 100, y: 148 },
  abdomen: { id: "abdomen", label: "Abdomen", x: 100, y: 208 },
  pelvis: { id: "pelvis", label: "Lower abdomen", x: 100, y: 252 },
  left_arm: { id: "left_arm", label: "Left arm", x: 46, y: 168 },
  right_arm: { id: "right_arm", label: "Right arm", x: 154, y: 168 },
  skin: { id: "skin", label: "Skin", x: 132, y: 188 },
};

export interface BodyHit {
  regionId: BodyRegionId;
  label: string;
  sourcePhrases: string[];
  onset: string;
  relatedToAsk: string[];
  urgency: "red" | "routine";
}

export interface BookedVisit {
  when: string;
  doctorName?: string;
}

export interface BodyMapResult {
  hits: BodyHit[];
  findings: string[];
  onsetSummary: string;
  visit: BookedVisit | null;
  redFlags: string[];
}

const CUES: {
  regionId: BodyRegionId;
  re: RegExp;
  related: string[];
}[] = [
  {
    regionId: "head",
    re: /\bheadache\b|\bhead(?:'s| is) pounding\b|\bmigraine\b|\bphotophobia\b|\blight (?:hurt|hurts)\b|\bfever\b|\btemp(?:erature)?\b|\bdizzy|\bdizziness\b/i,
    related: [
      "Is it one side or both?",
      "Does light or sound make it worse?",
      "Is the neck stiff?",
      "Is this the worst headache of your life?",
    ],
  },
  {
    regionId: "throat",
    re: /\bsore throat\b|\bthroat(?:'s| is) killing\b|\bswallow\b|\braw throat\b/i,
    related: [
      "Can you swallow fluids?",
      "Is one side worse?",
      "Any fever with it?",
    ],
  },
  {
    regionId: "chest",
    re: /\bchest pain\b|\bcrushing chest\b|\bpalpitation|\bheart racing\b|\bshort of breath\b|\btrouble breathing\b|\bcough\b|\bheartburn\b|\breflux\b/i,
    related: [
      "Does it move into an arm, jaw, or back?",
      "Were you walking or at rest?",
      "Any sweating or breathlessness with it?",
    ],
  },
  {
    regionId: "abdomen",
    re: /\bvomit|\bthrowing up\b|\bnausea\b|\bqueasy\b|\bdiarrhea\b|\bthe runs\b|\bstomach\b|\babdomen\b|\bbelly\b/i,
    related: [
      "Can you keep fluids down?",
      "Any blood in vomit or stool?",
      "How many times today?",
    ],
  },
  {
    regionId: "pelvis",
    re: /\bdysuria\b|\bburning when (?:i )?(?:pee|pass)\b|\burine\b|\bpee\b/i,
    related: ["Any fever?", "Pain in the back or side?", "How long has passing urine hurt?"],
  },
  {
    regionId: "left_arm",
    re: /\bleft arm\b|\bpain radiating to the arm\b|\barm weakness\b/i,
    related: ["Is the chest involved as well?", "When did the arm symptom start?"],
  },
  {
    regionId: "right_arm",
    re: /\bright arm\b/i,
    related: ["Is the chest involved as well?", "When did the arm symptom start?"],
  },
  {
    regionId: "skin",
    re: /\brash\b|\bitchy spots?\b|\bitch\b|\bacne\b/i,
    related: ["Is it spreading?", "Any fever with the rash?", "Does it blanch when pressed?"],
  },
];

export function onsetFromText(text: string): string {
  const numbered = text.match(/(\d+)\s+days?\s+ago/i);
  if (numbered) return `${numbered[1]} days ago`;
  const past = text.match(/for the past\s+(\d+)\s+days?/i);
  if (past) return `for the past ${past[1]} days`;
  if (/yesterday|since yesterday/i.test(text)) return "since yesterday";
  if (/last week/i.test(text)) return "last week";
  if (/this morning/i.test(text)) return "this morning";
  if (/last night/i.test(text)) return "last night";
  if (/since then|after that|then /i.test(text)) return "after an earlier symptom";
  return "timing not stated in your words";
}

function phrasesFor(text: string, re: RegExp): string[] {
  const words = text.split(/[\n.?!;]+/).map((s) => s.trim()).filter(Boolean);
  return words.filter((w) => re.test(w)).slice(0, 3);
}

function alreadyCovered(text: string, question: string): boolean {
  const key = question.toLowerCase();
  if (/one side|both/.test(key) && /one side|both sides|left|right/.test(text)) return true;
  if (/light|sound/.test(key) && /light|photophobia|sound/.test(text)) return true;
  if (/neck/.test(key) && /neck/.test(text)) return true;
  if (/swallow/.test(key) && /swallow/.test(text)) return true;
  if (/fever/.test(key) && /fever|temp/.test(text)) return true;
  if (/arm|jaw|back/.test(key) && /arm|jaw|back/.test(text)) return true;
  if (/fluids/.test(key) && /fluid|drink|water/.test(text)) return true;
  return false;
}

export function mapTranscriptToBody(
  raw: string,
  visit: BookedVisit | null = null,
): BodyMapResult {
  const text = `${raw} ${toClinicalText(raw)}`.toLowerCase();
  const onset = onsetFromText(raw);
  const flags = RED_FLAGS.filter((f) => text.includes(f));
  const hits: BodyHit[] = [];

  for (const cue of CUES) {
    if (!cue.re.test(text)) continue;
    hits.push({
      regionId: cue.regionId,
      label: BODY_REGIONS[cue.regionId].label,
      sourcePhrases: phrasesFor(raw, cue.re),
      onset,
      relatedToAsk: cue.related.filter((q) => !alreadyCovered(text, q)),
      urgency: flags.length ? "red" : "routine",
    });
  }

  const answers = answersFromTranscript(raw);
  const findings = Object.entries(answers)
    .filter(([, v]) => v === "yes")
    .map(([id]) => id.replace(/_/g, " "));

  return {
    hits,
    findings,
    onsetSummary: hits.length ? onset : "No localisable symptom mapped yet",
    visit,
    redFlags: flags,
  };
}
