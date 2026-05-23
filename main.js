/**
 * Chess Legend - Diamond Review Edition
 */

'use strict';

(function() {
  const CONFIG = {
    STOCKFISH_PATH: 'stockfish.js',
    DEPTH: 18,
    MAX_GAMES: 10
  };

  const state = {
    username: '',
    games: [],
    currentGame: null,
    currentMoveIndex: 0,
    history: [], // {fen, move, uci, score, classification, explanation}
    engine: null,
    isEngineReady: false,
    boardFlipped: false,
    lastScore: 0
  };

  const elements = {
    mainBoard: document.getElementById('mainBoard'),
    gameList: document.getElementById('gameList'),
    moveHistory: document.getElementById('moveHistory'),
    evalFill: document.getElementById('evalFill'),
    evalText: document.getElementById('evalText'),
    coachExplanation: document.getElementById('coachExplanation'),
    loginPanel: document.getElementById('loginPanel'),
    mainDashboard: document.getElementById('mainDashboard'),
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText')
  };

  function init() {
    elements.fetchBtn.addEventListener('click', startApp);
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
      calculateDiamondReview(score);
    }
  }

  function parseScore(msg) {
    if (msg.includes('score cp')) return (parseInt(msg.split('cp ')[1]) / 100).toFixed(1);
    const mate = parseInt(msg.split('mate ')[1]);
    return 'M' + Math.abs(mate);
  }

  async function startApp() {
    const user = elements.usernameInput.value.trim();
    if (!user) return;
    state.username = user;
    toggleStatus(true, 'جاري جلب مبارياتك من Chess.com...');
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
    } catch (e) {
      toggleStatus(true, 'خطأ: تأكد من اسم المستخدم.');
    }
  }

  function toggleStatus(show, text = '') {
    elements.statusBar.classList.toggle('hidden', !show);
    elements.statusText.textContent = text;
  }

  window.selectGame = (index) => {
    state.currentGame = state.games[index];
    const chess = new Chess();
    chess.load_pgn(state.currentGame.pgn);
    const moves = chess.history({ verbose: true });
    const temp = new Chess();
    state.history = [{ fen: temp.fen(), move: 'البداية', uci: '', score: 0, classification: 'book', explanation: 'بداية المباراة. كل الحظ للمتلاعبين!' }];
    for (let m of moves) {
      temp.move(m);
      state.history.push({
        fen: temp.fen(),
        move: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        score: 0,
        classification: 'good',
        explanation: ''
      });
    }
    state.currentMoveIndex = 0;
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
    const icons = { brilliant: '!!', best: '★', great: '!', good: '✓', blunder: '??', book: '📖' };
    return icons[cls] || '';
  }

  window.goTo = (i) => {
    state.currentMoveIndex = i;
    renderBoard();
    renderMoveHistory();
    elements.coachExplanation.textContent = state.history[i].explanation || 'جاري تحليل النقلة من قبل المدرب...';
    analyze();
  };

  function navigate(dir) {
    let n = state.currentMoveIndex + dir;
    if (n < 0) n = 0;
    if (n >= state.history.length) n = state.history.length - 1;
    window.goTo(n);
  }

  function renderBoard() {
    const fen = state.history[state.currentMoveIndex].fen;
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
        square.dataset.pos = String.fromCharCode(97 + c) + (8 - r);
        const piece = board[r][c];
        if (piece) {
          const img = document.createElement('img');
          img.src = `https://lichess1.org/assets/piece/cburnett/${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}.svg`;
          img.className = 'piece';
          square.appendChild(img);
        }
        elements.mainBoard.appendChild(square);
      }
    }
    if (state.currentMoveIndex > 0) {
      const uci = state.history[state.currentMoveIndex].uci;
      highlight(uci.substring(0,2));
      highlight(uci.substring(2,4));
    }
  }

  function highlight(pos) {
    const sq = document.querySelector(`[data-pos="${pos}"]`);
    if (sq) sq.classList.add('last-move');
  }

  function updateEvalUI(score) {
    elements.evalText.textContent = score;
    let val = parseFloat(score);
    if (isNaN(val)) val = score.startsWith('M') ? 10 : -10;
    const h = Math.max(5, Math.min(95, 50 + (val * 10)));
    elements.evalFill.style.height = `${h}%`;
  }

  function calculateDiamondReview(score) {
    if (state.currentMoveIndex === 0) return;
    const current = parseFloat(score) || 0;
    const diff = Math.abs(current - state.lastScore);
    state.lastScore = current;

    let cls = 'good';
    let exp = 'نقلة جيدة تحافظ على توازن المباراة.';

    if (diff < 0.1 && Math.abs(current) > 2.0) {
      cls = 'brilliant';
      exp = 'يا لها من نقلة عبقرية! لقد وجدت أفضل تكتيك في هذا الوضع المعقد.';
    } else if (diff < 0.2) {
      cls = 'best';
      exp = 'هذه هي أفضل نقلة ممكنة. أنت تلعب بدقة المحترفين.';
    } else if (diff < 0.5) {
      cls = 'great';
      exp = 'نقلة قوية جداً تزيد من ضغطك على الخصم.';
    } else if (diff > 2.5) {
      cls = 'blunder';
      exp = 'خطأ فادح! لقد فوتّ فرصة كبيرة أو خسرت أفضلية واضحة هنا.';
    } else if (diff > 1.0) {
      exp = 'نقلة غير دقيقة، كان بإمكانك إيجاد خيار أفضل للسيطرة على الرقعة.';
    }

    state.history[state.currentMoveIndex].classification = cls;
    state.history[state.currentMoveIndex].explanation = exp;
    elements.coachExplanation.textContent = exp;
    renderMoveHistory();
  }

  function analyze() {
    if (!state.isEngineReady) return;
    state.engine.postMessage(`position fen ${state.history[state.currentMoveIndex].fen}`);
    state.engine.postMessage(`go depth ${CONFIG.DEPTH}`);
  }

  init();
})();
