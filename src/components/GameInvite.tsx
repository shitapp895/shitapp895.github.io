import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { FaGamepad } from 'react-icons/fa';

interface GameInviteProps {
  inviteId?: string;
  onAccept: (gameId: string, opponentId: string) => void;
  onClose: () => void;
}

interface GameInvite {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  gameType: 'wordle';
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: number;
}

const GameInvite = ({ inviteId, onAccept, onClose }: GameInviteProps) => {
  const { currentUser } = useAuth();
  const [invite, setInvite] = useState<GameInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Listen for invite changes
  useEffect(() => {
    if (!currentUser || !inviteId) return;

    const inviteRef = doc(firestore, 'gameInvites', inviteId);
    
    const unsubscribe = onSnapshot(inviteRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setInvite({ id: docSnapshot.id, ...docSnapshot.data() } as GameInvite);
      } else {
        setInvite(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to invite updates:', error);
      setError('Error connecting to the invite. Please try again.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, inviteId]);

  const handleAccept = async () => {
    if (!invite || !currentUser) return;

    try {
      // Create a new game ID
      const gameId = `wordle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Update invite status
      await updateDoc(doc(firestore, 'gameInvites', invite.id), {
        status: 'accepted',
        gameId
      });
      
      // Notify parent component
      onAccept(gameId, invite.senderId);
    } catch (error) {
      console.error('Error accepting invite:', error);
      setError('Error accepting the invite. Please try again.');
    }
  };

  const handleReject = async () => {
    if (!invite || !currentUser) return;

    try {
      // Update invite status
      await updateDoc(doc(firestore, 'gameInvites', invite.id), {
        status: 'rejected'
      });
      
      // Close the invite modal
      onClose();
    } catch (error) {
      console.error('Error rejecting invite:', error);
      setError('Error rejecting the invite. Please try again.');
    }
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

  if (!invite) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center">
            <p className="mb-4">This game invite no longer exists.</p>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              Close
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
          <h2 className="text-xl font-bold">Game Invitation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <FaGamepad className="text-primary text-2xl" />
          </div>
          
          <p className="mb-2">
            <span className="font-semibold">{invite.senderName}</span> has invited you to play:
          </p>
          <p className="text-lg font-bold mb-4">Toilet Wordle</p>
          
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleReject}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameInvite; 