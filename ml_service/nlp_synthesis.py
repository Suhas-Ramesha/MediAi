"""
Clinical NLP Synthesis Engine for MediAi.

Extracts clinical entities, temporal markers, red flags, and colloquial-to-clinical
mappings from patient speech fragments, and synthesizes a formal, professional
physician-facing clinical brief narrative.
"""
from __future__ import annotations

import re
from typing import Any


CLINICAL_LEXICON: list[dict[str, Any]] = [
    {
        "id": "fever",
        "clinical": "fever",
        "narrative": "febrile illness",
        "patterns": [
            r"\brun(?:ning)? a temp(?:erature)?\b",
            r"\bburning up\b",
            r"\bfever(?:ish)?\b",
            r"\btemp(?:erature)? (?:of|at) \d+",
            r"\bhigh (?:fever|temp(?:erature)?)\b",
            r"\bspiking a temp\b",
            r"\bchills and fever\b",
            r"\bhot and cold\b",
        ],
    },
    {
        "id": "sore_throat",
        "clinical": "sore throat",
        "narrative": "severe pharyngitis",
        "patterns": [
            r"\bthroat(?:'s| is) killing me\b",
            r"\braw throat\b",
            r"\bscratchy throat\b",
            r"\bsore throat\b",
            r"\bthroat (?:hurts|aches|is sore)\b",
            r"\b(?:pain|hurts?) (?:to|when) swallow(?:ing)?\b",
        ],
    },
    {
        "id": "vomiting",
        "clinical": "vomiting",
        "narrative": "emesis",
        "patterns": [
            r"\bthrowing up\b",
            r"\bthrew up\b",
            r"\bvomit(?:ing|ed|s)?\b",
            r"\bchucked up\b",
            r"\bspewing\b",
            r"\bpuking\b",
            r"\bemesis\b",
        ],
    },
    {
        "id": "diarrhea",
        "clinical": "diarrhea",
        "narrative": "diarrhea",
        "patterns": [
            r"\bthe runs\b",
            r"\bloose stools?\b",
            r"\bwatery stools?\b",
            r"\btrotting to the (?:loo|toilet)\b",
            r"\bloose motions?\b",
            r"\bdiarrhea\b",
        ],
    },
    {
        "id": "dysuria",
        "clinical": "dysuria",
        "narrative": "dysuria",
        "patterns": [
            r"\bburning when (?:i )?pee\b",
            r"\bsting(?:ing)? when (?:i )?pass water\b",
            r"\bpain(?:ful)? (?:urination|peeing)\b",
            r"\bdysuria\b",
        ],
    },
    {
        "id": "dyspnea",
        "clinical": "dyspnea",
        "narrative": "dyspnea",
        "is_red_flag": True,
        "patterns": [
            r"\bcan(?:not|'t) catch my breath\b",
            r"\b(?:trouble|hard|difficulty)\s+(?:catching|to catch)\s+(?:my\s+)?breath\b",
            r"\bgasping for air\b",
            r"\bwinded(?: walking)?\b",
            r"\bshort(?:ness)? of breath\b",
            r"\bhard to breathe\b",
            r"\btrouble breathing\b",
            r"\bdifficulty breathing\b",
            r"\bbreathless(?:ness)?\b",
            r"\bdyspnea\b",
        ],
    },
    {
        "id": "headache",
        "clinical": "headache",
        "narrative": "severe headache",
        "patterns": [
            r"\bhead(?:'s| is) pounding\b",
            r"\bpounding head\b",
            r"\bhead(?:ache)? (?:hurts|aching|hurting)\b",
            r"\bhead is killing me\b",
            r"\bthrobbing head\b",
            r"\b(?:bad|terrible|severe|awful|mild) headache\b",
            r"\bmigraine\b",
            r"\bheadache\b",
        ],
    },
    {
        "id": "cough",
        "clinical": "cough",
        "narrative": "persistent cough",
        "patterns": [
            r"\bhacking cough\b",
            r"\bchesty cough\b",
            r"\bcough(?:ing)?\b",
            r"\bdry cough\b",
            r"\bwet cough\b",
            r"\bcoughing (?:my )?lungs out\b",
        ],
    },
    {
        "id": "rash",
        "clinical": "rash",
        "narrative": "dermatological rash",
        "patterns": [
            r"\bitchy spots?\b",
            r"\bcrop of spots\b",
            r"\bskin rash\b",
            r"\bbreaking out in (?:a rash|spots|hives)\b",
            r"\bhives\b",
            r"\brash\b",
        ],
    },
    {
        "id": "nausea",
        "clinical": "nausea",
        "narrative": "nausea",
        "patterns": [
            r"\bqueasy\b",
            r"\bsick to my stomach\b",
            r"\boff my food\b",
            r"\bnausea\b",
            r"\bnauseous\b",
            r"\bnauseated\b",
            r"\bfeel like (?:vomiting|throwing up)\b",
        ],
    },
    {
        "id": "palpitations",
        "clinical": "palpitations",
        "narrative": "palpitations",
        "patterns": [
            r"\bheart(?:'s| is) racing\b",
            r"\bthumping heart\b",
            r"\bheart skipping\b",
            r"\bpalpitations?\b",
            r"\bfluttering in my chest\b",
        ],
    },
    {
        "id": "chest_pain",
        "clinical": "chest pain",
        "narrative": "chest pain",
        "is_red_flag": True,
        "patterns": [
            r"\bpain in (?:my )?chest\b",
            r"\bchest is tight\b",
            r"\btight chest\b",
            r"\bpressure in (?:my )?chest\b",
            r"\bchest (?:hurts|pain|ache)\b",
            r"\bcrushing chest\b",
        ],
    },
    {
        "id": "dizziness",
        "clinical": "dizziness",
        "narrative": "dizziness and lightheadedness",
        "patterns": [
            r"\blight[ -]?headed\b",
            r"\broom is spinning\b",
            r"\bwoozy\b",
            r"\bdizzy\b",
            r"\bdizziness\b",
            r"\bfeeling (?:dizzy|faint)\b",
        ],
    },
    {
        "id": "abdominal_pain",
        "clinical": "abdominal pain",
        "narrative": "abdominal pain",
        "patterns": [
            r"\b(?:stomach|tummy|belly|abdomen|abdominal|gut)(?:\s+(?:is|has been|feels))?\s+(?:pain(?:ful)?|ache|aching|hurts?|hurting|cramp(?:s|ing)?|upset)\b",
            r"\b(?:pain|cramp(?:s|ing)?|ache|hurting) in (?:my )?(?:stomach|tummy|belly|abdomen|gut)\b",
            r"\bcramping in my stomach\b",
            r"\bupset (?:stomach|tummy|belly)\b",
            r"\bgut pain\b",
        ],
    },
    {
        "id": "fatigue",
        "clinical": "fatigue",
        "narrative": "generalized fatigue",
        "patterns": [
            r"\b(?:feeling |feel )?(?:so |very )?(?:tired|exhausted|fatigued|worn out|drained|weak)\b",
            r"\b(?:feeling |feel )?weak\b",
            r"\bextreme tiredness\b",
            r"\bno energy\b",
            r"\blethargic\b",
            r"\bweakness\b",
            r"\bfatigue\b",
        ],
    },
    {
        "id": "anorexia",
        "clinical": "loss of appetite",
        "narrative": "anorexia",
        "patterns": [
            r"\bno appetite\b",
            r"\bcan(?:not|'t) eat\b",
            r"\blost my appetite\b",
            r"\bloss of appetite\b",
            r"\banorexia\b",
        ],
    },
    {
        "id": "back_pain",
        "clinical: ": "back pain",
        "narrative": "back pain",
        "patterns": [
            r"\b(?:lower |upper )?back (?:hurts|pain|ache|aching|hurting)\b",
            r"\bsore back\b",
            r"\b(?:pain|ache) in (?:my )?back\b",
        ],
    },
    {
        "id": "congestion",
        "clinical": "nasal congestion",
        "narrative": "nasal congestion",
        "patterns": [
            r"\b(?:runny|stuffy|blocked|congested) nose\b",
            r"\bsinus pressure\b",
            r"\bhead cold\b",
        ],
    },
    {
        "id": "insomnia",
        "clinical": "insomnia",
        "narrative": "insomnia",
        "patterns": [
            r"\bcan(?:not|'t) sleep\b",
            r"\btrouble sleeping\b",
            r"\bwaking up constantly\b",
            r"\binsomnia\b",
        ],
    },
]

RED_FLAG_EXPLICIT = [
    "trouble breathing",
    "difficulty breathing",
    "can't breathe",
    "short of breath",
    "chest pain",
    "crushing chest",
    "stiff neck",
    "worst headache",
    "vomiting blood",
    "coughing blood",
    "blood in stool",
    "passed out",
    "fainted",
]


def extract_timeline_offset(text: str) -> tuple[float | None, str | None]:
    """Extract temporal offset in days and clean label from sentence."""
    low = text.lower()
    m_days = re.search(r"(\d+)\s+days?\s+ago", low)
    if m_days:
        return float(m_days.group(1)), f"{m_days.group(1)} days ago"
    m_past = re.search(r"(?:for|over)\s+(?:the\s+past\s+)?(\d+)\s+days?", low)
    if m_past:
        return float(m_past.group(1)), f"{m_past.group(1)} days duration"
    if "since yesterday" in low or "yesterday" in low:
        return 1.0, "yesterday"
    if "this morning" in low or "since morning" in low:
        return 0.2, "this morning"
    if "today" in low or "last night" in low:
        return 0.5, "recently"
    if "last week" in low:
        return 7.0, "last week"
    if re.search(r"\b(?:then|after that|later|subsequently)\b", low):
        return None, "subsequent"
    return None, None


def extract_symptoms(text: str) -> list[dict[str, Any]]:
    """Extract all clinical matches from a patient statement."""
    found = []
    for entry in CLINICAL_LEXICON:
        for pat in entry["patterns"]:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                found.append(
                    {
                        "id": entry["id"],
                        "clinical": entry.get("clinical", entry["id"]),
                        "narrative": entry.get("narrative", entry.get("clinical", entry["id"])),
                        "sourceSpan": m.group(0),
                        "is_red_flag": entry.get("is_red_flag", False),
                    }
                )
                break
    return found


def extract_red_flags(text: str) -> list[str]:
    """Identify acute red-flag symptoms in patient text."""
    low = text.lower()
    flags = []
    for rf in RED_FLAG_EXPLICIT:
        if rf in low:
            flags.append(rf)
    return list(dict.fromkeys(flags))


def synthesize_clinical_brief(patient_words: list[str]) -> dict[str, Any]:
    """Generate a formal clinical brief using rule-directed NLP synthesis."""
    if not patient_words:
        return {
            "synthesis": "No patient statements submitted for clinical synthesis.",
            "source": "ml_service_nlp",
            "extracted_symptoms": [],
            "red_flags": [],
        }

    extracted_events: list[dict[str, Any]] = []
    all_red_flags: list[str] = []
    seen_ids = set()

    for idx, fragment in enumerate(patient_words):
        symptoms = extract_symptoms(fragment)
        days_ago, time_desc = extract_timeline_offset(fragment)
        rfs = extract_red_flags(fragment)
        all_red_flags.extend(rfs)

        for sym in symptoms:
            if sym.get("is_red_flag"):
                all_red_flags.append(sym["clinical"])
            if sym["id"] not in seen_ids:
                seen_ids.add(sym["id"])
                extracted_events.append(
                    {
                        "id": sym["id"],
                        "clinical": sym["clinical"],
                        "narrative": sym["narrative"],
                        "sourceSpan": sym["sourceSpan"],
                        "days_ago": days_ago if days_ago is not None else (idx * 0.5),
                        "time_desc": time_desc,
                        "fragment_idx": idx,
                    }
                )

    all_red_flags = list(dict.fromkeys(all_red_flags))

    # Formulate chronological narrative
    if not extracted_events:
        # Fallback if no specific lexicon regex matched: clean natural wording
        clean_words = [w.strip().rstrip(".,;") for w in patient_words if w.strip()]
        synthesis = (
            f"The patient presents with symptoms reported in sequence: {'; '.join(clean_words)}. "
            "No medications were reported, and no red-flag symptoms were reported."
        )
        return {
            "synthesis": synthesis,
            "source": "ml_service_nlp",
            "extracted_symptoms": [],
            "red_flags": all_red_flags,
        }

    # Primary chief complaint
    chief = extracted_events[0]
    initial_time = chief.get("time_desc")

    if initial_time in ("yesterday", "this morning", "last week"):
        onset_str = f"beginning {initial_time}"
    elif initial_time and "days" in initial_time:
        onset_str = f"of {initial_time}"
    else:
        onset_str = "of recent acute onset"

    sentences: list[str] = []

    if len(extracted_events) == 1:
        s1 = f"The patient presents with {chief['narrative']} {onset_str}."
        sentences.append(s1)
    elif len(extracted_events) == 2:
        second = extracted_events[1]
        s1 = (
            f"The patient presents with {chief['narrative']} {onset_str}, "
            f"accompanied by subsequent {second['narrative']}."
        )
        sentences.append(s1)
    else:
        second = extracted_events[1]
        remaining = [e["narrative"] for e in extracted_events[2:]]
        s1 = (
            f"The patient presents with {chief['narrative']} {onset_str}, "
            f"initially accompanied by {second['narrative']}."
        )
        sentences.append(s1)
        s2 = f"Clinical progression subsequently included {', and '.join(remaining)}."
        sentences.append(s2)

    # Red-flag & medication statements
    if all_red_flags:
        rf_str = ", ".join(all_red_flags)
        s_end = f"The patient reports {rf_str} as an acute red-flag symptom. No medications were reported."
    else:
        s_end = "No medications were reported, and no red-flag symptoms were reported."

    sentences.append(s_end)

    full_narrative = " ".join(sentences)
    return {
        "synthesis": full_narrative,
        "source": "ml_service_nlp",
        "extracted_symptoms": extracted_events,
        "red_flags": all_red_flags,
    }
