import { entropy, type AnswerValue, type ConditionId, type ConditionProbability } from "./types.ts";

export interface Question {
  id: string;
  text: string;
  /** Likelihood P(yes | condition). */
  pYes: Record<ConditionId, number>;
}

export const CONDITIONS: ConditionId[] = [
  "viral_uri",
  "strep_pharyngitis",
  "influenza",
  "pneumonia_suspect",
  "migraine",
  "tension_headache",
  "gerd",
  "uti",
  "covid",
  "gastroenteritis",
];

export const QUESTIONS: Question[] = [
  {
    id: "fever",
    text: "Have you had a fever?",
    pYes: {
      viral_uri: 0.45,
      strep_pharyngitis: 0.7,
      influenza: 0.88,
      pneumonia_suspect: 0.8,
      migraine: 0.05,
      tension_headache: 0.04,
      gerd: 0.05,
      uti: 0.35,
      covid: 0.75,
      gastroenteritis: 0.35,
    },
  },
  {
    id: "sore_throat",
    text: "Do you have a sore throat?",
    pYes: {
      viral_uri: 0.7,
      strep_pharyngitis: 0.92,
      influenza: 0.4,
      pneumonia_suspect: 0.25,
      migraine: 0.05,
      tension_headache: 0.05,
      gerd: 0.15,
      uti: 0.04,
      covid: 0.45,
      gastroenteritis: 0.08,
    },
  },
  {
    id: "cough",
    text: "Do you have a cough?",
    pYes: {
      viral_uri: 0.65,
      strep_pharyngitis: 0.2,
      influenza: 0.7,
      pneumonia_suspect: 0.9,
      migraine: 0.04,
      tension_headache: 0.04,
      gerd: 0.2,
      uti: 0.04,
      covid: 0.8,
      gastroenteritis: 0.08,
    },
  },
  {
    id: "dyspnea",
    text: "Are you short of breath or having trouble breathing?",
    pYes: {
      viral_uri: 0.08,
      strep_pharyngitis: 0.05,
      influenza: 0.2,
      pneumonia_suspect: 0.85,
      migraine: 0.03,
      tension_headache: 0.03,
      gerd: 0.1,
      uti: 0.03,
      covid: 0.35,
      gastroenteritis: 0.05,
    },
  },
  {
    id: "unilateral_throat",
    text: "Is the pain worse on one side when you swallow?",
    pYes: {
      viral_uri: 0.2,
      strep_pharyngitis: 0.7,
      influenza: 0.1,
      pneumonia_suspect: 0.08,
      migraine: 0.02,
      tension_headache: 0.02,
      gerd: 0.05,
      uti: 0.02,
      covid: 0.1,
      gastroenteritis: 0.04,
    },
  },
  {
    id: "rash",
    text: "Do you have a new rash?",
    pYes: {
      viral_uri: 0.08,
      strep_pharyngitis: 0.12,
      influenza: 0.06,
      pneumonia_suspect: 0.05,
      migraine: 0.02,
      tension_headache: 0.02,
      gerd: 0.02,
      uti: 0.03,
      covid: 0.08,
      gastroenteritis: 0.06,
    },
  },
  {
    id: "headache",
    text: "Do you have a headache?",
    pYes: {
      viral_uri: 0.25,
      strep_pharyngitis: 0.2,
      influenza: 0.55,
      pneumonia_suspect: 0.2,
      migraine: 0.95,
      tension_headache: 0.9,
      gerd: 0.08,
      uti: 0.15,
      covid: 0.4,
      gastroenteritis: 0.15,
    },
  },
  {
    id: "photophobia",
    text: "Does light make the headache worse?",
    pYes: {
      viral_uri: 0.05,
      strep_pharyngitis: 0.04,
      influenza: 0.08,
      pneumonia_suspect: 0.04,
      migraine: 0.85,
      tension_headache: 0.15,
      gerd: 0.03,
      uti: 0.03,
      covid: 0.08,
      gastroenteritis: 0.04,
    },
  },
  {
    id: "dysuria",
    text: "Does it burn when you pass urine?",
    pYes: {
      viral_uri: 0.03,
      strep_pharyngitis: 0.02,
      influenza: 0.03,
      pneumonia_suspect: 0.03,
      migraine: 0.02,
      tension_headache: 0.02,
      gerd: 0.02,
      uti: 0.9,
      covid: 0.03,
      gastroenteritis: 0.04,
    },
  },
  {
    id: "reflux",
    text: "Do you get burning in the chest after meals?",
    pYes: {
      viral_uri: 0.05,
      strep_pharyngitis: 0.04,
      influenza: 0.05,
      pneumonia_suspect: 0.06,
      migraine: 0.05,
      tension_headache: 0.05,
      gerd: 0.88,
      uti: 0.04,
      covid: 0.05,
      gastroenteritis: 0.12,
    },
  },
  {
    id: "vomiting",
    text: "Have you been vomiting?",
    pYes: {
      viral_uri: 0.2,
      strep_pharyngitis: 0.08,
      influenza: 0.4,
      pneumonia_suspect: 0.15,
      migraine: 0.55,
      tension_headache: 0.08,
      gerd: 0.25,
      uti: 0.08,
      covid: 0.18,
      gastroenteritis: 0.85,
    },
  },
  {
    id: "diarrhea",
    text: "Do you have diarrhea?",
    pYes: {
      viral_uri: 0.12,
      strep_pharyngitis: 0.05,
      influenza: 0.15,
      pneumonia_suspect: 0.06,
      migraine: 0.04,
      tension_headache: 0.04,
      gerd: 0.08,
      uti: 0.06,
      covid: 0.12,
      gastroenteritis: 0.9,
    },
  },
  {
    id: "neck_stiffness",
    text: "Is your neck stiff or painful to bend?",
    pYes: {
      viral_uri: 0.04,
      strep_pharyngitis: 0.08,
      influenza: 0.06,
      pneumonia_suspect: 0.05,
      migraine: 0.12,
      tension_headache: 0.2,
      gerd: 0.02,
      uti: 0.02,
      covid: 0.04,
      gastroenteritis: 0.03,
    },
  },
];

const MIN_ANSWERS_BEFORE_STOP = 2;
const MAX_QUESTIONS = 8;
const CONFIDENCE_STOP = 0.82;
export const RED_FLAG_QUESTION_IDS = ["dyspnea", "neck_stiffness"] as const;

export interface TriageState {
  answers: Record<string, AnswerValue>;
  turn: number;
}

export function uniformPrior(): Record<ConditionId, number> {
  const p = 1 / CONDITIONS.length;
  return Object.fromEntries(CONDITIONS.map((c) => [c, p])) as Record<
    ConditionId,
    number
  >;
}

export function posterior(
  prior: Record<ConditionId, number>,
  answers: Record<string, AnswerValue>,
): Record<ConditionId, number> {
  const scores: Record<string, number> = {};
  let total = 0;
  for (const c of CONDITIONS) {
    let s = prior[c];
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (!a || a === "unknown") continue;
      const py = q.pYes[c];
      s *= a === "yes" ? py : 1 - py;
    }
    scores[c] = s;
    total += s;
  }
  const out = {} as Record<ConditionId, number>;
  for (const c of CONDITIONS) {
    out[c] = total > 0 ? scores[c] / total : prior[c];
  }
  return out;
}

export function asDistribution(
  post: Record<ConditionId, number>,
): ConditionProbability[] {
  return CONDITIONS.map((condition) => ({
    condition,
    probability: post[condition],
  })).sort((a, b) => b.probability - a.probability);
}

const TRANSCRIPT_CUES: { id: string; yes: RegExp; no?: RegExp }[] = [
  { id: "fever", yes: /\bfever\b|\btemp(?:erature)?\b|\bchills?\b|\bburning up\b|\bfeverish\b/i },
  { id: "sore_throat", yes: /\bsore throat\b|\bthroat(?:'s| is) killing\b|\braw throat\b|\bscratchy throat\b/i },
  { id: "cough", yes: /\bcough(?:ing)?\b|\bhacking\b/i },
  { id: "dyspnea", yes: /\bshort of breath\b|\btrouble breathing\b|\bcan't breathe\b|\bdyspnea\b|\bwinded\b/i },
  { id: "headache", yes: /\bheadache\b|\bhead(?:'s| is) pounding\b|\bmigraine\b/i },
  { id: "photophobia", yes: /\bphotophobia\b|\blight (?:hurt|hurts|makes)\b|\bcan't look at lights\b/i },
  { id: "dysuria", yes: /\bdysuria\b|\bburning when (?:i )?(?:pee|pass)\b|\bburn(?:ing)? (?:on )?(?:urination|urine)\b/i },
  { id: "reflux", yes: /\bheartburn\b|\breflux\b|\bburning in the chest after\b|\bgerd\b/i },
  { id: "vomiting", yes: /\bvomit(?:ing)?\b|\bthrowing up\b|\bpuking\b/i },
  { id: "diarrhea", yes: /\bdiarrhea\b|\bthe runs\b|\bloose stools?\b/i },
  { id: "rash", yes: /\brash\b|\bitchy spots?\b/i },
  { id: "neck_stiffness", yes: /\bstiff neck\b|\bneck stiffness\b/i },
];

function negatedCue(text: string, matchIndex: number): boolean {
  const window = text.slice(Math.max(0, matchIndex - 28), matchIndex);
  return /\bno\b|\bnot\b|\bdenies\b|\bwithout\b|\bn't\b|\bnever\b/.test(window);
}

/** Map free-text chat onto the Bayes question set. Unknown stays unknown. */
export function answersFromTranscript(text: string): Record<string, AnswerValue> {
  const answers: Record<string, AnswerValue> = {};
  for (const cue of TRANSCRIPT_CUES) {
    const m = cue.yes.exec(text);
    if (!m || m.index == null) continue;
    answers[cue.id] = negatedCue(text, m.index) ? "no" : "yes";
  }
  return answers;
}

export function inferTriageFromTranscript(text: string): ConditionProbability[] {
  const answers = answersFromTranscript(text);
  return asDistribution(posterior(uniformPrior(), answers));
}

export interface RankedQuestion {
  question: Question;
  informationGain: number;
}

function expectedPosteriorEntropy(
  post: Record<ConditionId, number>,
  q: Question,
): number {
  let pYes = 0;
  for (const c of CONDITIONS) pYes += post[c] * q.pYes[c];
  pYes = Math.min(0.999, Math.max(0.001, pYes));
  const pNo = 1 - pYes;

  const yesAns = { dummy: "yes" as AnswerValue };
  const noAns = { dummy: "no" as AnswerValue };
  void yesAns;
  void noAns;

  const postYes = posterior(post, { [q.id]: "yes" });
  const postNo = posterior(post, { [q.id]: "no" });
  return (
    pYes * entropy(CONDITIONS.map((c) => postYes[c])) +
    pNo * entropy(CONDITIONS.map((c) => postNo[c]))
  );
}

export function rankQuestions(
  post: Record<ConditionId, number>,
  asked: Set<string>,
): RankedQuestion[] {
  const H = entropy(CONDITIONS.map((c) => post[c]));
  const ranked: RankedQuestion[] = [];
  for (const q of QUESTIONS) {
    if (asked.has(q.id)) continue;
    const ig = H - expectedPosteriorEntropy(post, q);
    ranked.push({ question: q, informationGain: ig });
  }
  ranked.sort((a, b) => b.informationGain - a.informationGain);
  return ranked;
}

export type StopReason = "confidence" | "max_questions" | "red_flag" | null;

export function shouldStop(state: TriageState, post: Record<ConditionId, number>): StopReason {
  const answered = Object.values(state.answers).filter((a) => a !== "unknown").length;
  if (state.answers.dyspnea === "yes") return "red_flag";
  if (state.answers.neck_stiffness === "yes") return "red_flag";
  if (answered < MIN_ANSWERS_BEFORE_STOP) return null;
  if (answered >= MAX_QUESTIONS) return "max_questions";
  const top = Math.max(...CONDITIONS.map((c) => post[c]));
  if (top >= CONFIDENCE_STOP) return "confidence";
  return null;
}

export function nextTriageTurn(state: TriageState): {
  distribution: ConditionProbability[];
  nextQuestion: RankedQuestion | null;
  stop: StopReason;
  ranking: RankedQuestion[];
} {
  const post = posterior(uniformPrior(), state.answers);
  const asked = new Set(Object.keys(state.answers));
  const ranking = rankQuestions(post, asked);
  const stop = shouldStop(state, post);
  return {
    distribution: asDistribution(post),
    nextQuestion: stop ? null : ranking[0] ?? null,
    stop,
    ranking,
  };
}
