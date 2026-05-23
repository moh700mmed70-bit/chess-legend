/**
 * Chess Legend - AI Training Platform
 * 
 * تم إصلاح هذا الملف برمجياً لضمان العمل المحلي بالكامل للمحرك.
 * يتم استدعاء ملف stockfish.js من المجلد المحلي فقط.
 */

'use strict';

(function() {
  // ============ CONFIG & STATE ============
  const CONFIG = {
    CHESS_API_BASE: 'https://api.chess.com/pub/player/',
    STOCKFISH_PATH: 'stockfish.js', // تم التأكد من أنه مسار محلي
    INITIAL_DEPTH: 14,
    MAX_PUZZLES: 6
  };

  const state = {
    username: '',
    games: [],
    puzzles: [],
    currentPuzzleIndex: 0,
    board: null,
    game: new Chess(),
    engine: null,
    isEngineReady: false,
    isAnalyzing: false,
    boardFlipped: false,
    moveHistory: [],
    currentHint: null
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
    statsSection: document.getElementById('statsSection'),
    statsGrid: document.getElementById('statsGrid'),
    trainerSection: document.getElementById('trainerSection'),
    puzzleCounter: document.getElementById('puzzleCounter'),
    prevPuzzle: document.getElementById('prevPuzzle'),
    nextPuzzle: document.getElementById('nextPuzzle'),
    board: document.getElementById('board'),
    topPlayer: document.getElementById('topPlayer'),
    bottomPlayer: document.getElementById('bottomPlayer'),
    boardStatus: document.getElementById('boardStatus'),
    evalFill: document.getElementById('evalFill'),
    evalText: document.getElementById('evalText'),
    undoBtn: document.getElementById('undoBtn'),
    hintBtn: document.getElementById('hintBtn'),
    solutionBtn: document.getElementById('solutionBtn'),
    resetBtn: document.getElementById('resetBtn'),
    flipBtn: document.getElementById('flipBtn'),
    puzzleTitle: document.getElementById('puzzleTitle'),
    puzzleDifficulty: document.getElementById('puzzleDifficulty'),
    puzzleContext: document.getElementById('puzzleContext'),
    taskPrompt: document.getElementById('taskPrompt'),
    moveList: document.getElementById('moveList'),
    feedback: document.getElementById('feedback'),
    feedbackTitle: document.getElementById('feedbackTitle'),
    feedbackBody: document.getElementById('feedbackBody'),
    tipsSection: document.getElementById('tipsSection'),
    tipsGrid: document.getElementById('tipsGrid'),
    promoOverlay: document.getElementById('promoOverlay'),
    promoPieces: document.getElementById('promoPieces')
  };

  // ============ INITIALIZATION ============
  function init() {
    elements.fetchBtn.addEventListener('click', startAnalysis);
    elements.usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') startAnalysis();
    });

    elements.prevPuzzle.addEventListener('click', () => switchPuzzle(-1));
    elements.nextPuzzle.addEventListener('click', () => switchPuzzle(1));
    elements.undoBtn.addEventListener('click', undoMove);
    elements.hintBtn.addEventListener('click', showHint);
    elements.solutionBtn.addEventListener('click', showSolution);
    elements.resetBtn.addEventListener('click', resetPuzzle);
    elements.flipBtn.addEventListener('click', flipBoard);

    // التحقق من وجود ملف المحرك محلياً
    checkEngineAvailability();
  }

  async function checkEngineAvailability() {
    try {
      const response = await fetch(CONFIG.STOCKFISH_PATH, { method: 'HEAD' });
      if (!response.ok) {
        console.error('تحذير: ملف stockfish.js غير موجود في المجلد المحلي!');
      }
    } catch (e) {
      console.error('فشل التحقق من ملف المحرك:', e);
    }
  }

  // ============ ENGINE LOGIC ============
  function initEngine() {
    return new Promise((resolve, reject) => {
      if (state.engine) {
        state.engine.terminate();
      }

      // إضافة بصمة زمنية لتجاوز الكاش وضمان تحميل النسخة المحلية
      const engineUrl = CONFIG.STOCKFISH_PATH + '?v=' + new Date().getTime();
      
      try {
        console.log('جاري تحميل المحرك من:', engineUrl);
        state.engine = new Worker(engineUrl);
      } catch (e) {
        console.error('خطأ في إنشاء الـ Worker:', e);
        return reject(new Error('فشل إنشاء الـ Worker. قد يكون بسبب قيود الأمان في المتصفح.'));
      }

      let ready = false;
      const timeout = setTimeout(() => {
        if (!ready) {
          state.engine.terminate();
          reject(new Error('انتهت مهلة تحميل المحرك.'));
        }
      }, 30000);

      state.engine.onmessage = (e) => {
        const msg = e.data;
        if (typeof msg !== 'string') return;

        if (msg === 'uciok') {
          state.engine.postMessage('isready');
        } else if (msg === 'readyok') {
          ready = true;
          state.isEngineReady = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      state.engine.onerror = (e) => {
        console.error('خطأ في محرك Stockfish:', e);
        reject(new Error('حدث خطأ أثناء تحميل المحرك.'));
      };

      state.engine.postMessage('uci');
    });
  }

  function getBestMove(fen, depth) {
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

  async function getEvaluation(fen, depth) {
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
          lastScore = mateIn > 0 ? 10 : -10; // قيمة تقديرية للمات
        }

        if (msg.startsWith('bestmove')) {
          state.engine.removeEventListener('message', listener);
          resolve(lastScore);
        }
      };

      state.engine.addEventListener('message', listener);
    });
  }

  // ============ DATA FETCHING ============
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
      await initEngine();
      showStatus('جاري جلب مبارياتك من Chess.com...');
      
      const archives = await fetchArchives(user);
      if (!archives || archives.length === 0) {
        throw new Error('لم يتم العثور على مباريات لهذا المستخدم.');
      }

      const lastMonthUrl = archives[archives.length - 1];
      const gamesData = await fetchGames(lastMonthUrl);
      state.games = gamesData.filter(g => g.rules === 'chess').slice(-20);

      if (state.games.length === 0) {
        throw new Error('لا توجد مباريات شطرنج كلاسيكية مؤخراً.');
      }

      showStatus(`جاري تحليل ${state.games.length} مباراة لاستخراج الأخطاء...`);
      await generatePuzzles();

      renderStats();
      renderTips();
      
      if (state.puzzles.length > 0) {
        showTrainer();
        loadPuzzle(0);
      } else {
        throw new Error('حللنا مبارياتك ولم نجد أخطاء فادحة تستحق التدريب! أنت بطل.');
      }

      hideStatus();
      elements.loginPanel.classList.add('hidden');

    } catch (err) {
      console.error(err);
      showInputError(err.message);
      hideStatus();
    }
  }

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

  // ============ PUZZLE GENERATION ============
  async function generatePuzzles() {
    state.puzzles = [];
    const depth = parseInt(elements.depthSelect.value);
    
    for (const gameData of state.games) {
      if (state.puzzles.length >= CONFIG.MAX_PUZZLES) break;

      const chess = new Chess();
      const pgn = gameData.pgn;
      chess.load_pgn(pgn);
      const history = chess.history({ verbose: true });
      
      const userColor = gameData.white.username.toLowerCase() === state.username.toLowerCase() ? 'w' : 'b';
      
      // فحص الحركات التي قام بها المستخدم
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        if (move.color !== userColor) continue;

        // نحن نبحث عن أخطاء في منتصف أو نهاية اللعبة (تجنب الافتتاحيات البسيطة)
        if (i < 10) continue;

        const fenBefore = i === 0 ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : history[i-1].fen;
        
        // تقييم الوضع قبل الحركة
        const evalBefore = await getEvaluation(fenBefore, depth);
        
        // الحركة الفعلية التي لعبها المستخدم
        const userMoveUci = move.from + move.to + (move.promotion || '');
        
        // الحركة الأفضل حسب المحرك
        const bestMoveUci = await getBestMove(fenBefore, depth);
        
        if (userMoveUci !== bestMoveUci) {
          const tempChess = new Chess(fenBefore);
          tempChess.move(move);
          const evalAfterUser = await getEvaluation(tempChess.fen(), depth);
          
          // إذا كان الفرق في التقييم أكثر من 1.5 بيادق (خطأ فادح)
          const diff = userColor === 'w' ? (evalBefore - evalAfterUser) : (evalAfterUser - evalBefore);
          
          if (diff > 1.5) {
            state.puzzles.push({
              fen: fenBefore,
              bestMove: bestMoveUci,
              userMove: userMoveUci,
              gameUrl: gameData.url,
              opponent: userColor === 'w' ? gameData.black.username : gameData.white.username,
              date: new Date(gameData.end_time * 1000).toLocaleDateString('ar-EG'),
              diff: diff.toFixed(1)
            });
            break; // لغز واحد لكل مباراة لضمان التنوع
          }
        }
      }
    }
  }

  // ============ UI RENDERING ============
  function showStatus(text) {
    elements.statusText.textContent = text;
    elements.statusBar.classList.remove('hidden');
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

  function renderStats() {
    elements.statsSection.classList.remove('hidden');
    const winCount = state.games.filter(g => {
      const isWhite = g.white.username.toLowerCase() === state.username.toLowerCase();
      return isWhite ? g.white.result === 'win' : g.black.result === 'win';
    }).length;

    const stats = [
      { label: 'المباريات المحللة', value: state.games.length },
      { label: 'عدد الانتصارات', value: winCount },
      { label: 'ألغاز مستخرجة', value: state.puzzles.length },
      { label: 'دقة التحليل', value: elements.depthSelect.value }
    ];

    elements.statsGrid.innerHTML = stats.map(s => `
      <div class="stat-card">
        <span class="stat-value">${s.value}</span>
        <span class="stat-label">${s.label}</span>
      </div>
    `).join('');
  }

  function renderTips() {
    elements.tipsSection.classList.remove('hidden');
    const tips = [
      { title: 'تجنب الأخطاء الفادحة', body: 'معظم الألغاز المستخرجة كانت بسبب ترك قطع غير محمية. تأكد من حماية قطعك قبل الهجوم.' },
      { title: 'استغلال الفرص', body: 'المحرك وجد حركات أفضل كانت ستمنحك أفضلية حاسمة. تدرب على رؤية النقلات التكتيكية.' }
    ];

    elements.tipsGrid.innerHTML = tips.map(t => `
      <div class="tip-card">
        <h4>${t.title}</h4>
        <p>${t.body}</p>
      </div>
    `).join('');
  }

  function showTrainer() {
    elements.trainerSection.classList.remove('hidden');
  }

  // ============ BOARD LOGIC ============
  function createBoard() {
    elements.board.innerHTML = '';
    const fen = state.game.fen().split(' ')[0];
    const rows = fen.split('/');
    
    // تحويل الـ FEN إلى مصفوفة 8x8
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

    // رسم المربعات
    for (let i = 0; i < 8; i++) {
      const rowIdx = state.boardFlipped ? 7 - i : i;
      for (let j = 0; j < 8; j++) {
        const colIdx = state.boardFlipped ? 7 - j : j;
        const square = document.createElement('div');
        const isLight = (rowIdx + colIdx) % 2 === 0;
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        square.dataset.row = rowIdx;
        square.dataset.col = colIdx;
        
        const pieceChar = boardArray[rowIdx][colIdx];
        if (pieceChar) {
          const piece = document.createElement('img');
          piece.src = getPieceImage(pieceChar);
          piece.className = 'piece';
          piece.draggable = true;
          piece.dataset.from = getSquareName(rowIdx, colIdx);
          
          piece.addEventListener('dragstart', handleDragStart);
          square.appendChild(piece);
        }

        square.addEventListener('dragover', (e) => e.preventDefault());
        square.addEventListener('drop', handleDrop);
        square.addEventListener('click', handleSquareClick);
        
        elements.board.appendChild(square);
      }
    }
    updateStatus();
  }

  function getPieceImage(char) {
    const color = char === char.toUpperCase() ? 'w' : 'b';
    const type = char.toLowerCase();
    const map = { 'p': 'P', 'r': 'R', 'n': 'N', 'b': 'B', 'q': 'Q', 'k': 'K' };
    return `https://lichess1.org/assets/piece/cburnett/${color}${map[type]}.svg`;
  }

  function getSquareName(row, col) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return files[col] + ranks[row];
  }

  let selectedSquare = null;

  function handleSquareClick(e) {
    const square = e.currentTarget;
    const pos = getSquareName(parseInt(square.dataset.row), parseInt(square.dataset.col));

    if (selectedSquare) {
      if (selectedSquare === pos) {
        selectedSquare = null;
        clearHighlights();
      } else {
        makeMove(selectedSquare, pos);
        selectedSquare = null;
      }
    } else {
      const piece = state.game.get(pos);
      if (piece && piece.color === state.game.turn()) {
        selectedSquare = pos;
        clearHighlights();
        square.classList.add('last-move');
      }
    }
  }

  function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.from);
    selectedSquare = null;
    clearHighlights();
  }

  function handleDrop(e) {
    e.preventDefault();
    const from = e.dataTransfer.getData('text/plain');
    const to = getSquareName(parseInt(e.currentTarget.dataset.row), parseInt(e.currentTarget.dataset.col));
    makeMove(from, to);
  }

  function makeMove(from, to) {
    // التحقق من الترقية
    const piece = state.game.get(from);
    if (piece && piece.type === 'p' && ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))) {
      showPromotionModal(from, to);
      return;
    }

    const move = state.game.move({ from, to });
    if (move) {
      onMoveComplete(move);
    } else {
      highlightWrong(to);
    }
  }

  function onMoveComplete(move) {
    createBoard();
    const moveUci = move.from + move.to + (move.promotion || '');
    const puzzle = state.puzzles[state.currentPuzzleIndex];

    if (moveUci === puzzle.bestMove) {
      showFeedback(true, 'حركة ممتازة!', `لقد وجدت الحل الصحيح الذي فاتك في مباراتك ضد ${puzzle.opponent}.`);
      addToMoveList(move.san, true);
    } else {
      showFeedback(false, 'ليست الحركة الأفضل', 'حاول مرة أخرى، فكر في تكتيك أفضل.');
      addToMoveList(move.san, false);
      setTimeout(() => {
        state.game.undo();
        createBoard();
      }, 1000);
    }
    updateEval();
  }

  function showPromotionModal(from, to) {
    elements.promoOverlay.style.display = 'flex';
    const pieces = ['q', 'r', 'b', 'n'];
    elements.promoPieces.innerHTML = '';
    
    pieces.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'promo-piece-btn';
      const char = state.game.turn() === 'w' ? p.toUpperCase() : p.toLowerCase();
      btn.innerHTML = `<img src="${getPieceImage(char)}" alt="${p}">`;
      btn.onclick = () => {
        const move = state.game.move({ from, to, promotion: p });
        elements.promoOverlay.style.display = 'none';
        if (move) onMoveComplete(move);
      };
      elements.promoPieces.appendChild(btn);
    });
  }

  // ============ PUZZLE MANAGEMENT ============
  function loadPuzzle(index) {
    state.currentPuzzleIndex = index;
    const puzzle = state.puzzles[index];
    state.game = new Chess(puzzle.fen);
    state.moveHistory = [];
    
    elements.puzzleCounter.textContent = `لغز ${index + 1} من ${state.puzzles.length}`;
    elements.puzzleTitle.textContent = `مباراتك ضد ${puzzle.opponent}`;
    elements.puzzleDifficulty.textContent = `فقدت ${puzzle.diff} نقطة تقييم`;
    elements.puzzleContext.textContent = `في هذه المباراة بتاريخ ${puzzle.date}، قمت بحركة أدت إلى تراجع وضعك. هل يمكنك إيجاد الحركة الأفضل؟`;
    elements.taskPrompt.textContent = state.game.turn() === 'w' ? 'الأبيض يلعب ويربح' : 'الأسود يلعب ويربح';
    
    elements.moveList.innerHTML = '';
    hideFeedback();
    
    // قلب الرقعة تلقائياً حسب لون اللاعب
    state.boardFlipped = state.game.turn() === 'b';
    
    createBoard();
    updateEval();
  }

  function switchPuzzle(dir) {
    let newIdx = state.currentPuzzleIndex + dir;
    if (newIdx >= 0 && newIdx < state.puzzles.length) {
      loadPuzzle(newIdx);
    }
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
    elements.topPlayer.textContent = state.boardFlipped ? 'الأبيض' : 'الأسود';
    elements.bottomPlayer.textContent = state.boardFlipped ? 'الأسود' : 'الأبيض';
    
    elements.topPlayer.classList.toggle('active', (state.game.turn() === 'b' && !state.boardFlipped) || (state.game.turn() === 'w' && state.boardFlipped));
    elements.bottomPlayer.classList.toggle('active', (state.game.turn() === 'w' && !state.boardFlipped) || (state.game.turn() === 'b' && state.boardFlipped));
  }

  async function updateEval() {
    const score = await getEvaluation(state.game.fen(), 10);
    const percent = Math.max(5, Math.min(95, 50 + (score * 10)));
    elements.evalFill.style.width = `${percent}%`;
    elements.evalText.textContent = score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  }

  // ============ UTILS ============
  function clearHighlights() {
    document.querySelectorAll('.square').forEach(s => {
      s.classList.remove('last-move', 'hint', 'wrong');
    });
  }

  function highlightWrong(squareName) {
    const sq = document.querySelector(`.square[data-row="${getRow(squareName)}"][data-col="${getCol(squareName)}"]`);
    if (sq) {
      sq.classList.add('wrong');
      setTimeout(() => sq.classList.remove('wrong'), 500);
    }
  }

  function getRow(name) { return 8 - parseInt(name[1]); }
  function getCol(name) { return name.charCodeAt(0) - 97; }

  function showFeedback(isSuccess, title, body) {
    elements.feedback.className = `feedback ${isSuccess ? 'success' : 'error'}`;
    elements.feedbackTitle.textContent = title;
    elements.feedbackBody.textContent = body;
  }

  function hideFeedback() {
    elements.feedback.classList.remove('success', 'error');
    elements.feedback.style.display = 'none';
  }

  function addToMoveList(san, isCorrect) {
    const item = document.createElement('span');
    item.className = `move-item ${isCorrect ? 'correct' : 'wrong'}`;
    item.textContent = san;
    elements.moveList.appendChild(item);
  }

  function undoMove() {
    state.game.undo();
    createBoard();
    hideFeedback();
    updateEval();
  }

  function showHint() {
    const puzzle = state.puzzles[state.currentPuzzleIndex];
    const from = puzzle.bestMove.substring(0, 2);
    const sq = document.querySelector(`.square[data-row="${getRow(from)}"][data-col="${getCol(from)}"]`);
    if (sq) {
      sq.classList.add('hint');
      setTimeout(() => sq.classList.remove('hint'), 2000);
    }
  }

  function showSolution() {
    const puzzle = state.puzzles[state.currentPuzzleIndex];
    showFeedback(false, 'الحل الصحيح', `الحركة الأفضل هي: ${puzzle.bestMove}`);
  }

  function resetPuzzle() {
    loadPuzzle(state.currentPuzzleIndex);
  }

  function flipBoard() {
    state.boardFlipped = !state.boardFlipped;
    createBoard();
  }

  // Start the app
  init();

})();
