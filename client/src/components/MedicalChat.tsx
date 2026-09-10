import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mic, PlusCircle, Upload, FileText, Image, Send, Save, CalendarPlus, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Message, Consultation } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { SpeechService } from '@/lib/speechService';
import { cloudinaryService } from '@/lib/cloudinaryService';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  arrayUnion
} from 'firebase/firestore';
import { medicalChatService, medicalAnalysisService } from "@/lib/aiService";
import { stripDiagnosisDisclaimer } from "@/lib/disclaimer";
import {
  appendAudit,
  loadBriefsLocal,
  loadGraph,
  persistChatSession,
  restoreChatSession,
  saveGraph,
  stashHandoffFromChat,
  stashPendingSlotBook,
  takePendingSlotBook,
} from "@/lib/engineStore";
import { analyzeChatTurn, emptySafetyGraph } from "@shared/mediai/chatSafety";
import type { ChatEngineResult } from "@shared/mediai/chatSafety";
import { draftEngineReply } from "@shared/mediai/engineReply";
import { decorateText, type ClaimVerdict } from "@shared/mediai/verifier";
import type { SafetyGraph } from "@shared/mediai/medication";
import { ChatEnginePanel } from "@/components/ChatEnginePanel";
import { useLocation } from "wouter";
import * as AppointmentService from '@/lib/appointmentService';
import AppointmentLoginModal from './AppointmentLoginModal';
import { RiskAssessmentModal } from "./RiskAssessmentModal";
import { predictRisk, type RiskContributingFactor, type RiskDisease } from "@/lib/riskApi";
import {
  collapseRepeatedSpeech,
  comePrepared,
  inferSpecialtyHint,
  specialtyGuard,
} from "@shared/mediai/intake";

const DISEASE_TITLE: Record<RiskDisease, string> = {
  diabetes: "Diabetes",
  heart: "Heart disease",
  liver: "Liver disease",
  kidney: "Kidney disease",
};

const DISEASE_SPECIALIST: Record<RiskDisease, string> = {
  diabetes: "Endocrinologist",
  heart: "Cardiologist",
  liver: "Hepatologist",
  kidney: "Nephrologist",
};

/** First user turn: short hello → show route menu instead of calling the model. */
function isRoutingGreeting(text: string): boolean {
  const raw = text.trim().toLowerCase().replace(/[!.,?]+$/g, "");
  if (!raw) return false;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  return /^(hi|hello|hey|howdy|yo|sup|hii|hiya|greetings)\b/.test(raw);
}

function doctorSpecialtyOf(doc: any): string {
  return String(doc?.specialization || doc?.specialty || doc?.speciality || "");
}

function userTranscript(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
}
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bk-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function decorateClass(status?: ClaimVerdict["status"]): string | undefined {
  if (status === "contradicted") {
    return "underline decoration-wavy decoration-destructive";
  }
  if (status === "unsupported") {
    return "underline decoration-dotted decoration-warning";
  }
  return undefined;
}

function renderRichParts(cleanLine: string, verdicts?: ClaimVerdict[]) {
  const spans = decorateText(cleanLine, verdicts ?? []);
  return spans.map((span, j) => {
    const inner = span.text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const rich = inner.map((part, k) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={`b-${j}-${k}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={`t-${j}-${k}`}>{part}</React.Fragment>;
    });
    const cls = decorateClass(span.status);
    if (!cls) return <React.Fragment key={`s-${j}`}>{rich}</React.Fragment>;
    return (
      <span key={`s-${j}`} className={cls} title={span.status}>
        {rich}
      </span>
    );
  });
}

function renderAssistantText(
  content: string,
  verdicts?: ClaimVerdict[],
): React.ReactNode {
  const lines = content.split("\n");
  return (
    <div className="text-sm space-y-1">
      {lines.map((rawLine, i) => {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
          return <div key={`sp-${i}`} className="h-2" />;
        }

        const isBullet = /^[-*•]\s+/.test(line);
        const isNumbered = /^\d+\.\s+/.test(line);
        const cleanLine = line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        const richText = renderRichParts(cleanLine, verdicts);

        if (isBullet || isNumbered) {
          return (
            <div key={`l-${i}`} className="flex items-start gap-2">
              <span aria-hidden="true">•</span>
              <span className="whitespace-pre-wrap">{richText}</span>
            </div>
          );
        }

        return (
          <p key={`p-${i}`} className="whitespace-pre-wrap">
            {richText}
          </p>
        );
      })}
    </div>
  );
}

async function runChatEngines(
  userText: string,
  assistantText: string,
  graph: SafetyGraph,
  patientId: string,
): Promise<ChatEngineResult> {
  const local = analyzeChatTurn({
    userText,
    assistantText,
    graph,
    evidence: [userText],
  });
  try {
    const r = await fetch("/api/mediai/chat/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userText,
        assistantText,
        graph,
        patientId,
        evidence: [userText],
      }),
    });
    if (r.ok) return (await r.json()) as ChatEngineResult;
  } catch {
    /* Express / RxNav down: keep the in-browser engines */
  }
  return local;
}

function preventionTips(disease: RiskDisease): string {
  const lines: Record<RiskDisease, string[]> = {
    diabetes: [
      "Choose steady meals with plenty of vegetables and whole grains.",
      "Build gentle daily movement you can keep up.",
      "Limit sugary drinks and keep alcohol modest.",
    ],
    heart: [
      "Favor heart-friendly foods with less added salt.",
      "Aim for regular walks or similar activity most days.",
      "Avoid smoking and keep alcohol moderate.",
    ],
    liver: [
      "Keep alcohol very low or none, as your doctor agrees.",
      "Stay hydrated and choose minimally processed foods.",
      "Maintain a steady weight with sustainable habits.",
    ],
    kidney: [
      "Stay hydrated unless your doctor advised fluid limits.",
      "Keep blood pressure in a healthy range with lifestyle support.",
      "Avoid long-term use of kidney-stressing remedies without medical advice.",
    ],
  };
  return lines[disease].map((s) => `• ${s}`).join("\n");
}

interface MedicalChatProps {
  selectedConsultation?: Consultation | null;
}

export default function MedicalChat({ selectedConsultation }: MedicalChatProps) {
  const { toast } = useToast();
  const { currentUser, userProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [safetyGraph, setSafetyGraph] = useState<SafetyGraph>(() =>
    emptySafetyGraph("anon"),
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConsultation, setCurrentConsultation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const speechService = useRef<SpeechService | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'text' | 'image' | null>(null);
  const [isBookingFlowActive, setIsBookingFlowActive] = useState(false);
  const [bookingStep, setBookingStep] = useState(0);
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [appointmentUser, setAppointmentUser] = useState<any>(null);
  /** Only the message with this id may render doctor / slot controls (avoids duplicate UI). */
  const [bookingDoctorMessageId, setBookingDoctorMessageId] = useState<string | null>(null);
  const [bookingSlotMessageId, setBookingSlotMessageId] = useState<string | null>(null);
  const [bookingBriefMessageId, setBookingBriefMessageId] = useState<string | null>(null);

  const [showHealthMainMenu, setShowHealthMainMenu] = useState(false);
  const [showRiskDiseaseMenu, setShowRiskDiseaseMenu] = useState(false);
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [riskModalDisease, setRiskModalDisease] = useState<RiskDisease | null>(null);
  const [riskSubmitLoading, setRiskSubmitLoading] = useState(false);
  const [bookingSpecialtyHint, setBookingSpecialtyHint] = useState<string | undefined>(undefined);
  const [riskBookingSummary, setRiskBookingSummary] = useState<string | undefined>(undefined);
  const riskModalCompletedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const allergies = String(userProfile?.allergies ?? "")
      .split(/[,;/]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const pid = currentUser?.uid ?? "anon";
    void loadGraph(currentUser?.uid ?? null, pid, allergies).then(setSafetyGraph);
  }, [currentUser?.uid, userProfile?.allergies]);

  useEffect(() => {
    if (selectedConsultation?.id) return;
    const saved = restoreChatSession();
    if (!saved?.messages.length) return;
    setCurrentConsultation(saved.consultationId);
    setMessages(saved.messages as Message[]);
  }, [selectedConsultation?.id]);

  useEffect(() => {
    if (!messages.length) return;
    persistChatSession(currentConsultation ?? "local", messages);
  }, [currentConsultation, messages]);

  // Update messages when selectedConsultation changes
  useEffect(() => {
    if (selectedConsultation?.id && selectedConsultation?.messages) {
      // Process messages to remove duplicates
      const uniqueMessages = removeDuplicateMessages(selectedConsultation.messages);
      setMessages(uniqueMessages);
      setCurrentConsultation(selectedConsultation.id);

      const last = uniqueMessages[uniqueMessages.length - 1];
      if (last?.role === "assistant" && String(last.id).startsWith("health-intro")) {
        setShowHealthMainMenu(true);
        setShowRiskDiseaseMenu(false);
      } else if (
        last?.role === "assistant" &&
        typeof last.content === "string" &&
        last.content.includes("Please choose the type of health risk")
      ) {
        setShowRiskDiseaseMenu(true);
        setShowHealthMainMenu(false);
      } else {
        setShowHealthMainMenu(false);
        setShowRiskDiseaseMenu(false);
      }
      
      // Check for any pending appointments in the messages and resume status checks
      checkForPendingAppointments(uniqueMessages);
    }
  }, [selectedConsultation]);

  // Initialize speech service
  useEffect(() => {
    speechService.current = new SpeechService();
    speechService.current.initialize(
      () => {
        /* Transcript is applied once in handleVoiceRecord to avoid double typing. */
      },
      // Handle errors
      (error) => {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        setIsRecording(false);
      }
    );

    return () => {
      if (speechService.current) {
        speechService.current.stopRecording();
      }
    };
  }, []);

  // Handle voice recording (mic records locally, then Deepgram transcribes)
  const handleVoiceRecord = async () => {
    if (!speechService.current) {
      toast({
        title: "Error",
        description: "Speech recognition not available",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      toast({
        title: "Transcribing",
        description: "Converting your speech to text...",
      });
      const text = collapseRepeatedSpeech(await speechService.current.stopRecording());
      if (text) {
        setInput((prev) => {
          const p = collapseRepeatedSpeech(prev);
          if (!p) return text;
          const merged = collapseRepeatedSpeech(`${p} ${text}`);
          return merged;
        });
        toast({
          title: "Ready",
          description: "Transcript added. Review it, then send.",
        });
      }
    } else {
      const started = await speechService.current.startRecording();
      if (started) {
        setIsRecording(true);
        toast({
          title: "Recording",
          description: "Speak clearly... Click the mic again to stop.",
        });
      }
    }
  };

  // Create a new consultation
  const createConsultation = async (firstMessage?: string) => {
    if (!currentUser) {
      const id = `local_${Date.now()}`;
      setCurrentConsultation(id);
      return id;
    }

    try {
      // Create a unique chat ID
      const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const consultationData = {
        userId: currentUser.uid,
        chatId: chatId,
        title: `Chat ${new Date().toLocaleDateString()}`,
        date: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        status: firstMessage ? 'active' : 'new',
        messages: firstMessage ? [{
          id: Date.now().toString(),
          role: 'user',
          content: firstMessage,
          timestamp: new Date().toISOString()
        }] : [],
        symptoms: firstMessage || '',
      };

      console.log('Creating new consultation:', consultationData);
      const consultationRef = await addDoc(collection(db, 'consultations'), consultationData);
      console.log('Created consultation with ID:', consultationRef.id);
      
      setCurrentConsultation(consultationRef.id);
      return consultationRef.id;
    } catch (error) {
      console.error('Error creating consultation:', error);
      return null;
    }
  };

  // Add message to consultation
  const addMessageToConsultation = async (consultationId: string, message: Message) => {
    if (!consultationId || consultationId.startsWith("local_")) {
      return;
    }

    try {
      const consultationRef = doc(db, 'consultations', consultationId);
      
      // Store message with ISO string timestamp
      const messageToStore = {
        ...message,
        timestamp: message.timestamp instanceof Date ? message.timestamp.toISOString() : message.timestamp
      };

      console.log('Adding message to consultation:', consultationId, messageToStore);
      
      await updateDoc(consultationRef, {
        messages: arrayUnion(messageToStore),
        lastUpdated: serverTimestamp(),
      });

      console.log('Message added successfully');
    } catch (error) {
      console.error('Error adding message to consultation:', error);
    }
  };

  // Start a new chat
  const handleNewChat = async () => {
    // If there's an existing consultation with messages, update its status
    if (currentConsultation && messages.length > 0 && !currentConsultation.startsWith("local_")) {
      try {
        const consultationRef = doc(db, 'consultations', currentConsultation);
        
        // Store all messages with ISO string timestamps
        const messagesToStore = messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
        }));

        const updateData = {
          status: 'completed',
          lastUpdated: serverTimestamp(),
          messages: messagesToStore,
          diagnosis: messages.length >= 2 ? extractDiagnosis(messages[messages.length - 1].content) : '',
          recommendations: messages.length >= 2 ? extractRecommendations(messages[messages.length - 1].content) : ''
        };

        console.log('Updating consultation:', currentConsultation, updateData);
        
        await updateDoc(consultationRef, updateData);

        toast({
          title: "Chat Saved",
          description: "Your chat has been saved to recent consultations.",
        });
      } catch (error) {
        console.error('Error updating previous consultation:', error);
        toast({
          title: "Error",
          description: "Failed to save the current chat. Please try again.",
          variant: "destructive"
        });
        return;
      }
    }

    // Clear current messages and create new consultation
    setMessages([]);
    setInput('');
    setShowHealthMainMenu(false);
    setShowRiskDiseaseMenu(false);
    setRiskModalOpen(false);
    setRiskModalDisease(null);
    setBookingSpecialtyHint(undefined);
    setRiskBookingSummary(undefined);
    const newConsultationId = await createConsultation();
    if (newConsultationId) {
      setCurrentConsultation(newConsultationId);
      const introMessage: Message = {
        id: `health-intro-${newConsultationId}`,
        role: "assistant",
        content:
          "Hi! What can I do for you today?\n\nUse the buttons below for risk prediction or general consultation, or type in the box.",
        timestamp: new Date(),
        suggestsBooking: false,
      };
      setMessages([introMessage]);
      await addMessageToConsultation(newConsultationId, introMessage);
      setShowHealthMainMenu(true);
    }
  };

  // Helper function to remove asterisks from text
  const removeAsterisks = (text: string): string => {
    return text.replace(/\*/g, '');
  };

  const handleSendMessage = async (rawText: string) => {
    const text = collapseRepeatedSpeech(rawText);
    // If there's a file, handle image analysis first
    if (file && fileType === 'image') {
      try {
        setIsLoading(true);
        // Upload image to Cloudinary first
        const imageUrl = await cloudinaryService.uploadImage(file);
        
        // Create a user message with the image
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: text || 'Please analyze this medical image.',
          timestamp: new Date(),
          image: imageUrl,
          imagePrompt: text || 'Please analyze this medical image.',
          suggestsBooking: false
        };
        
        // Create a new consultation if none exists
        let consultationId = currentConsultation;
        if (!consultationId) {
          consultationId = await createConsultation(userMessage.content);
          if (!consultationId) throw new Error('Failed to create consultation');
        }
        
        // Add user message to consultation
        await addMessageToConsultation(consultationId, userMessage);
        
        setMessages(prev => [...prev, userMessage]);
        setInput(''); // Clear input field immediately after sending
        
        // Add a loading message
        const loadingMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Analyzing your medical image...',
          timestamp: new Date(),
          isLoading: true,
          suggestsBooking: false
        };
        setMessages(prev => [...prev, loadingMessage]);
        
        // Analyze the image
        const analysis = stripDiagnosisDisclaimer(
          await medicalAnalysisService.analyzeImage(file, text || 'Please analyze this medical image.'),
        );
        
        console.log("AI Response:", analysis, "Suggests Booking:", false);

        const engine = await runChatEngines(
          text || "Please analyze this medical image.",
          analysis,
          safetyGraph,
          currentUser?.uid ?? "anon",
        );
        setSafetyGraph(engine.graph);
        void saveGraph(currentUser?.uid ?? null, engine.graph);
        void appendAudit(currentUser?.uid ?? null, {
          consultationId,
          userText: text || "Please analyze this medical image.",
          assistantText: analysis,
          result: engine,
          at: new Date().toISOString(),
        });
        
        // Create analysis message
        const aiMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: analysis,
          timestamp: new Date(),
          suggestsBooking: false,
          engine,
        };
        
        // Replace loading message with analysis result
        setMessages(prev => prev.map(msg => 
          msg.id === loadingMessage.id ? aiMessage : msg
        ));
        
        // Add AI message to consultation
        await addMessageToConsultation(consultationId, aiMessage);
        
        setFile(null);
        setFileType(null);
        setIsLoading(false);
        return;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to analyze the image",
          variant: "destructive"
        });
        return;
      }
    }

    // If in booking flow, handle differently (or disable regular send)
    if (isBookingFlowActive) {
      toast({ title: "Please complete the booking process or cancel it.", variant: "destructive" });
      return;
    }

    if (!text.trim() || isLoading) return;

    const priorUserMessageCount = messages.filter((m) => m.role === "user").length;

    setInput('');
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      suggestsBooking: false
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Create new consultation if none exists
      let consultationId = currentConsultation;
      if (!consultationId) {
        consultationId = await createConsultation(text);
        if (!consultationId) throw new Error('Failed to create consultation');
      }

      // Add user message to consultation
      await addMessageToConsultation(consultationId, userMessage);

      if (priorUserMessageCount === 0 && isRoutingGreeting(text)) {
        const routeMsg: Message = {
          id: `health-intro-routes-${Date.now()}`,
          role: "assistant",
          content:
            "Hi! What can I do for you today?\n\nChoose risk prediction or general consultation below, or describe what is going on in your own words.",
          timestamp: new Date(),
          suggestsBooking: false,
        };
        setMessages((prev) => [...prev, routeMsg]);
        await addMessageToConsultation(consultationId, routeMsg);
        setShowHealthMainMenu(true);
        return;
      }

      // Insert a placeholder message immediately, then stream content into it
      const aiMessageId = (Date.now() + 1).toString();
      const aiPlaceholder: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
        suggestsBooking: false
      };
      setMessages(prev => [...prev, aiPlaceholder]);

      let cleanContent = "";
      let responseMeta: Partial<Message> = { role: "assistant" };
      try {
        const response = await medicalChatService.streamMessage(text, (partialText) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, content: stripDiagnosisDisclaimer(partialText), isLoading: true }
                : msg
            )
          );
        });
        responseMeta = response;
        cleanContent = stripDiagnosisDisclaimer(
          response.content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
        );
      } catch (err) {
        console.warn("Gemini unavailable; using engine draft", err);
        const preview = analyzeChatTurn({
          userText: text,
          assistantText: text,
          graph: safetyGraph,
          evidence: [text],
        });
        cleanContent = draftEngineReply(text, preview);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: cleanContent, isLoading: true }
              : msg,
          ),
        );
      }

      // Avoid repetitive greeting on every turn; keep greeting mostly for first assistant turn.
      if (priorUserMessageCount > 0) {
        cleanContent = cleanContent.replace(
          /^(hello(?: there)?|hi(?: there)?|hey(?: there)?)[!,.:\s]+/i,
          "",
        ).trim();
      }

      // Booking only when reply clearly steers to care (not the word "consult" in the fixed disclaimer)
      const suggestsBookingKeywords = [
        'see a doctor',
        'see your doctor',
        'visit a doctor',
        'visit your doctor',
        'specialist',
        'appointment',
        'physician',
        'book an appointment',
        'schedule an appointment',
        'urgent care',
        'emergency room',
        'er visit',
      ];
      const lowerCaseContent = cleanContent.toLowerCase();
      const hasStructuredTriage =
        /\*\*what this could mean\*\*/i.test(cleanContent) ||
        /\*\*when to seek urgent care\*\*/i.test(cleanContent) ||
        /\*\*what you can do now\*\*/i.test(cleanContent);
      const suggestsBooking =
        hasStructuredTriage ||
        suggestsBookingKeywords.some((keyword) =>
          lowerCaseContent.includes(keyword),
        );
      
      console.log("[Text Response] AI Content:", cleanContent, "| Suggests Booking:", suggestsBooking);

      const engine = await runChatEngines(
        text,
        cleanContent,
        safetyGraph,
        currentUser?.uid ?? "anon",
      );
      setSafetyGraph(engine.graph);
      void saveGraph(currentUser?.uid ?? null, engine.graph);
      void appendAudit(currentUser?.uid ?? null, {
        consultationId: consultationId,
        userText: text,
        assistantText: cleanContent,
        result: engine,
        at: new Date().toISOString(),
      });

      const aiMessage: Message = {
        ...responseMeta,
        id: aiMessageId,
        role: "assistant",
        content: cleanContent,
        timestamp: new Date(),
        isLoading: false,
        suggestsBooking: suggestsBooking,
        engine,
      };

      // Add AI message to consultation
      await addMessageToConsultation(consultationId, aiMessage);
      setMessages(prev => prev.map(msg => msg.id === aiMessageId ? aiMessage : msg));

      if (!consultationId.startsWith("local_")) {
        await updateDoc(doc(db, 'consultations', consultationId), {
          status: 'active',
          lastUpdated: serverTimestamp(),
          diagnosis: extractDiagnosis(aiMessage.content),
          recommendations: extractRecommendations(aiMessage.content),
        });
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to get response: ${error.message}`,
        variant: "destructive"
      });
      setMessages(prev => prev.filter(msg => !msg.isLoading));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions to extract medical insights from AI responses
  const extractDiagnosis = (content: string): string => {
    // Simple extraction - you might want to make this more sophisticated
    const diagnosisMatch = content.match(/diagnosis|assessment/i);
    if (diagnosisMatch) {
      const startIndex = content.indexOf(diagnosisMatch[0]);
      const endIndex = content.indexOf('.', startIndex);
      return content.slice(startIndex, endIndex + 1);
    }
    return '';
  };

  const extractRecommendations = (content: string): string => {
    // Simple extraction - you might want to make this more sophisticated
    const recommendationsMatch = content.match(/recommend|suggest|advise/i);
    if (recommendationsMatch) {
      const startIndex = content.indexOf(recommendationsMatch[0]);
      const endIndex = content.indexOf('.', startIndex);
      return content.slice(startIndex, endIndex + 1);
    }
    return '';
  };

  // PLACEHOLDER: Function to log symptoms
  const handleLogSymptom = async (text: string) => {
    if (!text.trim() || !currentUser) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "You must be logged in to log symptoms.",
      });
      return;
    }

    const symptomToLog = text.trim();
    setInput(''); // Clear input immediately

    try {
      const symptomLogData = {
        userId: currentUser.uid,
        timestamp: serverTimestamp(), // Use server timestamp for consistency
        symptom: symptomToLog,
      };

      await addDoc(collection(db, 'symptomLogs'), symptomLogData);

      toast({
        title: "Symptom Logged Successfully",
        description: `"${symptomToLog.substring(0, 30)}${symptomToLog.length > 30 ? '...' : ''}" saved to your diary.`,
      });

    } catch (error) {
      console.error("Error logging symptom:", error);
      toast({
        variant: "destructive",
        title: "Error Logging Symptom",
        description: "Could not save symptom to diary. Please try again.",
      });
      setInput(symptomToLog); // Restore input if saving failed
    }
  };

  // Check if appointment user is logged in
  useEffect(() => {
    // Check localStorage on mount
    const checkAppointmentAuth = () => {
      const isAuth = AppointmentService.isAuthenticated();
      if (isAuth) {
        // If we have a token but no user data, set a minimal user object
        if (!appointmentUser) {
          setAppointmentUser({ isLoggedIn: true });
        }
      }
    };
    
    checkAppointmentAuth();
  }, [appointmentUser]);

  // --- Booking Flow Logic --- 
  const handleStartBooking = async () => {
    // Check if user is authenticated for appointments
    if (!AppointmentService.isAuthenticated()) {
      console.log("User not authenticated for appointment system, showing login modal");
      setShowLoginModal(true);
      return;
    }

    if (isBookingFlowActive) {
      return;
    }

    // Continue with booking flow as before
    setIsBookingFlowActive(true);
    setIsLoading(true);
    setBookingStep(1); // Move to doctor selection step
    setBookingDoctorMessageId(null);
    setBookingSlotMessageId(null);
    console.log("Starting booking flow...");

    const bookingStartId = newBookingMessageId();
    const bookingStartMessage: Message = {
      id: bookingStartId,
      role: 'assistant',
      content: "Okay, let's find a doctor for you. Fetching available doctors...",
      timestamp: new Date(),
      isLoading: true, // Show loading indicator
      suggestsBooking: false
    };
    setMessages((prev) => [...prev, bookingStartMessage]);

    try {
      const transcript = userTranscript(messages);
      const inferred = inferSpecialtyHint(transcript);
      const specialtyArg = bookingSpecialtyHint
        ? [bookingSpecialtyHint]
        : inferred?.directoryQueries;
      const { doctors, specialtyMiss, attemptedSpecialty } =
        await AppointmentService.fetchDoctors(specialtyArg);
      const list = Array.isArray(doctors) ? doctors : [];
      setAvailableDoctors(list);
      const needed = attemptedSpecialty || inferred?.cluster || bookingSpecialtyHint;
      let doctorPrompt: string;
      if (specialtyMiss || (needed && list.length === 0)) {
        doctorPrompt = `No doctor listed as ${needed} is in this directory, so booking is stopped here. Chest pain and similar red flags need a matching specialist — not a substitute from another list.`;
      } else if (list.length > 0) {
        doctorPrompt = inferred?.cluster
          ? `Doctors listed for ${inferred.cluster}. Select only if the specialty matches:`
          : "Please select a doctor:";
      } else {
        doctorPrompt = "No doctors are available to show right now. Try again later or contact support.";
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === bookingStartId
            ? {
                ...msg,
                content: doctorPrompt,
                isLoading: false,
              }
            : msg,
        ),
      );
      if (list.length > 0 && !specialtyMiss) {
        setBookingDoctorMessageId(bookingStartId);
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
      toast({ title: "Error fetching doctors", variant: "destructive" });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === bookingStartId
            ? {
                ...msg,
                content: "Sorry, I couldn't fetch doctors right now.",
                isLoading: false,
              }
            : msg,
        ),
      );
      resetBookingFlow(); // Reset flow on error
    } finally {
      setIsLoading(false);
    }
  };

  // Handle successful login
  const handleLoginSuccess = (userData: any) => {
    console.log("Login successful, user data:", userData);
    
    // Verify that login actually succeeded - check for token in various locations
    const token = userData?.token || userData?.data?.token || userData?.accessToken || userData?.access_token;
    
    if (!userData || userData.success === false || userData.error || !token) {
      console.error("Invalid login data received:", userData);
      toast({
        title: "Login Error",
        description: "Authentication failed. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    setAppointmentUser(userData);
    setShowLoginModal(false);
    
    // Defer until after modal unmount + localStorage flush so fetchDoctors sees the token
    setTimeout(() => {
      void handleStartBooking();
    }, 0);
  };

  const loadSlotsForDoctor = async (doctor: any) => {
    setSelectedDoctor(doctor);
    setIsLoading(true);
    setBookingStep(2);
    setBookingBriefMessageId(null);
    const slotsMessageId = newBookingMessageId();
    const prep = comePrepared(userTranscript(messages));
    const loadingSlotsMessage: Message = {
      id: slotsMessageId,
      role: "assistant",
      content: `Come prepared: ${prep.guideline}${
        prep.labs.length ? ` Labs: ${prep.labs.join(", ")}.` : ""
      } Fetching available slots for ${
        doctor.name ||
        (doctor.firstName ? doctor.firstName + " " + doctor.lastName : "the doctor")
      }...`,
      timestamp: new Date(),
      isLoading: true,
      suggestsBooking: false,
    };
    setBookingSlotMessageId(null);
    setMessages((prev) => [...prev, loadingSlotsMessage]);

    try {
      const doctorId = doctor._id || doctor.id;
      const slots = await AppointmentService.fetchAvailability(doctorId);
      const slotList = Array.isArray(slots) ? slots : (slots as any)?.data ?? (slots as any)?.slots ?? [];
      setAvailableSlots(slotList);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === slotsMessageId
            ? {
                ...msg,
                content:
                  slotList.length > 0
                    ? `${loadingSlotsMessage.content.replace(/Fetching available slots.*/, "")}Please select an available time slot:`
                    : "No open slots were returned for this doctor. Try another doctor or check back later.",
                isLoading: false,
              }
            : msg,
        ),
      );
      if (slotList.length > 0) {
        setBookingSlotMessageId(slotsMessageId);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast({ title: "Error fetching time slots", variant: "destructive" });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === slotsMessageId
            ? {
                ...msg,
                content: `Sorry, I couldn't fetch slots for ${doctor.name || (doctor.firstName ? doctor.firstName + " " + doctor.lastName : "the doctor")}.`,
                isLoading: false,
              }
            : msg,
        ),
      );
      setBookingStep(1);
      setSelectedDoctor(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDoctor = async (doctor: any) => {
    console.log("SELECTED DOCTOR OBJECT:", doctor);
    const guard = specialtyGuard(userTranscript(messages), doctorSpecialtyOf(doctor));
    if (guard.mismatch) {
      const id = newBookingMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          content: guard.reason,
          timestamp: new Date(),
          suggestsBooking: false,
        },
      ]);
      toast({ title: "Specialty does not match", description: guard.reason, variant: "destructive" });
      return;
    }

    setSelectedDoctor(doctor);
    setIsBookingFlowActive(true);
    setBookingStep(15);
    const prep = comePrepared(userTranscript(messages));
    const briefId = newBookingMessageId();
    setBookingBriefMessageId(briefId);
    setMessages((prev) => [
      ...prev,
      {
        id: briefId,
        role: "assistant",
        content: `Before a slot is booked: do you want to create a visit brief for the doctor?\n\nCome prepared: ${prep.guideline}${
          prep.labs.length ? `\nLabs: ${prep.labs.join(", ")}` : ""
        }\nFasting: ${prep.fasting ? "yes" : "no"}.`,
        timestamp: new Date(),
        suggestsBooking: false,
        briefPrompt: true,
      },
    ]);
  };

  const acceptBriefThenBook = () => {
    const lines = messages
      .filter((m) => m.role === "user")
      .map((m) => collapseRepeatedSpeech(m.content.trim()))
      .filter(Boolean);
    const meds = [
      ...new Set(
        messages.flatMap((m) =>
          (m.engine?.mentions ?? [])
            .filter((x) => x.generic)
            .map((x) => x.generic as string),
        ),
      ),
    ];
    stashHandoffFromChat(lines, meds);
    if (selectedDoctor) {
      stashPendingSlotBook({ doctor: selectedDoctor, afterBrief: true });
    }
    setLocation("/handoff-review?next=book");
  };

  const skipBriefThenBook = () => {
    if (!selectedDoctor) return;
    void loadSlotsForDoctor(selectedDoctor);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("book") !== "1") return;
    const pending = takePendingSlotBook();
    if (!pending?.afterBrief || !pending.doctor) return;
    const latest = loadBriefsLocal().at(-1);
    const ok =
      latest &&
      (latest.patientReview.status === "approved" ||
        latest.patientReview.status === "waived");
    if (!ok) {
      stashPendingSlotBook(pending);
      toast({
        title: "Approve the brief first",
        description: "A slot is offered only after you approve or waive the visit brief.",
      });
      return;
    }
    setIsBookingFlowActive(true);
    void loadSlotsForDoctor(pending.doctor);
    // Resume once after returning from handoff-review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSlot = async (slot: any) => {
    // Log the full slot object to understand its structure
    console.log("SELECTED SLOT FULL OBJECT:", slot);
    
    setSelectedSlot(slot);
    setIsLoading(true);
    setBookingStep(3); // Move to confirmation
    console.log("Slot selected:", slot);

    // Add placeholder message
    const requestingMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Requesting appointment with ${selectedDoctor.name || selectedDoctor.firstName + ' ' + selectedDoctor.lastName} for ${slot.date || slot.appointmentDate} at ${slot.time || slot.startTime}...`,
      timestamp: new Date(),
      isLoading: true,
      suggestsBooking: false
    };
    setMessages(prev => [...prev, requestingMessage]);

    if (!currentUser) {
      toast({ title: "Login Required", variant: "destructive" });
      resetBookingFlow();
      setIsLoading(false);
      return;
    }

    try {
      // Get the MongoDB ObjectId for the doctor
      const doctorId = selectedDoctor._id || selectedDoctor.id;
      
      // Extract date and time from the slot
      const appointmentDate = slot.date || slot.appointmentDate;
      const appointmentTime = slot.time || slot.startTime;
      
      // Get symptoms from previous messages (last user message or a few messages combined)
      const extractSymptoms = (): string => {
        // Find the last few user messages to extract symptoms
        const userMessages = messages
          .filter(msg => msg.role === 'user')
          .slice(-3); // Get last 3 user messages
        
        if (userMessages.length === 0) {
          return "General consultation";
        }
        
        // Combine the content of user messages, with a maximum length
        const combinedSymptoms = userMessages
          .map(msg => msg.content)
          .join("; ")
          .substring(0, 100); // Limit to 100 characters
        
        return combinedSymptoms || "General consultation";
      };
      
      // Extract symptoms for the reason field
      const symptoms =
        bookingSpecialtyHint && riskBookingSummary
          ? riskBookingSummary
          : extractSymptoms();
      
      // Prepare the appointment data for the API
      const appointmentData = {
        // Doctor details
        doctorId: doctorId,
        doctorName: selectedDoctor.name || 
                   (selectedDoctor.firstName ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : "Doctor"),
        
        // Patient details - include EVERYTHING the API might need
        patientName: currentUser.displayName || "Patient",
        patientEmail: currentUser.email || "patient@example.com",
        patientPhone: "", // Add if available
        
        // Include the external ID for the backend to handle
        externalPatientId: currentUser.uid,
        patientExternalId: currentUser.uid,
        
        // Flag for API to handle patient creation if needed
        createPatientIfNeeded: true,
        
        // Appointment details  
        date: appointmentDate,
        time: appointmentTime,
        dateTime: slot.dateTime || `${appointmentDate}T${appointmentTime}`,
        status: "pending",
        
        // Slot ID if available
        slotId: slot._id || slot.id,
        
        // Include patient symptoms in the reason field
        reason: `${symptoms} - Consultation from MediAI`,
        notes: "Appointment booked via MediAI assistant",
      };
      
      // Log the appointment data we're sending
      console.log("SENDING APPOINTMENT DATA:", JSON.stringify(appointmentData, null, 2));
      
      // Send request directly to appointments endpoint
      const response = await AppointmentService.requestAppointment(appointmentData);
      console.log("Appointment request response:", response);

      // Show confirmation message with doctor's name and appointment details
      const doctorName = selectedDoctor.name || 
                        (selectedDoctor.firstName ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : 'the doctor');

      const appointmentIdFromApi =
        AppointmentService.extractAppointmentIdFromCreateResponse(response) ||
        (typeof response?.appointmentId === "string" ? response.appointmentId : undefined);

      if (appointmentIdFromApi) {
        AppointmentService.persistBookingDisplayMeta(appointmentIdFromApi, {
          date: appointmentDate,
          time: appointmentTime,
          doctorName,
        });
      }
      
      // Update the message to include appointment ID
      const updatedMessage: Message = {
        ...requestingMessage,
        content: `Appointment request sent! You will be notified once ${doctorName} confirms for ${appointmentDate} at ${appointmentTime}.`,
        isLoading: false,
        appointmentId: appointmentIdFromApi,
      };
      
      setMessages(prev => prev.map(msg => 
        msg.id === requestingMessage.id ? updatedMessage : msg
      ));
      
      // Also store in Firestore
      if (currentConsultation) {
        await addMessageToConsultation(currentConsultation, updatedMessage);
      }
      
      // Show appointment ID in toast if available
      if (response && appointmentIdFromApi) {
        toast({
          title: "Appointment Requested",
          description: `Appointment ID: ${appointmentIdFromApi}`,
        });
        
        // Reset the booking flow with appointment ID for status checks
        resetBookingFlow(appointmentIdFromApi);
      } else {
        // Reset without ID if no appointment ID returned
        resetBookingFlow();
      }

    } catch (error: any) { 
      console.error("Error requesting appointment:", error);
      toast({ 
        title: "Error requesting appointment", 
        description: error.message || "Failed to book appointment",
        variant: "destructive" 
      });
      setMessages(prev => prev.map(msg => 
        msg.id === requestingMessage.id 
          ? { ...msg, content: "Sorry, I couldn't submit the appointment request.", isLoading: false } 
          : msg
      ));
      // Optionally reset only this step or the whole flow
      setBookingStep(2); // Go back to slot selection
      setSelectedSlot(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Add function to display a more prominent notification when appointment is approved
  const showAppointmentApprovalNotification = (
    display: {
      doctorName: string;
      date: string;
      time: string;
    },
    appointmentId: string,
  ) => {
    // Add a visible banner notification at the top of the chat
    const appointmentNotificationBanner = document.createElement('div');
    appointmentNotificationBanner.className = 'bg-success/10 border border-success/30 text-success p-4 mb-4 rounded-xl';
    appointmentNotificationBanner.innerHTML = `
      <div class="flex items-center">
        <svg class="h-5 w-5 shrink-0 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <p class="font-bold">Appointment Confirmed!</p>
          <p>Your appointment with Dr. ${display.doctorName} on ${display.date} at ${display.time} has been approved.</p>
        </div>
      </div>
    `;
    
    // Find the chat container and insert at the top
    const chatContainer = document.querySelector('.scroll-area');
    if (chatContainer) {
      chatContainer.prepend(appointmentNotificationBanner);
      
      // Scroll to show the notification
      appointmentNotificationBanner.scrollIntoView({ behavior: 'smooth' });
      
      // Remove after 10 seconds
      setTimeout(() => {
        appointmentNotificationBanner.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => appointmentNotificationBanner.remove(), 500);
      }, 10000);
    }
    
    // Also store appointment in localStorage for quick access across the app
    storeAppointment({ ...display, appointmentId });
  };

  // Function to store the appointment in localStorage for access from other parts of the app
  const storeAppointment = (appointmentData: any) => {
    try {
      // Validate required fields
      if (!appointmentData.doctorName || !appointmentData.date || !appointmentData.time) {
        console.error('Missing required appointment fields:', appointmentData);
        return;
      }

      // Format the appointment data
      const appointmentToStore = {
        id: appointmentData.appointmentId || appointmentData._id || Date.now().toString(),
        doctorId: appointmentData.doctorId || '',
        doctorName: appointmentData.doctorName,
        date: appointmentData.date,
        time: appointmentData.time,
        status: appointmentData.status || 'pending',
        reason: appointmentData.reason || 'Medical Consultation',
        createdAt: new Date().toISOString(),
        patientId: currentUser?.uid
      };

      // Get existing appointments
      const existingAppointments = JSON.parse(localStorage.getItem('mediaiAppointments') || '[]');
      
      // Remove any appointments with the same ID
      const filteredAppointments = existingAppointments.filter(
        (appt: any) => appt.id !== appointmentToStore.id
      );
      
      // Add the new appointment
      filteredAppointments.push(appointmentToStore);
      
      // Store back in localStorage
      localStorage.setItem('mediaiAppointments', JSON.stringify(filteredAppointments));
      
      console.log('Appointment stored:', appointmentToStore);
      
      // Also store in Firestore if possible
      if (currentUser && appointmentToStore.id) {
        storeAppointmentInFirestore(appointmentToStore);
      }
    } catch (error) {
      console.error('Error storing appointment:', error);
    }
  };

  // Function to store appointment in Firestore for persistence
  const storeAppointmentInFirestore = async (appointmentData: any) => {
    if (!currentUser) return;
    
    try {
      // Create a collection for user appointments
      const appointmentRef = collection(db, 'users', currentUser.uid, 'appointments');
      
      await addDoc(appointmentRef, {
        ...appointmentData,
        createdAt: serverTimestamp()
      });
      
      console.log('Appointment stored in Firestore');
    } catch (error) {
      console.error('Error storing appointment in Firestore:', error);
    }
  };

  // Update checkAppointmentStatus function to use the notification
  const checkAppointmentStatus = async (appointmentId: string) => {
    if (!appointmentId) return;
    
    try {
      const status = await AppointmentService.checkAppointmentStatus(appointmentId);
      console.log("Appointment status check:", status);

      const st = typeof status?.status === "string" ? status.status.toLowerCase() : "";
      if (status && st === "approved") {
        const display = AppointmentService.resolveApprovedAppointmentDisplay(appointmentId, status);
        // Check if this is the first time we're seeing this approval
        const appointmentKey = `appointment_approved_${appointmentId}`;
        const alreadyNotified = sessionStorage.getItem(appointmentKey);
        
        if (!alreadyNotified) {
          // Show prominent notification
          showAppointmentApprovalNotification(display, appointmentId);
          
          // Store flag to avoid duplicate notifications
          sessionStorage.setItem(appointmentKey, 'true');
          
          // Add confirmation message to chat
          const confirmationMessage: Message = {
            id: `appointment_approved_${appointmentId}`,
            role: 'assistant',
            content: `Good news! Dr. ${display.doctorName} has approved your appointment for ${display.date} at ${display.time}. Please arrive 15 minutes early.`,
            timestamp: new Date(),
            suggestsBooking: false,
            isAppointmentUpdate: true,
            appointmentId: appointmentId
          };
          
          // Check if this message already exists in the chat
          const messageExists = messages.some(msg => msg.id === confirmationMessage.id);
          if (!messageExists) {
            setMessages(prev => [...prev, confirmationMessage]);
            
            // Also show a toast notification
            toast({
              title: "Appointment Approved!",
              description: `Your appointment with Dr. ${display.doctorName} on ${display.date} at ${display.time} has been approved.`,
              variant: "default"
            });
            
            // Add the message to the current consultation in Firestore
            if (currentConsultation) {
              await addMessageToConsultation(currentConsultation, confirmationMessage);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking appointment status:", error);
    }
  };

  // Modify the resetBookingFlow function to save booking messages
  const resetBookingFlow = (appointmentId?: string) => {
    setIsBookingFlowActive(false);
    setBookingStep(0);
    setAvailableDoctors([]);
    setAvailableSlots([]);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setIsLoading(false);
    
    // If we have an appointment ID, schedule status checks
    if (appointmentId) {
      // Check immediately once
      checkAppointmentStatus(appointmentId);
      
      // Then set an interval to check every 30 seconds for 5 minutes
      const statusCheckInterval = setInterval(() => {
        checkAppointmentStatus(appointmentId);
      }, 30000); // Check every 30 seconds
      
      // Clear the interval after 5 minutes
      setTimeout(() => {
        clearInterval(statusCheckInterval);
      }, 300000); // 5 minutes
    }
    
    console.log("Booking flow reset. Will monitor appointment status:", appointmentId);
    setBookingSpecialtyHint(undefined);
    setRiskBookingSummary(undefined);
    setBookingDoctorMessageId(null);
    setBookingSlotMessageId(null);
    setBookingBriefMessageId(null);
  };

  const ensureConsultationId = async (): Promise<string | null> => {
    if (currentConsultation) return currentConsultation;
    const id = await createConsultation();
    if (id) setCurrentConsultation(id);
    return id;
  };

  const chooseRiskAssessment = async () => {
    if (!currentUser) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }
    const cid = await ensureConsultationId();
    if (!cid) return;
    const userMessage: Message = {
      id: `u-risk-${Date.now()}`,
      role: "user",
      content: "Risk prediction",
      timestamp: new Date(),
      suggestsBooking: false,
    };
    const assistantMessage: Message = {
      id: `a-risk-menu-${Date.now()}`,
      role: "assistant",
      content: "Please choose the type of health risk you want to assess:",
      timestamp: new Date(),
      suggestsBooking: false,
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    await addMessageToConsultation(cid, userMessage);
    await addMessageToConsultation(cid, assistantMessage);
    setShowHealthMainMenu(false);
    setShowRiskDiseaseMenu(true);
  };

  const chooseGeneralConsultation = async () => {
    if (!currentUser) {
      toast({ title: "Login required", variant: "destructive" });
      return;
    }
    const cid = await ensureConsultationId();
    if (!cid) return;
    const userMessage: Message = {
      id: `u-gen-${Date.now()}`,
      role: "user",
      content: "Consultation",
      timestamp: new Date(),
      suggestsBooking: false,
    };
    const assistantMessage: Message = {
      id: `a-gen-prompt-${Date.now()}`,
      role: "assistant",
      content:
        "Please describe your problem or symptoms.",
      timestamp: new Date(),
      suggestsBooking: false,
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    await addMessageToConsultation(cid, userMessage);
    await addMessageToConsultation(cid, assistantMessage);
    setShowHealthMainMenu(false);
    setShowRiskDiseaseMenu(false);
  };

  const openRiskDiseaseModal = (disease: RiskDisease) => {
    setRiskModalDisease(disease);
    setRiskModalOpen(true);
    setShowRiskDiseaseMenu(false);
  };

  const buildRiskResultText = (
    disease: RiskDisease,
    percent: number,
    factors: RiskContributingFactor[],
    riskSummary?: string,
  ) => {
    const title = DISEASE_TITLE[disease];
    const band =
      percent < 25
        ? "This score is relatively low for this calculator. The inputs you gave looked more like lower-risk examples the model was trained on."
        : percent < 55
          ? "This score sits in a middle band. Not extreme either way, but still useful as a prompt to talk with a clinician if something worries you."
          : "This score is on the higher side. The model is reacting to stronger signals in what you entered, so follow-up with a professional is especially reasonable.";

    const factorLines = (
      factors?.length
        ? factors.slice(0, 4)
        : [{ name: "Overall pattern", explanation: "The tool combined your answers into one score; details below are general hints, not a diagnosis." }]
    )
      .map((f) => {
        const why = f.explanation?.trim();
        return why ? `• ${f.name}: ${why}` : `• ${f.name}`;
      })
      .join("\n");

    const prev = preventionTips(disease);
    const spec = DISEASE_SPECIALIST[disease];
    const summaryBlock = (riskSummary && riskSummary.trim()) || band;

    return `Your estimated risk for ${title} is ${percent}%.\n\nWhat this means (in plain terms):\n${summaryBlock}\n\nKey contributing factors:\n${factorLines}\n\nGeneral ideas that support wellness:\n${prev}\n\nWould you like to consult a specialist? A ${spec} can review your situation in person.`;
  };

  const handleRiskFormSubmit = async (payload: Record<string, number | string>) => {
    if (!riskModalDisease || !currentUser) return;
    const cid = currentConsultation;
    if (!cid) {
      toast({ title: "Start a chat first", variant: "destructive" });
      return;
    }
    setRiskSubmitLoading(true);
    try {
      if (riskModalDisease === "kidney") {
        const assistantMessage: Message = {
          id: `a-risk-kidney-${Date.now()}`,
          role: "assistant",
          content: `Kidney risk scoring is not connected yet, so we cannot show a percentage. Your entries were noted for when the model is ready.\n\n${preventionTips(
            "kidney",
          )}\n\nWould you like to consult a specialist? A ${DISEASE_SPECIALIST.kidney} can help with kidney-related questions.`,
          timestamp: new Date(),
          suggestsBooking: true,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        await addMessageToConsultation(cid, assistantMessage);
        setBookingSpecialtyHint(DISEASE_SPECIALIST.kidney);
        setRiskBookingSummary(`Kidney health discussion (${DISEASE_TITLE.kidney})`);
        riskModalCompletedRef.current = true;
        setRiskModalOpen(false);
        return;
      }

      const data = await predictRisk(riskModalDisease, payload);
      const pct =
        typeof data.riskPercent === "number" && !Number.isNaN(data.riskPercent)
          ? data.riskPercent
          : 0;
      const assistantMessage: Message = {
        id: `a-risk-result-${Date.now()}`,
        role: "assistant",
        content: buildRiskResultText(
          riskModalDisease,
          pct,
          data.contributingFactors || [],
          data.riskSummary,
        ),
        timestamp: new Date(),
        suggestsBooking: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await addMessageToConsultation(cid, assistantMessage);
      setBookingSpecialtyHint(DISEASE_SPECIALIST[riskModalDisease]);
      setRiskBookingSummary(`Risk assessment: ${DISEASE_TITLE[riskModalDisease]}`);
      riskModalCompletedRef.current = true;
      setRiskModalOpen(false);
    } catch (e: any) {
      toast({
        title: "Risk estimate unavailable",
        description: e?.message || "Check that the ML service is running (port 5050).",
        variant: "destructive",
      });
    } finally {
      setRiskSubmitLoading(false);
    }
  };

  // Function to remove duplicate messages
  const removeDuplicateMessages = (messages: Message[]): Message[] => {
    const uniqueIds = new Set<string>();
    return messages.filter(msg => {
      // For messages with IDs, check if we've seen this ID before
      if (uniqueIds.has(msg.id)) {
        return false; // Skip duplicate
      }
      
      uniqueIds.add(msg.id);
      return true; // Keep unique message
    });
  };

  // Function to check for pending appointments in message history
  const checkForPendingAppointments = (messages: Message[]) => {
    // Look for appointment request messages
    for (const msg of messages) {
      // If message contains appointmentId and is about a pending appointment
      if (msg.appointmentId && msg.content.includes('appointment request sent')) {
        // Resume status checking for this appointment
        checkAppointmentStatus(msg.appointmentId);
      }
    }
  };

  return (
    <div className="surface relative flex h-full min-h-[600px] w-full flex-col overflow-hidden">
      <div className="z-10 flex flex-row items-center justify-between border-b border-border bg-card px-5 py-3.5">
        <h2 className="text-base font-semibold tracking-tight">
          Medical assistant
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lines = messages
                .filter((m) => m.role === "user")
                .map((m) => m.content.trim())
                .filter(Boolean);
              if (!lines.length) {
                toast({
                  title: "No patient words yet",
                  description: "Send a symptom message first.",
                  variant: "destructive",
                });
                return;
              }
              const meds = [
                ...new Set(
                  messages.flatMap((m) =>
                    (m.engine?.mentions ?? [])
                      .filter((x) => x.generic)
                      .map((x) => x.generic as string),
                  ),
                ),
              ];
              stashHandoffFromChat(lines, meds);
              setLocation("/handoff-review");
            }}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Send to doctor brief
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            New session
          </Button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden bg-muted/20">
        {/* Chat Messages */}
        <ScrollArea className="h-full px-4 pt-6 pb-32">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] gap-4 p-8 text-center">
              <div className="mb-2 grid h-14 w-14 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <BrainCircuit className="h-7 w-7" />
              </div>
              <p className="text-base font-medium">What can I do for you today?</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Start a{" "}
                <span className="font-medium text-primary">new session</span> for
                a risk assessment, or just describe how you feel below.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md border border-border bg-card text-card-foreground shadow-xs'
                    }`}
                  >
                    {msg.image && (
                      <div className="mb-2">
                        <img 
                          src={msg.image} 
                          alt="Uploaded medical image" 
                          className="max-w-full max-h-[200px] object-contain rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '';
                            target.alt = 'Failed to load image';
                            target.className = 'max-w-full rounded-lg bg-gray-100 p-4 text-center text-sm text-gray-500';
                            target.textContent = 'Image failed to load';
                          }}
                        />
                      </div>
                    )}
                    {msg.role === 'user' && msg.image ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.imagePrompt || 'Please analyze this medical image.'}
                      </p>
                    ) : msg.role === "assistant" ? (
                      <>
                        {renderAssistantText(msg.content, msg.engine?.verdicts)}
                        {msg.engine && <ChatEnginePanel result={msg.engine} />}
                      </>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {msg.role === "assistant" &&
                      showHealthMainMenu &&
                      String(msg.id).startsWith("health-intro") && (
                        <div className="mt-3 flex flex-col gap-2">
                          <Button
                            size="sm"
                            className="w-full justify-center"
                            onClick={() => void chooseRiskAssessment()}
                            disabled={isLoading}
                          >
                            Risk prediction
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() => void chooseGeneralConsultation()}
                            disabled={isLoading}
                          >
                            Consultation
                          </Button>
                        </div>
                      )}
                    
                    {/* Render Booking Button if AI suggests it and flow isn't active */}
                    {msg.role === 'assistant' && msg.suggestsBooking && !isBookingFlowActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mt-3 border-t border-border pt-3"
                      >
                        <Button
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={handleStartBooking}
                          disabled={isLoading}
                        >
                          <CalendarPlus className="h-4 w-4" />
                          Book consultation
                        </Button>
                      </motion.div>
                    )}

                    {/* Show doctors only on the anchored booking prompt (not every matching text bubble) */}
                    {msg.role === "assistant" &&
                      bookingStep === 1 &&
                      msg.id === bookingDoctorMessageId &&
                      availableDoctors.length > 0 && (
                       <div className="mt-2 space-y-1">
                         {availableDoctors.map(doc => (
                           <Button 
                             key={doc._id || doc.id} 
                             variant="outline" 
                             size="sm" 
                             className="w-full justify-start text-left" 
                             onClick={() => handleSelectDoctor(doc)} 
                             disabled={isLoading}
                           >
                             {doc.name || doc.firstName + ' ' + doc.lastName || 'Unnamed Doctor'} 
                             {doc.specialization && ` (${doc.specialization})`}
                             {doc.specialty && ` (${doc.specialty})`}
                           </Button>
                         ))}
                       </div>
                    )}

                    {msg.role === "assistant" &&
                      bookingStep === 15 &&
                      msg.id === bookingBriefMessageId &&
                      msg.briefPrompt && (
                        <div className="mt-3 flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={acceptBriefThenBook}
                            disabled={isLoading}
                          >
                            Yes, create a visit brief
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={skipBriefThenBook}
                            disabled={isLoading}
                          >
                            No, pick a slot now
                          </Button>
                        </div>
                      )}

                    {/* Show time slots only on the anchored slot prompt */}
                    {msg.role === "assistant" &&
                      bookingStep === 2 &&
                      msg.id === bookingSlotMessageId &&
                      availableSlots.length > 0 && (
                       <div className="mt-2 grid grid-cols-2 gap-1.5">
                         {availableSlots.map((slot, index) => {
                           // Handle different data formats that might come from API
                           const displayDate = slot.date || slot.appointmentDate || '';
                           const displayTime = slot.time || slot.startTime || '';
                           
                           return (
                             <Button 
                               key={index} 
                               variant="outline" 
                               size="sm" 
                               className="whitespace-nowrap px-2 text-xs" 
                               onClick={() => handleSelectSlot(slot)} 
                               disabled={isLoading}
                             >
                               {displayDate && displayTime 
                                 ? `${displayDate} @ ${displayTime}`
                                 : (slot.displayText || JSON.stringify(slot))
                               }
                             </Button>
                           );
                         })}
                         {availableSlots.length === 0 && 
                           <p className="text-xs text-muted-foreground col-span-3">No available slots found.</p>
                         }
                       </div>
                    )}
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
              {showRiskDiseaseMenu && (
                <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Please choose the type of health risk you want to assess:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["diabetes", "heart", "liver", "kidney"] as RiskDisease[]).map((d) => (
                      <Button
                        key={d}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-background"
                        onClick={() => openRiskDiseaseModal(d)}
                        disabled={isLoading}
                      >
                        {DISEASE_TITLE[d]}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
          {isLoading && (
            <div className="flex justify-start mt-2">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Cancel Booking Button */} 
        {isBookingFlowActive && (
          <div className="flex justify-center mb-2">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => resetBookingFlow()} 
              disabled={isLoading}
            >
              Cancel Booking Process
            </Button>
          </div>
        )}

        {/* Selected File Display */}
        {file && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg mb-4">
            <div className="flex items-center space-x-2">
              <Image className="h-4 w-4" />
              <span className="text-sm">{file.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFile(null);
                setFileType(null);
              }}
              disabled={isLoading}
            >
              Remove
            </Button>
          </div>
        )}
        
        {/* Loading indicator for image upload */}
        {file && isLoading && (
          <div className="flex justify-center items-center p-2 bg-muted rounded-lg mb-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Uploading and analyzing image...</span>
          </div>
        )}

        {/* Sleek Floating Input Area */}
        <div className="absolute bottom-6 left-1/2 z-20 flex w-[92%] max-w-3xl -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 p-2 pr-3 shadow-lg backdrop-blur-md">
          <label htmlFor="file-upload" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground">
            <Upload className="h-4 w-4" />
            <Input
              id="file-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (!selectedFile) return;
                if (selectedFile.type.startsWith('image/')) {
                  setFile(selectedFile);
                  setFileType('image');
                } else {
                  toast({
                    variant: "destructive",
                    title: "Invalid file type",
                    description: "Please upload an image file (JPG, PNG)",
                  });
                }
              }}
              disabled={isLoading}
            />
          </label>
          
          <div className="relative flex-1">
            <input
              className="h-10 w-full border-0 bg-transparent px-2 text-sm text-foreground outline-none focus:ring-0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(input)}
              placeholder="Type your symptoms or questions..."
              disabled={isLoading || isRecording}
            />
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full transition-colors duration-fast ${isRecording ? "bg-destructive/12 text-destructive hover:bg-destructive/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              onClick={handleVoiceRecord}
              disabled={isLoading}
            >
              <Mic className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
              onClick={() => handleLogSymptom(input)}
              disabled={isLoading || !input.trim()}
              title="Log symptom to diary"
            >
              <Save className="h-4 w-4" />
            </Button>

            <Button
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => handleSendMessage(input)}
              disabled={isLoading || isRecording || !input.trim()}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </div>
        </div>

        {/* Login Modal */}
        <AppointmentLoginModal 
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
        />

        <RiskAssessmentModal
          open={riskModalOpen}
          onOpenChange={(open) => {
            setRiskModalOpen(open);
            if (!open) {
              if (!riskModalCompletedRef.current) {
                setShowRiskDiseaseMenu(true);
              }
              riskModalCompletedRef.current = false;
            }
          }}
          disease={riskModalDisease}
          onSubmit={(payload) => void handleRiskFormSubmit(payload)}
          isSubmitting={riskSubmitLoading}
        />
      </div>
    </div>
  );
}