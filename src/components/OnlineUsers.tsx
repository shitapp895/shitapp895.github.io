import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { database, firestore } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { FaToilet, FaGamepad } from 'react-icons/fa'

interface OnlineUser {
  uid: string
  displayName: string
  isShitting: boolean
  lastActive: number
}

const OnlineUsers = () => {
  const { currentUser, userData } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [friends, setFriends] = useState<string[]>([])

  // Get user's friends
  useEffect(() => {
    if (!currentUser) return

    const fetchFriends = async () => {
      try {
        const userDoc = await getDocs(query(
          collection(firestore, 'users'),
          where('uid', '==', currentUser.uid)
        ))
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data()
          setFriends(userData.friends || [])
        }
      } catch (error) {
        console.error('Error fetching friends:', error)
      }
    }

    fetchFriends()
  }, [currentUser])

  // Listen for online users
  useEffect(() => {
    if (!currentUser || !friends.length) return

    const statusRef = ref(database, 'status')
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const statuses = snapshot.val()
      if (!statuses) return

      const onlineUsersList: OnlineUser[] = []
      
      // Get all users who are online and are friends
      Object.entries(statuses).forEach(([uid, status]: [string, any]) => {
        if (
          uid !== currentUser.uid && 
          status.isOnline && 
          friends.includes(uid) &&
          Date.now() - status.lastActive < 300000 // 5 minutes
        ) {
          onlineUsersList.push({
            uid,
            displayName: uid, // Will be updated with actual names
            isShitting: status.isShitting,
            lastActive: status.lastActive
          })
        }
      })
      
      // Fetch display names for the online users
      const fetchDisplayNames = async () => {
        try {
          const userDocs = await getDocs(query(
            collection(firestore, 'users'),
            where('uid', 'in', onlineUsersList.map(user => user.uid))
          ))
          
          const usersWithNames = [...onlineUsersList]
          
          userDocs.forEach(doc => {
            const userData = doc.data()
            const index = usersWithNames.findIndex(u => u.uid === userData.uid)
            if (index !== -1) {
              usersWithNames[index].displayName = userData.displayName
            }
          })
          
          setOnlineUsers(usersWithNames)
        } catch (error) {
          console.error('Error fetching user names:', error)
        }
      }
      
      if (onlineUsersList.length > 0) {
        fetchDisplayNames()
      } else {
        setOnlineUsers([])
      }
    })

    return () => unsubscribe()
  }, [currentUser, friends])

  const sendGameInvite = (userId: string) => {
    // This would be implemented with Firebase to send a game invite
    console.log(`Sending game invite to ${userId}`)
    alert(`Game invite sent to ${userId}!`)
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
      
      {onlineUsers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No friends are online right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {onlineUsers.map(user => (
            <li key={user.uid} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {user.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  {user.isShitting && (
                    <div className="absolute -top-1 -right-1 bg-accent rounded-full p-1">
                      <FaToilet className="text-white text-xs" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user.isShitting ? 'Currently shitting' : 'Online'}
                  </p>
                </div>
              </div>
              
              {user.isShitting && userData?.isShitting && (
                <button 
                  onClick={() => sendGameInvite(user.uid)}
                  className="p-2 text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <FaGamepad />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OnlineUsers 