import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { 
  getAuth, 
  GoogleAuthProvider,
  Auth
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

function isConfiguredValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return !lower.startsWith("your_") && !lower.includes("your-project") && !lower.includes("your_firebase");
}

export function isFirebaseConfigured() {
  const requiredConfigs = [
    'apiKey', 
    'authDomain', 
    'projectId', 
    'storageBucket', 
    'messagingSenderId', 
    'appId'
  ] as const;
  
  const missingConfigs = requiredConfigs.filter(key => 
    !isConfiguredValue(firebaseConfig[key])
  );
  
  if (missingConfigs.length > 0) {
    console.error(`Firebase configuration missing: ${missingConfigs.join(', ')}`);
    return false;
  }
  
  return true;
}

const validConfig = isFirebaseConfigured();

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

try {
  if (!validConfig) {
    throw new Error("Firebase configuration is invalid");
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  const storageBucket = firebaseConfig.storageBucket;
  storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app);

  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase initialization error details:", error);
  throw new Error("Failed to initialize Firebase. Please check your configuration.");
}

export { app, db, storage, auth, googleProvider };

// Firestore collection references
export const usersCollection = 'users';
export const consultationsCollection = 'consultations';
export const uploadsCollection = 'uploads';

// Types
export interface FirebaseUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  age?: number;
  bloodType?: string;
  allergies?: string;
  createdAt: Date;
}

export interface FirebaseConsultation {
  id: string;
  userId: string;
  title: string;
  status: 'ongoing' | 'completed';
  date: Date;
  symptoms?: string[];
  diagnosis?: string;
  recommendations?: string[];
}

export interface FirebaseUpload {
  id: string;
  consultationId: string;
  userId: string;
  fileName: string;
  fileType: string;
  url: string;
  uploadedAt: Date;
  analysisResult?: {
    conditions?: Array<{
      name: string;
      confidence: number;
    }>;
    observations?: string[];
    recommendations?: string[];
  };
}