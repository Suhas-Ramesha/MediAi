export class SpeechService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private isListening = false;
  private mimeType = "audio/webm";
  private onTranscript: ((text: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  static readonly SUPPORTED_LANGUAGES = [
    { code: "en-US", name: "English (US)" },
    { code: "en-IN", name: "English (India)" },
    { code: "hi-IN", name: "Hindi" },
  ];

  initialize(onTranscript: (text: string) => void, onError: (error: string) => void) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    return true;
  }

  setLanguage(_languageCode: string) {
    // Language is applied server-side by Deepgram; kept for API compatibility.
  }

  getCurrentLanguage(): string {
    return "en";
  }

  private pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];
    for (const type of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "audio/webm";
  }

  async startRecording(): Promise<boolean> {
    if (this.isListening) return false;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.onError?.("Microphone is not supported in this browser");
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.chunks = [];
      this.mimeType = this.pickMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      this.mediaRecorder.start(250);
      this.isListening = true;
      return true;
    } catch (error: any) {
      console.error("Error starting microphone:", error);
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      this.onError?.(denied ? "Microphone access denied" : "Could not start recording");
      this.cleanupStream();
      return false;
    }
  }

  async stopRecording(): Promise<string> {
    if (!this.mediaRecorder || !this.isListening) {
      this.cleanupStream();
      this.isListening = false;
      return "";
    }

    const blob = await new Promise<Blob>((resolve) => {
      const recorder = this.mediaRecorder!;
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: this.mimeType.split(";")[0] || "audio/webm" }));
      };
      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
      }
    });

    this.cleanupStream();
    this.isListening = false;

    if (blob.size < 800) {
      this.onError?.("No speech detected");
      return "";
    }

    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.onError?.(data.message || "Failed to recognize speech");
        return "";
      }
      const text = String(data.text || "").trim();
      if (!text) {
        this.onError?.("No speech detected");
        return "";
      }
      return text;
    } catch (error) {
      console.error("Speech transcription error:", error);
      this.onError?.("Network error occurred while transcribing");
      return "";
    }
  }

  isRecording() {
    return this.isListening;
  }

  private cleanupStream() {
    this.mediaRecorder = null;
    this.chunks = [];
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
