/**
 * Claim verifier (NLP).
 *
 * Pipeline: sentence/bullet split → stopword tokens → synonym fold →
 * scoped negation → overlap entailment against retrieved evidence only.
 * Empty evidence flags every claim. This is lexical NLI, not an LLM.
 */

export interface ClaimVerdict {
  claimId: string;
  text: string;
  status: "supported" | "unsupported" | "contradicted";
  confidence: number;
}

const STOP = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "and", "or", "in", "on", "for", "with", "that", "this",
  "it", "as", "by", "from", "at", "may", "can", "could", "would",
  "should", "your", "you", "most", "likely", "possible", "possibly",
  "perhaps", "might", "often", "also", "into", "than", "then", "if",
  "do", "does", "did", "not", "no", "what", "when", "how", "who",
]);

const NEGATIONS = [
  "not", "no", "never", "without", "n't", "absent", "deny", "denies",
  "denied", "unlikely", "rule out", "ruled out", "negative for",
];

/** Clinical spelling / lay variants so leukaemia vs leukemia still match. */
const SYNONYMS: Record<string, string> = {
  leukaemia: "leukemia",
  leukaemias: "leukemia",
  pyrexia: "fever",
  febrile: "fever",
  temperature: "fever",
  temp: "fever",
  dyspnoea: "breathing",
  dyspnea: "breathing",
  breath: "breathing",
  breathless: "breathing",
  pharyngitis: "throat",
  emesis: "vomiting",
  diarrhoea: "diarrhea",
  uri: "infection",
  tummy: "abdomen",
  stomachache: "abdomen",
  haematuria: "hematuria",
  oedema: "edema",
  hypoglycaemia: "hypoglycemia",
  anaemia: "anemia",
  palpitations: "heartbeat",
  pounding: "heartbeat",
};

function foldToken(t: string): string {
  const low = t.toLowerCase();
  return SYNONYMS[low] ?? low;
}

export function splitClaims(answer: string): string[] {
  const lines = answer.replace(/\r\n/g, "\n").split(/\n+/);
  const chunks: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const headingOnly = /^\*\*[^*]{2,40}\*\*:?\s*$/.test(line);
    if (headingOnly) continue;
    const stripped = line
      .replace(/^[-*•]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/^\*\*([^*]+)\*\*:?\s*/, "")
      .trim();
    if (stripped.length < 18) continue;
    if (/\?$/.test(stripped)) continue;
    for (const part of stripped.split(/(?<=[.!])\s+/)) {
      const t = part.trim();
      if (t.length > 12) chunks.push(t);
    }
  }
  if (chunks.length) return chunks;
  return answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .map(foldToken)
    .filter((t) => t && !STOP.has(t));
}

function hasNegation(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIONS.some((n) => t.includes(n));
}

function scopedNegation(text: string, content: string[]): boolean {
  const lower = text.toLowerCase();
  for (const word of content) {
    const idx = lower.indexOf(word);
    if (idx < 0) continue;
    const window = lower.slice(Math.max(0, idx - 24), idx + word.length + 8);
    if (NEGATIONS.some((n) => window.includes(n))) return true;
  }
  return hasNegation(text);
}

/**
 * Entailment is only against the evidence retrieved for this turn.
 * Empty evidence must flag every claim rather than silently passing.
 */
export function verifyClaims(
  answer: string,
  evidence: string[],
): ClaimVerdict[] {
  const claims = splitClaims(answer);
  const evidenceJoined = evidence.join(" ");
  const evidenceTokens = new Set(tokens(evidenceJoined));
  const evidenceEmpty = evidence.every((e) => !e.trim());

  return claims.map((text, i) => {
    const claimId = `c${i + 1}`;
    if (evidenceEmpty) {
      return { claimId, text, status: "unsupported" as const, confidence: 1 };
    }
    const claimTok = tokens(text);
    const claimTokens = new Set(claimTok);
    const contentOverlap = Array.from(claimTokens).filter((t) =>
      evidenceTokens.has(t),
    );
    const contained = contentOverlap.length / Math.max(claimTokens.size, 1);
    const claimNeg = scopedNegation(text, contentOverlap);
    const evidenceNeg = scopedNegation(evidenceJoined, contentOverlap);

    if (contentOverlap.length >= 2 && claimNeg !== evidenceNeg) {
      return { claimId, text, status: "contradicted", confidence: 0.85 };
    }
    if (contained >= 0.55 && contentOverlap.length >= 2) {
      return {
        claimId,
        text,
        status: "supported",
        confidence: Math.min(0.95, 0.5 + contained),
      };
    }
    return { claimId, text, status: "unsupported", confidence: 0.8 };
  });
}

export interface DecoratedSpan {
  text: string;
  status?: ClaimVerdict["status"];
}

/**
 * Mark unsupported / contradicted claim substrings so the chat bubble can
 * underline them in place (dotted = unsupported, wavy = contradicted).
 */
export function decorateText(
  text: string,
  verdicts: ClaimVerdict[],
): DecoratedSpan[] {
  const interesting = verdicts.filter((v) => v.status !== "supported");
  if (!interesting.length || !text) return [{ text }];

  type Hit = { start: number; end: number; status: ClaimVerdict["status"] };
  const hits: Hit[] = [];
  const lower = text.toLowerCase();
  for (const v of interesting) {
    const needle = v.text.toLowerCase().trim();
    if (needle.length < 12) continue;
    let idx = lower.indexOf(needle);
    let end = idx + needle.length;
    if (idx < 0) {
      const short = needle.slice(0, Math.min(56, needle.length));
      if (short.length < 18) continue;
      idx = lower.indexOf(short);
      end = idx + short.length;
    }
    if (idx < 0) continue;
    hits.push({ start: idx, end, status: v.status });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: Hit[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    kept.push(h);
    cursor = h.end;
  }
  if (!kept.length) return [{ text }];

  const out: DecoratedSpan[] = [];
  let at = 0;
  for (const h of kept) {
    if (h.start > at) out.push({ text: text.slice(at, h.start) });
    out.push({ text: text.slice(h.start, h.end), status: h.status });
    at = h.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
