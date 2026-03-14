const App = (() => {
  let state = null;

  const SUIT_SYMBOLS = {
    spades: '\u2660',
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663'
  };

  const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

  function init() {
    state = Storage.loadGame();
    if (state) {
      render();
    } else {
      showSetup();
    }
  }

  function save() {
    Storage.saveGame(state);
  }

  function showView(phase) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.toggle('active', v.dataset.phase === phase);
    });
  }

  function render() {
    switch (state.phase) {
      case 'setup': renderSetup(); break;
      case 'roundStart': renderRoundStart(); break;
      case 'bidding': renderBidding(); break;
      case 'trickPlay': renderTrickPlay(); break;
      case 'roundEnd': renderRoundEnd(); break;
      case 'gameOver': renderGameOver(); break;
    }
    showView(state.phase);
    save();
  }

  // --- Setup Phase ---

  function showSetup(prefillNames) {
    state = { phase: 'setup', players: [], setupNames: prefillNames || ['', ''] };
    render();
  }

  function renderSetup() {
    const el = document.getElementById('view-setup');
    const names = state.setupNames || ['', ''];
    const canStart = names.length >= Game.MIN_PLAYERS &&
                     names.every(n => n.trim().length > 0);

    el.innerHTML = `
      <div class="view-content">
        <h1 class="app-title">Up &amp; Down<br>the River</h1>
        <div class="section-label">Players</div>
        <div id="player-inputs" class="player-inputs">
          ${names.map((name, i) => `
            <div class="player-input-row">
              <span class="player-number">${i + 1}</span>
              <input type="text" class="player-name-input" value="${escapeAttr(name)}"
                     placeholder="Player ${i + 1}" data-index="${i}"
                     maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false">
              ${names.length > Game.MIN_PLAYERS ? `<button class="btn-icon btn-remove" data-index="${i}" aria-label="Remove player">&times;</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${names.length < Game.MAX_PLAYERS ? `<button id="btn-add-player" class="btn-secondary">+ Add Player</button>` : ''}
        <button id="btn-start-game" class="btn-primary" ${canStart ? '' : 'disabled'}>Start Game</button>
      </div>
    `;

    el.querySelectorAll('.player-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        state.setupNames[parseInt(e.target.dataset.index)] = e.target.value;
        save();
        updateStartButton();
      });
    });

    el.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        state.setupNames.splice(idx, 1);
        render();
      });
    });

    const addBtn = document.getElementById('btn-add-player');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        state.setupNames.push('');
        render();
        setTimeout(() => {
          const inputs = el.querySelectorAll('.player-name-input');
          inputs[inputs.length - 1].focus();
        }, 50);
      });
    }

    document.getElementById('btn-start-game').addEventListener('click', () => {
      if (state.setupNames.every(n => n.trim().length > 0)) {
        state = Game.createNewGame(state.setupNames.map(n => n.trim()));
        state = Game.startRound(state);
        render();
      }
    });
  }

  function updateStartButton() {
    const btn = document.getElementById('btn-start-game');
    if (!btn) return;
    const names = state.setupNames || [];
    const canStart = names.length >= Game.MIN_PLAYERS &&
                     names.every(n => n.trim().length > 0);
    btn.disabled = !canStart;
  }

  // --- Round Start Phase ---

  function renderRoundStart() {
    const el = document.getElementById('view-round-start');
    const roundNum = state.currentRound + 1;
    const cards = Game.getCardsForRound(state.currentRound);
    const direction = Game.getRiverDirection(state.currentRound);
    const dealerIdx = Game.getDealerIndex(state);
    const leaderIdx = Game.getLeaderIndex(state);
    const round = state.rounds[state.currentRound];
    const selectedSuit = round ? round.trumpSuit : null;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header">
          <div class="round-number">Round ${roundNum} <span class="of-total">of ${Game.TOTAL_ROUNDS}</span></div>
          <div class="round-meta">
            <span class="direction-badge ${direction}">${direction === 'up' ? '\u25B2 Up' : '\u25BC Down'} the River</span>
            <span class="cards-badge">${cards} card${cards > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="info-rows">
          <div class="info-row"><span class="info-label">Dealer</span><span class="info-value">${escapeHtml(state.players[dealerIdx].name)}</span></div>
          <div class="info-row"><span class="info-label">Leads</span><span class="info-value">${escapeHtml(state.players[leaderIdx].name)}</span></div>
        </div>
        <div class="section-label">Trump Suit</div>
        <div class="suit-picker">
          ${SUIT_NAMES.map(suit => `
            <button class="suit-btn ${suit} ${selectedSuit === suit ? 'selected' : ''}" data-suit="${suit}">
              <span class="suit-symbol">${SUIT_SYMBOLS[suit]}</span>
            </button>
          `).join('')}
        </div>
        <button id="btn-collect-bids" class="btn-primary" ${selectedSuit ? '' : 'disabled'}>Collect Bids</button>
      </div>
    `;

    el.querySelectorAll('.suit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const suit = e.currentTarget.dataset.suit;
        state = Game.setTrumpSuit(state, suit);
        render();
      });
    });

    document.getElementById('btn-collect-bids').addEventListener('click', () => {
      state.phase = 'bidding';
      render();
    });
  }

  // --- Bidding Phase ---

  function renderBidding() {
    const el = document.getElementById('view-bidding');
    const round = state.rounds[state.currentRound];
    const maxBid = round.cardsDealt;
    const totalBids = Game.getTotalBids(state);
    const overUnder = totalBids - maxBid;
    let overUnderText = '';
    if (overUnder > 0) overUnderText = `<span class="over">Over by ${overUnder}</span>`;
    else if (overUnder < 0) overUnderText = `<span class="under">Under by ${Math.abs(overUnder)}</span>`;
    else overUnderText = `<span class="even">Even</span>`;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header compact">
          <div class="round-number">Round ${state.currentRound + 1} &mdash; Bids</div>
          <div class="round-meta">
            <span class="trump-display ${round.trumpSuit}">${SUIT_SYMBOLS[round.trumpSuit]} Trump</span>
          </div>
        </div>
        <div class="bid-summary">
          <span>Total bids: <strong>${totalBids}</strong> / ${maxBid} tricks</span>
          ${overUnderText}
        </div>
        <div class="bid-list">
          ${state.players.map(p => `
            <div class="bid-row">
              <span class="bid-player-name">${escapeHtml(p.name)}</span>
              <div class="bid-controls">
                <button class="btn-bid-adjust" data-player="${p.id}" data-delta="-1" ${round.bids[p.id] <= 0 ? 'disabled' : ''}>−</button>
                <span class="bid-value">${round.bids[p.id]}</span>
                <button class="btn-bid-adjust" data-player="${p.id}" data-delta="1" ${round.bids[p.id] >= maxBid ? 'disabled' : ''}>+</button>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="btn-lock-bids" class="btn-primary">Lock Bids</button>
        <button id="btn-back-to-round" class="btn-secondary">Back</button>
      </div>
    `;

    el.querySelectorAll('.btn-bid-adjust').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = parseInt(e.currentTarget.dataset.player);
        const delta = parseInt(e.currentTarget.dataset.delta);
        const current = round.bids[playerId];
        state = Game.setBid(state, playerId, current + delta);
        render();
      });
    });

    document.getElementById('btn-lock-bids').addEventListener('click', () => {
      state = Game.lockBids(state);
      render();
    });

    document.getElementById('btn-back-to-round').addEventListener('click', () => {
      state.phase = 'roundStart';
      render();
    });
  }

  // --- Trick Play Phase ---

  function renderTrickPlay() {
    const el = document.getElementById('view-trick-play');
    const round = state.rounds[state.currentRound];
    const totalTricks = round.cardsDealt;
    const awarded = round.trickLog.length;
    const allDone = awarded >= totalTricks;
    const currentTrick = awarded + 1;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header compact">
          <div class="round-number">Round ${state.currentRound + 1} &mdash; Play</div>
          <div class="round-meta">
            <span class="trump-display ${round.trumpSuit}">${SUIT_SYMBOLS[round.trumpSuit]} Trump</span>
            <span class="trick-progress">${allDone ? 'All tricks played' : `Trick ${currentTrick} of ${totalTricks}`}</span>
          </div>
        </div>
        ${!allDone ? `
          <div class="section-label">Who won this trick?</div>
          <div class="trick-player-list">
            ${state.players.map(p => `
              <button class="trick-player-btn" data-player="${p.id}">
                <span class="trick-player-name">${escapeHtml(p.name)}</span>
                <span class="trick-player-count">${round.tricks[p.id]}</span>
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="section-label">Tricks complete</div>
        `}
        ${awarded > 0 ? `
          <div class="section-label">Trick Log</div>
          <div class="trick-log">
            ${round.trickLog.map((pid, i) => `
              <button class="trick-log-entry" data-trick-index="${i}">
                <span class="trick-log-num">${i + 1}.</span>
                <span class="trick-log-name">${escapeHtml(state.players.find(p => p.id === pid).name)}</span>
                <span class="trick-log-edit">tap to change</span>
              </button>
            `).join('')}
          </div>
        ` : ''}
        ${allDone ? `<button id="btn-end-round" class="btn-primary">Review &amp; Score</button>` : ''}
      </div>
    `;

    // Reassign overlay state
    el._reassignIndex = null;

    if (!allDone) {
      el.querySelectorAll('.trick-player-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const playerId = parseInt(e.currentTarget.dataset.player);
          state = Game.awardTrick(state, playerId);
          render();
        });
      });
    }

    el.querySelectorAll('.trick-log-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trickIndex = parseInt(e.currentTarget.dataset.trickIndex);
        showReassignOverlay(trickIndex);
      });
    });

    const endBtn = document.getElementById('btn-end-round');
    if (endBtn) {
      endBtn.addEventListener('click', () => {
        state.phase = 'roundEnd';
        render();
      });
    }
  }

  function showReassignOverlay(trickIndex) {
    const existing = document.querySelector('.overlay');
    if (existing) existing.remove();

    const round = state.rounds[state.currentRound];
    const currentHolder = round.trickLog[trickIndex];

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="overlay-content">
        <div class="overlay-title">Reassign Trick ${trickIndex + 1}</div>
        <div class="overlay-subtitle">Currently: ${escapeHtml(state.players.find(p => p.id === currentHolder).name)}</div>
        <div class="reassign-list">
          ${state.players.map(p => `
            <button class="reassign-btn ${p.id === currentHolder ? 'current' : ''}" data-player="${p.id}">
              ${escapeHtml(p.name)}
            </button>
          `).join('')}
        </div>
        <button class="btn-secondary overlay-cancel">Cancel</button>
      </div>
    `;

    overlay.querySelector('.overlay-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelectorAll('.reassign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const newPlayerId = parseInt(e.currentTarget.dataset.player);
        state = Game.reassignTrick(state, trickIndex, newPlayerId);
        overlay.remove();
        render();
      });
    });

    document.body.appendChild(overlay);
  }

  // --- Round End Phase (Confirmation + Scoring) ---

  function renderRoundEnd(editingRoundIndex) {
    const el = document.getElementById('view-round-end');
    const isEditing = editingRoundIndex !== undefined;
    const roundIdx = isEditing ? editingRoundIndex : state.currentRound;
    const round = state.rounds[roundIdx];
    const isConfirmed = round.confirmed;

    if (!isConfirmed && !isEditing) {
      renderConfirmation(el, roundIdx);
    } else if (isEditing) {
      renderEditRound(el, roundIdx);
    } else {
      renderScoreboard(el);
    }
    showView('roundEnd');
    save();
  }

  function renderConfirmation(el, roundIdx) {
    const round = state.rounds[roundIdx];
    const maxTricks = round.cardsDealt;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header compact">
          <div class="round-number">Round ${roundIdx + 1} &mdash; Confirm</div>
        </div>
        <div class="section-label">Review before scoring</div>
        <div class="confirm-list">
          ${state.players.map(p => `
            <div class="confirm-row">
              <span class="confirm-name">${escapeHtml(p.name)}</span>
              <div class="confirm-col">
                <div class="confirm-label">Bid</div>
                <div class="confirm-adjust">
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="bids" data-delta="-1" ${round.bids[p.id] <= 0 ? 'disabled' : ''}>−</button>
                  <span class="confirm-value">${round.bids[p.id]}</span>
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="bids" data-delta="1" ${round.bids[p.id] >= maxTricks ? 'disabled' : ''}>+</button>
                </div>
              </div>
              <div class="confirm-col">
                <div class="confirm-label">Tricks</div>
                <div class="confirm-adjust">
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="tricks" data-delta="-1" ${round.tricks[p.id] <= 0 ? 'disabled' : ''}>−</button>
                  <span class="confirm-value">${round.tricks[p.id]}</span>
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="tricks" data-delta="1" ${round.tricks[p.id] >= maxTricks ? 'disabled' : ''}>+</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="btn-confirm-scores" class="btn-primary">Confirm &amp; Score</button>
      </div>
    `;

    el.querySelectorAll('.btn-bid-adjust').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = parseInt(e.currentTarget.dataset.player);
        const field = e.currentTarget.dataset.field;
        const delta = parseInt(e.currentTarget.dataset.delta);
        round[field][playerId] = Math.max(0, Math.min(maxTricks, round[field][playerId] + delta));
        renderRoundEnd();
      });
    });

    document.getElementById('btn-confirm-scores').addEventListener('click', () => {
      state = Game.confirmRound(state);
      renderRoundEnd();
    });
  }

  function renderScoreboard(el) {
    const round = state.rounds[state.currentRound];
    const cumulative = Game.getCumulativeScores(state);
    const isLastRound = state.currentRound >= Game.TOTAL_ROUNDS - 1;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header compact">
          <div class="round-number">Round ${state.currentRound + 1} &mdash; Scores</div>
        </div>
        <div class="score-table">
          <div class="score-table-header">
            <span>Player</span>
            <span>Bid</span>
            <span>Got</span>
            <span>Pts</span>
            <span>Total</span>
          </div>
          ${state.players.map(p => {
            const made = round.bids[p.id] === round.tricks[p.id];
            return `
              <div class="score-table-row ${made ? 'made' : 'missed'}">
                <span class="score-player-name">${escapeHtml(p.name)}</span>
                <span>${round.bids[p.id]}</span>
                <span>${round.tricks[p.id]}</span>
                <span class="score-pts">${round.scores[p.id]}</span>
                <span class="score-total">${cumulative[p.id]}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${state.currentRound > 0 ? `
          <div class="section-label">Past Rounds <span class="hint">tap to edit</span></div>
          <div class="past-rounds">
            ${state.rounds.slice(0, state.currentRound).map((r, i) => {
              if (!r || !r.confirmed) return '';
              return `
                <button class="past-round-btn" data-round="${i}">
                  <span class="past-round-num">R${i + 1}</span>
                  <span class="past-round-cards">${r.cardsDealt} card${r.cardsDealt > 1 ? 's' : ''}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
        <button id="btn-next-round" class="btn-primary">${isLastRound ? 'Finish Game' : 'Next Round'}</button>
      </div>
    `;

    el.querySelectorAll('.past-round-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roundIdx = parseInt(e.currentTarget.dataset.round);
        renderEditRound(el, roundIdx);
      });
    });

    document.getElementById('btn-next-round').addEventListener('click', () => {
      if (isLastRound) {
        state.phase = 'gameOver';
        Storage.saveToHistory(state);
        render();
      } else {
        state = Game.advanceRound(state);
        render();
      }
    });
  }

  function renderEditRound(el, roundIdx) {
    const round = state.rounds[roundIdx];
    const maxTricks = round.cardsDealt;

    el.innerHTML = `
      <div class="view-content">
        <div class="round-header compact">
          <div class="round-number">Edit Round ${roundIdx + 1}</div>
        </div>
        <div class="confirm-list">
          ${state.players.map(p => `
            <div class="confirm-row">
              <span class="confirm-name">${escapeHtml(p.name)}</span>
              <div class="confirm-col">
                <div class="confirm-label">Bid</div>
                <div class="confirm-adjust">
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="bids" data-delta="-1" ${round.bids[p.id] <= 0 ? 'disabled' : ''}>−</button>
                  <span class="confirm-value">${round.bids[p.id]}</span>
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="bids" data-delta="1" ${round.bids[p.id] >= maxTricks ? 'disabled' : ''}>+</button>
                </div>
              </div>
              <div class="confirm-col">
                <div class="confirm-label">Tricks</div>
                <div class="confirm-adjust">
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="tricks" data-delta="-1" ${round.tricks[p.id] <= 0 ? 'disabled' : ''}>−</button>
                  <span class="confirm-value">${round.tricks[p.id]}</span>
                  <button class="btn-bid-adjust" data-player="${p.id}" data-field="tricks" data-delta="1" ${round.tricks[p.id] >= maxTricks ? 'disabled' : ''}>+</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="btn-save-edit" class="btn-primary">Save Changes</button>
        <button id="btn-cancel-edit" class="btn-secondary">Cancel</button>
      </div>
    `;

    el.querySelectorAll('.btn-bid-adjust').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = parseInt(e.currentTarget.dataset.player);
        const field = e.currentTarget.dataset.field;
        const delta = parseInt(e.currentTarget.dataset.delta);
        round[field][playerId] = Math.max(0, Math.min(maxTricks, round[field][playerId] + delta));
        renderEditRound(el, roundIdx);
      });
    });

    document.getElementById('btn-save-edit').addEventListener('click', () => {
      state = Game.editPastRound(state, roundIdx, round.bids, round.tricks);
      renderScoreboard(el);
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      renderScoreboard(el);
    });
  }

  // --- Game Over Phase ---

  function renderGameOver() {
    const el = document.getElementById('view-game-over');
    const leaderboard = Game.getLeaderboard(state);
    const topScore = leaderboard[0].totalScore;
    const showStats = el._showStats || false;

    el.innerHTML = `
      <div class="view-content">
        <h1 class="game-over-title">Game Over!</h1>
        <div class="leaderboard">
          ${leaderboard.map((p, i) => {
            const isWinner = p.totalScore === topScore;
            return `
              <div class="leaderboard-row ${isWinner ? 'winner' : ''}">
                <span class="leaderboard-rank">${i + 1}</span>
                <span class="leaderboard-name">${escapeHtml(p.name)} ${isWinner ? '\uD83C\uDFC6' : ''}</span>
                <span class="leaderboard-score">${p.totalScore}</span>
              </div>
            `;
          }).join('')}
        </div>
        <button id="btn-toggle-stats" class="btn-secondary">${showStats ? 'Hide Stats' : 'Show Stats'}</button>
        ${showStats ? renderStatsTable() : ''}
        <button id="btn-play-again" class="btn-primary">Play Again</button>
      </div>
    `;

    document.getElementById('btn-toggle-stats').addEventListener('click', () => {
      el._showStats = !el._showStats;
      renderGameOver();
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      const names = state.players.map(p => p.name);
      Storage.clearGame();
      showSetup(names);
    });
  }

  function renderStatsTable() {
    let html = '<div class="stats-table-wrapper"><table class="stats-table"><thead><tr><th>Rnd</th>';
    state.players.forEach(p => {
      html += `<th>${escapeHtml(p.name)}</th>`;
    });
    html += '</tr></thead><tbody>';

    state.rounds.forEach((round, i) => {
      if (!round || !round.confirmed) return;
      html += `<tr><td class="stats-round-num">${i + 1}</td>`;
      state.players.forEach(p => {
        const made = round.bids[p.id] === round.tricks[p.id];
        html += `<td class="${made ? 'made' : 'missed'}">
          <span class="stats-bid">${round.bids[p.id]}/${round.tricks[p.id]}</span>
          <span class="stats-pts">${round.scores[p.id]}</span>
        </td>`;
      });
      html += '</tr>';
    });

    const cumulative = Game.getCumulativeScores(state);
    html += '<tr class="stats-total-row"><td><strong>Total</strong></td>';
    state.players.forEach(p => {
      html += `<td><strong>${cumulative[p.id]}</strong></td>`;
    });
    html += '</tr></tbody></table></div>';
    return html;
  }

  // --- Helpers ---

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init, showSetup };
})();
