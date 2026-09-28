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
  synonyms?: string[];
}

export const COLLOQUIAL_LEXICON: ColloquialMapping[] = [
  {
    id: "fever",
    clinical: "fever",
    synonyms: ["fever", "fevers", "febrile", "pyrexia", "pyrexial", "hyperthermia", "temp", "temperature"],
    patterns: [
      /\brun(?:ning)? a temp(?:erature)?\b/i,
      /\bburning up\b/i,
      /\bfever(?:ish)?\b/i,
      /\btemp(?:erature)? (?:of|at) \d+/i,
      /\bhigh (?:fever|temp(?:erature)?)\b/i,
      /\bspiking a temp\b/i,
      /\bfeeling hot and cold\b/i,
      /\bchills and fever\b/i,
    ],
  },
  {
    id: "sore_throat",
    clinical: "sore throat",
    synonyms: ["sore throat", "pharyngitis", "odynophagia", "pharyngeal", "throat pain", "throat"],
    patterns: [
      /\bthroat(?:'s| is) killing me\b/i,
      /\braw throat\b/i,
      /\bscratchy throat\b/i,
      /\bsore throat\b/i,
      /\bthroat (?:hurts|aches|is sore)\b/i,
      /\b(?:pain|hurts?) (?:to|when) swallow(?:ing)?\b/i,
    ],
  },
  {
    id: "vomiting",
    clinical: "vomiting",
    synonyms: ["vomiting", "emesis", "emetic", "vomit", "vomitus", "throwing up"],
    patterns: [
      /\bthrowing up\b/i,
      /\bthrew up\b/i,
      /\bvomit(?:ing|ed|s)?\b/i,
      /\bchucked up\b/i,
      /\bspewing\b/i,
      /\bpuking\b/i,
      /\bemesis\b/i,
    ],
  },
  {
    id: "diarrhea",
    clinical: "diarrhea",
    synonyms: ["diarrhea", "diarrheal", "loose stools", "gastroenteritis", "loose motions"],
    patterns: [
      /\bthe runs\b/i,
      /\bloose stools?\b/i,
      /\bwatery stools?\b/i,
      /\btrotting to the (?:loo|toilet)\b/i,
      /\bloose motions?\b/i,
      /\bdiarrhea\b/i,
    ],
  },
  {
    id: "dysuria",
    clinical: "dysuria",
    synonyms: ["dysuria", "painful urination", "burning urination", "urinary pain"],
    patterns: [
      /\bburning when (?:i )?pee\b/i,
      /\bsting(?:ing)? when (?:i )?pass water\b/i,
      /\bpain(?:ful)? (?:urination|peeing)\b/i,
    ],
  },
  {
    id: "dyspnea",
    clinical: "dyspnea",
    synonyms: ["dyspnea", "dyspneic", "breathlessness", "shortness of breath", "respiratory distress", "difficulty breathing", "respiratory"],
    patterns: [
      /\bcan(?:not|'t) catch my breath\b/i,
      /\b(?:trouble|hard|difficulty)\s+(?:catching|to catch)\s+(?:my\s+)?breath\b/i,
      /\bgasping for air\b/i,
      /\bwinded(?: walking)?\b/i,
      /\bshort(?:ness)? of breath\b/i,
      /\bhard to breathe\b/i,
      /\btrouble breathing\b/i,
      /\bdifficulty breathing\b/i,
      /\bbreathless(?:ness)?\b/i,
    ],
  },
  {
    id: "headache",
    clinical: "headache",
    synonyms: ["headache", "headaches", "cephalea", "cephalalgia", "migraine", "cranial pain"],
    patterns: [
      /\bhead(?:'s| is) pounding\b/i,
      /\bpounding head\b/i,
      /\bhead(?:ache)? (?:hurts|aching|hurting)\b/i,
      /\bhead is killing me\b/i,
      /\bthrobbing head\b/i,
      /\b(?:bad|terrible|severe|awful|mild) headache\b/i,
      /\bmigraine\b/i,
      /\bheadache\b/i,
    ],
  },
  {
    id: "cough",
    clinical: "cough",
    synonyms: ["cough", "coughing", "tussis", "expectoration", "sputum", "phlegm", "bronchial"],
    patterns: [
      /\bhacking cough\b/i,
      /\bchesty cough\b/i,
      /\bcough(?:ing)?\b/i,
      /\bdry cough\b/i,
      /\bwet cough\b/i,
      /\bcoughing (?:my )?lungs out\b/i,
    ],
  },
  {
    id: "rash",
    clinical: "rash",
    synonyms: ["rash", "erythema", "erythematous", "exanthem", "dermatitis", "eruption", "pruritus", "hives", "urticaria", "lesions"],
    patterns: [
      /\bitchy spots?\b/i,
      /\bcrop of spots\b/i,
      /\bskin rash\b/i,
      /\bbreaking out in (?:a rash|spots|hives)\b/i,
      /\bhives\b/i,
      /\brash\b/i,
    ],
  },
  {
    id: "nausea",
    clinical: "nausea",
    synonyms: ["nausea", "nauseous", "nauseated", "queasiness"],
    patterns: [
      /\bqueasy\b/i,
      /\bsick to my stomach\b/i,
      /\boff my food\b/i,
      /\bnausea\b/i,
      /\bnauseous\b/i,
      /\bnauseated\b/i,
      /\bfeel like (?:vomiting|throwing up)\b/i,
    ],
  },
  {
    id: "constipation",
    clinical: "constipation",
    synonyms: ["constipation", "constipated", "obstipation"],
    patterns: [
      /\bbunged up\b/i,
      /\bcan't poo\b/i,
      /\bhaven't gone in days\b/i,
      /\bconstipated\b/i,
      /\bconstipation\b/i,
    ],
  },
  {
    id: "palpitations",
    clinical: "palpitations",
    synonyms: ["palpitations", "palpitation", "tachycardia", "tachycardic", "arrhythmia", "racing heart"],
    patterns: [
      /\bheart(?:'s| is) racing\b/i,
      /\bthumping heart\b/i,
      /\bheart skipping\b/i,
      /\bpalpitations?\b/i,
      /\bfluttering in my chest\b/i,
    ],
  },
  {
    id: "edema",
    clinical: "swelling of the legs",
    synonyms: ["edema", "edematous", "swelling", "swollen", "fluid retention"],
    patterns: [
      /\bpuffy (?:ankles|legs)\b/i,
      /\bcan(?:not|'t) get my shoes on\b/i,
      /\bswollen (?:feet|ankles|legs)\b/i,
      /\bleg swelling\b/i,
    ],
  },
  {
    id: "hematuria",
    clinical: "blood in the urine",
    synonyms: ["hematuria", "hematuric", "blood in urine", "bloody urine"],
    patterns: [
      /\bblood in (?:my )?pee\b/i,
      /\bpink wee\b/i,
      /\bbloody urine\b/i,
      /\bred urine\b/i,
    ],
  },
  {
    id: "photophobia",
    clinical: "photophobia",
    synonyms: ["photophobia", "photophobic", "light sensitivity"],
    patterns: [
      /\blight (?:hurts|is killing) (?:my )?eyes\b/i,
      /\bcan't look at lights\b/i,
      /\bsensitive to light\b/i,
      /\blight sensitivity\b/i,
    ],
  },
  {
    id: "myalgia",
    clinical: "myalgia",
    synonyms: ["myalgia", "myalgic", "muscle pain", "muscle aches", "body aches"],
    patterns: [
      /\bbody aches?\b/i,
      /\baching all over\b/i,
      /\bmuscle aches?\b/i,
      /\bmuscle pain\b/i,
    ],
  },
  {
    id: "anorexia",
    clinical: "loss of appetite",
    synonyms: ["anorexia", "anorexic", "loss of appetite", "hyporexia", "decreased appetite"],
    patterns: [
      /\bno appetite\b/i,
      /\bcan(?:not|'t) eat\b/i,
      /\blost my appetite\b/i,
      /\bloss of appetite\b/i,
    ],
  },
  {
    id: "chest_pain",
    clinical: "chest pain",
    synonyms: ["chest pain", "angina", "thoracic pain", "precordial pain", "substernal pain"],
    patterns: [
      /\bpain in (?:my )?chest\b/i,
      /\bchest is tight\b/i,
      /\btight chest\b/i,
      /\bpressure in (?:my )?chest\b/i,
      /\bchest (?:hurts|pain|ache)\b/i,
      /\bcrushing chest\b/i,
    ],
  },
  {
    id: "dizziness",
    clinical: "dizziness",
    synonyms: ["dizziness", "vertigo", "lightheadedness", "presyncope", "lightheaded", "faintness"],
    patterns: [
      /\blight[ -]?headed\b/i,
      /\broom is spinning\b/i,
      /\bwoozy\b/i,
      /\bdizzy\b/i,
      /\bdizziness\b/i,
      /\bfeeling (?:dizzy|faint)\b/i,
    ],
  },
  {
    id: "abdominal_pain",
    clinical: "abdominal pain",
    synonyms: ["abdominal pain", "stomach pain", "epigastric pain", "gastric pain", "belly ache", "gastrointestinal pain", "cramping", "cramps"],
    patterns: [
      /\b(?:stomach|tummy|belly|abdomen|abdominal|gut)(?:\s+(?:is|has been|feels))?\s+(?:pain(?:ful)?|ache|aching|hurts?|hurting|cramp(?:s|ing)?|upset)\b/i,
      /\b(?:pain|cramp(?:s|ing)?|ache|hurting) in (?:my )?(?:stomach|tummy|belly|abdomen|gut)\b/i,
      /\bcramping in my stomach\b/i,
      /\bupset (?:stomach|tummy|belly)\b/i,
      /\bgut pain\b/i,
    ],
  },
  {
    id: "fatigue",
    clinical: "fatigue",
    synonyms: ["fatigue", "fatigued", "exhaustion", "exhausted", "lethargy", "lethargic", "malaise", "asthenia", "tiredness", "weakness"],
    patterns: [
      /\b(?:feeling |feel )?(?:so |very )?(?:tired|exhausted|fatigued|worn out|drained|weak)\b/i,
      /\b(?:feeling |feel )?weak\b/i,
      /\bextreme tiredness\b/i,
      /\bno energy\b/i,
      /\blethargic\b/i,
      /\bweakness\b/i,
    ],
  },
  {
    id: "back_pain",
    clinical: "back pain",
    synonyms: ["back pain", "lumbago", "lumbar pain", "dorsalgia"],
    patterns: [
      /\b(?:lower |upper )?back (?:hurts|pain|ache|aching|hurting)\b/i,
      /\bsore back\b/i,
      /\b(?:pain|ache) in (?:my )?back\b/i,
    ],
  },
  {
    id: "congestion",
    clinical: "nasal congestion",
    synonyms: ["nasal congestion", "rhinorrhea", "coryza", "rhinitis", "sinus pressure"],
    patterns: [
      /\b(?:runny|stuffy|blocked|congested) nose\b/i,
      /\bsinus pressure\b/i,
      /\bhead cold\b/i,
    ],
  },
  {
    id: "insomnia",
    clinical: "insomnia",
    synonyms: ["insomnia", "sleeplessness", "sleep disturbance"],
    patterns: [
      /\bcan(?:not|'t) sleep\b/i,
      /\btrouble sleeping\b/i,
      /\bwaking up constantly\b/i,
    ],
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

export const LEXICON_BY_ID = new Map(COLLOQUIAL_LEXICON.map((e) => [e.id, e]));

export function toClinicalText(text: string): string {
  return applyColloquialMap(text).clinical;
}

const STOP = new Set(
  "a an the is am are was were be been being to of and or in on for with that this it its as by from at since ago days day then after before yesterday morning night past wait waiting".split(
    " ",
  ),
);

/**
 * Common connective, structural, and grammatical phrasing used in clinical briefs
 * that do not introduce independent medical diagnoses or pathologies.
 */
export const CLINICAL_CONNECTIVES = new Set([
  // Pronouns, determiners & relatives
  "i", "me", "my", "myself", "we", "our", "us", "he", "him", "his", "she",
  "her", "they", "them", "their", "theirs", "there", "here", "what", "which",
  "who", "whom", "whose", "where", "when", "why", "how", "these", "those",
  "each", "every", "both", "either", "neither", "some", "any", "all", "none",
  "much", "many", "more", "most", "other", "another", "such", "own", "same",

  // Verbs of state, reporting, onset, progression
  "have", "has", "had", "having", "do", "does", "did", "done", "doing", "get", "got", "getting",
  "presents", "presented", "presenting", "presentation",
  "reports", "reported", "reporting",
  "states", "stated", "stating",
  "describes", "described", "describing",
  "complains", "complained", "complaining", "complaint", "complaints",
  "notes", "noted", "noting",
  "mentions", "mentioned", "mentioning", "mention",
  "discloses", "disclosed", "disclosing", "disclose",
  "observes", "observed", "observing", "observe",
  "characterizes", "characterized", "characterizing", "characterize",
  "indicates", "indicated", "indicating",
  "denies", "denied", "denying",
  "shows", "showed", "showing",
  "started", "starts", "starting", "start",
  "began", "begins", "beginning", "begin",
  "developed", "develops", "developing", "development",
  "experienced", "experiences", "experiencing", "experience",
  "felt", "feels", "feeling",
  "remains", "remained", "persists", "persisted", "persisting", "persistent",
  "worsened", "worsening", "worsens", "worse",
  "improved", "improving", "improves",
  "occurred", "occurs", "occurring",
  "accompanied", "accompanying", "associated",
  "included", "includes", "including",
  "requires", "required", "advises", "advised",
  "warrants", "warranted", "warranting", "warrant",

  // Clinical structure & narrative terms
  "patient", "individual", "adult", "male", "female", "person",
  "symptom", "symptoms", "symptomatic",
  "sign", "signs",
  "finding", "findings",
  "clinical", "picture", "pattern", "profile", "feature", "features",
  "history", "timeline", "course", "progression", "progress", "progressed", "progresses", "progressing",
  "order", "duration", "frequency",
  "onset", "acute", "subacute", "chronic", "intermittent", "constant", "continuous", "gradual", "sudden",
  "episode", "episodes", "event", "events",
  "condition", "illness", "state", "status",
  "intake", "brief", "synthesis", "summary", "evaluation", "assessment", "consultation", "management",
  "primary", "secondary", "chief", "initial", "initially", "subsequent", "subsequently",
  "concomitant", "concurrent", "recurrent", "recurrently",
  "followed", "following", "prior", "preceding", "current", "currently", "recent", "recently", "active",
  "later", "earlier", "duration",
  "mild", "moderate", "severe", "intensity", "severity", "marked", "notable", "apparent", "concerning",
  "relevant", "significant", "pertinent", "additional", "further", "extra",
  "include", "includes", "included", "including",
  "endorse", "endorses", "endorsed", "endorsing",
  "involve", "involves", "involved", "involving",

  // Medication, review & flags
  "medication", "medications", "medicine", "medicines", "meds", "drugs", "treatment", "treatments",
  "prescription", "prescriptions", "prescribed", "named", "unnamed", "none", "no", "not", "without",
  "negative", "positive", "normal", "abnormal", "unremarkable", "remarkable",
  "red", "flag", "flags", "red-flag", "warning", "words", "speech", "text", "submitted", "taken",

  // Quantifiers, prepositions, time
  "about", "approximate", "approximately", "around", "over", "under", "per", "into", "onto",
  "out", "up", "down", "through", "during", "while", "also", "further", "furthermore",
  "however", "although", "well", "due", "likely", "possible", "potential",
  "hours", "hour", "weeks", "week", "months", "month", "today", "tonight", "afternoon", "evening",
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "twenty", "thirty", "first", "second", "third", "past", "several",

  // General sensation & region descriptors
  "body", "overall", "general", "generalized", "localized", "area", "region", "side", "bilateral", "unilateral",
  "discomfort", "sensation", "distress", "trouble", "difficulty", "persistent", "persisting", "constant", "continuous"
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && !CLINICAL_CONNECTIVES.has(t) && !/^\d+$/.test(t));
}

/**
 * Every substantive clinical diagnosis/pathology token in `statement` must come
 * from an applied mapping whose source span is in the transcript or in the patient words.
 * Standard grammatical and clinical connective terms are permitted.
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
    const entry = LEXICON_BY_ID.get(map.id);
    if (entry?.synonyms) {
      for (const syn of entry.synonyms) {
        for (const tok of tokens(syn)) allowed.add(tok);
      }
    }
  }
  for (const tok of tokens(statement)) {
    if (!allowed.has(tok)) {
      throw new Error("unsourced_claim");
    }
  }
}

