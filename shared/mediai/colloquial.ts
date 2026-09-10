/**
 * Conservative colloquial → clinical map.
 * A clinical term is emitted only when a listed pattern matches patient text.
 * Unmapped wording stays verbatim. Nothing is invented.
 */

export interface ColloquialMapping {
  id: string;
  /** Clinical phrase used in the synthesis layer. */
  clinical: string;
  patterns: RegExp[];
}

export const COLLOQUIAL_LEXICON: ColloquialMapping[] = [
  {
    id: "fever",
    clinical: "fever",
    patterns: [
      /\brun(?:ning)? a temp(?:erature)?\b/i,
      /\bburning up\b/i,
      /\bfeverish\b/i,
      /\btemp(?:erature)? (?:of|at) \d+/i,
    ],
  },
  {
    id: "sore_throat",
    clinical: "sore throat",
    patterns: [
      /\bthroat(?:'s| is) killing me\b/i,
      /\braw throat\b/i,
      /\bscratchy throat\b/i,
    ],
  },
  {
    id: "vomiting",
    clinical: "vomiting",
    patterns: [/\bthrowing up\b/i, /\bchucked up\b/i, /\bspewing\b/i, /\bpuking\b/i],
  },
  {
    id: "diarrhea",
    clinical: "diarrhea",
    patterns: [/\bthe runs\b/i, /\bloose stools?\b/i, /\btrotting to the (?:loo|toilet)\b/i],
  },
  {
    id: "dysuria",
    clinical: "dysuria",
    patterns: [
      /\bburning when (?:i )?pee\b/i,
      /\bsting(?:ing)? when (?:i )?pass water\b/i,
    ],
  },
  {
    id: "dyspnea",
    clinical: "dyspnea",
    patterns: [
      /\bcan(?:not|'t) catch my breath\b/i,
      /\bgasping for air\b/i,
      /\bwinded walking\b/i,
    ],
  },
  {
    id: "headache",
    clinical: "headache",
    patterns: [/\bhead(?:'s| is) pounding\b/i, /\bpounding head\b/i],
  },
  {
    id: "cough",
    clinical: "cough",
    patterns: [/\bhacking cough\b/i, /\bchesty cough\b/i],
  },
  {
    id: "rash",
    clinical: "rash",
    patterns: [/\bitchy spots?\b/i, /\bcrop of spots\b/i],
  },
  {
    id: "nausea",
    clinical: "nausea",
    patterns: [/\bqueasy\b/i, /\bsick to my stomach\b/i, /\boff my food\b/i],
  },
  {
    id: "constipation",
    clinical: "constipation",
    patterns: [/\bbunged up\b/i, /\bcan't poo\b/i, /\bhaven't gone in days\b/i],
  },
  {
    id: "palpitations",
    clinical: "palpitations",
    patterns: [/\bheart(?:'s| is) racing\b/i, /\bthumping heart\b/i, /\bheart skipping\b/i],
  },
  {
    id: "edema",
    clinical: "swelling of the legs",
    patterns: [/\bpuffy (?:ankles|legs)\b/i, /\bcan(?:not|'t) get my shoes on\b/i],
  },
  {
    id: "hematuria",
    clinical: "blood in the urine",
    patterns: [/\bblood in (?:my )?pee\b/i, /\bpink wee\b/i],
  },
  {
    id: "photophobia",
    clinical: "photophobia",
    patterns: [/\blight (?:hurts|is killing) (?:my )?eyes\b/i, /\bcan't look at lights\b/i],
  },
  {
    id: "myalgia",
    clinical: "myalgia",
    patterns: [/\bbody aches?\b/i, /\baching all over\b/i],
  },
  {
    id: "anorexia",
    clinical: "loss of appetite",
    patterns: [/\bno appetite\b/i, /\bcan(?:not|'t) eat\b/i],
  },
];

export interface AppliedMapping {
  id: string;
  clinical: string;
  sourceSpan: string;
}

export interface TranslatedLine {
  source: string;
  clinical: string;
  mappings: AppliedMapping[];
}

export function applyColloquialMap(text: string): TranslatedLine {
  const mappings: AppliedMapping[] = [];
  let clinical = text;
  for (const entry of COLLOQUIAL_LEXICON) {
    for (const re of entry.patterns) {
      const m = text.match(re);
      if (!m || m.index === undefined) continue;
      mappings.push({
        id: entry.id,
        clinical: entry.clinical,
        sourceSpan: m[0],
      });
      clinical = clinical.replace(re, entry.clinical);
      break;
    }
  }
  return { source: text, clinical, mappings };
}

export function toClinicalText(text: string): string {
  return applyColloquialMap(text).clinical;
}

const STOP = new Set(
  "a an the is are was were be been to of and or in on for with that this it as by from at since ago days day then after before yesterday morning night for past wait".split(
    " ",
  ),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
}

/**
 * Every extra clinical token in `statement` must come from an applied mapping
 * whose source span is in the transcript. Everything else must already appear
 * in the patient's words.
 */
export function assertMappedSourcing(
  statement: string,
  transcript: string[],
  mappings: AppliedMapping[],
): void {
  const joined = transcript.join(" ").toLowerCase();
  if (!transcript.some((t) => t.trim())) {
    throw new Error("unsourced_claim");
  }
  const allowed = new Set(tokens(joined));
  for (const map of mappings) {
    if (!joined.includes(map.sourceSpan.toLowerCase())) {
      throw new Error("unsourced_claim");
    }
    for (const tok of tokens(map.clinical)) allowed.add(tok);
  }
  for (const tok of tokens(statement)) {
    if (!allowed.has(tok)) {
      throw new Error("unsourced_claim");
    }
  }
}
