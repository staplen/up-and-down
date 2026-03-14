const App = (() => {
  let state = null;
  let lastStepperRound = -1;
  let savedStepperScroll = null;

  const SUIT_SYMBOLS = {
    spades: '\u2660', hearts: '\u2665',
    diamonds: '\u2666', clubs: '\u2663'
  };
  const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];

  function init() {
    state = Storage.loadGame();
    if (state) {
      if (state.phase === 'roundStart') state.phase = 'bidding';
      render();
    } else {
      showSetup();
    }
  }

  function save() { Storage.saveGame(state); }

  function showView(phase) {
    document.querySelectorAll('.view').forEach(v => {
      const match = v.dataset.phase === phase;
      if (match && !v.classList.contains('active')) {
        v.classList.add('active');
        v.classList.remove('view-exit');
        void v.offsetWidth;
        v.classList.add('view-enter');
      } else if (!match && v.classList.contains('active')) {
        v.classList.remove('active', 'view-enter');
      }
    });
  }

  function render() {
    switch (state.phase) {
      case 'setup': renderSetup(); break;
      case 'bidding': renderBidding(); break;
      case 'trickPlay': renderTrickPlay(); break;
      case 'roundEnd': renderRoundEnd(); break;
      case 'gameOver': renderGameOver(); break;
    }
    showView(state.phase);
    save();
  }

  // ── Round Stepper ──────────────────────────────────────

  function renderStepper() {
    return `
      <div class="round-stepper" id="round-stepper">
        ${Game.ROUND_CARDS.map((cards, i) => {
          const r = state.rounds[i];
          const isPast = i < state.currentRound;
          const isCurrent = i === state.currentRound;
          const suit = r ? r.trumpSuit : null;
          let cls = 'stepper-card';
          if (isPast) cls += ' past';
          else if (isCurrent) cls += ' current';
          else cls += ' future';
          if (suit) cls += ' ' + suit;
          return `<div class="${cls}" data-round="${i}"><span class="stepper-count">${cards}</span>${suit ? `<span class="stepper-suit">${SUIT_SYMBOLS[suit]}</span>` : ''}</div>`;
        }).join('')}
      </div>`;
  }

  function saveStepperScroll() {
    const stepper = document.getElementById('round-stepper');
    if (stepper) savedStepperScroll = stepper.scrollLeft;
  }

  function scrollStepperToCurrent() {
    if (lastStepperRound === state.currentRound) {
      if (savedStepperScroll !== null) {
        requestAnimationFrame(() => {
          const stepper = document.getElementById('round-stepper');
          if (stepper) stepper.scrollLeft = savedStepperScroll;
        });
      }
      return;
    }
    lastStepperRound = state.currentRound;
    requestAnimationFrame(() => {
      const card = document.querySelector('#round-stepper .stepper-card.current');
      if (card) card.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    });
  }

  function attachStepperTap() {
    const card = document.querySelector('#round-stepper .stepper-card.current');
    if (card && (state.phase === 'bidding' || state.phase === 'trickPlay')) {
      card.classList.add('tappable');
      card.addEventListener('click', showSuitPickerOverlay);
    }
  }

  // ── Bottom Actions (New Game + Scores) ─────────────────

  function renderBottomActions() {
    if (state.phase === 'setup' || state.phase === 'gameOver') return '';
    return `
      <div class="bottom-actions">
        <button class="bottom-btn" id="btn-scores">Scores</button>
        <button class="bottom-btn" id="btn-reset">New Game</button>
      </div>`;
  }

  function attachBottomActions() {
    document.getElementById('btn-scores')?.addEventListener('click', showLeaderboardOverlay);
    document.getElementById('btn-reset')?.addEventListener('click', showResetOverlay);
  }

  // ── Number Row (shared) ────────────────────────────────

  function renderNumberRow(player, max, selectedValue, opts) {
    const bidRef = opts && opts.bidRef;
    const field = (opts && opts.field) || '';
    const role = (opts && opts.role) || '';
    const roleCls = role ? ` role-${role}` : '';
    const roleLabel = role ? `<span class="role-label">${role === 'dealer' ? 'Dealer' : 'Leads'}</span>` : '';
    return `
      <div class="number-row${roleCls}">
        ${roleLabel}
        <div class="number-row-label">
          <span class="number-row-name">${escapeHtml(player.name)}</span>
          ${bidRef !== undefined && bidRef !== null ? `<span class="number-row-ref">bid ${bidRef}</span>` : ''}
        </div>
        <div class="number-buttons-wrap">
          <div class="number-buttons">
            ${Array.from({length: max + 1}, (_, n) =>
              `<button class="num-btn${selectedValue === n ? ' selected' : ''}" data-player="${player.id}" data-value="${n}" data-field="${field}">${n}</button>`
            ).join('')}
          </div>
        </div>
      </div>`;
  }

  function setupScrollFade() {
    const init = () => {
      document.querySelectorAll('.number-buttons').forEach(nb => {
        const check = () => {
          const over = nb.scrollWidth > nb.clientWidth + 1;
          const atEnd = nb.scrollLeft + nb.clientWidth >= nb.scrollWidth - 2;
          nb.parentElement.classList.toggle('scroll-fade', over && !atEnd);
        };
        check();
        nb.addEventListener('scroll', check, { passive: true });
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(init));
  }

  // ── Setup Phase ────────────────────────────────────────

  function showSetup(prefillNames) {
    state = { phase: 'setup', players: [], setupNames: prefillNames || ['', ''] };
    render();
  }

  function renderSetup() {
    const el = document.getElementById('view-setup');
    const names = state.setupNames || ['', ''];
    const canStart = names.length >= Game.MIN_PLAYERS && names.every(n => n.trim().length > 0);

    el.innerHTML = `
      <div class="view-content">
        <h1 class="app-title">Up &amp; Down<br>the River</h1>
        <div class="section-label">Players <span class="hint">first player deals \u2014 drag to set order</span></div>
        <div id="player-inputs" class="player-inputs">
          ${names.map((name, i) => `
            <div class="player-input-row${i === 0 ? ' is-dealer' : ''}" data-index="${i}">
              <span class="drag-handle" aria-label="Drag to reorder">\u2630</span>
              <input type="text" class="player-name-input" value="${escapeAttr(name)}"
                     placeholder="Player ${i + 1}" data-index="${i}"
                     maxlength="20" autocomplete="off" autocorrect="off" spellcheck="false">
              ${i === 0 ? '<span class="dealer-badge">Dealer</span>' : ''}
              ${names.length > Game.MIN_PLAYERS ? `<button class="btn-icon btn-remove" data-index="${i}" aria-label="Remove">&times;</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${names.length < Game.MAX_PLAYERS ? `<button id="btn-add-player" class="btn-secondary">+ Add Player</button>` : ''}
        <button id="btn-start-game" class="btn-primary" ${canStart ? '' : 'disabled'}>Start Game</button>
      </div>`;

    el.querySelectorAll('.player-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        state.setupNames[parseInt(e.target.dataset.index)] = e.target.value;
        save();
        updateStartButton();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (state.setupNames.length < Game.MAX_PLAYERS) {
            state.setupNames.push('');
            render();
            setTimeout(() => {
              const inputs = el.querySelectorAll('.player-name-input');
              inputs[inputs.length - 1].focus();
            }, 50);
          }
        }
      });
    });

    el.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.setupNames.splice(parseInt(e.currentTarget.dataset.index), 1);
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
        lastStepperRound = -1;
        state = Game.createNewGame(state.setupNames.map(n => n.trim()));
        state = Game.startRound(state);
        render();
      }
    });

    setupDragReorder();
  }

  function updateStartButton() {
    const btn = document.getElementById('btn-start-game');
    if (!btn) return;
    const names = state.setupNames || [];
    btn.disabled = !(names.length >= Game.MIN_PLAYERS && names.every(n => n.trim().length > 0));
  }

  // ── Drag-to-Reorder ───────────────────────────────────

  function setupDragReorder() {
    const container = document.getElementById('player-inputs');
    if (!container) return;
    const rows = [...container.querySelectorAll('.player-input-row')];
    if (rows.length < 2) return;

    rows.forEach((row, idx) => {
      const handle = row.querySelector('.drag-handle');
      if (!handle) return;

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        let dragIdx = idx;
        const startY = e.clientY;
        const rowH = row.offsetHeight + 8;
        row.classList.add('dragging');
        container.classList.add('reordering');

        const onMove = (ev) => {
          const dy = ev.clientY - startY;
          rows[dragIdx].style.transform = `translateY(${dy}px)`;
          const shift = Math.round(dy / rowH);
          const target = Math.max(0, Math.min(rows.length - 1, dragIdx + shift));
          rows.forEach((r, i) => {
            if (i === dragIdx) return;
            if (dragIdx < target && i > dragIdx && i <= target) r.style.transform = `translateY(${-rowH}px)`;
            else if (dragIdx > target && i < dragIdx && i >= target) r.style.transform = `translateY(${rowH}px)`;
            else r.style.transform = '';
          });
        };

        const onUp = (ev) => {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          const dy = ev.clientY - startY;
          const target = Math.max(0, Math.min(rows.length - 1, dragIdx + Math.round(dy / rowH)));
          if (target !== dragIdx) {
            const item = state.setupNames.splice(dragIdx, 1)[0];
            state.setupNames.splice(target, 0, item);
          }
          rows.forEach(r => { r.style.transform = ''; r.classList.remove('dragging'); });
          container.classList.remove('reordering');
          render();
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });
    });
  }

  // ── Bidding Phase ──────────────────────────────────────

  function renderBidding() {
    saveStepperScroll();
    const el = document.getElementById('view-bidding');
    const round = state.rounds[state.currentRound];
    const maxBid = round.cardsDealt;
    const totalBids = Game.getTotalBids(state);
    const allSet = Game.allBidsSet(state);
    const canLock = allSet;

    let overUnderHtml = '';
    if (allSet) {
      const d = totalBids - maxBid;
      if (d > 0) overUnderHtml = `<span class="ou over">+${d} over</span>`;
      else if (d < 0) overUnderHtml = `<span class="ou under">${d} under</span>`;
      else overUnderHtml = `<span class="ou even">even</span>`;
    }

    const dealerIdx = Game.getDealerIndex(state);
    const leaderIdx = Game.getLeaderIndex(state);

    el.innerHTML = `
      <div class="view-content">
        ${renderStepper()}
        <div class="number-rows">
          ${state.players.map(p => {
            let role = '';
            if (p.id === state.players[dealerIdx].id) role = 'dealer';
            else if (p.id === state.players[leaderIdx].id) role = 'leads';
            return renderNumberRow(p, maxBid, round.bids[p.id], { field: 'bids', role });
          }).join('')}
        </div>
        <div class="bid-tally">
          Bids: <strong>${totalBids}</strong> / ${maxBid} ${overUnderHtml}
        </div>
        <button id="btn-lock-bids" class="btn-primary" ${canLock ? '' : 'disabled'}>Lock Bids</button>
        ${renderBottomActions()}
      </div>`;

    el.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state = Game.setBid(state, parseInt(e.currentTarget.dataset.player), parseInt(e.currentTarget.dataset.value));
        render();
      });
    });

    document.getElementById('btn-lock-bids').addEventListener('click', () => {
      state = Game.lockBids(state);
      render();
    });

    attachStepperTap();
    attachBottomActions();
    scrollStepperToCurrent();
    setupScrollFade();
  }

  // ── Trick Play ─────────────────────────────────────────

  function renderTrickPlay() {
    saveStepperScroll();
    const el = document.getElementById('view-trick-play');
    const round = state.rounds[state.currentRound];
    const total = round.cardsDealt;
    const awarded = round.trickLog.length;

    el.innerHTML = `
      <div class="view-content">
        ${renderStepper()}
        <div class="phase-info tight">
          <span class="phase-title">Trick ${awarded + 1} of ${total}</span>
        </div>
        <div class="trick-player-list">
          ${state.players.map(p => `
            <button class="trick-player-btn" data-player="${p.id}">
              <span class="trick-player-name">${escapeHtml(p.name)}</span>
              <span class="trick-player-meta">bid ${round.bids[p.id] !== null ? round.bids[p.id] : '?'} \u00B7 got ${round.tricks[p.id]}</span>
            </button>
          `).join('')}
        </div>
        ${awarded > 0 ? `
          <div class="section-label">Trick Log <span class="hint">tap to change</span></div>
          <div class="trick-log">
            ${round.trickLog.map((pid, i) => `
              <button class="trick-log-entry" data-trick-index="${i}">
                <span class="trick-log-num">${i + 1}.</span>
                <span class="trick-log-name">${escapeHtml(state.players.find(p => p.id === pid).name)}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}
        ${renderBottomActions()}
      </div>`;

    el.querySelectorAll('.trick-player-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.currentTarget.classList.add('flash');
        state = Game.awardTrick(state, parseInt(e.currentTarget.dataset.player));
        setTimeout(() => render(), 120);
      });
    });

    el.querySelectorAll('.trick-log-entry').forEach(btn => {
      btn.addEventListener('click', (e) => showReassignOverlay(parseInt(e.currentTarget.dataset.trickIndex)));
    });

    attachStepperTap();
    attachBottomActions();
    scrollStepperToCurrent();
  }

  function showReassignOverlay(trickIndex) {
    removeOverlay();
    const round = state.rounds[state.currentRound];
    const holder = round.trickLog[trickIndex];
    const overlay = createOverlay(`
      <div class="overlay-title">Reassign Trick ${trickIndex + 1}</div>
      <div class="overlay-subtitle">Currently: ${escapeHtml(state.players.find(p => p.id === holder).name)}</div>
      <div class="reassign-list">
        ${state.players.map(p => `
          <button class="reassign-btn${p.id === holder ? ' current' : ''}" data-player="${p.id}">${escapeHtml(p.name)}</button>
        `).join('')}
      </div>
      <button class="btn-secondary overlay-cancel">Cancel</button>
    `);
    overlay.querySelectorAll('.reassign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state = Game.reassignTrick(state, trickIndex, parseInt(e.currentTarget.dataset.player));
        overlay.remove(); render();
      });
    });
  }

  // ── Suit Picker Overlay ────────────────────────────────

  function showSuitPickerOverlay() {
    removeOverlay();
    const round = state.rounds[state.currentRound];
    const overlay = createOverlay(`
      <div class="overlay-title">Select Suit</div>
      <div class="suit-picker-grid">
        ${SUIT_NAMES.map(s => `
          <button class="suit-btn-lg ${s}${round.trumpSuit === s ? ' selected' : ''}" data-suit="${s}">${SUIT_SYMBOLS[s]}</button>
        `).join('')}
      </div>
      ${round.trumpSuit ? `<button class="btn-secondary" id="btn-clear-suit">Clear Suit</button>` : ''}
      <button class="btn-secondary overlay-cancel">Cancel</button>
    `);
    overlay.querySelectorAll('.suit-btn-lg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state = Game.setTrumpSuit(state, e.currentTarget.dataset.suit);
        overlay.remove(); render();
      });
    });
    document.getElementById('btn-clear-suit')?.addEventListener('click', () => {
      state.rounds[state.currentRound].trumpSuit = null;
      overlay.remove(); render();
    });
  }

  // ── Round End ──────────────────────────────────────────

  function renderRoundEnd(editingRoundIndex) {
    const el = document.getElementById('view-round-end');
    const isEditing = editingRoundIndex !== undefined;
    const rIdx = isEditing ? editingRoundIndex : state.currentRound;
    const round = state.rounds[rIdx];

    if (!round.confirmed && !isEditing) renderConfirmation(el, rIdx);
    else if (isEditing) renderEditRound(el, rIdx);
    else renderScoreboard(el);

    showView('roundEnd');
    save();
  }

  function renderConfirmation(el, rIdx) {
    saveStepperScroll();
    const round = state.rounds[rIdx];
    const max = round.cardsDealt;
    const totalTricks = state.players.reduce((sum, p) => sum + round.tricks[p.id], 0);
    const tricksMatch = totalTricks === max;

    el.innerHTML = `
      <div class="view-content">
        ${renderStepper()}
        <div class="phase-info tight"><span class="phase-title">Confirm Tricks</span></div>
        <div class="number-rows">
          ${state.players.map(p => renderNumberRow(p, max, round.tricks[p.id], { bidRef: round.bids[p.id], field: 'tricks' })).join('')}
        </div>
        ${!tricksMatch ? `<div class="trick-warning">Tricks total <strong>${totalTricks}</strong> but this round has <strong>${max}</strong> trick${max !== 1 ? 's' : ''}</div>` : ''}
        <button id="btn-confirm-scores" class="btn-primary" ${tricksMatch ? '' : 'disabled'}>Confirm &amp; Score</button>
        ${renderBottomActions()}
      </div>`;

    el.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        round.tricks[parseInt(e.currentTarget.dataset.player)] = parseInt(e.currentTarget.dataset.value);
        round.trickLog = [];
        state.players.forEach(p => { for (let t = 0; t < round.tricks[p.id]; t++) round.trickLog.push(p.id); });
        renderRoundEnd();
      });
    });

    document.getElementById('btn-confirm-scores').addEventListener('click', () => {
      state = Game.confirmRound(state);
      renderRoundEnd();
    });
    attachStepperTap();
    attachBottomActions();
    scrollStepperToCurrent();
    setupScrollFade();
  }

  function renderScoreboard(el) {
    saveStepperScroll();
    const round = state.rounds[state.currentRound];
    const cum = Game.getCumulativeScores(state);
    const last = state.currentRound >= Game.TOTAL_ROUNDS - 1;

    el.innerHTML = `
      <div class="view-content">
        ${renderStepper()}
        <div class="phase-info tight"><span class="phase-title">Round ${state.currentRound + 1} Scores</span></div>
        <div class="score-table">
          <div class="score-table-header"><span>Player</span><span>Bid</span><span>Got</span><span>Pts</span><span>Total</span></div>
          ${state.players.map(p => {
            const made = round.bids[p.id] === round.tricks[p.id];
            return `<div class="score-table-row ${made ? 'made' : 'missed'}">
              <span class="score-player-name">${escapeHtml(p.name)}</span>
              <span>${round.bids[p.id]}</span><span>${round.tricks[p.id]}</span>
              <span class="score-pts">${round.scores[p.id]}</span>
              <span class="score-total">${cum[p.id]}</span>
            </div>`;
          }).join('')}
        </div>
        <button id="btn-edit-current" class="btn-secondary">Edit This Round</button>
        ${state.currentRound > 0 ? `
          <div class="section-label">Past Rounds <span class="hint">tap to edit</span></div>
          <div class="past-rounds">
            ${state.rounds.slice(0, state.currentRound).map((r, i) =>
              r && r.confirmed ? `<button class="past-round-btn" data-round="${i}"><span class="past-round-num">R${i+1}</span><span class="past-round-cards">${r.cardsDealt}${r.trumpSuit ? ' ' + SUIT_SYMBOLS[r.trumpSuit] : ''}</span></button>` : ''
            ).join('')}
          </div>
        ` : ''}
        <button id="btn-next-round" class="btn-primary">${last ? 'Finish Game' : 'Next Round'}</button>
        ${renderBottomActions()}
      </div>`;

    document.getElementById('btn-edit-current').addEventListener('click', () => {
      renderEditRound(el, state.currentRound);
    });
    el.querySelectorAll('.past-round-btn').forEach(btn =>
      btn.addEventListener('click', (e) => renderEditRound(el, parseInt(e.currentTarget.dataset.round)))
    );
    document.getElementById('btn-next-round').addEventListener('click', () => {
      if (last) { state.phase = 'gameOver'; Storage.saveToHistory(state); render(); }
      else { state = Game.advanceRound(state); render(); }
    });
    attachStepperTap();
    attachBottomActions();
    scrollStepperToCurrent();
  }

  function renderEditRound(el, rIdx) {
    saveStepperScroll();
    const round = state.rounds[rIdx];
    const max = round.cardsDealt;
    if (!el._eo || el._eo.r !== rIdx) el._eo = { r: rIdx, b: { ...round.bids }, t: { ...round.tricks } };

    const totalTricks = state.players.reduce((sum, p) => sum + round.tricks[p.id], 0);
    const tricksMatch = totalTricks === max;

    el.innerHTML = `
      <div class="view-content">
        ${renderStepper()}
        <div class="phase-info tight"><span class="phase-title">Edit Round ${rIdx + 1}</span></div>
        <div class="section-label">Bids</div>
        <div class="number-rows">${state.players.map(p => renderNumberRow(p, max, round.bids[p.id], { field: 'bids' })).join('')}</div>
        <div class="section-label">Tricks</div>
        <div class="number-rows">${state.players.map(p => renderNumberRow(p, max, round.tricks[p.id], { field: 'tricks' })).join('')}</div>
        ${!tricksMatch ? `<div class="trick-warning">Tricks total <strong>${totalTricks}</strong> but this round has <strong>${max}</strong> trick${max !== 1 ? 's' : ''}</div>` : ''}
        <button id="btn-save-edit" class="btn-primary" ${tricksMatch ? '' : 'disabled'}>Save Changes</button>
        <button id="btn-cancel-edit" class="btn-secondary">Cancel</button>
        ${renderBottomActions()}
      </div>`;

    el.querySelectorAll('.num-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        round[e.currentTarget.dataset.field][parseInt(e.currentTarget.dataset.player)] = parseInt(e.currentTarget.dataset.value);
        renderEditRound(el, rIdx);
      });
    });
    document.getElementById('btn-save-edit').addEventListener('click', () => {
      state = Game.editPastRound(state, rIdx, round.bids, round.tricks);
      el._eo = null; renderScoreboard(el);
    });
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      const o = el._eo;
      state.players.forEach(p => { round.bids[p.id] = o.b[p.id]; round.tricks[p.id] = o.t[p.id]; });
      el._eo = null; renderScoreboard(el);
    });
    attachStepperTap();
    attachBottomActions();
    scrollStepperToCurrent();
    setupScrollFade();
  }

  // ── Game Over ──────────────────────────────────────────

  function renderGameOver() {
    const el = document.getElementById('view-game-over');
    const lb = Game.getLeaderboard(state);
    const top = lb[0].totalScore;
    const showStats = el._showStats || false;

    el.innerHTML = `
      <div class="view-content">
        <h1 class="game-over-title">Game Over!</h1>
        <div class="leaderboard">
          ${lb.map((p, i) => {
            const w = p.totalScore === top;
            return `<div class="leaderboard-row${w ? ' winner' : ''}">
              <span class="leaderboard-rank">${i+1}</span>
              <span class="leaderboard-name">${escapeHtml(p.name)}${w ? ' \uD83C\uDFC6' : ''}</span>
              <span class="leaderboard-score">${p.totalScore}</span>
            </div>`;
          }).join('')}
        </div>
        <button id="btn-toggle-stats" class="btn-secondary">${showStats ? 'Hide Stats' : 'Show Stats'}</button>
        ${showStats ? renderStatsTable() : ''}
        <button id="btn-play-again" class="btn-primary">Play Again</button>
      </div>`;

    document.getElementById('btn-toggle-stats').addEventListener('click', () => { el._showStats = !el._showStats; renderGameOver(); });
    document.getElementById('btn-play-again').addEventListener('click', () => {
      const names = state.players.map(p => p.name);
      Storage.clearGame(); lastStepperRound = -1; showSetup(names);
    });
  }

  function renderStatsTable() {
    let h = '<div class="stats-table-wrapper"><table class="stats-table"><thead><tr><th>Rnd</th>';
    state.players.forEach(p => { h += `<th>${escapeHtml(p.name)}</th>`; });
    h += '</tr></thead><tbody>';
    state.rounds.forEach((r, i) => {
      if (!r || !r.confirmed) return;
      h += `<tr><td class="stats-round-num">${i+1}</td>`;
      state.players.forEach(p => {
        const m = r.bids[p.id] === r.tricks[p.id];
        h += `<td class="${m?'made':'missed'}"><span class="stats-bid">${r.bids[p.id]}/${r.tricks[p.id]}</span><span class="stats-pts">${r.scores[p.id]}</span></td>`;
      });
      h += '</tr>';
    });
    const c = Game.getCumulativeScores(state);
    h += '<tr class="stats-total-row"><td><strong>Tot</strong></td>';
    state.players.forEach(p => { h += `<td><strong>${c[p.id]}</strong></td>`; });
    h += '</tr></tbody></table></div>';
    return h;
  }

  // ── Overlays ───────────────────────────────────────────

  function removeOverlay() { document.querySelector('.overlay')?.remove(); }

  function createOverlay(html) {
    removeOverlay();
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="overlay-content">${html}</div>`;
    o.querySelector('.overlay-cancel')?.addEventListener('click', () => o.remove());
    o.addEventListener('click', (e) => { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
    return o;
  }

  function showResetOverlay() {
    const o = createOverlay(`
      <div class="overlay-title">Reset Game?</div>
      <div class="overlay-subtitle">Current progress will be lost.</div>
      <button id="overlay-reset-yes" class="btn-primary btn-danger">New Game</button>
      <button class="btn-secondary overlay-cancel">Cancel</button>
    `);
    document.getElementById('overlay-reset-yes').addEventListener('click', () => {
      const names = state.players.map(p => p.name);
      Storage.clearGame(); o.remove(); lastStepperRound = -1; showSetup(names);
    });
  }

  function showLeaderboardOverlay() {
    const lb = Game.getLeaderboard(state);
    createOverlay(`
      <div class="overlay-title">Scores</div>
      <div class="leaderboard overlay-leaderboard">
        ${lb.map((p, i) => `<div class="leaderboard-row"><span class="leaderboard-rank">${i+1}</span><span class="leaderboard-name">${escapeHtml(p.name)}</span><span class="leaderboard-score">${p.totalScore}</span></div>`).join('')}
      </div>
      <button class="btn-secondary overlay-cancel">Close</button>
    `);
  }

  // ── Helpers ────────────────────────────────────────────

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escapeAttr(s) { return s.replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  document.addEventListener('DOMContentLoaded', init);
  return { init, showSetup };
})();
