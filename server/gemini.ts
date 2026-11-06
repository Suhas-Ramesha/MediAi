const GEMINI_MODELS = [
  // gemini-flash-lite-latest is the only model with available free-tier quota.
  // gemini-flash-latest (resolves to gemini-3.8-flash) has exhausted its daily
  // quota (~20 req/day, retry in ~15h) and is intentionally omitted.
  "gemini-flash-lite-latest",
];

const HEALTH_CHAT_INSTRUCTIONS = `You are an AI Health Assistant in a healthcare app. Rules you must follow:
- Offer possible explanations and practical self-care. You may name likely conditions as working impressions.
- Do NOT recommend specific prescription medicines, doses, or stopping/changing prescribed drugs.
- If symptoms could be serious, calmly suggest seeking urgent or in-person care without fear-mongering.
- Never add a disclaimer footer such as "this is not a diagnosis" or "consult a certified doctor for professional advice".

Length & format rules (IMPORTANT):
- For casual questions, small talk, thanks, or simple factual asks: reply in 1-3 short sentences. No sections, no bullets, no headings.
- For active symptoms (fever, pain, cough, vomiting, dizziness, injury, etc.) OR explicit requests for guidance: use the structured triage format below.
- Never pad a simple answer into a long structured one. Total reply should stay under ~180 words.
- Keep sentences short and scannable (one line per bullet).

Structured triage format (use ONLY for symptom or guidance replies):
**What this could mean**
- 2-3 short bullets

**What you can do now**
- 3-4 practical bullets

**Questions to answer next**
- 1-2 focused triage questions

**When to seek urgent care**
- 2-3 red-flag bullets`;

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set on the server");
  }
  return key;
}

function extractText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

async function generateContent(
  parts: Array<Record<string, unknown>>,
  systemInstruction?: string,
): Promise<string> {
  const key = apiKey();
  const allParts = systemInstruction
    ? [{ text: `${systemInstruction}\n\n` }, ...parts]
    : parts;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: allParts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      // thinkingConfig is omitted because gemini-flash-lite-latest does not
      // support it and returns HTTP 400 INVALID_ARGUMENT when present.
    },
  };

  let lastError = "Gemini request failed";
  const deadline = Date.now() + 45_000;
  for (const model of GEMINI_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) {
      lastError = "The AI service is busy right now. Please try again in a moment.";
      break;
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
        // Cap each model call so one slow model doesn't burn the whole budget.
        signal: AbortSignal.timeout(Math.min(20_000, remaining)),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = extractText(json);
        if (text) return text;
        lastError = "Empty response from AI";
        continue;
      }
      const geminiErr = json?.error?.message || `Gemini ${res.status}`;
      console.error(`[Gemini ${model}] Error ${res.status}:`, geminiErr);
      lastError = geminiErr;
      continue;
    } catch (e: any) {
      lastError = e?.message || "Gemini connection error";
      continue;
    }
  }
  const friendly =
    /abort|timeout|high demand|unavailable|503/i.test(lastError)
      ? "The AI service is busy right now. Please try again in a moment."
      : lastError;
  throw new Error(friendly);
}

const SYMPTOM_HINT_RE =
  /\b(fever|temperature|cough|cold|vomit|vomiting|nausea|pain|headache|dizzy|dizziness|diarrhea|sore throat|chills|breath|weak|fatigue)\b/i;

function looksTooShortForTriage(text: string): boolean {
  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  return text.trim().length < 160 || lineCount < 4;
}

export async function generateHealthChat(message: string): Promise<string> {
  const prompt = `${HEALTH_CHAT_INSTRUCTIONS}

User message:
${message}

Formatting requirements:
- Use short sections with bold headings (example: **What this could mean**).
- Use bullet points for actions and warning signs.
- Keep lines short and easy to scan on mobile.

Respond in a clear, friendly, professional tone. Prefer the shortest answer that is still safe and useful.`;

  let text = await generateContent([{ text: prompt }]);

  if (SYMPTOM_HINT_RE.test(message) && looksTooShortForTriage(text)) {
    const expandPrompt = `${HEALTH_CHAT_INSTRUCTIONS}

The previous draft is too brief and not helpful enough for triage.

User message:
${message}

Previous short draft:
${text}

Rewrite it with this exact structure:
**What this could mean**
- 2-3 concise bullet points

**What you can do now**
- 3-4 practical bullet points

**Questions to answer next**
- Ask exactly 2 focused triage questions

**When to seek urgent care**
- 2-3 red-flag bullet points

Keep every bullet to one line. Do not add an intro or closing paragraph.`;
    text = (await generateContent([{ text: expandPrompt }])) || text;
  }

  return text
    .replace(
      /This is not a medical diagnosis\. Please consult a certified doctor for professional advice\.?/gi,
      "",
    )
    .replace(/\bThis is (?:a ranking, )?not a(?: medical)? diagnosis\.?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BRIEF_PHRASE_INSTRUCTIONS = `You are an expert clinical documentation scribe preparing a physician-facing intake brief from a patient's colloquial description.
Rules:
- Transform the patient's informal words and colloquial descriptions into a cohesive, professional clinical narrative.
- Summarize chief complaint, timeline (e.g., began yesterday, ongoing for 2 days), and clinical symptom progression.
- Rephrase informal/slang terms into standard clinical terminology (e.g. "running a temp" -> fever, "throat is killing me" -> severe sore throat, "throwing up" -> vomiting, "belly hurts" -> abdominal pain).
- Explicitly state any named medications or state that no medications were reported.
- If red-flag symptoms are present in the patient words, mention them. If no red flags are mentioned, state "No red-flag symptoms were reported." Do NOT invent or enumerate unmentioned negative diseases or symptoms (do NOT say "no dyspnea or chest pain").
- Do NOT repeat the patient's informal words verbatim. Rephrase them into 2 to 3 concise, high-yield clinical sentences.
- Ground all facts strictly in the patient's statements without fabricating unmentioned conditions.
- CRITICAL: Return ONLY the direct clinical brief narrative. Do NOT include greetings, intro phrases, bullet points, numbered options, or headings (no "Here is...", no "Option 1").`;

export async function generateBriefPhrase(input: {
  patientWords: string[];
  engineDraft: string;
  mappings: string[];
}): Promise<string> {
  const prompt = `${BRIEF_PHRASE_INSTRUCTIONS}

Patient words (informal statements):
${input.patientWords.map((w, i) => `${i + 1}. ${w}`).join("\n")}

Baseline engine draft:
${input.engineDraft}

Mapped clinical terms:
${input.mappings.join(", ") || "(none)"}

Write the finalized clinical brief narrative now:`;
  return generateContent([{ text: prompt }], BRIEF_PHRASE_INSTRUCTIONS);
}

export async function generateImageAnalysis(
  userPrompt: string,
  mimeType: string,
  base64Data: string,
): Promise<string> {
  const prompt = `You are an AI assistant helping a patient understand a medical image. The patient asks: "${userPrompt}"

Return ONLY the Markdown below, with no greeting, preamble, or closing disclaimer:

**Image**
- One line: likely type (X-ray, CT, MRI, photo), body area, and whether the image is clear enough to read

**What I can see**
- 2-3 short bullets, each starting with a bold label, for example: "- **Lungs:** clear, no obvious fluid"

**What it may mean**
- 1-2 short bullets using hedging words ("may", "possibly", "can suggest"). Never state a diagnosis as fact.

**What to do next**
- 2 short, practical bullets, including that a radiologist or doctor should review the actual scan

Strict rules:
- Every bullet must be under 20 words. No paragraph longer than one line.
- Use plain, patient-friendly language. Explain any clinical term in the same line.
- Do not prescribe medicines, doses, or treatment changes.
- Do not invent findings that are not visible.
- If this is not a medical image, or is too blurry/blank to read, say so in the first "What I can see" bullet and keep the rest cautious.`;

  return generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ]);
}
