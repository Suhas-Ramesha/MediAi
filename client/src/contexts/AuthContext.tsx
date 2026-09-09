import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextProps } from '@/lib/types';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  updateEmail as updateFirebaseEmail,
  updatePassword as updateFirebasePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  currentUser: null,
  userProfile: null,
  isLoading: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  signUp: async () => {},
  updateProfile: async () => {},
  updateEmail: async () => { return { status: 'initial', message: 'Initial state' }; },
  updatePassword: async () => {},
});

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEmailUpdate, setPendingEmailUpdate] = useState<string | null>(null);

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setUser(userData);
        setUserProfile(userData);
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Create or update user profile in Firestore
  const saveUserProfile = async (uid: string, userData: Partial<User>) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        await updateDoc(userRef, userData);
      } else {
        await setDoc(userRef, {
          ...userData,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  };

  // Handle email verification success
  const handleEmailVerificationSuccess = async (firebaseUser: any) => {
    try {
      // Update email in Firestore
      await saveUserProfile(firebaseUser.uid, { email: firebaseUser.email });

      // Update local state
      const updatedProfile = await fetchUserProfile(firebaseUser.uid);
      if (updatedProfile) {
        setUser(updatedProfile);
        setUserProfile(updatedProfile);
      }
      
      // Clear pending email update
      setPendingEmailUpdate(null);
    } catch (error) {
      console.error('Error updating profile after email verification:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);

      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        
        // Check if email was just verified
        if (firebaseUser.emailVerified && 
            pendingEmailUpdate && 
            pendingEmailUpdate === firebaseUser.email) {
          await handleEmailVerificationSuccess(firebaseUser);
        }

        // Try to fetch existing profile
        const profile = await fetchUserProfile(firebaseUser.uid);
        
        if (!profile) {
          // Create new profile if none exists
          const newUser: User = {
            name: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            age: 0,
            bloodType: '',
            allergies: '',
          };
          await saveUserProfile(firebaseUser.uid, newUser);
          setUser(newUser);
          setUserProfile(newUser);
        }
      } else {
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setPendingEmailUpdate(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [pendingEmailUpdate]); // Add pendingEmailUpdate to dependencies

  const updateProfile = async (profileData: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      // Update Firebase Auth profile if name is provided
      if (profileData.name) {
        await updateFirebaseProfile(currentUser, {
          displayName: profileData.name
        });
      }

      // Update Firestore profile
      await saveUserProfile(currentUser.uid, profileData);

      // Update local state
      const updatedProfile = await fetchUserProfile(currentUser.uid);
      if (updatedProfile) {
        setUser(updatedProfile);
        setUserProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    if (!result.user.emailVerified) {
      // Resend verification email if needed
      await sendEmailVerification(result.user);
      throw new Error('Please verify your email before logging in. A new verification email has been sent.');
    }
    
    await fetchUserProfile(result.user.uid);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await fetchUserProfile(result.user.uid);
  };

  const logout = async () => {
    // Clear local storage related to appointments/consultations
    try {
      localStorage.removeItem('mediaiAppointments');
      // Remove other potential keys found in appointments.tsx loadAppointments
      Object.keys(localStorage).forEach(key => {
        if (key.includes('appointment') || key.includes('doctor') || key.includes('booking')) {
          localStorage.removeItem(key);
        }
      });
      // Clear relevant session storage keys
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('appointment_approved_')) {
          sessionStorage.removeItem(key);
        }
      });
      console.log("Cleared local/session storage for appointments.");
    } catch (error) {
      console.error("Error clearing local/session storage during logout:", error);
    }
    
    // Sign out from Firebase
    await signOut(auth);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    if (name) {
      await updateFirebaseProfile(result.user, { displayName: name });
    }

    const newUser: User = {
      name: name || 'Anonymous',
      email: email,
      age: 0,
      bloodType: '',
      allergies: '',
    };

    await saveUserProfile(result.user.uid, newUser);
    await sendEmailVerification(result.user);
    
    // Sign out the user after sending verification email
    await signOut(auth);
    
    // Log message instead of returning it, to match Promise<void> type
    console.log('Verification email sent. Please check your email before logging in.');
  };

  // Remove this line as it's causing the error
  // await fetchUserProfile(result.user.uid);

  const updateEmail = async (newEmail: string, currentPassword: string) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      // Re-authenticate user before updating email
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Store the pending email update
      setPendingEmailUpdate(newEmail);

      // Send verification email to new address
      await verifyBeforeUpdateEmail(currentUser, newEmail);

      return {
        status: 'verification_needed',
        message: 'Please check your new email address for a verification link. Your email will be updated after verification.'
      };
    } catch (error) {
      console.error('Error updating email:', error);
      setPendingEmailUpdate(null);
      throw error;
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      // Re-authenticate user before updating password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update password in Firebase Auth
      await updateFirebasePassword(currentUser, newPassword);
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      currentUser, 
      userProfile, 
      isLoading, 
      login, 
      loginWithGoogle, 
      logout, 
      signUp,
      updateProfile,
      updateEmail,
      updatePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}