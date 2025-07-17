'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  signInWithPopup, 
  getAdditionalUserInfo,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface UserData {
  email: string;
  displayName: string;
  brainFatPercentage: number;
  lastWorkoutBcal?: number;
  lastWorkoutDate?: Date;
  totalBcalBurned?: number;
  totalWorkouts?: number;
  workoutHistory?: any[];
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (newUserData: Partial<UserData>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up the main authentication state listener
  useEffect(() => {
    console.log("Auth: Setting up authentication listener...");

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("Auth: onAuthStateChanged triggered", user ? "with user" : "with null");
      
      if (user) {
        console.log("Auth: User is signed in:", user.email);
        setUser(user);
        
        // Fetch user data from Firestore once
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as UserData;
            console.log("Auth: Fetched user data from Firestore:", data);
            setUserData(data);
          } else {
            console.log("Auth: User document doesn't exist, using default data");
            const defaultData: UserData = {
              email: user.email || '',
              displayName: user.displayName || '',
              brainFatPercentage: 100,
              createdAt: new Date()
            };
            setUserData(defaultData);
          }
        } catch (error) {
          console.error("Auth: Error fetching user data:", error);
          const defaultData: UserData = {
            email: user.email || '',
            displayName: user.displayName || '',
            brainFatPercentage: 100,
            createdAt: new Date()
          };
          setUserData(defaultData);
        }
        
        setIsLoading(false);
      } else {
        console.log("Auth: No user signed in");
        setUser(null);
        setUserData(null);
        setIsLoading(false);
      }
    });

    // Cleanup function for the auth state listener
    return () => {
      console.log("Auth: Cleaning up authentication listener");
      unsubscribeAuth();
    };
  }, []);

  const login = async () => {
    try {
      console.log("Auth: Initiating Google sign-in popup...");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      console.log("Auth: Popup sign-in successful:", result);
      
      // Check if this is a new user
      const additionalUserInfo = getAdditionalUserInfo(result);
      console.log("Auth: Additional user info:", additionalUserInfo);
      
      if (additionalUserInfo?.isNewUser) {
        console.log("Auth: New user detected, creating Firestore document...");
        
        try {
          const userDocRef = doc(db, 'users', result.user.uid);
          const newUserData: UserData = {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            brainFatPercentage: 100, // Initialize new users with exactly 100%
            createdAt: new Date()
          };
          
          await setDoc(userDocRef, newUserData);
          console.log("Auth: New user document created successfully with brainFatPercentage: 100");
          
          // Update AuthContext state with the new user data
          setUserData(newUserData);
        } catch (firestoreError) {
          console.error("Auth: Error creating user document:", firestoreError);
        }
      } else {
        console.log("Auth: Existing user - user data will be fetched by auth state listener");
      }
      
      // Set user state immediately from the popup result
      setUser(result.user);
      
    } catch (error) {
      console.error("Auth: Error during sign-in popup:", error);
    }
  };

  const logout = async () => {
    try {
      console.log("Auth: Signing out user...");
      await signOut(auth);
      console.log("Auth: User signed out successfully");
      // Note: No need to reset state here - the auth state listener will handle it
    } catch (error) {
      console.error("Auth: Error signing out:", error);
    }
  };

  const updateUser = (newUserData: Partial<UserData>) => {
    console.log("Auth: Updating user data:", newUserData);
    setUserData(prev => prev ? { ...prev, ...newUserData } : null);
  };

  const value = {
    user,
    userData,
    isLoading,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 