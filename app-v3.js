/**
 * Chess Legend - AI Training Platform (v3.0)
 * 
 * نسخة مطابقة تماماً لـ Chess.com:
 * - تحليل المباراة بالكامل دفعة واحدة
 * - تقرير دقة اللعب (Accuracy Score من 100)
 * - عرض جميع النقلات مع التصنيفات
 * - واجهة مراجعة احترافية
 */

'use strict';

(async function() {
  // ============ CONFIG & STATE ============
  const CONFIG = {
    CHESS_API_BASE: 'https://api.chess.com/pub/player/',
    ANALYSIS_DEPTH: 22,
    MAX_GAMES: 10,
    ACCURACY_THRESHOLD: 0.5 // نقطة واحدة = 100 centipawns
  };

  const state = {
    username: '',
    games: [],
    currentGameIndex: 0,
    currentGame: null,
    gameAnalysis: null,
    board: null,
    game: new Chess(),
    engine: null,
    isEngineReady: false,
    isAnalyzing: false,
    boardFlipped: false,
    moveIndex: 0
  };

  // ============ MOVE CLASSIFICATION ============
  const MoveClassification = {
    BOOK: 'book',
    BRILLIANT: 'brilliant',
    GREAT: 'great',
    BEST: 'best',
    GOOD: 'good',
    INACCURACY: 'inaccuracy',
    MISTAKE: 'mistake',
    BLUNDER: 'blunder'
  };

  // ============ DOM ELEMENTS ============
  const elements = {
    loginPanel: document.getElementById('loginPanel'),
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    depthSelect: document.getElementById('depthSelect'),
    inputError: document.getElementById('inputError'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    statusProgress: document.getElementById('statusProgress'),
    reviewSection: document.getElementById('reviewSection'),
    gameSelector: document.getElementById('gameSelector'),
    accuracyScore: document.getElementById('accuracyScore'),
    accuracyBar: document.getElementById('accuracyBar'),
    gameStats: document.getElementById('gameStats'),
    movesList: document.getElementById('movesList'),
    board: document.getElementById('board'),
    topPlayer: document.getElementById('topPlayer'),
    bottomPlayer: document.getElementById('bottomPlayer'),
    boardStatus: document.getElementById('boardStatus'),
    evalFill: document.getElementById('evalFill'),
    evalText: document.getElementById('evalText'),
    moveControls: document.getElementById('moveControls'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    moveCounter: document.getElementById('moveCounter'),
    flipBtn: document.getElementById('flipBtn'),
    resetBtn: document.getElementById('resetBtn'),
    promoOverlay: document.getElementById('promoOverlay'),
    promoPieces: document.getElementById('promoPieces')
  };

  // ============ INITIALIZATION ============
  function init() {
    elements.fetchBtn.addEventListener('click', startAnalysis);
    elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') startAnalysis();
    });

    elements.prevBtn?.addEventListener('click', () => navigateMove(-1));
    elements.nextBtn?.addEventListener('click', () => navigateMove(1));
    elements.flipBtn?.addEventListener('click', flipBoard);
    elements.resetBtn?.addEventListener('click', resetBoard);

    initEngine();
  }

  // ============ ENGINE INITIALIZATION ============
  async function initEngine() {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker('https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish.wasm.js');
        
        let ready = false;
        const timeout = setTimeout(() => {
          if (!ready) {
            worker.terminate();
            reject(new Error('انتهت مهلة تحميل المحرك.'));
          }
        }, 30000);

        worker.onmessage = (e) => {
          const msg = e.data;
          if (typeof msg !== 'string') return;

          if (msg === 'uciok') {
            worker.postMessage('isready');
          } else if (msg === 'readyok') {
            ready = true;
            state.isEngineReady = true;
            clearTimeout(timeout);
            state.engine = worker;
            console.log('✓ محرك Stockfish جاهز');
            resolve();
          }
        };

        worker.onerror = (e) => {
          console.error('خطأ في محرك Stockfish:', e);
          reject(new Error('حدث خطأ أثناء تحميل المحرك.'));
        };

        worker.postMessage('uci');
      } catch (e) {
        console.error('خطأ في إنشاء الـ Worker:', e);
        reject(new Error('فشل إنشاء الـ Worker.'));
      }
    });
  }

  function getBestMove(fen, depth = CONFIG.ANALYSIS_DEPTH) {
    return new Promise((resolve) => {
      if (!state.engine) return resolve(null);

      state.engine.postMessage(`position fen ${fen}`);
      state.engine.postMessage(`go depth ${depth}`);

      const listener = (e) => {
        const msg = e.data;
        if (typeof msg !== 'string') return;

        if (msg.startsWith('bestmove')) {
          state.engine.removeEventListener('message', listener);
          const move = msg.split(' ')[1];
          resolve(move);
        }
      };

      state.engine.addEventListener('message', listener);
    });
  }

  async function getEvaluation(fen, depth = CONFIG.ANALYSIS_DEPTH) {
    return new Promise((resolve) => {
      if (!state.engine) return resolve(0);

      state.engine.postMessage(`position fen ${fen}`);
      state.engine.postMessage(`go depth ${depth}`);

      let lastScore = 0;
      const listener = (e) => {
        const msg = e.data;
        if (typeof msg !== 'string') return;

        if (msg.includes('score cp')) {
          const parts = msg.split(' ');
          const scoreIdx = parts.indexOf('cp');
          lastScore = parseInt(parts[scoreIdx + 1]) / 100;
        } else if (msg.includes('score mate')) {
          const parts = msg.split(' ');
          const mateIdx = parts.indexOf('mate');
          const mateIn = parseInt(parts[mateIdx + 1]);
          lastScore = mateIn > 0 ? 30 : -30;
        }

        if (msg.startsWith('bestmove')) {
          state.engine.removeEventListener('message', listener);
          resolve(lastScore);
        }
      };

      state.engine.addEventListener('message', listener);
    });
  }

  // ============ GAME ANALYSIS ============
  async function startAnalysis() {
    const user = elements.usernameInput.value.trim();
    if (!user) {
      showInputError('يرجى إدخال اسم المستخدم');
      return;
    }

    state.username = user;
    hideInputError();
    showStatus('جاري تهيئة المحرك الذكي...');

    try {
      if (!state.isEngineReady) {
        await initEngine();
      }
      
      showStatus('جاري جلب مبارياتك من Chess.com...');
      
      const archives = await fetchArchives(user);
      if (!archives || archives.length === 0) {
        throw new Error('لم يتم العثور على مباريات لهذا المستخدم.');
      }

      const lastMonthUrl = archives[archives.length - 1];
      const gamesData = await fetchGames(lastMonthUrl);
      state.games = gamesData.filter(g => g.rules === 'chess').slice(-CONFIG.MAX_GAMES);

      if (state.games.length === 0) {
        throw new Error('لا توجد مباريات شطرنج كلاسيكية مؤخراً.');
      }

      showStatus(`جاري تحليل ${state.games.length} مباراة...`);
      await analyzeAllGames();

      renderGameSelector();
      showReviewSection();
      loadGame(0);

      hideStatus();
      elements.loginPanel.classList.add('hidden');

    } catch (err) {
      console.error(err);
      showInputError(err.message);
      hideStatus();
    }
  }

  async function analyzeAllGames() {
    for (let i = 0; i < state.games.length; i++) {
      const gameData = state.games[i];
      updateStatus(`جاري تحليل المباراة ${i + 1} من ${state.games.length}...`, (i + 1) / state.games.length);
      
      const analysis = await analyzeGame(gameData);
      state.games[i].analysis = analysis;
    }
  }

  async function analyzeGame(gameData) {
    const chess = new Chess();
    const pgn = gameData.pgn;
    chess.load_pgn(pgn);
    const history = chess.history({ verbose: true });
    
    const userColor = gameData.white.username.toLowerCase() === state.username.toLowerCase() ? 'w' : 'b';
    const opponent = userColor === 'w' ? gameData.black.username : gameData.white.username;
    
    const moves = [];
    let totalAccuracy = 0;
    let accuracyCount = 0;

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      
      // تحليل النقلات الخاصة بالمستخدم فقط
      if (move.color === userColor) {
        const fenBefore = i === 0 ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : history[i-1].fen;
        
        const evalBefore = await getEvaluation(fenBefore, CONFIG.ANALYSIS_DEPTH);
        const userMoveUci = move.from + move.to + (move.promotion || '');
        const bestMoveUci = await getBestMove(fenBefore, CONFIG.ANALYSIS_DEPTH);
        
        const tempChess = new Chess(fenBefore);
        tempChess.move(move);
        const evalAfter = await getEvaluation(tempChess.fen(), CONFIG.ANALYSIS_DEPTH);
        
        const evalDiff = userColor === 'w' ? (evalBefore - evalAfter) : (evalAfter - evalBefore);
        
        const classification = await classifyMove(fenBefore, userMoveUci, userColor, bestMoveUci, evalBefore, evalAfter);
        
        // حساب الدقة (Accuracy)
        const accuracy = calculateAccuracy(evalDiff);
        totalAccuracy += accuracy;
        accuracyCount++;
        
        moves.push({
          moveNumber: Math.floor(i / 2) + 1,
          color: move.color,
          san: move.san,
          uci: userMoveUci,
          bestMove: bestMoveUci,
          classification: classification.type,
          evalBefore: evalBefore,
          evalAfter: evalAfter,
          evalDiff: evalDiff,
          accuracy: accuracy,
          fen: fenBefore
        });
      }
    }

    const overallAccuracy = accuracyCount > 0 ? Math.round((totalAccuracy / accuracyCount) * 100) : 100;

    return {
      gameUrl: gameData.url,
      opponent: opponent,
      result: userColor === 'w' ? gameData.white.result : gameData.black.result,
      date: new Date(gameData.end_time * 1000).toLocaleDateString('ar-EG'),
      timeControl: gameData.time_control,
      moves: moves,
      overallAccuracy: overallAccuracy,
      userColor: userColor,
      pgn: pgn
    };
  }

  async function classifyMove(fen, move, userColor, bestMove, evalBefore, evalAfter) {
    const isBestMove = move === bestMove;
    
    if (isBestMove) {
      return { type: MoveClassification.BEST };
    }

    // تحليل أفضل نقلة
    const chess = new Chess(fen);
    chess.move(bestMove, { sloppy: true });
    const evalBestAfter = await getEvaluation(chess.fen(), CONFIG.ANALYSIS_DEPTH);
    
    const evalDiff = userColor === 'w' ? (evalBefore - evalAfter) : (evalAfter - evalBefore);
    const bestEvalDiff = userColor === 'w' ? (evalBefore - evalBestAfter) : (evalBestAfter - evalBefore);
    
    // التحقق من التضحية
    const isSacrifice = isMaterialSacrifice(fen, move);
    if (isSacrifice && evalDiff >= bestEvalDiff - 0.5) {
      return { type: MoveClassification.BRILLIANT };
    }
    
    if (evalDiff >= bestEvalDiff - 0.3) {
      return { type: MoveClassification.GREAT };
    }
    
    if (evalDiff >= bestEvalDiff - 1.0) {
      return { type: MoveClassification.GOOD };
    }
    
    if (evalDiff >= bestEvalDiff - 2.0) {
      return { type: MoveClassification.INACCURACY };
    }
    
    if (evalDiff >= bestEvalDiff - 4.0) {
      return { type: MoveClassification.MISTAKE };
    }
    
    return { type: MoveClassification.BLUNDER };
  }

  function isMaterialSacrifice(fen, move) {
    const chess = new Chess(fen);
    const moveObj = chess.move(move, { sloppy: true });
    
    if (!moveObj || !moveObj.captured) return false;
    
    const valuablePieces = ['n', 'b', 'r', 'q'];
    return valuablePieces.includes(moveObj.captured.toLowerCase());
  }

  function calculateAccuracy(evalDiff) {
    // حساب الدقة بناءً على الفرق في التقييم
    // 0 فرق = 100% دقة
    // كل 0.5 نقطة = -10% دقة
    if (evalDiff <= 0) return 100;
    if (evalDiff >= 5) return 0;
    
    return Math.max(0, 100 - (evalDiff * 20));
  }

  // ============ DATA FETCHING ============
  async function fetchArchives(user) {
    const res = await fetch(`${CONFIG.CHESS_API_BASE}${user}/games/archives`);
    if (!res.ok) throw new Error('فشل جلب بيانات الأرشيف.');
    const data = await res.json();
    return data.archives;
  }

  async function fetchGames(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('فشل جلب مباريات الشهر الحالي.');
    const data = await res.json();
    return data.games;
  }

  // ============ UI RENDERING ============
  function showStatus(text, progress = 0) {
    elements.statusText.textContent = text;
    if (elements.statusProgress && progress > 0) {
      elements.statusProgress.style.width = `${progress * 100}%`;
    }
    elements.statusBar.classList.remove('hidden');
  }

  function updateStatus(text, progress = 0) {
    elements.statusText.textContent = text;
    if (elements.statusProgress && progress > 0) {
      elements.statusProgress.style.width = `${progress * 100}%`;
    }
  }

  function hideStatus() {
    elements.statusBar.classList.add('hidden');
  }

  function showInputError(text) {
    elements.inputError.textContent = text;
    elements.inputError.classList.remove('hidden');
  }

  function hideInputError() {
    elements.inputError.classList.add('hidden');
  }

  function showReviewSection() {
    elements.reviewSection.classList.remove('hidden');
  }

  function renderGameSelector() {
    elements.gameSelector.innerHTML = state.games.map((game, idx) => `
      <option value="${idx}">
        ${game.analysis.opponent} (${game.analysis.result}) - ${game.analysis.date}
      </option>
    `).join('');

    elements.gameSelector.addEventListener('change', (e) => {
      loadGame(parseInt(e.target.value));
    });
  }

  function loadGame(index) {
    state.currentGameIndex = index;
    state.gameAnalysis = state.games[index].analysis;
    state.moveIndex = 0;
    
    // عرض تقرير الدقة
    renderAccuracyReport();
    
    // عرض قائمة النقلات
    renderMovesList();
    
    // عرض أول نقلة
    displayMove(0);
  }

  function renderAccuracyReport() {
    const analysis = state.gameAnalysis;
    
    elements.accuracyScore.textContent = `${analysis.overallAccuracy}%`;
    elements.accuracyBar.style.width = `${analysis.overallAccuracy}%`;
    
    const resultText = analysis.result === 'win' ? '✓ فوز' : (analysis.result === 'loss' ? '✗ خسارة' : '= تعادل');
    
    elements.gameStats.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">الخصم:</span>
        <span class="stat-value">${analysis.opponent}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">النتيجة:</span>
        <span class="stat-value">${resultText}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">التاريخ:</span>
        <span class="stat-value">${analysis.date}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">نوع المباراة:</span>
        <span class="stat-value">${analysis.timeControl}</span>
      </div>
    `;
  }

  function renderMovesList() {
    const analysis = state.gameAnalysis;
    
    elements.movesList.innerHTML = analysis.moves.map((move, idx) => {
      const icon = getMoveIcon(move.classification);
      const accuracyClass = move.accuracy >= 90 ? 'excellent' : 
                           move.accuracy >= 70 ? 'good' : 
                           move.accuracy >= 50 ? 'fair' : 'poor';
      
      return `
        <div class="move-item ${accuracyClass}" data-index="${idx}">
          <span class="move-number">${move.moveNumber}${move.color === 'b' ? '...' : '.'}</span>
          <span class="move-san">${move.san}</span>
          <span class="move-icon">${icon}</span>
          <span class="move-accuracy">${move.accuracy}%</span>
        </div>
      `;
    }).join('');

    // إضافة مستمعين للنقرات
    document.querySelectorAll('.move-item').forEach(item => {
      item.addEventListener('click', () => {
        displayMove(parseInt(item.dataset.index));
      });
    });
  }

  function getMoveIcon(classification) {
    const icons = {
      'brilliant': '✨',
      'great': '👍',
      'best': '🏆',
      'good': '✓',
      'inaccuracy': '⚠️',
      'mistake': '❌',
      'blunder': '💥',
      'book': '📖'
    };
    return icons[classification] || '•';
  }

  function displayMove(index) {
    state.moveIndex = index;
    const move = state.gameAnalysis.moves[index];
    
    // تحميل الموقف قبل النقلة
    state.game = new Chess(move.fen);
    
    // تطبيق النقلة
    state.game.move(move.san);
    
    // تحديث الرقعة
    createBoard();
    updateEval();
    
    // تحديث عداد النقلات
    elements.moveCounter.textContent = `النقلة ${index + 1} من ${state.gameAnalysis.moves.length}`;
    
    // تحديث الأزرار
    elements.prevBtn.disabled = index === 0;
    elements.nextBtn.disabled = index === state.gameAnalysis.moves.length - 1;
    
    // تمييز النقلة الحالية
    document.querySelectorAll('.move-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  function navigateMove(direction) {
    const newIndex = state.moveIndex + direction;
    if (newIndex >= 0 && newIndex < state.gameAnalysis.moves.length) {
      displayMove(newIndex);
    }
  }

  // ============ BOARD LOGIC ============
  function createBoard() {
    elements.board.innerHTML = '';
    const fen = state.game.fen().split(' ')[0];
    const rows = fen.split('/');
    
    let boardArray = [];
    for (let row of rows) {
      let rowArray = [];
      for (let char of row) {
        if (isNaN(char)) {
          rowArray.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) rowArray.push(null);
        }
      }
      boardArray.push(rowArray);
    }

    for (let i = 0; i < 8; i++) {
      const rowIdx = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const colIdx = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        const piece = boardArray[rowIdx][colIdx];
        const isLight = (rowIdx + colIdx) % 2 === 0;
        
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        square.setAttribute('data-row', rowIdx);
        square.setAttribute('data-col', colIdx);
        
        if (piece) {
          square.innerHTML = `<span class="piece">${getPieceUnicode(piece)}</span>`;
        }
        
        elements.board.appendChild(square);
      }
    }

    updateStatus();
  }

  function getPieceUnicode(piece) {
    const pieces = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    return pieces[piece] || '';
  }

  function updateStatus() {
    let status = '';
    const turn = state.game.turn() === 'w' ? 'الأبيض' : 'الأسود';

    if (state.game.in_checkmate()) {
      status = `كش مات! ${turn} خسر.`;
    } else if (state.game.in_draw()) {
      status = 'تعادل!';
    } else if (state.game.in_check()) {
      status = `${turn} في حالة كش!`;
    } else {
      status = `دور ${turn}`;
    }

    elements.boardStatus.textContent = status;
  }

  async function updateEval() {
    const score = await getEvaluation(state.game.fen(), 15);
    const percent = Math.max(5, Math.min(95, 50 + (score * 5)));
    elements.evalFill.style.width = `${percent}%`;
    elements.evalText.textContent = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }

  function flipBoard() {
    state.boardFlipped = !state.boardFlipped;
    createBoard();
  }

  function resetBoard() {
    displayMove(0);
  }

  // Start the app
  init();

})();
