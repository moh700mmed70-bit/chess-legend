/**
 * Chess Legend v6.0 - Precision Engine
 */

'use strict';

(function() {
  const CONFIG = {
    STOCKFISH_PATH: 'stockfish.js',
    DEPTH: 16,
    MAX_GAMES: 10
  };

  const state = {
    username: '',
    games: [],
    currentGame: null,
    currentMoveIndex: 0,
    history: [], // {fen, move, uci, score, classification}
    engine: null,
    isEngineReady: false,
    activeTab: 'analysis',
    boardFlipped: false,
    // Training
    trainingMode: null,
    trainingData: null,
    trainingChess: new Chess(),
    draggedFrom: null,
    bestMove: null
  };

  const elements = {
    mainBoard: document.getElementById('mainBoard'),
    gameList: document.getElementById('gameList'),
    moveHistory: document.getElementById('moveHistory'),
    evalFill: document.getElementById('evalFill'),
    evalText: document.getElementById('evalText'),
    feedbackArea: document.getElementById('feedbackArea'),
    loginPanel: document.getElementById('loginPanel'),
    mainDashboard: document.getElementById('mainDashboard'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-content-panel'),
    openingsList: document.getElementById('openingsList'),
    puzzlesList: document.getElementById('puzzlesList'),
    endgamesList: document.getElementById('endgamesList'),
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText')
  };

  // ============ INITIALIZATION ============
  function init() {
    elements.fetchBtn.addEventListener('click', startApp);
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    document.getElementById('prevMove').addEventListener('click', () => navigate(-1));
    document.getElementById('nextMove').addEventListener('click', () => navigate(1));
    document.getElementById('firstMove').addEventListener('click', () => navigate(-999));
    document.getElementById('lastMove').addEventListener('click', () => navigate(999));
    document.getElementById('flipBoard').addEventListener('click', () => {
      state.boardFlipped = !state.boardFlipped;
      renderBoard();
    });

    initEngine();
  }

  function initEngine() {
    if (state.engine) state.engine.terminate();
    state.engine = new Worker(CONFIG.STOCKFISH_PATH + '?v=' + Date.now());
    state.engine.onmessage = (e) => {
      const msg = e.data;
      if (msg === 'uciok') state.engine.postMessage('isready');
      if (msg === 'readyok') state.isEngineReady = true;
      handleEngineMsg(msg);
    };
    state.engine.postMessage('uci');
  }

  function handleEngineMsg(msg) {
    if (msg.includes('score cp') || msg.includes('score mate')) {
      const score = parseScore(msg);
      updateEvalUI(score);
      if (!state.trainingMode) updateMoveClassification(score);
    }
    if (msg.startsWith('bestmove')) {
      state.bestMove = msg.split(' ')[1];
    }
  }

  function parseScore(msg) {
    if (msg.includes('score cp')) return (parseInt(msg.split('cp ')[1]) / 100).toFixed(1);
    const mate = parseInt(msg.split('mate ')[1]);
    return 'M' + Math.abs(mate);
  }

  // ============ APP FLOW ============
  async function startApp() {
    const user = elements.usernameInput.value.trim();
    if (!user) return;
    state.username = user;
    
    toggleStatus(true, 'جاري جلب بياناتك من Chess.com...');
    try {
      const res = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`);
      const archives = (await res.json()).archives;
      const gamesRes = await fetch(archives[archives.length - 1]);
      state.games = (await gamesRes.json()).games.slice(-CONFIG.MAX_GAMES).reverse();
      
      elements.loginPanel.classList.add('hidden');
      elements.mainDashboard.classList.remove('hidden');
      toggleStatus(false);
      
      renderGameList();
      if (state.games.length > 0) selectGame(0);
      populateTraining();
    } catch (e) {
      toggleStatus(true, 'حدث خطأ. يرجى التأكد من اسم المستخدم.');
    }
  }

  function toggleStatus(show, text = '') {
    elements.statusBar.classList.toggle('hidden', !show);
    elements.statusText.textContent = text;
  }

  // ============ ANALYSIS SYSTEM ============
  window.selectGame = (index) => {
    state.currentGame = state.games[index];
    state.trainingMode = null;
    elements.feedbackArea.innerHTML = '';
    
    const chess = new Chess();
    chess.load_pgn(state.currentGame.pgn);
    const moves = chess.history({ verbose: true });
    
    const temp = new Chess();
    state.history = [{ fen: temp.fen(), move: 'Start', uci: '', score: 0, classification: 'book' }];
    
    for (let m of moves) {
      temp.move(m);
      state.history.push({
        fen: temp.fen(),
        move: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        score: 0,
        classification: 'good'
      });
    }
    
    state.currentMoveIndex = state.history.length - 1;
    renderGameList();
    renderMoveHistory();
    renderBoard();
    analyze();
  };

  function renderGameList() {
    elements.gameList.innerHTML = state.games.map((g, i) => `
      <div class="game-card ${state.currentGame === g ? 'active' : ''}" onclick="window.selectGame(${i})">
        <strong>${g.white.username} vs ${g.black.username}</strong>
        <div style="font-size: 0.7rem; color: var(--text-dim)">${new Date(g.end_time * 1000).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  function renderMoveHistory() {
    let html = '<div class="move-list">';
    for (let i = 1; i < state.history.length; i++) {
      if (i % 2 !== 0) html += `<div class="move-num">${Math.floor(i/2) + 1}</div>`;
      const m = state.history[i];
      const active = state.currentMoveIndex === i ? 'active' : '';
      html += `
        <div class="move-val ${active}" onclick="window.goTo(${i})">
          ${m.move}
          <span class="badge badge-${m.classification}">${getIcon(m.classification)}</span>
        </div>
      `;
    }
    html += '</div>';
    elements.moveHistory.innerHTML = html;
  }

  function getIcon(cls) {
    const icons = { brilliant: '!!', best: '★', blunder: '??', good: '✓', book: '📖' };
    return icons[cls] || '';
  }

  window.goTo = (i) => {
    state.currentMoveIndex = i;
    renderBoard();
    renderMoveHistory();
    analyze();
  };

  function navigate(dir) {
    let n = state.currentMoveIndex + dir;
    if (n < 0) n = 0;
    if (n >= state.history.length) n = state.history.length - 1;
    window.goTo(n);
  }

  // ============ THE ROCK SOLID BOARD ============
  function renderBoard() {
    const fen = state.trainingMode ? state.trainingChess.fen() : state.history[state.currentMoveIndex].fen;
    const pos = fen.split(' ')[0];
    const rows = pos.split('/');
    elements.mainBoard.innerHTML = '';
    
    let board = [];
    for (let row of rows) {
      let r = [];
      for (let c of row) {
        if (isNaN(c)) r.push(c);
        else for (let i=0; i<parseInt(c); i++) r.push(null);
      }
      board.push(r);
    }

    for (let i = 0; i < 8; i++) {
      const r = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const c = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        square.className = `square ${(r+c)%2===0?'light':'dark'}`;
        square.dataset.pos = getSqName(r, c);
        
        const piece = board[r][c];
        if (piece) {
          const img = document.createElement('img');
          img.src = getPieceImg(piece);
          img.className = 'piece';
          img.draggable = true;
          img.dataset.from = square.dataset.pos;
          img.addEventListener('dragstart', (e) => state.draggedFrom = e.target.dataset.from);
          square.appendChild(img);
        }
        
        square.addEventListener('dragover', e => e.preventDefault());
        square.addEventListener('drop', handleDrop);
        elements.mainBoard.appendChild(square);
      }
    }
    
    if (!state.trainingMode && state.currentMoveIndex > 0) {
      const uci = state.history[state.currentMoveIndex].uci;
      if (uci) {
        highlight(uci.substring(0,2));
        highlight(uci.substring(2,4));
      }
    }
  }

  function handleDrop(e) {
    const to = e.currentTarget.dataset.pos;
    const from = state.draggedFrom;
    if (!from || from === to) return;
    
    const chess = state.trainingMode ? state.trainingChess : new Chess(state.history[state.currentMoveIndex].fen);
    const move = chess.move({ from, to, promotion: 'q' });
    
    if (move) {
      if (state.trainingMode) {
        handleTrainingMove(move);
      } else {
        state.history = state.history.slice(0, state.currentMoveIndex + 1);
        state.history.push({
          fen: chess.fen(),
          move: move.san,
          uci: from + to + (move.promotion || ''),
          score: 0,
          classification: 'good'
        });
        state.currentMoveIndex++;
        renderBoard();
        renderMoveHistory();
        analyze();
      }
    }
  }

  function highlight(pos, cls = 'last-move') {
    const sq = document.querySelector(`[data-pos="${pos}"]`);
    if (sq) sq.classList.add(cls);
  }

  function getSqName(r, c) { return String.fromCharCode(97 + c) + (8 - r); }
  function getPieceImg(p) {
    const color = p === p.toUpperCase() ? 'w' : 'b';
    const type = p.toLowerCase();
    const map = {p:'P', r:'R', n:'N', b:'B', q:'Q', k:'K'};
    return `https://lichess1.org/assets/piece/cburnett/${color}${map[type]}.svg`;
  }

  // ============ TRAINING SYSTEM ============
  function populateTraining() {
    const data = {
      openings: [
        { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', target: 'a6', desc: 'دفاع مورفي الكلاسيكي.' },
        { name: 'Sicilian', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2', target: 'Nf3', desc: 'تطوير الحصان للسيطرة.' }
      ],
      puzzles: [
        { name: 'كش مات في نقلة', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', target: 'Qxf7#', desc: 'أنهِ المباراة فوراً.' }
      ],
      endgames: [
        { name: 'نهاية ملك ورخ', fen: '8/8/8/8/8/2k5/2r5/4K3 w - - 0 1', target: 'Kf1', desc: 'حافظ على التعادل.' }
      ]
    };

    elements.openingsList.innerHTML = data.openings.map((o, i) => renderCard(o, 'opening', i)).join('');
    elements.puzzlesList.innerHTML = data.puzzles.map((p, i) => renderCard(p, 'puzzle', i)).join('');
    elements.endgamesList.innerHTML = data.endgames.map((e, i) => renderCard(e, 'endgame', i)).join('');
  }

  function renderCard(item, type, index) {
    return `
      <div class="game-card">
        <strong>${item.name}</strong>
        <p style="font-size:0.8rem; color:var(--text-dim)">${item.desc}</p>
        <button class="btn" style="width:100%; margin-top:10px;" onclick="window.startTrain('${type}', ${index})">ابدأ التدريب</button>
      </div>
    `;
  }

  window.startTrain = (type, index) => {
    state.trainingMode = type;
    const pool = type === 'opening' ? [
      { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', target: 'a6' },
      { name: 'Sicilian', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2', target: 'Nf3' }
    ] : type === 'puzzle' ? [
      { name: 'كش مات في نقلة', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', target: 'Qxf7#' }
    ] : [
      { name: 'نهاية ملك ورخ', fen: '8/8/8/8/8/2k5/2r5/4K3 w - - 0 1', target: 'Kf1' }
    ];
    
    state.trainingData = pool[index];
    state.trainingChess = new Chess(state.trainingData.fen);
    switchTab('analysis');
    renderBoard();
    elements.feedbackArea.innerHTML = `<div class="msg-box">الهدف: ابحث عن النقلة الصحيحة في وضع ${state.trainingData.name}</div>`;
  };

  function handleTrainingMove(move) {
    const uci = move.from + move.to;
    const isCorrect = (uci === state.trainingData.target || move.san === state.trainingData.target);
    
    renderBoard();
    if (isCorrect) {
      highlight(move.to, 'correct');
      elements.feedbackArea.innerHTML = `
        <div class="msg-box msg-success">أحسنت! هذه هي النقلة الصحيحة.</div>
        <button class="btn btn-secondary" style="width:100%" onclick="window.resetTraining()">إعادة المحاولة</button>
      `;
    } else {
      highlight(move.to, 'wrong');
      elements.feedbackArea.innerHTML = `
        <div class="msg-box msg-error">نقلة خاطئة. حاول مرة أخرى.</div>
        <button class="btn btn-secondary" style="width:100%" onclick="window.resetTraining()">إعادة المحاولة</button>
      `;
      setTimeout(() => {
        state.trainingChess.undo();
        renderBoard();
      }, 1000);
    }
  }

  window.resetTraining = () => {
    state.trainingChess = new Chess(state.trainingData.fen);
    renderBoard();
    elements.feedbackArea.innerHTML = `<div class="msg-box">الهدف: ابحث عن النقلة الصحيحة في وضع ${state.trainingData.name}</div>`;
  };

  // ============ ANALYZER & CLASSIFICATION ============
  function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    elements.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId + 'Panel');
    });
  }

  function updateEvalUI(score) {
    elements.evalText.textContent = score;
    let val = parseFloat(score);
    if (isNaN(val)) val = score.startsWith('M') ? 10 : -10;
    const h = Math.max(5, Math.min(95, 50 + (val * 10)));
    elements.evalFill.style.height = `${h}%`;
  }

  function updateMoveClassification(score) {
    if (state.currentMoveIndex === 0) return;
    const prevScore = parseFloat(state.history[state.currentMoveIndex-1].score) || 0;
    const currentScore = parseFloat(score) || 0;
    const diff = Math.abs(currentScore - prevScore);
    
    let cls = 'good';
    if (diff < 0.2) cls = 'best';
    else if (diff > 2.0) cls = 'blunder';
    else if (diff < 0.1 && Math.abs(currentScore) > 2.0) cls = 'brilliant';
    
    state.history[state.currentMoveIndex].score = score;
    state.history[state.currentMoveIndex].classification = cls;
    renderMoveHistory();
  }

  function analyze() {
    if (!state.isEngineReady || state.trainingMode) return;
    const fen = state.history[state.currentMoveIndex].fen;
    state.engine.postMessage(`position fen ${fen}`);
    state.engine.postMessage(`go depth ${CONFIG.DEPTH}`);
  }

  init();
})();
