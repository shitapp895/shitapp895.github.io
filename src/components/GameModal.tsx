import { useGame } from '../contexts/GameContext';
import WordleGame from './WordleGame';
import GameInvite from './GameInvite';

const GameModal = () => {
  const { 
    activeGameId, 
    activeOpponentId, 
    activeInviteId, 
    handleCloseGame, 
    handleAcceptInvite, 
    handleCloseInvite 
  } = useGame();

  return (
    <>
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
  );
};

export default GameModal; 