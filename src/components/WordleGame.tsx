import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';

interface WordleGameProps {
  gameId: string;
  opponentId: string;
  onClose: () => void;
}

interface GameState {
  word: string;
  currentPlayer: string;
  player1: string;
  player2: string;
  player1Guesses: string[];
  player2Guesses: string[];
  status: 'waiting' | 'active' | 'completed';
  winner: string | null;
  createdAt: number;
}

const WORDS = [
  // Bathroom fixtures and plumbing
  'FLUSH', 'WIPES', 'BIDET', 'STOOL', 'BOWEL',
  'POTTY', 'SQUAT', 'PLUMB', 'WATER', 'PAPER',
  'CLEAN', 'SMELL', 'SPRAY', 'DRAIN', 'FLOAT',
  'ROYAL', 'WASTE', 'SEWER', 'PIPES', 'VALVE',
  'BASIN', 'FECAL', 'URINE', 'POOPS', 'POOHS',
  'CRAPS', 'DUMPS', 'TURDS', 'DOOKS', 'LOAFS',
  'SINKS', 'TANKS', 'SEATS', 'LATCH', 'LEVER',
  'CHAIN', 'KNOBS', 'HINGE', 'LOCKS', 'DOORS',
  'STALL', 'WALLS', 'TILES', 'GROUT', 'CAULK',
  'DRIPS', 'LEAKS', 'CLOGS', 'BACKS', 'FLOWS',
  'SWIRL', 'WHIRL', 'SPINS', 'DROPS', 'FALLS',
  'ROLLS', 'SHEET', 'CLOTH', 'BRUSH',
  
  // Bathroom activities and experiences
  'GOING', 'DOING', 'VISIT', 'BREAK', 'RELAX',
  'EMPTY', 'PURGE', 'EXPEL', 'GRUNT',
  'PINCH', 'PRESS', 'SHITS', 'FORCE',
  'QUIET', 'PEACE', 'ALONE', 'SPACE',
  'READS', 'PHONE', 'GAMES', 'TEXTS', 'WAITS',
  'HURRY', 'QUICK', 'RUSHS', 'TARDY', 'LATER',
  'STINK', 'ODORS', 'SCENT', 'WHIFF',
  'FRESH', 'MISTS', 'VAPOR', 'STEAM',
  
  // Bathroom cleaning and maintenance
  'SCRUB', 'MOPUP', 'RINSE', 'SHINE',
  'GLEAM', 'GLOSS', 'SHEEN', 'SLICK', 'SLIME',
  'GRIME', 'FILTH', 'DIRTY', 'MUCKY', 'GRIMY',
  'STAIN', 'MARKS', 'SPOTS', 'RINGS', 'LINES',
  'MOLDS', 'FUNGI', 'GERMS', 'VIRUS', 'BACTS',
  'LYSOL', 'SOAPY', 'SUDSY', 'SWIPE', 'SWEEP',
  'FOAMS', 'BUBBL', 'FROTH', 'SWISH',
  
  // Toilet parts and types
  'BOWLS', 'BASES', 'BENDS', 'TRAPS',
  'FLAPS', 'PEDAL', 'TOUCH', 'SENSE',
  'ROUND', 'JOHNS', 'HEADS',
  'ROOMS', 'CABIN', 'VENTS',
  
  // Toilet paper and hygiene products
  'PLUSH', 'THICK', 'ROUGH',
  'FOLDS', 'MOIST', 'WETTY', 'DRYER', 'TOWEL',
  'SOAPS', 'HANDS', 'PALMS', 'NAILS',
  
  // Plumbing and water-related
  'FLOWS', 'DUCTS',
  'MAINS', 'LINES', 'ROUTE',
  'PUMPS', 'POWER', 'BOOST',
  'GATES', 'STOPS', 'BLOCK', 'CLOGS',
  'DRIPS', 'DROPS', 'SPILL', 'FLOOD',
  'POOLS', 'SPINS', 'TWIST',
  'SOUND', 'NOISE'
];

const WordleGame = ({ gameId, opponentId, onClose }: WordleGameProps) => {
  const { currentUser, userData } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [showGameOver, setShowGameOver] = useState(false);

  // Get opponent's name
  useEffect(() => {
    const fetchOpponentName = async () => {
      try {
        const opponentDoc = await getDoc(doc(firestore, 'users', opponentId));
        if (opponentDoc.exists()) {
          setOpponentName(opponentDoc.data().displayName || 'Opponent');
        }
      } catch (error) {
        console.error('Error fetching opponent name:', error);
      }
    };

    fetchOpponentName();
  }, [opponentId]);

  // Listen for game state changes
  useEffect(() => {
    if (!currentUser || !gameId) return;

    const gameRef = doc(firestore, 'wordleGames', gameId);
    
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const newGameState = docSnapshot.data() as GameState;
        setGameState(newGameState);
        
        // If the game just completed, show the game over screen
        if (newGameState.status === 'completed' && !showGameOver) {
          setShowGameOver(true);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to game updates:', error);
      setMessage('Error connecting to the game. Please try again.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, gameId, showGameOver]);

  // Initialize game if it doesn't exist
  useEffect(() => {
    const initializeGame = async () => {
      if (!currentUser || !gameId) return;

      try {
        const gameRef = doc(firestore, 'wordleGames', gameId);
        const gameDoc = await getDoc(gameRef);

        if (!gameDoc.exists()) {
          // Select a random word
          const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
          
          // Create new game
          const newGameState: GameState = {
            word: randomWord,
            currentPlayer: currentUser.uid,
            player1: currentUser.uid,
            player2: opponentId,
            player1Guesses: [],
            player2Guesses: [],
            status: 'active',
            winner: null,
            createdAt: Date.now()
          };

          await setDoc(gameRef, newGameState);
        }
      } catch (error) {
        console.error('Error initializing game:', error);
        setMessage('Error creating the game. Please try again.');
      }
    };

    initializeGame();
  }, [currentUser, gameId, opponentId]);

  const handleKeyPress = (key: string) => {
    if (currentGuess.length < 5 && /^[A-Za-z]$/.test(key)) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  };

  const handleBackspace = () => {
    setCurrentGuess(prev => prev.slice(0, -1));
  };

  const handleSubmitGuess = async () => {
    if (!gameState || !currentUser) return;
    
    // Check if it's the current user's turn
    if (gameState.currentPlayer !== currentUser.uid) {
      setMessage("It's not your turn!");
      return;
    }

    // Validate guess
    if (currentGuess.length !== 5) {
      setMessage('Your guess must be 5 letters!');
      return;
    }

    try {
      const gameRef = doc(firestore, 'wordleGames', gameId);
      
      // Determine which player is making the guess
      const isPlayer1 = currentUser.uid === gameState.player1;
      const playerGuessesField = isPlayer1 ? 'player1Guesses' : 'player2Guesses';
      const opponentId = isPlayer1 ? gameState.player2 : gameState.player1;
      
      // Update game state with the new guess
      const updatedGuesses = [...(isPlayer1 ? gameState.player1Guesses : gameState.player2Guesses), currentGuess];
      
      // Check if the guess is correct
      const isCorrect = currentGuess === gameState.word;
      
      const updates: any = {
        [playerGuessesField]: updatedGuesses,
        currentPlayer: opponentId, // Switch turns
      };
      
      // If the guess is correct, end the game
      if (isCorrect) {
        updates.status = 'completed';
        updates.winner = currentUser.uid;
      }
      
      await updateDoc(gameRef, updates);
      
      // Reset current guess
      setCurrentGuess('');
      setMessage(isCorrect ? 'You won!' : 'Guess submitted!');
      
    } catch (error) {
      console.error('Error submitting guess:', error);
      setMessage('Error submitting your guess. Please try again.');
    }
  };

  const renderGuessResult = (guess: string) => {
    if (!gameState) return null;
    
    return (
      <div className="flex justify-center mb-2">
        {guess.split('').map((letter, i) => {
          let bgColor = 'bg-gray-300 dark:bg-gray-700';
          
          if (gameState.word[i] === letter) {
            bgColor = 'bg-green-500';
          } else if (gameState.word.includes(letter)) {
            bgColor = 'bg-yellow-500';
          }
          
          return (
            <div 
              key={i} 
              className={`${bgColor} w-10 h-10 m-1 flex items-center justify-center font-bold text-lg rounded`}
            >
              {letter}
            </div>
          );
        })}
      </div>
    );
  };

  const renderKeyboard = () => {
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    return (
      <div className="mt-4">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center mb-2">
            {rowIndex === 2 && (
              <button
                onClick={handleSubmitGuess}
                className="px-4 py-2 bg-primary text-white rounded mr-1"
                disabled={currentGuess.length !== 5 || (gameState && gameState.currentPlayer !== currentUser?.uid) || false}
              >
                Enter
              </button>
            )}
            
            {row.map(key => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="w-8 h-10 m-1 bg-gray-200 dark:bg-gray-700 rounded"
                disabled={currentGuess.length >= 5 || (gameState && gameState.currentPlayer !== currentUser?.uid) || false}
              >
                {key}
              </button>
            ))}
            
            {rowIndex === 2 && (
              <button
                onClick={handleBackspace}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded ml-1"
                disabled={currentGuess.length === 0 || (gameState && gameState.currentPlayer !== currentUser?.uid) || false}
              >
                ←
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Clean up game invite when closing
  const handleClose = async () => {
    // Set loading to true to prevent flicker of second window
    setLoading(true);
    
    try {
      // Find and delete the game invite
      if (currentUser) {
        // Check if user is sender
        const senderQuery = query(
          collection(firestore, 'gameInvites'),
          where('senderId', '==', currentUser.uid),
          where('gameId', '==', gameId)
        );
        
        const senderResults = await getDocs(senderQuery);
        
        if (!senderResults.empty) {
          await deleteDoc(doc(firestore, 'gameInvites', senderResults.docs[0].id));
        } else {
          // Check if user is receiver
          const receiverQuery = query(
            collection(firestore, 'gameInvites'),
            where('receiverId', '==', currentUser.uid),
            where('gameId', '==', gameId)
          );
          
          const receiverResults = await getDocs(receiverQuery);
          
          if (!receiverResults.empty) {
            await deleteDoc(doc(firestore, 'gameInvites', receiverResults.docs[0].id));
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up game invite:', error);
    }
    
    // Call the original onClose function immediately
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show game over screen
  if (showGameOver && gameState && gameState.status === 'completed') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Game Over</h2>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
          
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4 text-2xl">
              {gameState.winner === currentUser?.uid ? '🏆' : '👏'}
            </div>
            
            <h3 className="text-xl font-bold mb-2">
              {gameState.winner === currentUser?.uid 
                ? 'You Won!' 
                : `${opponentName} Won!`}
            </h3>
            
            <p className="mb-4">The word was: <span className="font-bold">{gameState.word}</span></p>
            
            <button 
              onClick={handleClose}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              Close Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Toilet Wordle</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {gameState && (
          <>
            <div className="mb-4 text-center">
              <p className="text-sm mb-2">
                Playing against: <span className="font-semibold">{opponentName}</span>
              </p>
              
              <p className="text-sm">
                {gameState.status === 'completed' 
                  ? `Game over! ${gameState.winner === currentUser?.uid ? 'You won!' : `${opponentName} won!`}` 
                  : `${gameState.currentPlayer === currentUser?.uid ? 'Your turn' : `${opponentName}'s turn`}`}
              </p>
              
              {message && (
                <p className="text-sm text-accent mt-2">{message}</p>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-1">
                {(currentUser?.uid === gameState.player1 ? gameState.player1Guesses : gameState.player2Guesses).map((guess, index) => (
                  <div key={index}>{renderGuessResult(guess)}</div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">{opponentName}'s Guesses:</h3>
              <div className="space-y-1">
                {(currentUser?.uid === gameState.player1 ? gameState.player2Guesses : gameState.player1Guesses).map((guess, index) => (
                  <div key={index}>{renderGuessResult(guess)}</div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-center">
                {currentGuess.split('').map((letter, i) => (
                  <div 
                    key={i} 
                    className="bg-gray-200 dark:bg-gray-700 w-10 h-10 m-1 flex items-center justify-center font-bold text-lg rounded"
                  >
                    {letter}
                  </div>
                ))}
                {Array(5 - currentGuess.length).fill(null).map((_, i) => (
                  <div 
                    key={i} 
                    className="border-2 border-gray-300 dark:border-gray-600 w-10 h-10 m-1 rounded"
                  ></div>
                ))}
              </div>
            </div>

            {gameState.status !== 'completed' && gameState.currentPlayer === currentUser?.uid && renderKeyboard()}
          </>
        )}
      </div>
    </div>
  );
};

export default WordleGame; 