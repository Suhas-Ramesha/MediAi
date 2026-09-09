export class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private currentLanguage: string = 'en-US';

  // List of supported languages
  static readonly SUPPORTED_LANGUAGES = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese' },
    { code: 'hi-IN', name: 'Hindi' },
    { code: 'ar-SA', name: 'Arabic' }
  ];

  initialize(onTranscript: (text: string) => void, onError: (error: string) => void) {
    try {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Send the combined transcript
        onTranscript(finalTranscript + interimTranscript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let message = 'Failed to recognize speech';
        
        switch (event.error) {
          case 'not-allowed':
            message = 'Microphone access denied';
            break;
          case 'no-speech':
            message = 'No speech detected';
            break;
          case 'network':
            message = 'Network error occurred';
            break;
          case 'language-not-supported':
            message = 'Selected language is not supported';
            break;
        }
        
        onError(message);
        this.stopRecording();
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // Restart if we're still supposed to be listening
          this.recognition.start();
        }
      };

      return true;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      onError('Speech recognition not supported in this browser');
      return false;
    }
  }

  setLanguage(languageCode: string) {
    this.currentLanguage = languageCode;
    if (this.recognition) {
      this.recognition.lang = languageCode;
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  startRecording() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        return true;
      } catch (error) {
        console.error('Error starting recognition:', error);
        return false;
      }
    }
    return false;
  }

  stopRecording() {
    if (this.recognition) {
      this.isListening = false;
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }

  isRecording() {
    return this.isListening;
  }
} 