/**
 * Chess Legend - Pro Analysis & Interactive Trainer
 * Version: 3.0
 */

'use strict';

(function() {
  // ============ CONFIG & STATE ============
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
    history: [], // [{fen, move, score, classification}]
    board: null,
    engine: null,
    isEngineReady: false,
    activeTab: 'analysis',
    boardFlipped: false,
    // Interactive Features
    trainingMode: null, // 'opening', 'puzzle', 'endgame'
    targetMove: null,
    currentTrainingData: null
  };

  const elements = {
    mainBoard: document.getElementById('mainBoard'),
    gameList: document.getElementById('gameList'),
    moveHistory: document.getElementById('moveHistory'),
    evalBarFill: document.getElementById('evalBarFill'),
    evalBarText: document.getElementById('evalBarText'),
    engineFeedback: document.getElementById('engineFeedback'),
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    loginPanel: document.getElementById('loginPanel'),
    mainDashboard: document.getElementById('mainDashboard'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    openingsGrid: document.getElementById('openingsGrid'),
    endgamesGrid: document.getElementById('endgamesGrid'),
    puzzlesContainer: document.getElementById('puzzlesContainer')
  };

  // ============ INITIALIZATION ============
  function init() {
    elements.fetchBtn.addEventListener('click', startApp);
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    initEngine();
    setupGlobalControls();
  }

  function setupGlobalControls() {
    document.getElementById('prevMove').addEventListener('click', () => navigateHistory(-1));
    document.getElementById('nextMove').addEventListener('click', () => navigateHistory(1));
    document.getElementById('firstMove').addEventListener('click', () => navigateHistory(-999));
    document.getElementById('lastMove').addEventListener('click', () => navigateHistory(999));
    document.getElementById('flipBoard').addEventListener('click', () => {
      state.boardFlipped = !state.boardFlipped;
      renderBoard();
    });
  }

  // ============ ENGINE LOGIC ============
  function initEngine() {
    if (state.engine) state.engine.terminate();
    state.engine = new Worker(CONFIG.STOCKFISH_PATH + '?v=' + Date.now());
    state.engine.onmessage = (e) => {
      if (e.data === 'uciok') state.engine.postMessage('isready');
      if (e.data === 'readyok') state.isEngineReady = true;
      handleEngineOutput(e.data);
    };
    state.engine.postMessage('uci');
  }

  function handleEngineOutput(msg) {
    if (msg.includes('score cp') || msg.includes('score mate')) {
      const score = parseScore(msg);
      updateEvalBar(score);
    }
    if (msg.startsWith('bestmove')) {
      const best = msg.split(' ')[1];
      state.currentBestMove = best;
    }
  }

  function parseScore(msg) {
    if (msg.includes('score cp')) {
      return (parseInt(msg.split('cp ')[1]) / 100).toFixed(1);
    } else {
      const mate = parseInt(msg.split('mate ')[1]);
      return 'M' + Math.abs(mate);
    }
  }

  // ============ APP FLOW ============
  async function startApp() {
    const user = elements.usernameInput.value.trim();
    if (!user) return;
    state.username = user;
    
    toggleStatus(true, 'جاري جلب مبارياتك من Chess.com...');
    try {
      const res = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`);
      const archives = (await res.json()).archives;
      const lastArchive = archives[archives.length - 1];
      
      const gamesRes = await fetch(lastArchive);
      state.games = (await gamesRes.json()).games.slice(-CONFIG.MAX_GAMES).reverse();
      
      renderGameList();
      elements.loginPanel.classList.add('hidden');
      elements.mainDashboard.classList.remove('hidden');
      toggleStatus(false);
      
      if (state.games.length > 0) selectGame(0);
      prepareTrainingFeatures();
    } catch (e) {
      console.error(e);
      toggleStatus(true, 'خطأ في جلب البيانات. تأكد من اسم المستخدم.');
    }
  }

  function toggleStatus(show, text = '') {
    const bar = document.getElementById('statusBar');
    const txt = document.getElementById('statusText');
    if (show) {
      bar.classList.remove('hidden');
      txt.textContent = text;
    } else {
      bar.classList.add('hidden');
    }
  }

  // ============ GAME ANALYSIS ============
  window.selectGame = async (index) => {
    state.currentGame = state.games[index];
    const chess = new Chess();
    chess.load_pgn(state.currentGame.pgn);
    
    state.history = [{ fen: chess.fen(), move: 'البداية', score: 0, classification: 'book' }];
    const moves = chess.history({ verbose: true });
    
    const analysisChess = new Chess();
    state.history = [{ fen: analysisChess.fen(), move: 'Start', score: 0, classification: 'book' }];
    
    for (let m of moves) {
      analysisChess.move(m);
      state.history.push({
        fen: analysisChess.fen(),
        move: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        score: 0,
        classification: 'good' // سيتم تحديثه لاحقاً بالتحليل العميق
      });
    }
    
    state.currentMoveIndex = state.history.length - 1;
    renderGameList();
    renderMoveHistory();
    renderBoard();
    analyzePosition();
  };

  function classifyMove(prevScore, currentScore, isBest) {
    const diff = Math.abs(prevScore - currentScore);
    if (isBest) return 'best';
    if (diff < 0.2) return 'excellent';
    if (diff < 0.5) return 'good';
    if (diff < 1.0) return 'inaccuracy';
    if (diff < 2.0) return 'mistake';
    return 'blunder';
  }

  // ============ UI RENDERING ============
  function renderGameList() {
    elements.gameList.innerHTML = state.games.map((g, i) => `
      <div class="game-card ${state.currentGame === g ? 'active' : ''}" onclick="window.selectGame(${i})">
        <strong>${g.white.username} vs ${g.black.username}</strong>
        <div style="font-size: 0.75rem; color: var(--text-dim)">${new Date(g.end_time * 1000).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  function renderMoveHistory() {
    let html = '<div class="move-list">';
    for (let i = 1; i < state.history.length; i++) {
      if (i % 2 !== 0) html += `<div class="move-num">${Math.floor(i/2) + 1}.</div>`;
      const m = state.history[i];
      const activeClass = state.currentMoveIndex === i ? 'active' : '';
      const badgeClass = `badge-${m.classification}`;
      html += `
        <div class="move-val ${activeClass}" onclick="window.goToMove(${i})">
          ${m.move}
          <span class="move-eval-icon ${badgeClass}">${getEvalIcon(m.classification)}</span>
        </div>
      `;
    }
    html += '</div>';
    elements.moveHistory.innerHTML = html;
  }

  function getEvalIcon(cls) {
    const icons = { brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '○', inaccuracy: '?!', mistake: '?', blunder: '??', book: '📖' };
    return icons[cls] || '';
  }

  window.goToMove = (index) => {
    state.currentMoveIndex = index;
    renderBoard();
    renderMoveHistory();
    analyzePosition();
  };

  function navigateHistory(dir) {
    let n = state.currentMoveIndex + dir;
    if (n < 0) n = 0;
    if (n >= state.history.length) n = state.history.length - 1;
    window.goToMove(n);
  }

  function renderBoard() {
    const fen = state.history[state.currentMoveIndex].fen;
    const position = fen.split(' ')[0];
    const rows = position.split('/');
    elements.mainBoard.innerHTML = '';
    
    let boardArr = [];
    for (let row of rows) {
      let r = [];
      for (let c of row) {
        if (isNaN(c)) r.push(c);
        else for (let i=0; i<parseInt(c); i++) r.push(null);
      }
      boardArr.push(r);
    }

    for (let i = 0; i < 8; i++) {
      const r = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const c = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        square.className = `square ${(r+c)%2===0?'light':'dark'}`;
        square.dataset.pos = getSquareName(r, c);
        
        const piece = boardArr[r][c];
        if (piece) {
          const img = document.createElement('img');
          img.src = getPieceImg(piece);
          img.className = 'piece';
          img.draggable = true;
          img.dataset.from = square.dataset.pos;
          img.addEventListener('dragstart', handleDragStart);
          square.appendChild(img);
        }
        
        square.addEventListener('dragover', e => e.preventDefault());
        square.addEventListener('drop', handleDrop);
        elements.mainBoard.appendChild(square);
      }
    }
    
    // إضافة تظليل لآخر نقلة
    if (state.currentMoveIndex > 0) {
      const lastMove = state.history[state.currentMoveIndex].uci;
      if (lastMove) {
        const from = lastMove.substring(0, 2);
        const to = lastMove.substring(2, 4);
        highlightSquare(from);
        highlightSquare(to);
      }
    }
  }

  function highlightSquare(pos) {
    const sq = document.querySelector(`[data-pos="${pos}"]`);
    if (sq) sq.classList.add('last-move');
  }

  function getSquareName(r, c) { return String.fromCharCode(97 + c) + (8 - r); }
  function getPieceImg(p) {
    const color = p === p.toUpperCase() ? 'w' : 'b';
    const type = p.toLowerCase();
    const map = {p:'P', r:'R', n:'N', b:'B', q:'Q', k:'K'};
    return `https://lichess1.org/assets/piece/cburnett/${color}${map[type]}.svg`;
  }

  // ============ INTERACTIVE DRAG & DROP ============
  let draggedPieceFrom = null;
  function handleDragStart(e) { draggedPieceFrom = e.target.dataset.from; }
  function handleDrop(e) {
    const to = e.currentTarget.dataset.pos;
    const from = draggedPieceFrom;
    if (from === to) return;
    
    const chess = new Chess(state.history[state.currentMoveIndex].fen);
    const move = chess.move({ from, to, promotion: 'q' });
    
    if (move) {
      if (state.trainingMode) {
        handleTrainingMove(move);
      } else {
        // إضافة نقلة جديدة للتحليل اليدوي
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
        analyzePosition();
      }
    }
  }

  // ============ TRAINING FEATURES ============
  function prepareTrainingFeatures() {
    // استخراج الافتتاحيات
    const openings = [
      { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', target: 'a6', desc: 'هذه هي نقلة Morphy الدفاعية، الأكثر شيوعاً.' },
      { name: 'Sicilian Defense', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2', target: 'Nf3', desc: 'تطوير الحصان للسيطرة على الوسط والتحضير لـ d4.' }
    ];
    
    elements.openingsGrid.innerHTML = openings.map((o, i) => `
      <div class="feature-card">
        <h3>${o.name}</h3>
        <p>${o.desc}</p>
        <button class="btn" onclick="window.startTraining('opening', ${i})">تدرب الآن</button>
      </div>
    `).join('');

    // استخراج النهايات
    const endgames = [
      { name: 'نهاية ملك ورخ', fen: '8/8/8/8/8/2k5/2r5/4K3 w - - 0 1', target: 'Kf1', desc: 'تعلم كيف تحافظ على التعادل أو تمنع المات.' }
    ];
    
    elements.endgamesGrid.innerHTML = endgames.map((e, i) => `
      <div class="feature-card">
        <h3>${e.name}</h3>
        <p>${e.desc}</p>
        <button class="btn" onclick="window.startTraining('endgame', ${i})">ابدأ التدريب</button>
      </div>
    `).join('');
  }

  window.startTraining = (type, index) => {
    state.trainingMode = type;
    const data = type === 'opening' ? [
      { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', target: 'a6' },
      { name: 'Sicilian Defense', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2', target: 'Nf3' }
    ][index] : [
      { name: 'نهاية ملك ورخ', fen: '8/8/8/8/8/2k5/2r5/4K3 w - - 0 1', target: 'Kf1' }
    ][index];
    
    state.currentTrainingData = data;
    state.history = [{ fen: data.fen, move: 'تدريب', score: 0, classification: 'book' }];
    state.currentMoveIndex = 0;
    switchTab('analysis');
    renderBoard();
    elements.engineFeedback.innerHTML = `<div class="feedback-box info">الهدف: ابحث عن النقلة الصحيحة في وضع ${data.name}</div>`;
  };

  function handleTrainingMove(move) {
    const uci = move.from + move.to;
    if (uci === state.currentTrainingData.target || move.san === state.currentTrainingData.target) {
      elements.engineFeedback.innerHTML = `<div class="feedback-box feedback-success">أحسنت! هذه هي النقلة الصحيحة.</div>`;
    } else {
      elements.engineFeedback.innerHTML = `<div class="feedback-box feedback-error">نقلة خاطئة. حاول مرة أخرى أو ابحث عن النقلة الأفضل.</div>`;
      setTimeout(() => navigateHistory(0), 1000);
    }
  }

  // ============ UTILS ============
  function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    elements.tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId + 'Tab'));
  }

  function updateEvalBar(score) {
    let val = parseFloat(score);
    if (isNaN(val)) val = score.startsWith('M') ? 10 : -10;
    const percent = Math.max(5, Math.min(95, 50 + (val * 10)));
    elements.evalBarFill.style.height = `${percent}%`;
    elements.evalBarText.textContent = score;
  }

  function analyzePosition() {
    if (!state.isEngineReady) return;
    const fen = state.history[state.currentMoveIndex].fen;
    state.engine.postMessage(`position fen ${fen}`);
    state.engine.postMessage(`go depth ${CONFIG.DEPTH}`);
  }

  init();
})();
