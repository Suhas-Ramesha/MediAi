import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripDiagnosisDisclaimer } from './disclaimer';

function getGenAI(): GoogleGenerativeAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is required to run chat, not the landing demos.');
  }
  return new GoogleGenerativeAI(apiKey);
}

const DEFAULT_TIMEOUT_MS = 40000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
};

const retry = async <T>(fn: () => Promise<T>, maxRetries = 1, delayMs = 500): Promise<T> => {
  let lastError: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
};

const SYMPTOM_HINT_RE =
  /\b(fever|temperature|cough|cold|vomit|vomiting|nausea|pain|headache|dizzy|dizziness|diarrhea|sore throat|chills|breath|weak|fatigue)\b/i;

function isSymptomLikeMessage(message: string): boolean {
  return SYMPTOM_HINT_RE.test(message);
}

function looksTooShortForTriage(text: string): boolean {
  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  return text.trim().length < 260 || lineCount < 5;
}

function buildExpansionPrompt(userMessage: string, initialDraft: string): string {
  return `${HEALTH_CHAT_INSTRUCTIONS}

The previous draft is too brief and not helpful enough for triage.

User message:
${userMessage}

Previous short draft:
${initialDraft}

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
}

async function maybeExpandShortSymptomReply(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  userMessage: string,
  replyText: string,
): Promise<string> {
  if (!isSymptomLikeMessage(userMessage) || !looksTooShortForTriage(replyText)) {
    return replyText;
  }
  const expandPrompt = buildExpansionPrompt(userMessage, replyText);
  const expanded = await retry(
    () => withTimeout(model.generateContent(expandPrompt), DEFAULT_TIMEOUT_MS),
    1,
  );
  const expandedResp = await expanded.response;
  const expandedText = expandedResp.text().trim();
  return expandedText || replyText;
}

export interface Message {
  role: 'user' | 'assistant';
  id: string;
  content: string;
  timestamp: Date | string;
  isLoading?: boolean;
  image?: string;
  imagePrompt?: string;
  suggestsBooking?: boolean;
  appointmentId?: string;
  isAppointmentUpdate?: boolean;
}

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

const buildHealthPrompt = (message: string): string => `${HEALTH_CHAT_INSTRUCTIONS}

User message:
${message}

Formatting requirements:
- Use short sections with bold headings (example: **What this could mean**).
- Use bullet points for actions and warning signs.
- Keep lines short and easy to scan on mobile.

Respond in a clear, friendly, professional tone. Avoid heavy jargon and do not be overly brief.`;

export const medicalChatService = {
  async sendMessage(message: string): Promise<Message> {
    try {
      console.log('Starting chat request');

      const model = getGenAI().getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }, { apiVersion: "v1" });

      const prompt = buildHealthPrompt(message);

      const result = await retry(
        () => withTimeout(model.generateContent(prompt), DEFAULT_TIMEOUT_MS),
        1,
      );
      
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from AI');
      }

      const finalText = stripDiagnosisDisclaimer(
        await maybeExpandShortSymptomReply(model, message, text.trim()),
      );

      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: finalText,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('Detailed chat error:', {
        error: error.name,
        message: error.message,
      });
      throw new Error(`Failed to get AI response: ${error.message}`);
    }
  },

  async streamMessage(
    message: string,
    onChunk: (partialText: string) => void,
  ): Promise<Message> {
    try {
      const model = getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }, { apiVersion: "v1" });

      const prompt = buildHealthPrompt(message);

      const streamResult = await retry(
        () => withTimeout(model.generateContentStream(prompt), DEFAULT_TIMEOUT_MS),
        1,
      );

      let fullText = "";
      for await (const chunk of streamResult.stream) {
        const text = chunk.text();
        if (!text) continue;
        fullText += text;
        onChunk(fullText);
      }

      if (!fullText.trim()) {
        const fallback = await retry(
          () => withTimeout(model.generateContent(prompt), DEFAULT_TIMEOUT_MS),
          1,
        );
        const fallbackResp = await fallback.response;
        const fallbackText = fallbackResp.text().trim();
        if (!fallbackText) {
          throw new Error('Empty response from AI');
        }
        const finalFallback = stripDiagnosisDisclaimer(
          await maybeExpandShortSymptomReply(model, message, fallbackText),
        );
        return {
          id: Date.now().toString(),
          role: 'assistant',
          content: finalFallback,
          timestamp: new Date(),
        };
      }

      const finalStreamed = stripDiagnosisDisclaimer(
        await maybeExpandShortSymptomReply(model, message, fullText.trim()),
      );

      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: finalStreamed,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('Streaming chat error:', {
        error: error.name,
        message: error.message,
      });
      throw new Error(`Failed to stream AI response: ${error.message}`);
    }
  },
};

export const medicalAnalysisService = {
  async analyzeImage(file: File, userPrompt: string): Promise<string> {
    try {
      console.log('Starting image analysis with prompt:', userPrompt);
      
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
  
      const imageData = {
        inlineData: {
          data: data.split(',')[1],
          mimeType: file.type,
        },
      };
  
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

      const visionModel = getGenAI().getGenerativeModel({ 
        model: "gemini-2.5-flash",
      }, { apiVersion: "v1" });
      
      const result = await visionModel.generateContent([prompt, imageData]);
      const response = await result.response;
      const text = stripDiagnosisDisclaimer(response.text());
  
      if (!text) {
        throw new Error('Empty response from AI');
      }
  
      return text;
    } catch (error: any) {
      console.error('Image analysis error:', error);
      throw new Error(`Failed to analyze medical image: ${error.message}`);
    }
  }
};

export const voiceService = {
  recognition: typeof window !== 'undefined' ? new (window as any).webkitSpeechRecognition() : null,
  synthesis: typeof window !== 'undefined' ? window.speechSynthesis : null,

  startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject('Speech recognition not supported');
        return;
      }

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      this.recognition.onerror = (event: any) => {
        reject(event.error);
      };

      this.recognition.start();
    });
  },

  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject('Speech synthesis not supported');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        console.log('Speech finished');
        resolve();
      };
      utterance.onerror = (error) => {
        console.error('Speech error:', error);
        reject(error);
      };
      // Fallback timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('Speech timeout fallback');
        resolve(); // Resolve even if speech fails
      }, 10000); // 10-second timeout
      utterance.onend = () => {
        clearTimeout(timeout);
        console.log('Speech finished');
        resolve();
      };
      this.synthesis.speak(utterance);
    });
  }
};