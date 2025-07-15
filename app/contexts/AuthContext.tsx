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
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up the main authentication state listener
  useEffect(() => {
    console.log("Auth: Setting up authentication listener...");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth: onAuthStateChanged triggered", user ? "with user" : "with null");
      
      if (user) {
        console.log("Auth: User is signed in:", user.email);
        setUser(user);
      } else {
        console.log("Auth: No user signed in");
        setUser(null);
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
            brainFatPercentage: 35.0,
            createdAt: new Date()
          });
          console.log("Auth: New user document created successfully");
        } catch (firestoreError) {
          console.error("Auth: Error creating user document:", firestoreError);
        }
      } else {
        console.log("Auth: Existing user, no document creation needed");
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
    } catch (error) {
      console.error("Auth: Error signing out:", error);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    logout
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