import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseAuthUser,
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

// Initialize Firebase
// Check if Firebase is properly configured
export function isFirebaseConfigured() {
  const requiredConfigs = [
    'apiKey', 
    'authDomain', 
    'projectId', 
    'storageBucket', 
    'messagingSenderId', 
    'appId'
  ];
  
  const missingConfigs = requiredConfigs.filter(key => 
    !firebaseConfig[key as keyof typeof firebaseConfig]
  );
  
  if (missingConfigs.length > 0) {
    console.error(`Firebase configuration missing: ${missingConfigs.join(', ')}`);
    return false;
  }
  
  return true;
}

const validConfig = isFirebaseConfigured();

// Initialize Firebase variables
let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

// Initialize Firebase
try {
  if (!validConfig) {
    throw new Error("Firebase configuration is invalid");
  }
  
  app = initializeApp(firebaseConfig);
  
  auth = getAuth(app);
  
  db = getFirestore(app);
  
  storage = getStorage(app);
  // Configure storage to use the correct bucket
  const storageBucket = firebaseConfig.storageBucket;
  if (storageBucket) {
    storage = getStorage(app, `gs://${storageBucket}`);
  }
  
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.warn("Firebase initialization warning:", error);
  if (error instanceof Error) {
    console.warn("Error message:", error.message);
  }
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