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
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface UserData {
  email: string;
  displayName: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up the main authentication state listener with real-time Firestore sync
  useEffect(() => {
    console.log("Auth: Setting up authentication listener...");

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("Auth: onAuthStateChanged triggered", user ? "with user" : "with null");
      
      // Clean up previous snapshot listener if it exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      
      if (user) {
        console.log("Auth: User is signed in:", user.email);
        setUser(user);
        
        // Set up real-time listener for user data from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        
        unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data() as UserData;
            console.log("Auth: Real-time user data update from Firestore:", data);
            setUserData(data);
          } else {
            console.log("Auth: User document doesn't exist, creating default data");
            const defaultData: UserData = {
              email: user.email || '',
              displayName: user.displayName || '',
              createdAt: new Date()
            };
            
            // Create the user document with default data
            setDoc(userDocRef, defaultData).then(() => {
              console.log("Auth: Created new user document with default data");
            }).catch((error) => {
              console.error("Auth: Error creating user document:", error);
            });
            
            setUserData(defaultData);
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Auth: Error in real-time listener:", error);
          // Fallback to default data if listener fails
          const defaultData: UserData = {
            email: user.email || '',
            displayName: user.displayName || '',
            createdAt: new Date()
          };
          setUserData(defaultData);
          setIsLoading(false);
        });
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
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
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
            createdAt: new Date()
          };
          
          await setDoc(userDocRef, newUserData);
          console.log("Auth: New user document created successfully");
          // Note: The real-time listener will automatically update the state
        } catch (firestoreError) {
          console.error("Auth: Error creating user document:", firestoreError);
        }
      } else {
        console.log("Auth: Existing user - real-time listener will handle data updates");
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

  const value = {
    user,
    userData,
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