/**
 * Chess Legend - Professional Analysis & Training Platform
 * Version: 2.0
 */

'use strict';

(function() {
  // ============ CONFIG & STATE ============
  const CONFIG = {
    STOCKFISH_PATH: 'stockfish.js',
    MAX_GAMES: 10,
    DEPTH_DEFAULT: 14
  };

  const state = {
    username: '',
    games: [],
    currentGameIndex: -1,
    currentMoveIndex: -1,
    analysisData: [], // التقييمات لكل نقلة في المباراة الحالية
    puzzles: [],
    openings: [],
    endgames: [],
    game: new Chess(),
    engine: null,
    isEngineReady: false,
    boardFlipped: false,
    activeTab: 'analysis'
  };

  // ============ DOM ELEMENTS ============
  const elements = {
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    depthSelect: document.getElementById('depthSelect'),
    loginPanel: document.getElementById('loginPanel'),
    mainDashboard: document.getElementById('mainDashboard'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    gameList: document.getElementById('gameList'),
    mainBoard: document.getElementById('mainBoard'),
    moveHistory: document.getElementById('moveHistory'),
    engineFeedback: document.getElementById('engineFeedback'),
    evalBadge: document.getElementById('evalBadge'),
    gameInfo: document.getElementById('gameInfo'),
    // Controls
    prevMove: document.getElementById('prevMove'),
    nextMove: document.getElementById('nextMove'),
    firstMove: document.getElementById('firstMove'),
    lastMove: document.getElementById('lastMove'),
    flipBoard: document.getElementById('flipBoard'),
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    // Feature Grids
    openingsGrid: document.getElementById('openingsGrid'),
    endgamesGrid: document.getElementById('endgamesGrid')
  };

  // ============ INITIALIZATION ============
  function init() {
    elements.fetchBtn.addEventListener('click', startAnalysis);
    
    // Tab Switching
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Board Navigation
    elements.prevMove.addEventListener('click', () => navigateMove(-1));
    elements.nextMove.addEventListener('click', () => navigateMove(1));
    elements.firstMove.addEventListener('click', () => navigateMove(-999));
    elements.lastMove.addEventListener('click', () => navigateMove(999));
    elements.flipBoard.addEventListener('click', () => {
      state.boardFlipped = !state.boardFlipped;
      renderBoard();
    });

    initEngine();
  }

  // ============ ENGINE LOGIC ============
  function initEngine() {
    if (state.engine) state.engine.terminate();
    const url = CONFIG.STOCKFISH_PATH + '?v=' + Date.now();
    state.engine = new Worker(url);
    
    state.engine.onmessage = (e) => {
      const msg = e.data;
      if (msg === 'uciok') state.engine.postMessage('isready');
      if (msg === 'readyok') state.isEngineReady = true;
      handleEngineMessage(msg);
    };
    state.engine.postMessage('uci');
  }

  function handleEngineMessage(msg) {
    // معالجة رسائل المحرك للتقييم الحي
    if (msg.includes('score cp') || msg.includes('score mate')) {
      const score = parseScore(msg);
      updateEvalUI(score);
    }
    if (msg.startsWith('bestmove')) {
      const bestMove = msg.split(' ')[1];
      updateBestMoveUI(bestMove);
    }
  }

  function parseScore(msg) {
    if (msg.includes('score cp')) {
      const cp = parseInt(msg.split('cp ')[1]);
      return (cp / 100).toFixed(1);
    } else {
      const mate = parseInt(msg.split('mate ')[1]);
      return 'M' + Math.abs(mate);
    }
  }

  // ============ DATA FETCHING ============
  async function startAnalysis() {
    const user = elements.usernameInput.value.trim();
    if (!user) return;
    state.username = user;
    
    showStatus('جاري جلب المباريات والتحليل...');
    try {
      const res = await fetch(`https://api.chess.com/pub/player/${user}/games/archives`);
      const data = await res.json();
      const lastMonth = data.archives[data.archives.length - 1];
      
      const gamesRes = await fetch(lastMonth);
      const gamesData = await gamesRes.json();
      state.games = gamesData.games.slice(-CONFIG.MAX_GAMES).reverse();
      
      renderGameList();
      elements.loginPanel.classList.add('hidden');
      elements.mainDashboard.classList.remove('hidden');
      hideStatus();
      
      // تحليل تلقائي لأول مباراة
      if (state.games.length > 0) selectGame(0);
      
      // استخراج الافتتاحيات والنهايات (محاكاة ذكية)
      extractFeatures();
    } catch (err) {
      console.error(err);
      hideStatus();
    }
  }

  function showStatus(text) {
    elements.statusText.textContent = text;
    elements.statusBar.classList.remove('hidden');
  }

  function hideStatus() {
    elements.statusBar.classList.add('hidden');
  }

  // ============ UI RENDERING ============
  function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    elements.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId + 'Tab');
    });
  }

  function renderGameList() {
    elements.gameList.innerHTML = state.games.map((g, i) => `
      <div class="game-item ${state.currentGameIndex === i ? 'active' : ''}" onclick="window.selectGame(${i})">
        <strong>${g.white.username} vs ${g.black.username}</strong>
        <div style="font-size: 0.8rem; color: var(--text-dim)">${g.white.result === 'win' ? 'فوز الأبيض' : 'فوز الأسود'}</div>
      </div>
    `).join('');
  }

  window.selectGame = (index) => {
    state.currentGameIndex = index;
    const gameData = state.games[index];
    state.game.load_pgn(gameData.pgn);
    state.currentMoveIndex = state.game.history().length;
    
    elements.gameInfo.textContent = `${gameData.white.username} ⚔️ ${gameData.black.username}`;
    renderGameList();
    renderMoveHistory();
    renderBoard();
    analyzeCurrentPosition();
  };

  function renderMoveHistory() {
    const history = state.game.history();
    elements.moveHistory.innerHTML = history.map((m, i) => `
      <span class="move-node ${state.currentMoveIndex === i + 1 ? 'active' : ''}" onclick="window.goToMove(${i + 1})">
        ${Math.floor(i/2) + 1}${i%2===0?'.':'...'} ${m}
      </span>
    `).join('');
  }

  window.goToMove = (index) => {
    state.currentMoveIndex = index;
    const history = state.game.history();
    const tempGame = new Chess();
    for (let i = 0; i < index; i++) tempGame.move(history[i]);
    
    // تحديث رقعة العرض دون تغيير المباراة الأصلية في الذاكرة
    renderBoardAt(tempGame.fen());
    renderMoveHistory();
    analyzePosition(tempGame.fen());
  };

  function navigateMove(dir) {
    let newIdx = state.currentMoveIndex + dir;
    const max = state.game.history().length;
    if (newIdx < 0) newIdx = 0;
    if (newIdx > max) newIdx = max;
    window.goToMove(newIdx);
  }

  function renderBoard() {
    const history = state.game.history();
    const tempGame = new Chess();
    for (let i = 0; i < state.currentMoveIndex; i++) tempGame.move(history[i]);
    renderBoardAt(tempGame.fen());
  }

  function renderBoardAt(fen) {
    elements.mainBoard.innerHTML = '';
    const position = fen.split(' ')[0];
    const rows = position.split('/');
    
    let boardArray = [];
    for (let row of rows) {
      let rowArr = [];
      for (let char of row) {
        if (isNaN(char)) rowArr.push(char);
        else for (let i=0; i<parseInt(char); i++) rowArr.push(null);
      }
      boardArray.push(rowArr);
    }

    for (let i = 0; i < 8; i++) {
      const r = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const c = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        square.className = `square ${(r+c)%2===0?'light':'dark'}`;
        
        const piece = boardArray[r][c];
        if (piece) {
          const img = document.createElement('img');
          img.src = getPieceImg(piece);
          img.className = 'piece';
          square.appendChild(img);
        }
        elements.mainBoard.appendChild(square);
      }
    }
  }

  function getPieceImg(p) {
    const color = p === p.toUpperCase() ? 'w' : 'b';
    const type = p.toLowerCase();
    const map = {p:'P', r:'R', n:'N', b:'B', q:'Q', k:'K'};
    return `https://lichess1.org/assets/piece/cburnett/${color}${map[type]}.svg`;
  }

  // ============ ANALYSIS ENGINE ============
  function analyzePosition(fen) {
    if (!state.isEngineReady) return;
    state.engine.postMessage(`position fen ${fen}`);
    state.engine.postMessage(`go depth ${elements.depthSelect.value}`);
  }

  function analyzeCurrentPosition() {
    const history = state.game.history();
    const tempGame = new Chess();
    for (let i = 0; i < state.currentMoveIndex; i++) tempGame.move(history[i]);
    analyzePosition(tempGame.fen());
  }

  function updateEvalUI(score) {
    elements.evalBadge.textContent = score;
    elements.evalBadge.style.background = score.toString().includes('-') ? '#e74c3c' : '#2ecc71';
    elements.evalBadge.style.color = '#fff';
  }

  function updateBestMoveUI(bestMove) {
    elements.engineFeedback.innerHTML = `
      <div style="color: var(--accent); font-weight: bold;">أفضل نقلة: ${bestMove}</div>
      <p style="font-size: 0.8rem; margin-top: 5px;">المحرك يقترح هذه النقلة كأفضل خيار استراتيجي في هذا الوضع.</p>
    `;
  }

  // ============ FEATURES EXTRACTION ============
  function extractFeatures() {
    // محاكاة استخراج الافتتاحيات والنهايات من المباريات المجلوبة
    // في نسخة كاملة، سنقوم بتحليل كل مباراة بالكامل
    
    // الافتتاحيات
    const openings = [
      { name: 'Ruy Lopez', result: 'خسارة', error: 'خرجت عن الكتاب في النقلة 7 بنقلة h3', fix: 'النقلة الصحيحة هي d4 للسيطرة على الوسط.' },
      { name: 'Sicilian Defense', result: 'فوز', error: 'لعبت بدقة عالية', fix: 'استمر في دراسة تفريعات Najdorf.' }
    ];
    
    elements.openingsGrid.innerHTML = openings.map(o => `
      <div class="card">
        <h4>${o.name}</h4>
        <p>الحالة: <strong>${o.result}</strong></p>
        <p>${o.error}</p>
        <div class="engine-feedback">${o.fix}</div>
      </div>
    `).join('');

    // النهايات
    const endgames = [
      { type: 'نهاية ملك وبيادق', status: 'تعادل ضائع', tip: 'ضيعت الفوز بسبب عدم تفعيل الملك في الوقت المناسب.' },
      { type: 'نهاية رخ وبيادق', status: 'خسارة', tip: 'وضعية الرخ كانت سلبية، كان يجب وضعه خلف البيادق السالكة.' }
    ];

    elements.endgamesGrid.innerHTML = endgames.map(e => `
      <div class="card">
        <h4>${e.type}</h4>
        <p>النتيجة: <strong>${e.status}</strong></p>
        <p>${e.tip}</p>
        <button class="btn" style="width:100%; margin-top:10px;">تدرب على الموقف</button>
      </div>
    `).join('');
  }

  init();
})();
