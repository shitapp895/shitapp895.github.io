import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { ref, set, onValue, onDisconnect, get, push, serverTimestamp } from 'firebase/database';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { auth, firestore, database } from '../firebase/config';

interface ShitEvent {
  startTime: number;
  endTime: number | null;
  duration: number | null;
  date: string;
}

interface ShitStats {
  totalShits: number;
  shitEvents: ShitEvent[];
  lastShitDate: string | null;
}

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isOnline: boolean;
  isShitting: boolean;
  lastActive: number;
  shitStats: ShitStats;
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
  getAverageShitsPerDay: () => number;
  getFriendsCount: () => number;
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
        
        // Track shit events
        if (isShitting !== currentStatus.isShitting) {
          if (isShitting) {
            // Starting a shit session
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            const shitEventRef = ref(database, `shitEvents/${currentUser.uid}`);
            const newShitEventRef = push(shitEventRef);
            
            await set(newShitEventRef, {
              startTime: Date.now(),
              endTime: null,
              duration: null,
              date: today
            });
            
            // Store the event key in the session for later reference
            await set(ref(database, `status/${currentUser.uid}/currentShitEventId`), newShitEventRef.key);
          } else if (currentStatus.isShitting && currentStatus.currentShitEventId) {
            // Ending a shit session
            const shitEventRef = ref(database, `shitEvents/${currentUser.uid}/${currentStatus.currentShitEventId}`);
            const shitEventSnapshot = await get(shitEventRef);
            
            if (shitEventSnapshot.exists()) {
              const shitEvent = shitEventSnapshot.val();
              const endTime = Date.now();
              const duration = endTime - shitEvent.startTime;
              
              await set(shitEventRef, {
                ...shitEvent,
                endTime,
                duration
              });
              
              // Update total shits count
              const userShitStatsRef = ref(database, `shitStats/${currentUser.uid}`);
              const userShitStatsSnapshot = await get(userShitStatsRef);
              
              if (userShitStatsSnapshot.exists()) {
                const shitStats = userShitStatsSnapshot.val();
                await set(userShitStatsRef, {
                  ...shitStats,
                  totalShits: (shitStats.totalShits || 0) + 1,
                  lastShitDate: shitEvent.date
                });
              } else {
                await set(userShitStatsRef, {
                  totalShits: 1,
                  lastShitDate: shitEvent.date
                });
              }
              
              // Clear the current event ID
              await set(ref(database, `status/${currentUser.uid}/currentShitEventId`), null);
            }
          }
        }

        await set(statusRef, {
          isOnline: true,
          isShitting,
          lastActive: Date.now(),
          sessions: { ...sessions, [sessionId]: true },
          currentShitEventId: isShitting ? currentStatus.currentShitEventId : null
        });
      } else {
        // Create new status
        await set(statusRef, {
          isOnline: true,
          isShitting,
          lastActive: Date.now(),
          sessions: { [sessionId]: true },
          currentShitEventId: null
        });
      }

      // Set up onDisconnect to remove this session when tab closes
      onDisconnect(ref(database, `status/${currentUser.uid}/sessions/${sessionId}`)).remove();
    } catch (error: any) {
      console.error('Status update error:', error);
      setError(error.message || 'Failed to update status. Please try again.');
    }
  }

  // Function to get average shits per day
  function getAverageShitsPerDay() {
    if (!userData || !currentUser) return 0;
    
    // Get shit events from the database
    const shitStatsRef = ref(database, `shitStats/${currentUser.uid}`);
    let totalShits = 0;
    let uniqueDays = new Set();
    
    onValue(shitStatsRef, (snapshot) => {
      if (snapshot.exists()) {
        const shitStats = snapshot.val();
        totalShits = shitStats.totalShits || 0;
      }
    });
    
    const shitEventsRef = ref(database, `shitEvents/${currentUser.uid}`);
    onValue(shitEventsRef, (snapshot) => {
      if (snapshot.exists()) {
        const events = snapshot.val();
        Object.values(events).forEach((event: any) => {
          if (event.date) {
            uniqueDays.add(event.date);
          }
        });
      }
    });
    
    const dayCount = uniqueDays.size || 1; // Avoid division by zero
    return totalShits / dayCount;
  }
  
  // Function to get friends count
  function getFriendsCount() {
    if (!userData) return 0;
    
    // Get friends from Firestore
    let friendsCount = 0;
    
    if (userData && Array.isArray(userData.friends)) {
      friendsCount = userData.friends.length;
    }
    
    return friendsCount;
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
                    shitStats: {
                      totalShits: 0,
                      shitEvents: [],
                      lastShitDate: null,
                    },
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
                    shitStats: {
                      totalShits: 0,
                      shitEvents: [],
                      lastShitDate: null,
                    },
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
                shitStats: {
                  totalShits: 0,
                  shitEvents: [],
                  lastShitDate: null,
                },
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
              shitStats: {
                totalShits: 0,
                shitEvents: [],
                lastShitDate: null,
              },
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
    getAverageShitsPerDay,
    getFriendsCount,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
