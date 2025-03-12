import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FaToilet, FaGamepad } from 'react-icons/fa'
import { collection, query, where, getDocs, getDoc, doc, deleteDoc } from 'firebase/firestore'
import { firestore } from '../firebase/config'
import WordleGame from '../components/WordleGame'

// Mini-games
const games = [
  { id: 'tictactoe', name: 'Tic Tac Toe', icon: '⭕❌' },
  { id: 'rockpaper', name: 'Rock Paper Scissors', icon: '✂️🪨📄' },
  { id: 'wordle', name: 'Toilet Wordle', icon: '🔤' },
  { id: 'hangman', name: 'Hangman', icon: '👨‍🦯' },
]

interface GameInviteData {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  gameType: 'wordle'
  status: 'accepted'
  createdAt: number
  gameId: string
}

const Home = () => {
  const { userData, currentUser } = useAuth()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const [activeOpponentId, setActiveOpponentId] = useState<string | null>(null)

  // Check for active games
  useEffect(() => {
    if (!currentUser) return;

    const checkForActiveGames = async () => {
      try {
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
      } catch (error) {
        console.error('Error checking for active games:', error);
      }
    };

    // Check for active games on component mount
    checkForActiveGames();

    // Set up a periodic check for new active games
    const intervalId = setInterval(checkForActiveGames, 10000);

    return () => clearInterval(intervalId);
  }, [currentUser]);

  const handleGameSelect = (gameId: string) => {
    if (gameId === 'wordle') {
      setSelectedGame(gameId);
      // For wordle, we don't do anything yet as it requires an opponent
      // The game will be started when an invite is accepted
    } else {
      // For other games, just select them (not implemented yet)
      setSelectedGame(gameId);
    }
  };

  const handleCloseGame = () => {
    // Immediately clear the game state to prevent any flicker
    setActiveGameId(null);
    setActiveOpponentId(null);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl">
            {userData?.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{userData?.displayName}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Status: {userData?.isShitting ? 'Currently Shitting 🚽' : 'Not Shitting'}
            </p>
          </div>
        </div>
        
        <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <FaToilet className="text-primary" />
            <h2 className="font-semibold">ShitApp Status</h2>
          </div>
          <p className="text-sm">
            {userData?.isShitting 
              ? "You're currently in shitting mode. You can now play mini-games with other friends who are also shitting!"
              : "You're not in shitting mode. Toggle your status in the navbar when you're taking a bathroom break to connect with friends!"}
          </p>
        </div>
      </div>
      
      <div className="card">
        <div className="flex items-center space-x-2 mb-4">
          <FaGamepad className="text-primary" />
          <h2 className="text-xl font-semibold">Mini Games</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {games.map(game => (
            <button
              key={game.id}
              onClick={() => handleGameSelect(game.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedGame === game.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
              }`}
              disabled={!userData?.isShitting}
            >
              <div className="text-2xl mb-2">{game.icon}</div>
              <h3 className="font-medium">{game.name}</h3>
              {!userData?.isShitting && (
                <p className="text-xs text-gray-500 mt-1">
                  Available when shitting
                </p>
              )}
            </button>
          ))}
        </div>
        
        {!userData?.isShitting && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded text-sm text-center">
            Toggle your status to "Shitting" to play mini-games with friends!
          </div>
        )}

        {userData?.isShitting && selectedGame === 'wordle' && (
          <div className="mt-4 p-3 bg-primary/10 rounded text-sm">
            <p className="text-center font-medium mb-2">Toilet Wordle Selected!</p>
            <p>To play Toilet Wordle:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Check which friends are currently shitting in the sidebar</li>
              <li>Click the game icon next to their name to send an invite</li>
              <li>Wait for them to accept your invitation</li>
              <li>Take turns guessing the 5-letter word</li>
            </ol>
          </div>
        )}
      </div>

      {/* Wordle Game Modal */}
      {activeGameId && activeOpponentId && (
        <WordleGame 
          gameId={activeGameId}
          opponentId={activeOpponentId}
          onClose={handleCloseGame}
        />
      )}
    </div>
  )
}

export default Home 