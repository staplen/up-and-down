const Storage = (() => {
  const CURRENT_GAME_KEY = 'updown_currentGame';
  const HISTORY_KEY = 'updown_gameHistory';

  function saveGame(gameState) {
    try {
      localStorage.setItem(CURRENT_GAME_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  function loadGame() {
    try {
      const data = localStorage.getItem(CURRENT_GAME_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return null;
    }
  }

  function clearGame() {
    localStorage.removeItem(CURRENT_GAME_KEY);
  }

  function saveToHistory(gameState) {
    try {
      const history = getHistory();
      history.push({
        ...gameState,
        completedAt: new Date().toISOString()
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save game history:', e);
    }
  }

  function getHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load game history:', e);
      return [];
    }
  }

  return { saveGame, loadGame, clearGame, saveToHistory, getHistory };
})();
