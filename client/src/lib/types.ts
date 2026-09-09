export interface User {
  name: string;
  email: string;
  age: number;
  bloodType: string;
  allergies: string;
  photoURL?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string; // This will hold the currently displayed language
  timestamp: Date | string; // Can be Date object or ISO string
  isLoading?: boolean;
  image?: string; // URL to the image stored in Cloudinary
  imagePrompt?: string; // The prompt used for image analysis
  suggestsBooking?: boolean;
  appointmentId?: string; // ID of the appointment if this message is related to an appointment
  isAppointmentUpdate?: boolean; // Flag to indicate if this message is an appointment status update
  englishContent?: string; // Original English content from AI
  translatedContent?: string; // Translated content from AI
  showEnglish?: boolean; // Flag to determine which language to display for AI messages
}

export interface Consultation {
  id: string;
  chatId: string;
  title: string;
  date: Date;
  lastUpdated?: Date;
  status: 'new' | 'active' | 'completed';
  userId: string;
  messages: Message[];
  symptoms?: string;
  diagnosis?: string;
  recommendations?: string;
}

export interface AuthContextProps {
  user: User | null;
  currentUser: any; // Firebase user
  userProfile: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  updateEmail: (newEmail: string, currentPassword: string) => Promise<{ status: string; message: string; }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}