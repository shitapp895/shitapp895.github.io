import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { ref, set, onValue, onDisconnect, get } from 'firebase/database';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { auth, firestore, database } from '../firebase/config';

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isOnline: boolean;
  isShitting: boolean;
  lastActive: number;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus: (isShitting: boolean) => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Create a session ID for this browser tab
const sessionId = Math.random().toString(36).substring(2, 15);

// Store the session ID in sessionStorage
if (typeof window !== 'undefined') {
  sessionStorage.setItem('sessionId', sessionId);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function register(email: string, password: string, displayName: string) {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile
      await updateProfile(userCredential.user, { displayName });

      // Create user document in Firestore
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        displayName,
        photoURL: null,
        createdAt: Date.now(),
        friends: [],
      });

      // Set initial online status in Realtime Database
      const statusRef = ref(database, `status/${userCredential.user.uid}`);
      await set(statusRef, {
        isOnline: true,
        isShitting: false,
        lastActive: Date.now(),
        sessions: { [sessionId]: true },
      });

      // Set up onDisconnect to update status when tab closes
      onDisconnect(
        ref(database, `status/${userCredential.user.uid}/sessions/${sessionId}`)
      ).remove();
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Failed to register. Please try again.');
      throw error;
    }
  }

  async function login(email: string, password: string) {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login. Please check your credentials.');
      throw error;
    }
  }

  async function logout() {
    try {
      setError(null);
      // Update online status before signing out
      if (currentUser) {
        const statusRef = ref(database, `status/${currentUser.uid}/sessions/${sessionId}`);
        await set(statusRef, null);
      }

      await signOut(auth);
    } catch (error: any) {
      console.error('Logout error:', error);
      setError(error.message || 'Failed to logout. Please try again.');
      throw error;
    }
  }

  async function updateUserStatus(isShitting: boolean) {
    if (!currentUser) return;

    try {
      setError(null);
      // First check if the user has a status node
      const statusRef = ref(database, `status/${currentUser.uid}`);
      const snapshot = await get(statusRef);

      if (snapshot.exists()) {
        // Update existing status
        const currentStatus = snapshot.val() || {};
        const sessions = currentStatus.sessions || {};

        await set(statusRef, {
          isOnline: true,
          isShitting,
          lastActive: Date.now(),
          sessions: { ...sessions, [sessionId]: true },
        });
      } else {
        // Create new status
        await set(statusRef, {
          isOnline: true,
          isShitting,
          lastActive: Date.now(),
          sessions: { [sessionId]: true },
        });
      }

      // Set up onDisconnect to remove this session when tab closes
      onDisconnect(ref(database, `status/${currentUser.uid}/sessions/${sessionId}`)).remove();
    } catch (error: any) {
      console.error('Status update error:', error);
      setError(error.message || 'Failed to update status. Please try again.');
    }
  }

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async user => {
        setCurrentUser(user);

        if (user) {
          try {
            // Get user data from Firestore
            const userDocRef = doc(firestore, 'users', user.uid);
            let userDoc;

            try {
              userDoc = await getDoc(userDocRef);

              // If user document doesn't exist, create it
              if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  createdAt: Date.now(),
                  friends: [],
                });
              }
            } catch (error) {
              console.error('Error getting user document:', error);
              // Continue anyway to try setting up status
            }

            // Set up status in Realtime Database
            const statusRef = ref(database, `status/${user.uid}`);

            try {
              // Check if status exists
              const statusSnapshot = await get(statusRef);
              const existingStatus = statusSnapshot.val() || {
                isOnline: false,
                isShitting: false,
                lastActive: Date.now(),
                sessions: {},
              };

              // Update status with this session
              await set(statusRef, {
                ...existingStatus,
                isOnline: true,
                lastActive: Date.now(),
                sessions: {
                  ...(existingStatus.sessions || {}),
                  [sessionId]: true,
                },
              });

              // Set up onDisconnect to remove this session when tab closes
              onDisconnect(ref(database, `status/${user.uid}/sessions/${sessionId}`)).remove();

              // Listen for status changes
              onValue(
                statusRef,
                snapshot => {
                  const status = snapshot.val() || {
                    isOnline: false,
                    isShitting: false,
                    lastActive: Date.now(),
                    sessions: {},
                  };

                  // Determine if user is online based on any active sessions
                  const hasActiveSessions =
                    status.sessions && Object.keys(status.sessions).length > 0;

                  setUserData({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isOnline: hasActiveSessions,
                    isShitting: status.isShitting || false,
                    lastActive: status.lastActive || Date.now(),
                  });
                },
                error => {
                  console.error('Error listening to status:', error);
                  // Still set basic user data even if we can't get status
                  setUserData({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    isOnline: true,
                    isShitting: false,
                    lastActive: Date.now(),
                  });
                }
              );
            } catch (error) {
              console.error('Error setting up status:', error);
              // Still set basic user data even if we can't set up status
              setUserData({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                isOnline: true,
                isShitting: false,
                lastActive: Date.now(),
              });
            }
          } catch (error) {
            console.error('Error setting up user data:', error);
            setError(
              'There was a problem connecting to the server. Some features may not work properly.'
            );

            // Still set basic user data
            setUserData({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isOnline: true,
              isShitting: false,
              lastActive: Date.now(),
            });
          }
        } else {
          setUserData(null);
          setError(null);
        }

        setLoading(false);
      },
      error => {
        console.error('Auth state change error:', error);
        setError('Authentication error. Please try logging in again.');
        setLoading(false);
      }
    );

    // Handle beforeunload event to clean up session
    const handleBeforeUnload = () => {
      if (currentUser) {
        // Use synchronous API for beforeunload
        const statusRef = ref(database, `status/${currentUser.uid}/sessions/${sessionId}`);
        set(statusRef, null);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    error,
    register,
    login,
    logout,
    updateUserStatus,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
