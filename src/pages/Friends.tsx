import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FaUserFriends, FaSearch, FaUserPlus, FaTrash } from 'react-icons/fa'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore'
import { firestore } from '../firebase/config'

interface User {
  uid: string
  displayName: string
  email: string
}

const Friends = () => {
  const { currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [friends, setFriends] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch user's friends
  useEffect(() => {
    if (!currentUser) return

    const fetchFriends = async () => {
      try {
        setLoading(true)
        
        // Get current user's friend list
        const userDoc = await getDocs(query(
          collection(firestore, 'users'),
          where('uid', '==', currentUser.uid)
        ))
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data()
          const friendIds = userData.friends || []
          
          if (friendIds.length > 0) {
            // Fetch friend details
            const friendsQuery = query(
              collection(firestore, 'users'),
              where('uid', 'in', friendIds)
            )
            
            const friendDocs = await getDocs(friendsQuery)
            const friendsList: User[] = []
            
            friendDocs.forEach(doc => {
              const data = doc.data()
              friendsList.push({
                uid: data.uid,
                displayName: data.displayName,
                email: data.email
              })
            })
            
            setFriends(friendsList)
          } else {
            setFriends([])
          }
        }
      } catch (err: any) {
        console.error('Error fetching friends:', err)
        setError('Failed to load friends')
      } finally {
        setLoading(false)
      }
    }

    fetchFriends()
  }, [currentUser])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchTerm.trim()) return
    
    try {
      setLoading(true)
      setError('')
      
      // Search for users by display name
      const usersQuery = query(
        collection(firestore, 'users'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff')
      )
      
      const userDocs = await getDocs(usersQuery)
      const results: User[] = []
      
      userDocs.forEach(doc => {
        const data = doc.data()
        // Don't include current user in results
        if (data.uid !== currentUser?.uid) {
          results.push({
            uid: data.uid,
            displayName: data.displayName,
            email: data.email
          })
        }
      })
      
      setSearchResults(results)
    } catch (err: any) {
      console.error('Error searching users:', err)
      setError('Failed to search users')
    } finally {
      setLoading(false)
    }
  }

  const addFriend = async (user: User) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Add user to current user's friends list
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        friends: arrayUnion(user.uid)
      })
      
      // Add current user to the other user's friends list
      await updateDoc(doc(firestore, 'users', user.uid), {
        friends: arrayUnion(currentUser.uid)
      })
      
      // Update local friends list
      setFriends(prev => [...prev, user])
      
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.uid !== user.uid))
      
      setSuccess(`${user.displayName} added to your friends!`)
    } catch (err: any) {
      console.error('Error adding friend:', err)
      setError('Failed to add friend')
    } finally {
      setLoading(false)
    }
  }

  const removeFriend = async (user: User) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Remove user from current user's friends list
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        friends: arrayRemove(user.uid)
      })
      
      // Remove current user from the other user's friends list
      await updateDoc(doc(firestore, 'users', user.uid), {
        friends: arrayRemove(currentUser.uid)
      })
      
      // Update local friends list
      setFriends(prev => prev.filter(f => f.uid !== user.uid))
      
      setSuccess(`${user.displayName} removed from your friends`)
    } catch (err: any) {
      console.error('Error removing friend:', err)
      setError('Failed to remove friend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center space-x-2 mb-6">
          <FaUserFriends className="text-primary text-xl" />
          <h1 className="text-2xl font-bold">Friends</h1>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex">
            <input
              type="text"
              placeholder="Search users by display name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input rounded-r-none"
            />
            <button
              type="submit"
              className="btn btn-primary rounded-l-none"
              disabled={loading}
            >
              <FaSearch />
            </button>
          </div>
        </form>
        
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Search Results</h2>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {searchResults.map(user => (
                <li key={user.uid} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  <button
                    onClick={() => addFriend(user)}
                    className="btn btn-secondary flex items-center space-x-1"
                    disabled={loading || friends.some(f => f.uid === user.uid)}
                  >
                    <FaUserPlus />
                    <span>
                      {friends.some(f => f.uid === user.uid) ? 'Already Friends' : 'Add Friend'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Your Friends</h2>
          {friends.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              You don't have any friends yet. Search for users to add them as friends.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {friends.map(friend => (
                <li key={friend.uid} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{friend.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{friend.email}</p>
                  </div>
                  <button
                    onClick={() => removeFriend(friend)}
                    className="text-red-500 hover:text-red-700 p-2"
                    disabled={loading}
                  >
                    <FaTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default Friends 