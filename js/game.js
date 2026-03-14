const Game = (() => {
  const ROUND_CARDS = [1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1];
  const TOTAL_ROUNDS = ROUND_CARDS.length;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 7;

  function createNewGame(playerNames) {
    const players = playerNames.map((name, i) => ({ id: i, name }));
    return {
      players,
      dealerIndex: 0,
      currentRound: 0,
      phase: 'bidding',
      rounds: []
    };
  }

  function getCardsForRound(roundIndex) {
    return ROUND_CARDS[roundIndex];
  }

  function getRiverDirection(roundIndex) {
    return roundIndex < 7 ? 'up' : 'down';
  }

  function getDealerIndex(gameState) {
    return gameState.dealerIndex % gameState.players.length;
  }

  function getLeaderIndex(gameState) {
    return (getDealerIndex(gameState) + 1) % gameState.players.length;
  }

  function startRound(gameState) {
    const cards = getCardsForRound(gameState.currentRound);
    const round = {
      cardsDealt: cards,
      trumpSuit: null,
      bids: {},
      tricks: {},
      trickLog: [],
      scores: {},
      confirmed: false
    };
    gameState.players.forEach(p => {
      round.bids[p.id] = null;
      round.tricks[p.id] = 0;
    });
    gameState.rounds[gameState.currentRound] = round;
    gameState.phase = 'bidding';
    return gameState;
  }

  function setTrumpSuit(gameState, suit) {
    gameState.rounds[gameState.currentRound].trumpSuit = suit;
    return gameState;
  }

  function setBid(gameState, playerId, amount) {
    const round = gameState.rounds[gameState.currentRound];
    const max = round.cardsDealt;
    round.bids[playerId] = Math.max(0, Math.min(max, amount));
    return gameState;
  }

  function allBidsSet(gameState) {
    const round = gameState.rounds[gameState.currentRound];
    if (!round) return false;
    return gameState.players.every(p => round.bids[p.id] !== null);
  }

  function lockBids(gameState) {
    gameState.phase = 'trickPlay';
    return gameState;
  }

  function awardTrick(gameState, playerId) {
    const round = gameState.rounds[gameState.currentRound];
    const totalTricks = round.cardsDealt;
    const awarded = round.trickLog.length;
    if (awarded >= totalTricks) return gameState;

    round.tricks[playerId]++;
    round.trickLog.push(playerId);

    if (round.trickLog.length >= totalTricks) {
      gameState.phase = 'roundEnd';
    }
    return gameState;
  }

  function reassignTrick(gameState, trickIndex, newPlayerId) {
    const round = gameState.rounds[gameState.currentRound];
    const oldPlayerId = round.trickLog[trickIndex];
    if (oldPlayerId === newPlayerId) return gameState;

    round.tricks[oldPlayerId]--;
    round.tricks[newPlayerId]++;
    round.trickLog[trickIndex] = newPlayerId;
    return gameState;
  }

  function calculateScore(bid, tricks) {
    if (bid === tricks) {
      return (bid * 5) + 10;
    }
    return 0;
  }

  function scoreRound(gameState, roundIndex) {
    const round = gameState.rounds[roundIndex];
    gameState.players.forEach(p => {
      round.scores[p.id] = calculateScore(round.bids[p.id], round.tricks[p.id]);
    });
    round.confirmed = true;
    return gameState;
  }

  function confirmRound(gameState) {
    return scoreRound(gameState, gameState.currentRound);
  }

  function editPastRound(gameState, roundIndex, bids, tricks) {
    const round = gameState.rounds[roundIndex];
    gameState.players.forEach(p => {
      round.bids[p.id] = bids[p.id];
      round.tricks[p.id] = tricks[p.id];
    });
    return scoreRound(gameState, roundIndex);
  }

  function advanceRound(gameState) {
    gameState.currentRound++;
    gameState.dealerIndex++;
    if (gameState.currentRound >= TOTAL_ROUNDS) {
      gameState.phase = 'gameOver';
    } else {
      gameState = startRound(gameState);
    }
    return gameState;
  }

  function getCumulativeScores(gameState) {
    const totals = {};
    gameState.players.forEach(p => { totals[p.id] = 0; });
    for (let i = 0; i <= Math.min(gameState.currentRound, gameState.rounds.length - 1); i++) {
      const round = gameState.rounds[i];
      if (round && round.confirmed) {
        gameState.players.forEach(p => {
          totals[p.id] += round.scores[p.id] || 0;
        });
      }
    }
    return totals;
  }

  function getLeaderboard(gameState) {
    const totals = getCumulativeScores(gameState);
    return gameState.players
      .map(p => ({ ...p, totalScore: totals[p.id] }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  function getTotalBids(gameState) {
    const round = gameState.rounds[gameState.currentRound];
    if (!round) return 0;
    return Object.values(round.bids).reduce((sum, b) => sum + (b || 0), 0);
  }

  return {
    ROUND_CARDS, TOTAL_ROUNDS, MIN_PLAYERS, MAX_PLAYERS,
    createNewGame, getCardsForRound, getRiverDirection,
    getDealerIndex, getLeaderIndex, startRound, setTrumpSuit,
    setBid, allBidsSet, lockBids, awardTrick, reassignTrick,
    calculateScore, scoreRound, confirmRound, editPastRound,
    advanceRound, getCumulativeScores, getLeaderboard, getTotalBids
  };
})();
