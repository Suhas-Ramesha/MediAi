const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];

const HEALTH_CHAT_INSTRUCTIONS = `You are an AI Health Assistant in a healthcare app. Rules you must follow:
- Do NOT give a medical diagnosis or label a condition as certain.
- You may offer general education, possible non-alarming explanations, and self-care ideas that are widely considered safe.
- Do NOT recommend specific prescription medicines, doses, or stopping/changing prescribed drugs.
- If symptoms could be serious, calmly suggest seeking urgent or in-person care without fear-mongering.

Length & format rules (IMPORTANT):
- For casual questions, small talk, thanks, or simple factual asks: reply in 1-3 short sentences. No sections, no bullets, no headings.
- For active symptoms (fever, pain, cough, vomiting, dizziness, injury, etc.) OR explicit requests for guidance: use the structured triage format below.
- Never pad a simple answer into a long structured one.
- Keep sentences short and scannable.

Structured triage format (use ONLY for symptom or guidance replies):
**What this could mean**
- 2-4 short bullets

**What you can do now**
- 3-6 practical bullets

**Questions to answer next**
- 1-2 focused triage questions

**When to seek urgent care**
- 2-4 red-flag bullets`;

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
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let lastError = "Gemini request failed";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = extractText(json);
      if (text) return text;
      lastError = "Empty response from AI";
      continue;
    }
    lastError = json?.error?.message || `Gemini ${res.status}`;
    if (res.status === 404) continue;
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

const SYMPTOM_HINT_RE =
  /\b(fever|temperature|cough|cold|vomit|vomiting|nausea|pain|headache|dizzy|dizziness|diarrhea|sore throat|chills|breath|weak|fatigue)\b/i;

function looksTooShortForTriage(text: string): boolean {
  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  return text.trim().length < 260 || lineCount < 5;
}

export async function generateHealthChat(message: string): Promise<string> {
  const prompt = `${HEALTH_CHAT_INSTRUCTIONS}

User message:
${message}

Formatting requirements:
- Use short sections with bold headings (example: **What this could mean**).
- Use bullet points for actions and warning signs.
- Keep lines short and easy to scan on mobile.

Respond in a clear, friendly, professional tone. Avoid heavy jargon and do not be overly brief.`;

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
- 2-4 concise bullet points

**What you can do now**
- 4-6 practical bullet points

**Questions to answer next**
- Ask exactly 2 focused triage questions

**When to seek urgent care**
- 3-5 red-flag bullet points

Keep it concise but complete and easy to scan.`;
    text = (await generateContent([{ text: expandPrompt }])) || text;
  }

  return text
    .replace(
      /This is not a medical diagnosis\. Please consult a certified doctor for professional advice\.?/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateImageAnalysis(
  userPrompt: string,
  mimeType: string,
  base64Data: string,
): Promise<string> {
  const prompt = `You are a medical professional analyzing this medical image. The patient asks: "${userPrompt}"

Please provide a comprehensive analysis in the following format:

Image Type: [Specify the exact type of medical image - X-ray, MRI, CT scan, etc.]

Anatomical Region: [Specify the body part or organ system being examined]

Key Findings:
1. [List primary observations with specific details]
2. [Note any abnormalities, masses, or concerning features]
3. [Describe tissue characteristics, density variations, or structural changes]

Clinical Interpretation:
- [Provide detailed explanation of findings]
- [Discuss potential medical implications]
- [Compare with normal expectations]

Recommendations:
1. [Specific medical follow-up needed]
2. [Additional tests if required]
3. [Lifestyle or preventive measures]

Important Notes:
- [Critical information for patient awareness]
- [Limitations of the analysis]
- [Reminder about professional medical consultation]

Please be thorough and precise while explaining in patient-friendly terms.`;

  return generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64Data } },
  ]);
}
