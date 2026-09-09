export type RiskDisease = "diabetes" | "heart" | "liver" | "kidney";

export interface RiskContributingFactor {
  name: string;
  weight?: number;
  /** Plain-language tie to the user's inputs */
  explanation?: string;
}

export interface RiskPredictResponse {
  disease?: string;
  riskPercent?: number;
  label?: string;
  /** Overall read of why the % is low / mid / high (non-diagnostic). */
  riskSummary?: string;
  contributingFactors?: RiskContributingFactor[];
  gradioText?: string;
  message?: string;
  detail?: string | { msg?: string }[];
}

function parseRiskJsonBody(
  text: string,
  status: number,
): RiskPredictResponse & { detail?: string | { msg?: string }[] } {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      status === 404
        ? "Risk API not found. If you use `npm run dev` (Vite only), enable the Vite proxy to the ML service or run the full app on port 5000."
        : `Empty response from risk API (HTTP ${status}). Is the ML service running on port 5050?`,
    );
  }
  try {
    return JSON.parse(trimmed) as RiskPredictResponse & {
      detail?: string | { msg?: string }[];
    };
  } catch {
    throw new Error(
      trimmed.startsWith("<")
        ? `Risk API returned HTML (HTTP ${status}). Wrong dev server or missing proxy.`
        : `Invalid JSON from risk API (HTTP ${status}).`,
    );
  }
}

export async function predictRisk(
  disease: RiskDisease,
  payload: Record<string, unknown>,
): Promise<RiskPredictResponse> {
  const res = await fetch("/api/risk/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disease, payload }),
  });
  const text = await res.text();
  const data = parseRiskJsonBody(text, res.status);

  if (!res.ok) {
    const d = data.detail;
    const msg =
      typeof d === "string"
        ? d
        : Array.isArray(d) && d[0]?.msg
          ? d[0].msg
          : data.message || `Risk request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
