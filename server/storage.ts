import {
  users, type User, type InsertUser,
  consultations, type Consultation, type InsertConsultation,
  messages, type Message, type InsertMessage,
  diagnoses, type Diagnosis, type InsertDiagnosis,
  uploads, type Upload, type InsertUpload
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Consultations
  getConsultation(id: number): Promise<Consultation | undefined>;
  getConsultationsByUserId(userId: number): Promise<Consultation[]>;
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  updateConsultationStatus(id: number, status: string): Promise<Consultation | undefined>;
  
  // Messages
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConsultationId(consultationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Diagnoses
  getDiagnosis(id: number): Promise<Diagnosis | undefined>;
  getDiagnosisByConsultationId(consultationId: number): Promise<Diagnosis | undefined>;
  createDiagnosis(diagnosis: InsertDiagnosis): Promise<Diagnosis>;
  
  // Uploads
  getUpload(id: number): Promise<Upload | undefined>;
  getUploadsByConsultationId(consultationId: number): Promise<Upload[]>;
  createUpload(upload: InsertUpload): Promise<Upload>;
  updateUploadAnalysis(id: number, analysisResult: any): Promise<Upload | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private consultations: Map<number, Consultation>;
  private messages: Map<number, Message>;
  private diagnoses: Map<number, Diagnosis>;
  private uploads: Map<number, Upload>;
  
  private userIdCounter: number;
  private consultationIdCounter: number;
  private messageIdCounter: number;
  private diagnosisIdCounter: number;
  private uploadIdCounter: number;

  constructor() {
    this.users = new Map();
    this.consultations = new Map();
    this.messages = new Map();
    this.diagnoses = new Map();
    this.uploads = new Map();
    
    this.userIdCounter = 1;
    this.consultationIdCounter = 1;
    this.messageIdCounter = 1;
    this.diagnosisIdCounter = 1;
    this.uploadIdCounter = 1;
    
    // Add sample user
    this.createUser({
      username: "johndavis",
      password: "password123", // In a real app, this would be hashed
      email: "john.davis@example.com",
      name: "John Davis",
      age: 34,
      bloodType: "O+",
      allergies: "Penicillin"
    });
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { 
      ...insertUser,
      age: insertUser.age ?? null,
      bloodType: insertUser.bloodType ?? null,
      allergies: insertUser.allergies ?? null,
      id, 
      createdAt: now
    };
    this.users.set(id, user);
    return user;
  }

  // Consultation Methods
  async getConsultation(id: number): Promise<Consultation | undefined> {
    return this.consultations.get(id);
  }

  async getConsultationsByUserId(userId: number): Promise<Consultation[]> {
    return Array.from(this.consultations.values()).filter(
      (consultation) => consultation.userId === userId
    );
  }

  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const id = this.consultationIdCounter++;
    const now = new Date();
    const consultation: Consultation = {
      ...insertConsultation,
      status: insertConsultation.status ?? "active",
      id,
      date: now
    };
    this.consultations.set(id, consultation);
    return consultation;
  }

  async updateConsultationStatus(id: number, status: string): Promise<Consultation | undefined> {
    const consultation = this.consultations.get(id);
    if (!consultation) return undefined;
    
    const updatedConsultation = { ...consultation, status };
    this.consultations.set(id, updatedConsultation);
    return updatedConsultation;
  }

  // Message Methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConsultationId(consultationId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (message) => message.consultationId === consultationId
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: now
    };
    this.messages.set(id, message);
    return message;
  }

  // Diagnosis Methods
  async getDiagnosis(id: number): Promise<Diagnosis | undefined> {
    return this.diagnoses.get(id);
  }

  async getDiagnosisByConsultationId(consultationId: number): Promise<Diagnosis | undefined> {
    return Array.from(this.diagnoses.values()).find(
      (diagnosis) => diagnosis.consultationId === consultationId
    );
  }

  async createDiagnosis(insertDiagnosis: InsertDiagnosis): Promise<Diagnosis> {
    const id = this.diagnosisIdCounter++;
    const now = new Date();
    const diagnosis: Diagnosis = {
      ...insertDiagnosis,
      warnings: insertDiagnosis.warnings ?? null,
      id,
      createdAt: now
    };
    this.diagnoses.set(id, diagnosis);
    return diagnosis;
  }

  // Upload Methods
  async getUpload(id: number): Promise<Upload | undefined> {
    return this.uploads.get(id);
  }

  async getUploadsByConsultationId(consultationId: number): Promise<Upload[]> {
    return Array.from(this.uploads.values()).filter(
      (upload) => upload.consultationId === consultationId
    );
  }

  async createUpload(insertUpload: InsertUpload): Promise<Upload> {
    const id = this.uploadIdCounter++;
    const now = new Date();
    const upload: Upload = {
      ...insertUpload,
      analysisResult: insertUpload.analysisResult ?? null,
      id,
      uploadedAt: now
    };
    this.uploads.set(id, upload);
    return upload;
  }

  async updateUploadAnalysis(id: number, analysisResult: any): Promise<Upload | undefined> {
    const upload = this.uploads.get(id);
    if (!upload) return undefined;
    
    const updatedUpload = { ...upload, analysisResult };
    this.uploads.set(id, updatedUpload);
    return updatedUpload;
  }
}

export const storage = new MemStorage();
