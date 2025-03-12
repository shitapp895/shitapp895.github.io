import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, getDocs, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from './AuthContext';

interface GameInviteData {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  gameType: 'wordle';
  status: 'accepted' | 'pending' | 'rejected' | 'cancelled';
  createdAt: number;
  gameId?: string;
}

interface GameContextType {
  activeGameId: string | null;
  activeOpponentId: string | null;
  activeInviteId: string | null;
  pendingInvites: GameInviteData[];
  setActiveInviteId: (id: string | null) => void;
  handleCloseGame: () => void;
  handleAcceptInvite: (gameId: string, opponentId: string) => void;
  handleCloseInvite: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeOpponentId, setActiveOpponentId] = useState<string | null>(null);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<GameInviteData[]>([]);

  // Check for active games and pending invites
  useEffect(() => {
    if (!currentUser) return;

    const fetchGameState = async () => {
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
        console.error('Error fetching game state:', error);
      }
    };

    // Initial fetch
    fetchGameState();

    // Set up a periodic check for updates
    const intervalId = setInterval(fetchGameState, 10000);

    return () => clearInterval(intervalId);
  }, [currentUser, activeInviteId, activeGameId]);

  const handleCloseGame = () => {
    // Immediately clear all game state
    setActiveGameId(null);
    setActiveOpponentId(null);
  };

  const handleAcceptInvite = (gameId: string, opponentId: string) => {
    setActiveGameId(gameId);
    setActiveOpponentId(opponentId);
    setActiveInviteId(null);
  };

  const handleCloseInvite = () => {
    setActiveInviteId(null);
  };

  const value = {
    activeGameId,
    activeOpponentId,
    activeInviteId,
    pendingInvites,
    setActiveInviteId,
    handleCloseGame,
    handleAcceptInvite,
    handleCloseInvite
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}; 