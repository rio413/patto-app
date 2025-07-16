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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  brainFatPercentage: number;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateBrainFatPercentage: (newPercentage: number) => Promise<void>;
  updateUserBrainFat: (newPercentage: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [brainFatPercentage, setBrainFatPercentage] = useState(100);

  // Set up the main authentication state listener
  useEffect(() => {
    console.log("Auth: Setting up authentication listener...");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth: onAuthStateChanged triggered", user ? "with user" : "with null");
      
      if (user) {
        console.log("Auth: User is signed in:", user.email);
        setUser(user);
        
        // Fetch user's brainFatPercentage from Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const currentBrainFat = parseFloat(userData.brainFatPercentage) || 100;
            console.log("Auth: Fetched brainFatPercentage from Firestore:", currentBrainFat);
            setBrainFatPercentage(currentBrainFat);
          } else {
            console.log("Auth: User document doesn't exist, using default brainFatPercentage: 100");
            setBrainFatPercentage(100);
          }
        } catch (error) {
          console.error("Auth: Error fetching user data:", error);
          setBrainFatPercentage(100);
        }
      } else {
        console.log("Auth: No user signed in");
        setUser(null);
        setBrainFatPercentage(100);
      }
      
      setIsLoading(false);
    });

    // Cleanup function
    return () => {
      console.log("Auth: Cleaning up authentication listener");
      unsubscribe();
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
          await setDoc(userDocRef, {
            email: result.user.email,
            displayName: result.user.displayName,
            brainFatPercentage: 100, // Initialize new users with 100%
            createdAt: new Date()
          });
          console.log("Auth: New user document created successfully with brainFatPercentage: 100");
          setBrainFatPercentage(100);
        } catch (firestoreError) {
          console.error("Auth: Error creating user document:", firestoreError);
        }
      } else {
        console.log("Auth: Existing user, fetching brainFatPercentage from Firestore...");
        try {
          const userDocRef = doc(db, 'users', result.user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const currentBrainFat = parseFloat(userData.brainFatPercentage) || 100;
            console.log("Auth: Fetched existing user's brainFatPercentage:", currentBrainFat);
            setBrainFatPercentage(currentBrainFat);
          } else {
            console.log("Auth: Existing user but no document found, using default: 100");
            setBrainFatPercentage(100);
          }
        } catch (error) {
          console.error("Auth: Error fetching existing user data:", error);
          setBrainFatPercentage(100);
        }
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
      setBrainFatPercentage(100); // Reset to default
    } catch (error) {
      console.error("Auth: Error signing out:", error);
    }
  };

  const updateBrainFatPercentage = async (newPercentage: number) => {
    if (!user) {
      console.error("Auth: Cannot update brainFatPercentage - no user logged in");
      return;
    }

    try {
      console.log("Auth: Updating brainFatPercentage to:", newPercentage);
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { brainFatPercentage: newPercentage }, { merge: true });
      setBrainFatPercentage(newPercentage);
      console.log("Auth: brainFatPercentage updated successfully in Firestore and state");
    } catch (error) {
      console.error("Auth: Error updating brainFatPercentage:", error);
    }
  };

  const updateUserBrainFat = (newPercentage: number) => {
    console.log("Auth: Directly updating brainFatPercentage state to:", newPercentage);
    setBrainFatPercentage(newPercentage);
  };

  const value = {
    user,
    isLoading,
    brainFatPercentage,
    login,
    logout,
    updateBrainFatPercentage,
    updateUserBrainFat
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