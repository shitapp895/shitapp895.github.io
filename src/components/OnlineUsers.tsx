import { useState, useEffect } from 'react'
import { ref, onValue } from 'firebase/database'
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { database, firestore } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { FaToilet, FaGamepad } from 'react-icons/fa'
import GameInvite from './GameInvite'
import WordleGame from './WordleGame'

interface OnlineUser {
  uid: string
  displayName: string
  isShitting: boolean
  lastActive: number
}

interface GameInviteData {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  gameType: 'wordle'
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: number
  gameId?: string
}

const OnlineUsers = () => {
  const { currentUser, userData } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [friends, setFriends] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingInvites, setPendingInvites] = useState<GameInviteData[]>([])
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const [activeOpponentId, setActiveOpponentId] = useState<string | null>(null)
  const [inviteSendingStatus, setInviteSendingStatus] = useState<{[key: string]: 'sending' | 'sent' | 'error'}>({})

  // Get user's friends
  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      return
    }

    const fetchFriends = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Try to get user document directly first (more efficient)
        const userDocRef = doc(firestore, 'users', currentUser.uid)
        const userDocSnap = await getDoc(userDocRef)
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data()
          setFriends(userData.friends || [])
        } else {
          // Fallback to query if direct access fails
          const userDocs = await getDocs(query(
            collection(firestore, 'users'),
            where('uid', '==', currentUser.uid)
          ))
          
          if (!userDocs.empty) {
            const userData = userDocs.docs[0].data()
            setFriends(userData.friends || [])
          } else {
            setFriends([])
          }
        }
      } catch (error) {
        console.error('Error fetching friends:', error)
        setError('Could not load friends list. Please try again later.')
        setFriends([]) // Set empty array to prevent further errors
      } finally {
        setLoading(false)
      }
    }

    fetchFriends()
  }, [currentUser])

  // Listen for online users
  useEffect(() => {
    if (!currentUser) return
    
    // Even if friends list is empty, we still want to listen for status changes
    // This helps when friends are added later

    const statusRef = ref(database, 'status')
    let unsubscribe: () => void;
    
    try {
      unsubscribe = onValue(statusRef, (snapshot) => {
        const statuses = snapshot.val()
        if (!statuses || !friends.length) {
          setOnlineUsers([])
          return
        }

        const onlineUsersList: OnlineUser[] = []
        
        // Get all users who are online and are friends
        Object.entries(statuses).forEach(([uid, status]: [string, any]) => {
          // Check if the status has sessions and if any session is active
          const hasActiveSessions = status.sessions && Object.keys(status.sessions).length > 0
          
          if (
            uid !== currentUser.uid && 
            hasActiveSessions && 
            friends.includes(uid) &&
            Date.now() - (status.lastActive || 0) < 300000 // 5 minutes
          ) {
            onlineUsersList.push({
              uid,
              displayName: uid, // Will be updated with actual names
              isShitting: status.isShitting || false,
              lastActive: status.lastActive || Date.now()
            })
          }
        })
        
        // Fetch display names for the online users
        const fetchDisplayNames = async () => {
          if (onlineUsersList.length === 0) {
            setOnlineUsers([])
            return
          }
          
          try {
            // For small lists, fetch each user individually to avoid "in" query limitations
            const usersWithNames = [...onlineUsersList]
            
            for (const user of usersWithNames) {
              try {
                const userDocRef = doc(firestore, 'users', user.uid)
                const userDocSnap = await getDoc(userDocRef)
                
                if (userDocSnap.exists()) {
                  const userData = userDocSnap.data()
                  user.displayName = userData.displayName || user.uid
                }
              } catch (err) {
                console.warn(`Could not fetch name for user ${user.uid}`, err)
              }
            }
            
            setOnlineUsers(usersWithNames)
          } catch (error) {
            console.error('Error fetching user names:', error)
            // Still show users with UIDs if we can't get display names
            setOnlineUsers(onlineUsersList)
          }
        }
        
        fetchDisplayNames()
      }, (error) => {
        console.error('Error listening to online status:', error)
        setError('Could not load online friends. Please try again later.')
      })
    } catch (error) {
      console.error('Error setting up status listener:', error)
      setError('Could not connect to the server. Please try again later.')
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [currentUser, friends])

  // Listen for game invites
  useEffect(() => {
    if (!currentUser) return;

    const fetchPendingInvites = async () => {
      try {
        // Check for active games first
        // Check for accepted game invites where the current user is the sender
        const senderInvitesQuery = query(
          collection(firestore, 'gameInvites'),
          where('senderId', '==', currentUser.uid),
          where('status', '==', 'accepted')
        );

        const senderInvitesSnapshot = await getDocs(senderInvitesQuery);
        
        if (!senderInvitesSnapshot.empty) {
          const invite = senderInvitesSnapshot.docs[0].data() as GameInviteData;
          
          // Check if the game is still active
          if (invite.gameId) {
            const gameDoc = await getDoc(doc(firestore, 'wordleGames', invite.gameId));
            if (gameDoc.exists() && gameDoc.data().status !== 'completed') {
              setActiveGameId(invite.gameId);
              setActiveOpponentId(invite.receiverId);
              return;
            } else {
              // If game is completed, clean up the invite
              await deleteDoc(doc(firestore, 'gameInvites', senderInvitesSnapshot.docs[0].id));
            }
          }
        }

        // Check for accepted game invites where the current user is the receiver
        const receiverInvitesQuery = query(
          collection(firestore, 'gameInvites'),
          where('receiverId', '==', currentUser.uid),
          where('status', '==', 'accepted')
        );

        const receiverInvitesSnapshot = await getDocs(receiverInvitesQuery);
        
        if (!receiverInvitesSnapshot.empty) {
          const invite = receiverInvitesSnapshot.docs[0].data() as GameInviteData;
          
          // Check if the game is still active
          if (invite.gameId) {
            const gameDoc = await getDoc(doc(firestore, 'wordleGames', invite.gameId));
            if (gameDoc.exists() && gameDoc.data().status !== 'completed') {
              setActiveGameId(invite.gameId);
              setActiveOpponentId(invite.senderId);
              return;
            } else {
              // If game is completed, clean up the invite
              await deleteDoc(doc(firestore, 'gameInvites', receiverInvitesSnapshot.docs[0].id));
            }
          }
        }

        // If no active games, check for pending invites
        const invitesQuery = query(
          collection(firestore, 'gameInvites'),
          where('receiverId', '==', currentUser.uid),
          where('status', '==', 'pending')
        );

        const invitesSnapshot = await getDocs(invitesQuery);
        const invitesList: GameInviteData[] = [];

        invitesSnapshot.forEach(doc => {
          invitesList.push({ id: doc.id, ...doc.data() } as GameInviteData);
        });

        setPendingInvites(invitesList);

        // If there's a pending invite, set it as active
        if (invitesList.length > 0 && !activeInviteId && !activeGameId) {
          setActiveInviteId(invitesList[0].id);
        }
      } catch (error) {
        console.error('Error fetching game invites:', error);
      }
    };

    // Initial fetch
    fetchPendingInvites();

    // Set up a periodic check for new invites
    const intervalId = setInterval(fetchPendingInvites, 10000);

    return () => clearInterval(intervalId);
  }, [currentUser, activeInviteId, activeGameId]);

  const sendGameInvite = async (userId: string, userName: string) => {
    if (!currentUser || !userData) return;
    
    try {
      setInviteSendingStatus(prev => ({ ...prev, [userId]: 'sending' }));
      
      // Create a new invite document
      const inviteRef = doc(collection(firestore, 'gameInvites'));
      
      await setDoc(inviteRef, {
        senderId: currentUser.uid,
        senderName: userData.displayName,
        receiverId: userId,
        receiverName: userName,
        gameType: 'wordle',
        status: 'pending',
        createdAt: Date.now()
      });
      
      setInviteSendingStatus(prev => ({ ...prev, [userId]: 'sent' }));
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setInviteSendingStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[userId];
          return newStatus;
        });
      }, 3000);
      
    } catch (error) {
      console.error('Error sending game invite:', error);
      setInviteSendingStatus(prev => ({ ...prev, [userId]: 'error' }));
      
      // Reset error status after 3 seconds
      setTimeout(() => {
        setInviteSendingStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[userId];
          return newStatus;
        });
      }, 3000);
    }
  };

  const handleAcceptInvite = (gameId: string, opponentId: string) => {
    setActiveGameId(gameId);
    setActiveOpponentId(opponentId);
    setActiveInviteId(null);
  };

  const handleCloseInvite = () => {
    setActiveInviteId(null);
  };

  const handleCloseGame = () => {
    // Immediately clear the game state to prevent any flicker
    setActiveGameId(null);
    setActiveOpponentId(null);
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
        
        {onlineUsers.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {friends.length === 0 
              ? "You don't have any friends yet." 
              : "No friends are online right now."}
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
                    onClick={() => sendGameInvite(user.uid, user.displayName)}
                    className="p-2 text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    disabled={inviteSendingStatus[user.uid] === 'sending'}
                  >
                    {inviteSendingStatus[user.uid] === 'sending' ? (
                      <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-primary rounded-full"></div>
                    ) : inviteSendingStatus[user.uid] === 'sent' ? (
                      <span className="text-green-500 text-xs">Sent!</span>
                    ) : inviteSendingStatus[user.uid] === 'error' ? (
                      <span className="text-red-500 text-xs">Error</span>
                    ) : (
                      <FaGamepad />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Game Invite Modal */}
      {activeInviteId && (
        <GameInvite 
          inviteId={activeInviteId}
          onAccept={handleAcceptInvite}
          onClose={handleCloseInvite}
        />
      )}

      {/* Wordle Game Modal */}
      {activeGameId && activeOpponentId && (
        <WordleGame 
          gameId={activeGameId}
          opponentId={activeOpponentId}
          onClose={handleCloseGame}
        />
      )}
    </>
  )
}

export default OnlineUsers 