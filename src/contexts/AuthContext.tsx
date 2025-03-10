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
import { ref, set, onValue } from 'firebase/database'
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
    await set(ref(database, `status/${userCredential.user.uid}`), {
      isOnline: true,
      isShitting: false,
      lastActive: Date.now()
    })
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
    
    // Update online status
    if (currentUser) {
      await set(ref(database, `status/${currentUser.uid}`), {
        isOnline: true,
        isShitting: false,
        lastActive: Date.now()
      })
    }
  }

  async function logout() {
    // Update online status before signing out
    if (currentUser) {
      await set(ref(database, `status/${currentUser.uid}`), {
        isOnline: false,
        isShitting: false,
        lastActive: Date.now()
      })
    }
    
    await signOut(auth)
  }

  async function updateUserStatus(isShitting: boolean) {
    if (!currentUser) return
    
    await set(ref(database, `status/${currentUser.uid}`), {
      isOnline: true,
      isShitting,
      lastActive: Date.now()
    })
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      
      if (user) {
        // Get user data from Firestore
        await getDoc(doc(firestore, 'users', user.uid))
        
        // Listen to user status in Realtime Database
        const statusRef = ref(database, `status/${user.uid}`)
        onValue(statusRef, (snapshot) => {
          const status = snapshot.val() || { isOnline: false, isShitting: false, lastActive: Date.now() }
          
          setUserData({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            ...status
          })
        })
        
        // Update online status
        await set(statusRef, {
          isOnline: true,
          isShitting: false,
          lastActive: Date.now()
        })
      } else {
        setUserData(null)
      }
      
      setLoading(false)
    })
    
    return unsubscribe
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