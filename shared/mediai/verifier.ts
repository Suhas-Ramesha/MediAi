export interface ClaimVerdict {
  claimId: string;
  text: string;
  status: "supported" | "unsupported" | "contradicted";
  confidence: number;
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "with",
  "that",
  "this",
  "it",
  "as",
  "by",
  "from",
  "at",
  "may",
  "can",
  "could",
  "would",
  "should",
  "your",
  "you",
  "most",
  "likely",
]);

const NEGATIONS = ["not", "no", "never", "without", "n't", "absent", "deny", "denies"];

export function splitClaims(answer: string): string[] {
  return answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

function hasNegation(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIONS.some((n) => t.includes(n));
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
      return {
        claimId,
        text,
        status: "unsupported",
        confidence: 1,
      };
    }
    const claimTokens = new Set(tokens(text));
    const contentOverlap = Array.from(claimTokens).filter((t) =>
      evidenceTokens.has(t),
    );
    const contained =
      contentOverlap.length / Math.max(claimTokens.size, 1);
    const claimNeg = hasNegation(text);
    const evidenceNeg = hasNegation(evidenceJoined);

    if (contentOverlap.length >= 2 && claimNeg !== evidenceNeg) {
      return {
        claimId,
        text,
        status: "contradicted",
        confidence: 0.85,
      };
    }
    // Entailment direction: claim content must be present in evidence.
    if (contained >= 0.7 && contentOverlap.length >= 2) {
      return {
        claimId,
        text,
        status: "supported",
        confidence: Math.min(0.95, 0.5 + contained),
      };
    }
    return {
      claimId,
      text,
      status: "unsupported",
      confidence: 0.8,
    };
  });
}
