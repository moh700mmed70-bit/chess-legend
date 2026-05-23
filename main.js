/**
 * Chess Legend v8.0 - The Diamond Standard
 * Accurate Stockfish Analysis, Sacrifice Detection, and On-Board Badges.
 */

'use strict';

(function() {
  const CONFIG = {
    STOCKFISH_PATH: 'stockfish.js',
    DEPTH: 18,
    MAX_GAMES: 10,
    BOOK_MOVES_LIMIT: 8 // Typical book move range
  };

  const state = {
    username: '',
    games: [],
    currentGame: null,
    currentMoveIndex: 0,
    history: [], // {fen, move, uci, score, classification, explanation, isSacrifice}
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
    toggleStatus(true, 'جاري جلب مبارياتك...');
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
      toggleStatus(true, 'خطأ في جلب البيانات.');
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
    
    state.history = [{ 
      fen: temp.fen(), 
      move: 'Start', 
      uci: '', 
      score: 0, 
      classification: 'book', 
      explanation: 'مرحباً بك في المراجعة الماسية! لنبدأ تحليل المباراة.',
      isSacrifice: false
    }];

    for (let m of moves) {
      const prevFen = temp.fen();
      const isSac = isSacrifice(prevFen, m);
      temp.move(m);
      state.history.push({
        fen: temp.fen(),
        move: m.san,
        uci: m.from + m.to + (m.promotion || ''),
        score: 0,
        classification: 'good',
        explanation: '',
        isSacrifice: isSac
      });
    }
    
    state.currentMoveIndex = 0;
    state.lastScore = 0;
    renderGameList();
    renderMoveHistory();
    renderBoard();
    analyze();
  };

  // Logic to detect if a move is a sacrifice
  function isSacrifice(fen, move) {
    const chess = new Chess(fen);
    const piece = chess.get(move.from);
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    
    // If a higher value piece is moved to a square attacked by a lower value piece
    // Or if a piece is captured by a lower value piece without immediate recapture (simplified)
    if (move.captured) {
      return values[move.captured] < values[piece.type];
    }
    return false;
  }

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
          <span class="mini-badge badge-${m.classification}">${getIcon(m.classification)}</span>
        </div>
      `;
    }
    html += '</div>';
    elements.moveHistory.innerHTML = html;
  }

  function getIcon(cls) {
    const icons = { brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '✓', book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??' };
    return icons[cls] || '';
  }

  window.goTo = (i) => {
    state.currentMoveIndex = i;
    renderBoard();
    renderMoveHistory();
    elements.coachExplanation.textContent = state.history[i].explanation || 'جاري تحليل النقلة...';
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
    
    let boardArr = [];
    for (let row of rows) {
      let r = [];
      for (let c of row) {
        if (isNaN(c)) r.push(c);
        else for (let i=0; i<parseInt(c); i++) r.push(null);
      }
      boardArr.push(r);
    }

    const currentMove = state.history[state.currentMoveIndex];

    for (let i = 0; i < 8; i++) {
      const r = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const c = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        const sqName = String.fromCharCode(97 + c) + (8 - r);
        square.className = `square ${(r+c)%2===0?'light':'dark'}`;
        square.dataset.pos = sqName;
        
        const piece = boardArr[r][c];
        if (piece) {
          const img = document.createElement('img');
          img.src = `https://lichess1.org/assets/piece/cburnett/${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}.svg`;
          img.className = 'piece';
          square.appendChild(img);
        }

        // Show badge on the target square of the current move
        if (state.currentMoveIndex > 0 && currentMove.uci.endsWith(sqName)) {
          const badge = document.createElement('div');
          badge.className = `move-badge badge-${currentMove.classification}`;
          badge.textContent = getIcon(currentMove.classification);
          square.appendChild(badge);
        }

        elements.mainBoard.appendChild(square);
      }
    }

    if (state.currentMoveIndex > 0) {
      const uci = currentMove.uci;
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
    const move = state.history[state.currentMoveIndex];
    
    let cls = 'good';
    let exp = 'نقلة جيدة تساهم في تطوير وضعيتك.';

    // Logic for Book Moves
    if (state.currentMoveIndex <= CONFIG.BOOK_MOVES_LIMIT && diff < 0.5) {
      cls = 'book';
      exp = 'هذه نقلة نظرية معروفة (Book Move). أنت تتبع الافتتاحية بشكل صحيح.';
    } 
    // Logic for Brilliant Moves (Sacrifice + Good Eval)
    else if (move.isSacrifice && diff < 0.3 && Math.abs(current) > 1.0) {
      cls = 'brilliant';
      exp = 'يا إلهي! نقلة عبقرية (Brilliant) وتضحية رائعة قلبت موازين المباراة.';
    }
    // Logic for Best/Great
    else if (diff < 0.15) {
      cls = 'best';
      exp = 'أفضل نقلة في هذا الوضع! لقد وجدت المسار المثالي للمحرك.';
    } else if (diff < 0.4) {
      cls = 'great';
      exp = 'نقلة قوية جداً تزيد من ضغطك وتفوقك الميداني.';
    } else if (diff < 0.8) {
      cls = 'excellent';
      exp = 'نقلة ممتازة تحافظ على توازن القوى وتطور قطعك.';
    }
    // Logic for Errors
    else if (diff > 3.0) {
      cls = 'blunder';
      exp = 'خطأ فادح (Blunder)! لقد فوتّ فرصة حاسمة أو خسرت قطعة غالية هنا.';
    } else if (diff > 1.5) {
      cls = 'mistake';
      exp = 'خطأ واضح. كان هناك خيار أفضل بكثير لتجنب المشاكل.';
    } else if (diff > 0.8) {
      cls = 'inaccuracy';
      exp = 'نقلة غير دقيقة. لقد فقدت بعض الأفضلية التي كانت لديك.';
    }

    state.history[state.currentMoveIndex].classification = cls;
    state.history[state.currentMoveIndex].explanation = exp;
    state.lastScore = current;
    
    elements.coachExplanation.textContent = exp;
    renderMoveHistory();
    renderBoard(); // Re-render to show badge
  }

  function analyze() {
    if (!state.isEngineReady) return;
    state.engine.postMessage(`position fen ${state.history[state.currentMoveIndex].fen}`);
    state.engine.postMessage(`go depth ${CONFIG.DEPTH}`);
  }

  init();
})();
