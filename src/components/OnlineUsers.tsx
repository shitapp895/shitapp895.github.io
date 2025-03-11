import { ref, onValue } from 'firebase/database';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { FaToilet, FaGamepad } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { database, firestore } from '../firebase/config';

interface OnlineUser {
  uid: string;
  displayName: string;
  isShitting: boolean;
  lastActive: number;
}

const OnlineUsers = () => {
  const { currentUser, userData } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user's friends
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchFriends = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to get user document directly first (more efficient)
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setFriends(userData.friends || []);
        } else {
          // Fallback to query if direct access fails
          const userDocs = await getDocs(
            query(collection(firestore, 'users'), where('uid', '==', currentUser.uid))
          );

          if (!userDocs.empty) {
            const userData = userDocs.docs[0].data();
            setFriends(userData.friends || []);
          } else {
            setFriends([]);
          }
        }
      } catch (error) {
        console.error('Error fetching friends:', error);
        setError('Could not load friends list. Please try again later.');
        setFriends([]); // Set empty array to prevent further errors
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [currentUser]);

  // Listen for online users
  useEffect(() => {
    if (!currentUser) return;

    // Even if friends list is empty, we still want to listen for status changes
    // This helps when friends are added later

    const statusRef = ref(database, 'status');
    let unsubscribe: () => void;

    try {
      unsubscribe = onValue(
        statusRef,
        snapshot => {
          const statuses = snapshot.val();
          if (!statuses || !friends.length) {
            setOnlineUsers([]);
            return;
          }

          const onlineUsersList: OnlineUser[] = [];

          // Get all users who are online and are friends
          Object.entries(statuses).forEach(([uid, status]: [string, any]) => {
            // Check if the status has sessions and if any session is active
            const hasActiveSessions = status.sessions && Object.keys(status.sessions).length > 0;

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
                lastActive: status.lastActive || Date.now(),
              });
            }
          });

          // Fetch display names for the online users
          const fetchDisplayNames = async () => {
            if (onlineUsersList.length === 0) {
              setOnlineUsers([]);
              return;
            }

            try {
              // For small lists, fetch each user individually to avoid "in" query limitations
              const usersWithNames = [...onlineUsersList];

              for (const user of usersWithNames) {
                try {
                  const userDocRef = doc(firestore, 'users', user.uid);
                  const userDocSnap = await getDoc(userDocRef);

                  if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    user.displayName = userData.displayName || user.uid;
                  }
                } catch (err) {
                  console.warn(`Could not fetch name for user ${user.uid}`, err);
                }
              }

              setOnlineUsers(usersWithNames);
            } catch (error) {
              console.error('Error fetching user names:', error);
              // Still show users with UIDs if we can't get display names
              setOnlineUsers(onlineUsersList);
            }
          };

          fetchDisplayNames();
        },
        error => {
          console.error('Error listening to online status:', error);
          setError('Could not load online friends. Please try again later.');
        }
      );
    } catch (error) {
      console.error('Error setting up status listener:', error);
      setError('Could not connect to the server. Please try again later.');
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, friends]);

  const sendGameInvite = (userId: string) => {
    // This would be implemented with Firebase to send a game invite
    console.log(`Sending game invite to ${userId}`);
    alert(`Game invite sent to ${userId}!`);
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Friends Online</h2>
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Friends Online</h2>

      {onlineUsers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {friends.length === 0
            ? "You don't have any friends yet."
            : 'No friends are online right now.'}
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
  );
};

export default OnlineUsers;
