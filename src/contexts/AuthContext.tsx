import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ref, set, onValue, onDisconnect } from 'firebase/database'
import { auth, firestore, database } from '../firebase/config'

interface UserData {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  isOnline: boolean
  isShitting: boolean
  lastActive: number
}

interface AuthContextType {
  currentUser: User | null
  userData: UserData | null
  loading: boolean
  register: (email: string, password: string, displayName: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUserStatus: (isShitting: boolean) => Promise<void>
}

interface AuthProviderProps {
  children: ReactNode
}

const AuthContext = createContext<AuthContextType | null>(null)

// Create a session ID for this browser tab
const sessionId = Math.random().toString(36).substring(2, 15)

// Store the session ID in sessionStorage
if (typeof window !== 'undefined') {
  sessionStorage.setItem('sessionId', sessionId)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  async function register(email: string, password: string, displayName: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update profile
      await updateProfile(userCredential.user, { displayName })
      
      // Create user document in Firestore
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        displayName,
        photoURL: null,
        createdAt: Date.now(),
        friends: []
      })
      
      // Set initial online status in Realtime Database
      const statusRef = ref(database, `status/${userCredential.user.uid}`)
      await set(statusRef, {
        isOnline: true,
        isShitting: false,
        lastActive: Date.now(),
        sessions: { [sessionId]: true }
      })
      
      // Set up onDisconnect to update status when tab closes
      onDisconnect(ref(database, `status/${userCredential.user.uid}/sessions/${sessionId}`))
        .remove()
    } catch (error) {
      console.error("Registration error:", error)
      throw error
    }
  }

  async function login(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  async function logout() {
    try {
      // Update online status before signing out
      if (currentUser) {
        const statusRef = ref(database, `status/${currentUser.uid}/sessions/${sessionId}`)
        await set(statusRef, null)
      }
      
      await signOut(auth)
    } catch (error) {
      console.error("Logout error:", error)
      throw error
    }
  }

  async function updateUserStatus(isShitting: boolean) {
    if (!currentUser) return
    
    try {
      const userStatusRef = ref(database, `status/${currentUser.uid}`)
      const snapshot = await getDoc(doc(firestore, 'users', currentUser.uid))
      
      await set(userStatusRef, {
        isOnline: true,
        isShitting,
        lastActive: Date.now(),
        sessions: { [sessionId]: true }
      })
    } catch (error) {
      console.error("Status update error:", error)
    }
  }

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      
      if (user) {
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(firestore, 'users', user.uid))
          
          // Listen to user status in Realtime Database
          const statusRef = ref(database, `status/${user.uid}`)
          
          // Set up this session
          await set(ref(database, `status/${user.uid}/sessions/${sessionId}`), true)
          
          // Set up onDisconnect to remove this session when tab closes
          onDisconnect(ref(database, `status/${user.uid}/sessions/${sessionId}`))
            .remove()
          
          // Listen for status changes
          onValue(statusRef, (snapshot) => {
            const status = snapshot.val() || { 
              isOnline: false, 
              isShitting: false, 
              lastActive: Date.now(),
              sessions: {}
            }
            
            // Determine if user is online based on any active sessions
            const hasActiveSessions = status.sessions && Object.keys(status.sessions).length > 0
            
            setUserData({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isOnline: hasActiveSessions,
              isShitting: status.isShitting || false,
              lastActive: status.lastActive || Date.now()
            })
          })
          
          // Update online status
          await set(ref(database, `status/${user.uid}`), {
            isOnline: true,
            isShitting: false,
            lastActive: Date.now(),
            sessions: { [sessionId]: true }
          })
        } catch (error) {
          console.error("Error setting up user data:", error)
        }
      } else {
        setUserData(null)
      }
      
      setLoading(false)
    })
    
    // Handle beforeunload event to clean up session
    const handleBeforeUnload = () => {
      if (currentUser) {
        // Use synchronous API for beforeunload
        const statusRef = ref(database, `status/${currentUser.uid}/sessions/${sessionId}`)
        set(statusRef, null)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const value = {
    currentUser,
    userData,
    loading,
    register,
    login,
    logout,
    updateUserStatus
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 