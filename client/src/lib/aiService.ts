import { stripDiagnosisDisclaimer } from "./disclaimer";

export interface Message {
  role: "user" | "assistant";
  id: string;
  content: string;
  timestamp: Date | string;
  isLoading?: boolean;
  image?: string;
  imageRemote?: string;
  imagePrompt?: string;
  imageName?: string;
  suggestsBooking?: boolean;
  appointmentId?: string;
  isAppointmentUpdate?: boolean;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const medicalChatService = {
  async sendMessage(message: string): Promise<Message> {
    const data = await postJson<{ text: string }>("/api/chat", { message });
    const text = stripDiagnosisDisclaimer(data.text || "");
    if (!text) {
      throw new Error("Empty response from AI");
    }
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: text,
      timestamp: new Date(),
    };
  },

  async streamMessage(
    message: string,
    onChunk: (partialText: string) => void,
  ): Promise<Message> {
    try {
      const result = await this.sendMessage(message);
      onChunk(result.content);
      return result;
    } catch (error: any) {
      console.error("Streaming chat error:", {
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
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read the image file"));
        reader.readAsDataURL(file);
      });
      const data = dataUrl.split(",")[1] || "";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100_000);
      let payload: { text: string };
      try {
        const res = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: userPrompt,
            mimeType: file.type || "image/jpeg",
            data,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || `Image analysis failed (${res.status})`);
        }
        payload = body as { text: string };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new Error("The image service took too long. Please try again.");
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
      const text = stripDiagnosisDisclaimer(payload.text || "");
      if (!text) {
        throw new Error("Empty response from AI");
      }
      return text;
    } catch (error: any) {
      console.error("Image analysis error:", error);
      throw new Error(`Failed to analyze medical image: ${error.message}`);
    }
  },
};

export const voiceService = {
  recognition: typeof window !== "undefined" ? new (window as any).webkitSpeechRecognition() : null,
  synthesis: typeof window !== "undefined" ? window.speechSynthesis : null,

  startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject("Speech recognition not supported");
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
        reject("Speech synthesis not supported");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onerror = (error) => {
        console.error("Speech error:", error);
        reject(error);
      };
      const timeout = setTimeout(() => {
        resolve();
      }, 10000);
      utterance.onend = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.synthesis.speak(utterance);
    });
  },
};
