import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FaToilet, FaGamepad } from 'react-icons/fa'

// Mini-games
const games = [
  { id: 'tictactoe', name: 'Tic Tac Toe', icon: '⭕❌' },
  { id: 'rockpaper', name: 'Rock Paper Scissors', icon: '✂️🪨📄' },
  { id: 'wordle', name: 'Toilet Wordle', icon: '🔤' },
  { id: 'hangman', name: 'Hangman', icon: '👨‍🦯' },
]

const Home = () => {
  const { userData } = useAuth()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)

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
              onClick={() => setSelectedGame(game.id)}
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
      </div>
    </div>
  )
}

export default Home 