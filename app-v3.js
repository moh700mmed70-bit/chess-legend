/*
 * Chess Legend — Full Match Review
 * تدفق العمل: سجل المباريات ← تحليل المباراة المختارة بالكامل ← تقرير الدقة ← مراجعة نقلة بنقلة.
 */

'use strict';

(function () {
  const CONFIG = {
    CHESS_API_BASE: 'https://api.chess.com/pub/player/',
    MAX_GAMES: 18,
    DEFAULT_DEPTH: 20,
    ENGINE_TIMEOUT_MS: 120000,
    ENGINE_SOURCES: ['stockfish-nnue-16-single.js', 'stockfish.js']
  };

  const LABELS = {
    book: { ar: 'نقلة افتتاحية', short: 'Book', className: 'book' },
    brilliant: { ar: 'نقلة عبقرية', short: 'Brilliant', className: 'brilliant' },
    great: { ar: 'نقلة عظيمة', short: 'Great', className: 'great' },
    best: { ar: 'أفضل نقلة', short: 'Best', className: 'best' },
    excellent: { ar: 'نقلة ممتازة', short: 'Excellent', className: 'excellent' },
    good: { ar: 'نقلة جيدة', short: 'Good', className: 'good' },
    inaccuracy: { ar: 'عدم دقة', short: 'Inaccuracy', className: 'inaccuracy' },
    mistake: { ar: 'خطأ', short: 'Mistake', className: 'mistake' },
    blunder: { ar: 'غلطة كبيرة', short: 'Blunder', className: 'blunder' }
  };

  const PIECE_NAMES = {
    p: 'بيدق', n: 'حصان', b: 'فيل', r: 'رخ', q: 'وزير', k: 'ملك'
  };

  const OPENING_BOOK = new Set([
    'e4', 'd4', 'Nf3', 'c4', 'g3',
    'e4 e5', 'e4 c5', 'e4 e6', 'e4 c6', 'e4 d6', 'e4 d5', 'e4 Nf6',
    'd4 d5', 'd4 Nf6', 'd4 f5', 'd4 e6', 'd4 g6',
    'Nf3 d5', 'Nf3 Nf6', 'c4 e5', 'c4 c5', 'c4 Nf6',
    'e4 e5 Nf3', 'e4 e5 Nf3 Nc6', 'e4 e5 Nf3 Nc6 Bb5', 'e4 e5 Nf3 Nc6 Bc4',
    'e4 c5 Nf3', 'e4 c5 Nf3 d6', 'e4 c5 Nf3 Nc6', 'e4 c5 Nf3 e6',
    'd4 d5 c4', 'd4 d5 c4 e6', 'd4 d5 c4 c6', 'd4 Nf6 c4', 'd4 Nf6 c4 g6', 'd4 Nf6 c4 e6',
    'e4 e6 d4 d5', 'e4 c6 d4 d5', 'e4 d6 d4 Nf6', 'e4 d5 exd5',
    'Nf3 Nf6 c4', 'c4 e5 Nc3', 'c4 Nf6 Nc3'
  ]);

  const state = {
    username: '',
    games: [],
    selectedGameIndex: null,
    currentAnalysis: null,
    engine: null,
    engineReady: false,
    engineBusy: false,
    depth: CONFIG.DEFAULT_DEPTH,
    boardFlipped: false,
    moveIndex: 0,
    game: new Chess(),
    lastArchives: []
  };

  const el = {
    loginPanel: document.getElementById('loginPanel'),
    usernameInput: document.getElementById('usernameInput'),
    fetchBtn: document.getElementById('fetchBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    depthSelect: document.getElementById('depthSelect'),
    inputError: document.getElementById('inputError'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    statusProgress: document.getElementById('statusProgress'),
    historySection: document.getElementById('historySection'),
    gamesGrid: document.getElementById('gamesGrid'),
    summarySection: document.getElementById('summarySection'),
    summaryTitle: document.getElementById('summaryTitle'),
    summarySubtitle: document.getElementById('summarySubtitle'),
    summaryAccuracy: document.getElementById('summaryAccuracy'),
    summaryGrid: document.getElementById('summaryGrid'),
    classificationTable: document.getElementById('classificationTable'),
    startReviewBtn: document.getElementById('startReviewBtn'),
    backToHistoryBtn: document.getElementById('backToHistoryBtn'),
    reviewSection: document.getElementById('reviewSection'),
    reviewBackBtn: document.getElementById('reviewBackBtn'),
    reviewNote: document.getElementById('reviewNote'),
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
    moveExplanation: document.getElementById('moveExplanation'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    moveCounter: document.getElementById('moveCounter'),
    flipBtn: document.getElementById('flipBtn'),
    resetBtn: document.getElementById('resetBtn')
  };

  function init() {
    el.fetchBtn.addEventListener('click', fetchMatchHistory);
    el.refreshBtn.addEventListener('click', fetchMatchHistory);
    el.usernameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') fetchMatchHistory();
    });
    el.depthSelect.addEventListener('change', () => {
      state.depth = Number(el.depthSelect.value || CONFIG.DEFAULT_DEPTH);
    });
    el.startReviewBtn.addEventListener('click', showReview);
    el.backToHistoryBtn.addEventListener('click', showHistoryOnly);
    el.reviewBackBtn.addEventListener('click', showSummaryOnly);
    el.prevBtn.addEventListener('click', () => navigateMove(-1));
    el.nextBtn.addEventListener('click', () => navigateMove(1));
    el.flipBtn.addEventListener('click', () => {
      state.boardFlipped = !state.boardFlipped;
      renderBoard();
    });
    el.resetBtn.addEventListener('click', () => displayMove(0));
    state.depth = Number(el.depthSelect.value || CONFIG.DEFAULT_DEPTH);
  }

  async function fetchMatchHistory() {
    const username = el.usernameInput.value.trim();
    if (!username) {
      showInputError('يرجى إدخال اسم المستخدم على Chess.com.');
      return;
    }

    try {
      state.username = username;
      hideInputError();
      hideAllMainSections();
      showStatus('جاري جلب أرشيف مبارياتك من Chess.com...', 0.08);
      const archives = await fetchArchives(username);
      if (!archives.length) throw new Error('لم يتم العثور على أرشيف مباريات لهذا المستخدم.');
      state.lastArchives = archives;

      const urls = archives.slice(-3).reverse();
      const allGames = [];
      for (let i = 0; i < urls.length; i += 1) {
        showStatus(`جاري تحميل مباريات الشهر ${i + 1} من ${urls.length}...`, 0.15 + (i / urls.length) * 0.35);
        const monthGames = await fetchGames(urls[i]);
        allGames.push(...monthGames);
      }

      state.games = allGames
        .filter((game) => game.rules === 'chess' && game.pgn && game.white && game.black)
        .sort((a, b) => b.end_time - a.end_time)
        .slice(0, CONFIG.MAX_GAMES);

      if (!state.games.length) throw new Error('لم أجد مباريات شطرنج قياسية في آخر الأرشيفات.');

      renderMatchHistory();
      hideStatus();
      el.loginPanel.classList.add('hidden');
      el.historySection.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      hideStatus();
      showInputError(error.message || 'حدث خطأ أثناء جلب سجل المباريات.');
      el.loginPanel.classList.remove('hidden');
    }
  }

  async function fetchArchives(username) {
    const response = await fetch(`${CONFIG.CHESS_API_BASE}${encodeURIComponent(username)}/games/archives`);
    if (!response.ok) throw new Error('تعذر الوصول إلى حساب Chess.com. تأكد من كتابة الاسم بشكل صحيح.');
    const data = await response.json();
    return data.archives || [];
  }

  async function fetchGames(url) {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.games || [];
  }

  function renderMatchHistory() {
    el.gamesGrid.innerHTML = state.games.map((game, index) => {
      const userColor = getUserColor(game);
      const opponent = userColor === 'w' ? game.black.username : game.white.username;
      const result = userColor === 'w' ? game.white.result : game.black.result;
      const date = formatDate(game.end_time);
      const timeControl = formatTimeControl(game.time_control);
      const termination = extractTermination(game.pgn);
      const analyzed = game.analysis ? '<span class="game-badge analyzed">محللة</span>' : '<span class="game-badge">جاهزة</span>';
      return `
        <article class="game-card" data-index="${index}">
          <div class="game-card-top">
            <span class="game-badge ${resultClass(result)}">${resultText(result)}</span>
            ${analyzed}
          </div>
          <h3>${escapeHtml(state.username)} ضد ${escapeHtml(opponent)}</h3>
          <div class="game-card-meta">
            <span>${userColor === 'w' ? 'لعبت بالأبيض' : 'لعبت بالأسود'}</span>
            <span>${date}</span>
            <span>${timeControl}</span>
          </div>
          <p>${escapeHtml(termination)}</p>
          <button class="btn analyze-game-btn" data-index="${index}">${game.analysis ? 'فتح التقرير' : 'تحليل المباراة'}</button>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.analyze-game-btn').forEach((button) => {
      button.addEventListener('click', () => analyzeSelectedGame(Number(button.dataset.index)));
    });
  }

  async function initEngine() {
    if (state.engineReady && state.engine) return;

    let lastError = null;
    for (const source of CONFIG.ENGINE_SOURCES) {
      try {
        await createEngine(source);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Engine source failed: ${source}`, error);
      }
    }
    throw lastError || new Error('تعذر تشغيل محرك Stockfish.');
  }

  function createEngine(source) {
    return new Promise((resolve, reject) => {
      let worker;
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          try { worker && worker.terminate(); } catch (_) { /* ignore */ }
          reject(new Error('انتهت مهلة تشغيل محرك Stockfish.'));
        }
      }, 12000);

      try {
        worker = new Worker(source);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }

      worker.onerror = (error) => {
        if (!resolved) {
          clearTimeout(timer);
          reject(error);
        }
      };

      worker.onmessage = (event) => {
        const message = String(event.data || '');
        if (message === 'uciok') {
          worker.postMessage('setoption name UCI_AnalyseMode value true');
          worker.postMessage('setoption name Skill Level value 20');
          worker.postMessage('setoption name Hash value 256');
          worker.postMessage('setoption name Threads value 2');
          worker.postMessage('isready');
        } else if (message === 'readyok') {
          resolved = true;
          clearTimeout(timer);
          state.engine = worker;
          state.engineReady = true;
          resolve();
        }
      };

      worker.postMessage('uci');
    });
  }

  function engineCommand(fen, depth) {
    return new Promise((resolve) => {
      if (!state.engine) {
        resolve({ bestMove: null, evalWhite: 0, pv: [] });
        return;
      }

      let finalScore = null;
      let finalPv = [];
      let finalDepth = 0;
      const sideToMove = fen.split(' ')[1] || 'w';
      const timer = setTimeout(() => {
        cleanup();
        resolve({ bestMove: null, evalWhite: finalScore ?? 0, pv: finalPv, depth: finalDepth, timedOut: true });
      }, CONFIG.ENGINE_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timer);
        state.engine.removeEventListener('message', listener);
        state.engineBusy = false;
      };

      const listener = (event) => {
        const message = String(event.data || '');
        if (message.startsWith('info') && message.includes(' score ')) {
          const parsed = parseInfoLine(message, sideToMove);
          if (parsed) {
            finalScore = parsed.evalWhite;
            finalPv = parsed.pv;
            finalDepth = parsed.depth;
          }
        }
        if (message.startsWith('bestmove')) {
          const parts = message.split(/\s+/);
          cleanup();
          resolve({ bestMove: parts[1] || null, evalWhite: finalScore ?? 0, pv: finalPv, depth: finalDepth, timedOut: false });
        }
      };

      state.engineBusy = true;
      state.engine.addEventListener('message', listener);
      state.engine.postMessage('stop');
      state.engine.postMessage('ucinewgame');
      state.engine.postMessage('isready');
      state.engine.postMessage(`position fen ${fen}`);
      state.engine.postMessage(`go depth ${depth}`);
    });
  }

  function parseInfoLine(message, sideToMove) {
    const parts = message.trim().split(/\s+/);
    const depthIndex = parts.indexOf('depth');
    const scoreIndex = parts.indexOf('score');
    if (scoreIndex === -1) return null;

    const scoreType = parts[scoreIndex + 1];
    const rawValue = Number(parts[scoreIndex + 2]);
    if (!Number.isFinite(rawValue)) return null;

    let evalForSide;
    if (scoreType === 'cp') {
      evalForSide = rawValue / 100;
    } else if (scoreType === 'mate') {
      const sign = rawValue >= 0 ? 1 : -1;
      evalForSide = sign * (100 - Math.min(Math.abs(rawValue), 20));
    } else {
      return null;
    }

    const pvIndex = parts.indexOf('pv');
    return {
      evalWhite: sideToMove === 'w' ? evalForSide : -evalForSide,
      pv: pvIndex >= 0 ? parts.slice(pvIndex + 1, pvIndex + 6) : [],
      depth: depthIndex >= 0 ? Number(parts[depthIndex + 1]) || 0 : 0
    };
  }

  async function analyzeSelectedGame(index) {
    state.selectedGameIndex = index;
    const gameData = state.games[index];
    if (gameData.analysis) {
      state.currentAnalysis = gameData.analysis;
      renderSummary();
      showSummaryOnly();
      return;
    }

    try {
      hideInputError();
      hideAllMainSections();
      showStatus('جاري تجهيز Stockfish بأعلى إعدادات الدقة المتاحة داخل المتصفح...', 0.03);
      await initEngine();
      showStatus('تم تشغيل المحرك. جاري قراءة PGN وتجهيز النقلات...', 0.08);
      const analysis = await analyzeGame(gameData);
      gameData.analysis = analysis;
      state.currentAnalysis = analysis;
      renderMatchHistory();
      renderSummary();
      hideStatus();
      showSummaryOnly();
    } catch (error) {
      console.error(error);
      hideStatus();
      el.historySection.classList.remove('hidden');
      showInputError(error.message || 'حدث خطأ أثناء تحليل المباراة.');
    }
  }

  async function analyzeGame(gameData) {
    const userColor = getUserColor(gameData);
    const opponent = userColor === 'w' ? gameData.black.username : gameData.white.username;
    const userResult = userColor === 'w' ? gameData.white.result : gameData.black.result;
    const playerWhite = gameData.white.username;
    const playerBlack = gameData.black.username;
    const replay = new Chess();
    const source = new Chess();
    const loaded = source.load_pgn(gameData.pgn, { sloppy: true });
    if (!loaded) throw new Error('تعذر قراءة PGN لهذه المباراة.');

    const history = source.history({ verbose: true });
    const moves = [];
    const counts = createEmptyCounts();
    const userCounts = createEmptyCounts();
    let userAccuracyTotal = 0;
    let userMoveCount = 0;
    let gameAccuracyTotal = 0;

    for (let i = 0; i < history.length; i += 1) {
      const move = history[i];
      const beforeFen = replay.fen();
      const sanPrefix = moves.map((m) => m.san).concat(move.san).join(' ');
      const isBook = OPENING_BOOK.has(sanPrefix) || (i < 8 && OPENING_BOOK.has(sanPrefix.replace(/[+#?!]+/g, '')));
      const moveResult = replay.move(move.san, { sloppy: true });
      if (!moveResult) continue;
      const afterFen = replay.fen();
      const moveUci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;
      const moveColor = moveResult.color;
      const progressBase = i / Math.max(1, history.length);
      showStatus(`تحليل النقلة ${i + 1} من ${history.length}: ${moveResult.san}`, 0.1 + progressBase * 0.85);

      let before = { bestMove: null, evalWhite: 0, pv: [] };
      let actualAfter = { evalWhite: 0 };
      let bestAfterEval = 0;

      if (isBook) {
        actualAfter = { evalWhite: null };
      } else {
        // تحسين: بدلاً من 3 استدعاءات للمحرك، نستخدم 2 فقط لتحسين السرعة
        before = await engineCommand(beforeFen, state.depth);
        
        // إذا كانت النقلة الملعوبة هي الأفضل، فلا نحتاج لتحليل الموقف بعدها بشكل منفصل
        if (before.bestMove && moveUci === before.bestMove) {
            actualAfter = { evalWhite: before.evalWhite };
            bestAfterEval = before.evalWhite;
        } else {
            actualAfter = await engineCommand(afterFen, state.depth);
            bestAfterEval = await evaluateBestAfter(beforeFen, before.bestMove, moveColor, actualAfter.evalWhite);
        }
      }

      const classification = isBook ? 'book' : classifyMove({
        moveUci,
        bestMove: before.bestMove,
        moveColor,
        actualEvalWhite: actualAfter.evalWhite,
        bestEvalWhite: bestAfterEval,
        beforeFen,
        moveResult
      });

      const loss = isBook ? 0 : centipawnLoss(moveColor, actualAfter.evalWhite, bestAfterEval);
      const accuracy = isBook ? 100 : accuracyFromLoss(loss);
      const explanation = buildExplanation({
        classification,
        move: moveResult,
        moveUci,
        bestMove: before.bestMove,
        beforeFen,
        afterFen,
        actualEvalWhite: actualAfter.evalWhite,
        bestEvalWhite: bestAfterEval,
        loss,
        pv: before.pv,
        isUserMove: moveColor === userColor
      });

      counts[classification] += 1;
      gameAccuracyTotal += accuracy;
      if (moveColor === userColor) {
        userCounts[classification] += 1;
        userAccuracyTotal += accuracy;
        userMoveCount += 1;
      }

      moves.push({
        ply: i + 1,
        moveNumber: Math.floor(i / 2) + 1,
        color: moveColor,
        san: moveResult.san,
        from: moveResult.from,
        to: moveResult.to,
        captured: moveResult.captured || null,
        piece: moveResult.piece,
        flags: moveResult.flags,
        uci: moveUci,
        bestMove: before.bestMove,
        bestLine: before.pv || [],
        classification,
        evalBeforeWhite: before.evalWhite,
        evalAfterWhite: actualAfter.evalWhite,
        bestEvalWhite: bestAfterEval,
        loss,
        accuracy,
        fenBefore: beforeFen,
        fenAfter: afterFen,
        explanation,
        isUserMove: moveColor === userColor,
        depth: before.depth || state.depth
      });
    }

    const userAccuracy = userMoveCount ? Math.round(userAccuracyTotal / userMoveCount) : 100;
    const gameAccuracy = moves.length ? Math.round(gameAccuracyTotal / moves.length) : 100;

    return {
      pgn: gameData.pgn,
      url: gameData.url,
      playerWhite,
      playerBlack,
      userColor,
      opponent,
      userResult,
      date: formatDate(gameData.end_time),
      timeControl: formatTimeControl(gameData.time_control),
      termination: extractTermination(gameData.pgn),
      moves,
      counts,
      userCounts,
      userAccuracy,
      gameAccuracy,
      userMoveCount,
      totalMoves: moves.length,
      depth: state.depth
    };
  }

  async function evaluateBestAfter(beforeFen, bestMove, moveColor, fallbackEval) {
    if (!bestMove || bestMove === '(none)') return fallbackEval;
    const chess = new Chess(beforeFen);
    const move = uciToMove(chess, bestMove);
    const applied = move ? chess.move(move) : chess.move(bestMove, { sloppy: true });
    if (!applied) return fallbackEval;
    const bestAfter = await engineCommand(chess.fen(), Math.max(12, state.depth - 2));
    return Number.isFinite(bestAfter.evalWhite) ? bestAfter.evalWhite : fallbackEval;
  }

  function classifyMove({ moveUci, bestMove, moveColor, actualEvalWhite, bestEvalWhite, beforeFen, moveResult }) {
    const loss = centipawnLoss(moveColor, actualEvalWhite, bestEvalWhite);
    if (bestMove && moveUci === bestMove) return 'best';
    if (isBrilliantCandidate(beforeFen, moveResult, loss)) return 'brilliant';
    if (loss <= 0.05) return 'best';
    if (loss <= 0.18) return 'excellent';
    if (loss <= 0.45) return 'good';
    if (loss <= 0.9) return 'inaccuracy';
    if (loss <= 1.8) return 'mistake';
    return 'blunder';
  }

  function centipawnLoss(color, actualEvalWhite, bestEvalWhite) {
    if (!Number.isFinite(actualEvalWhite) || !Number.isFinite(bestEvalWhite)) return 0;
    const loss = color === 'w' ? bestEvalWhite - actualEvalWhite : actualEvalWhite - bestEvalWhite;
    return Math.max(0, loss);
  }

  function accuracyFromLoss(loss) {
    if (loss <= 0.03) return 100;
    const score = 103 * Math.exp(-0.72 * loss) - 3;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function isBrilliantCandidate(beforeFen, moveResult, loss) {
    if (loss > 0.35) return false;
    const chess = new Chess(beforeFen);
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const movingPieceValue = pieceValues[moveResult.piece] || 0;
    const capturedValue = pieceValues[moveResult.captured] || 0;
    const applied = chess.move(moveResult.san, { sloppy: true });
    if (!applied) return false;
    const destination = moveResult.to;
    const opponentMoves = chess.moves({ verbose: true }).filter((reply) => reply.to === destination && reply.captured === moveResult.piece);
    return movingPieceValue >= 3 && (opponentMoves.length > 0 || capturedValue < movingPieceValue - 1);
  }

  function buildExplanation({ classification, move, moveUci, bestMove, beforeFen, afterFen, actualEvalWhite, bestEvalWhite, loss, pv, isUserMove }) {
    const label = LABELS[classification]?.ar || 'نقلة';
    const actor = isUserMove ? 'نقلتك' : 'نقلة الخصم';
    const ideas = [];
    const before = new Chess(beforeFen);
    const after = new Chess(afterFen);
    const pieceName = PIECE_NAMES[move.piece] || 'قطعة';

    if (classification === 'book') {
      ideas.push('هذه نقلة افتتاحية معروفة، لذلك لا يتم الحكم عليها كخطأ لأنها تتبع مبادئ التطوير والسيطرة المبكرة على المركز.');
    }

    if (move.flags && move.flags.includes('c')) {
      ideas.push(`النقلة تكسب ${PIECE_NAMES[move.captured] || 'قطعة'} وتغيّر ميزان المادة على الرقعة.`);
    }
    if (move.san.includes('+')) {
      ideas.push('النقلة تضع الملك تحت كش وتجبر الخصم على الرد فوراً، وهذا يقلل خياراته التكتيكية.');
    }
    if (move.san.includes('#')) {
      ideas.push('النقلة تنهي المباراة بكش مات، وهي النتيجة الحاسمة في الموقف.');
    }
    if (move.san.includes('O-O')) {
      ideas.push('التبييت يحسن أمان الملك ويربط الرخين، وغالباً يساعد على إكمال التطوير.');
    }
    if (['e4', 'd4', 'e5', 'd5', 'c4', 'c5', 'f4', 'f5'].includes(move.to)) {
      const centerIdea = move.piece === 'p'
        ? 'دفع البيدق نحو المركز يزيد التحكم في المربعات المهمة ويفتح خطوطاً لتطوير القطع.'
        : 'هذه النقلة تؤثر مباشرة في المربعات المركزية، والسيطرة على المركز تمنح القطع حرية أكبر.';
      ideas.push(centerIdea);
    }
    if (move.piece === 'n' || move.piece === 'b') {
      const homeSquares = ['b1', 'g1', 'c1', 'f1', 'b8', 'g8', 'c8', 'f8'];
      if (homeSquares.includes(move.from)) {
        ideas.push(`تطوير ${pieceName} من مربعه الأصلي يساعد على إدخال قطعة جديدة في اللعب بدلاً من تكرار نقلات غير ضرورية.`);
      }
    }

    const attackedBefore = isSquareAttacked(before, move.from, opposite(move.color));
    const attackedAfter = isSquareAttacked(after, move.to, opposite(move.color));
    if (attackedBefore && !attackedAfter) {
      const safeText = move.piece === 'q'
        ? 'النقلة تحمي الوزير بإبعاده عن التهديد المباشر وتعيده إلى مربع أكثر أماناً.'
        : `النقلة تعيد ${pieceName} إلى مربع أكثر أماناً وتبعده عن التهديد المباشر.`;
      ideas.push(safeText);
    } else if (!attackedBefore && attackedAfter && !move.san.includes('+')) {
      ideas.push(`يجب الانتباه: ${pieceName} أصبح على مربع يمكن للخصم مهاجمته، لذلك تحتاج النقلة إلى تبرير تكتيكي واضح.`);
    }

    const defended = findNewlyDefendedPieces(beforeFen, afterFen, move.color);
    if (defended.length) {
      ideas.push(`النقلة تزيد حماية ${defended.slice(0, 2).join(' و')}، وهذا يقلل التكتيكات المباشرة ضدها.`);
    }

    const hanging = findNewHangingPieces(beforeFen, afterFen, move.color);
    if (hanging.length) {
      ideas.push(`بعد هذه النقلة أصبحت حماية ${hanging.slice(0, 2).join(' و')} أضعف، وهذا قد يمنح الخصم هدفاً سهلاً.`);
    }

    if (classification === 'best' || classification === 'excellent') {
      ideas.push('تقييم المحرك يؤكد أن هذه النقلة قريبة جداً من أفضل اختيار وتحافظ على جودة الموقف.');
    } else if (classification === 'good') {
      ideas.push('النقلة عملية ومقبولة، لكنها تترك للخصم فرصة أفضل قليلاً مما كان متاحاً بعد أفضل نقلة.');
    } else if (classification === 'inaccuracy') {
      ideas.push('هذه عدم دقة لأنها لا تخسر فوراً، لكنها تسمح للخصم بتحسين موقفه أو تخفف الضغط الذي كان لديك.');
    } else if (classification === 'mistake') {
      ideas.push('هذه النقلة تخسر جزءاً مهماً من أفضلية الموقف أو تسمح برد قوي كان يمكن تجنبه.');
    } else if (classification === 'blunder') {
      ideas.push('هذه غلطة كبيرة لأنها تغيّر تقييم الموقف بشكل واضح لصالح الخصم، وغالباً بسبب قطعة غير محمية أو تهديد تكتيكي مباشر.');
    } else if (classification === 'brilliant') {
      ideas.push('المحرك يرى أن الفكرة التكتيكية سليمة رغم وجود تضحية أو تعريض مؤقت لقطعة، لذلك صُنفت كنقلة عبقرية.');
    }

    const bestText = bestMove && bestMove !== moveUci ? ` كان اقتراح Stockfish الأفضل هو ${formatUci(bestMove)}.` : '';
    const lossText = loss > 0.05 ? ` الفرق التقريبي عن الأفضل هو ${loss.toFixed(2)} بيدق.` : ' الفرق عن الأفضل شبه معدوم.';
    const lineText = pv && pv.length ? ` الخط الرئيسي المقترح: ${pv.map(formatUci).join('، ')}.` : '';
    const main = `${actor} ${move.san}: ${label}.${bestText}${lossText}${lineText}`;
    return `${main} ${ideas.slice(0, 3).join(' ')}`;
  }

  function isSquareAttacked(chess, square, byColor) {
    const clone = new Chess(chess.fen());
    const turn = clone.turn();
    if (turn !== byColor) {
      const fenParts = clone.fen().split(' ');
      fenParts[1] = byColor;
      try { clone.load(fenParts.join(' ')); } catch (_) { return false; }
    }
    return clone.moves({ verbose: true }).some((move) => move.to === square);
  }

  function findNewHangingPieces(beforeFen, afterFen, color) {
    const before = loosePieces(beforeFen, color);
    const after = loosePieces(afterFen, color);
    return after.filter((piece) => !before.includes(piece));
  }

  function findNewlyDefendedPieces(beforeFen, afterFen, color) {
    const before = new Chess(beforeFen);
    const after = new Chess(afterFen);
    const pieces = [];
    const files = 'abcdefgh';
    for (let r = 1; r <= 8; r += 1) {
      for (let f = 0; f < 8; f += 1) {
        const square = `${files[f]}${r}`;
        const beforePiece = before.get(square);
        const afterPiece = after.get(square);
        if (!beforePiece || !afterPiece || beforePiece.color !== color || afterPiece.color !== color || beforePiece.type !== afterPiece.type || afterPiece.type === 'k') continue;
        const wasLoose = isSquareAttacked(before, square, opposite(color)) && !isSquareAttacked(before, square, color);
        const nowDefended = isSquareAttacked(after, square, opposite(color)) && isSquareAttacked(after, square, color);
        if (wasLoose && nowDefended) pieces.push(`${PIECE_NAMES[afterPiece.type]} على ${square}`);
      }
    }
    return pieces;
  }

  function loosePieces(fen, color) {
    const chess = new Chess(fen);
    const pieces = [];
    const files = 'abcdefgh';
    for (let r = 1; r <= 8; r += 1) {
      for (let f = 0; f < 8; f += 1) {
        const square = `${files[f]}${r}`;
        const piece = chess.get(square);
        if (!piece || piece.color !== color || piece.type === 'k') continue;
        const attacked = isSquareAttacked(chess, square, opposite(color));
        const defended = isSquareAttacked(chess, square, color);
        if (attacked && !defended) pieces.push(`${PIECE_NAMES[piece.type]} على ${square}`);
      }
    }
    return pieces;
  }

  function renderSummary() {
    const analysis = state.currentAnalysis;
    const userColorText = analysis.userColor === 'w' ? 'الأبيض' : 'الأسود';
    el.summaryTitle.textContent = `${analysis.playerWhite} ضد ${analysis.playerBlack}`;
    el.summarySubtitle.textContent = `لعبت باللون ${userColorText} ضد ${analysis.opponent}. تم تحليل ${analysis.totalMoves} نقلة بعمق ${analysis.depth}.`;
    el.summaryAccuracy.textContent = `${analysis.userAccuracy}%`;

    const bestLike = analysis.userCounts.book + analysis.userCounts.brilliant + analysis.userCounts.best + analysis.userCounts.excellent;
    el.summaryGrid.innerHTML = `
      ${summaryMetric('دقة لعبك', `${analysis.userAccuracy}%`, 'متوسط جودة نقلاتك فقط')}
      ${summaryMetric('دقة المباراة', `${analysis.gameAccuracy}%`, 'متوسط جميع النقلات للطرفين')}
      ${summaryMetric('نقلات ممتازة أو أفضل', bestLike, 'Book + Brilliant + Best + Excellent')}
      ${summaryMetric('الأخطاء الخطيرة', analysis.userCounts.mistake + analysis.userCounts.blunder, 'Mistake + Blunder')}
      ${summaryMetric('النتيجة', resultText(analysis.userResult), analysis.termination)}
      ${summaryMetric('الزمن', analysis.timeControl, analysis.date)}
    `;

    const rows = Object.keys(LABELS).map((key) => `
      <tr>
        <td><span class="label-dot ${LABELS[key].className}"></span>${LABELS[key].ar}</td>
        <td>${analysis.userCounts[key] || 0}</td>
        <td>${analysis.counts[key] || 0}</td>
      </tr>
    `).join('');

    el.classificationTable.innerHTML = `
      <h3>تفصيل التصنيفات</h3>
      <table>
        <thead><tr><th>التصنيف</th><th>نقلاتك</th><th>كل المباراة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function summaryMetric(label, value, hint) {
    return `<div class="summary-metric"><span>${label}</span><strong>${value}</strong><small>${escapeHtml(String(hint || ''))}</small></div>`;
  }

  function showReview() {
    el.summarySection.classList.add('hidden');
    el.reviewSection.classList.remove('hidden');
    renderReviewMeta();
    renderMovesList();
    displayMove(0);
  }

  function renderReviewMeta() {
    const analysis = state.currentAnalysis;
    el.topPlayer.textContent = analysis.playerBlack;
    el.bottomPlayer.textContent = analysis.playerWhite;
    el.reviewNote.textContent = `مراجعة ${analysis.playerWhite} ضد ${analysis.playerBlack} — اضغط أي نقلة من القائمة لمعرفة سبب تقييمها.`;
    el.gameStats.innerHTML = `
      <div class="stat-item"><span class="stat-label">دقتك:</span><span class="stat-value">${analysis.userAccuracy}%</span></div>
      <div class="stat-item"><span class="stat-label">الخصم:</span><span class="stat-value">${escapeHtml(analysis.opponent)}</span></div>
      <div class="stat-item"><span class="stat-label">النتيجة:</span><span class="stat-value">${resultText(analysis.userResult)}</span></div>
      <div class="stat-item"><span class="stat-label">العمق:</span><span class="stat-value">${analysis.depth}</span></div>
    `;
  }

  function renderMovesList() {
    const moves = state.currentAnalysis.moves;
    el.movesList.innerHTML = moves.map((move, index) => {
      const label = LABELS[move.classification] || LABELS.good;
      const prefix = `${move.moveNumber}${move.color === 'w' ? '.' : '...'}`;
      const actor = move.isUserMove ? 'أنت' : 'الخصم';
      return `
        <button class="move-item ${label.className}" data-index="${index}">
          <span class="move-number">${prefix}</span>
          <span class="move-san">${escapeHtml(move.san)}</span>
          <span class="move-label">${label.ar}</span>
          <span class="move-accuracy">${move.accuracy}%</span>
          <small>${actor}</small>
        </button>
      `;
    }).join('');

    document.querySelectorAll('.move-item').forEach((item) => {
      item.addEventListener('click', () => displayMove(Number(item.dataset.index)));
    });
  }

  function displayMove(index) {
    const moves = state.currentAnalysis.moves;
    if (!moves.length) return;
    state.moveIndex = Math.max(0, Math.min(index, moves.length - 1));
    const move = moves[state.moveIndex];
    state.game = new Chess(move.fenAfter);
    renderBoard(move);
    updateBoardStatus();
    updateEvalBar(move.evalAfterWhite);
    el.moveCounter.textContent = `النقلة ${state.moveIndex + 1} من ${moves.length}`;
    el.prevBtn.disabled = state.moveIndex === 0;
    el.nextBtn.disabled = state.moveIndex === moves.length - 1;
    document.querySelectorAll('.move-item').forEach((item, i) => item.classList.toggle('active', i === state.moveIndex));
    const label = LABELS[move.classification] || LABELS.good;
    el.moveExplanation.innerHTML = `
      <div class="explanation-head">
        <span class="label-pill ${label.className}">${label.ar}</span>
        <strong>${move.moveNumber}${move.color === 'w' ? '.' : '...'} ${escapeHtml(move.san)}</strong>
      </div>
      <p>${escapeHtml(move.explanation)}</p>
    `;
  }

  function navigateMove(direction) {
    displayMove(state.moveIndex + direction);
  }

  function renderBoard(highlightMove = null) {
    el.board.innerHTML = '';
    const fenRows = state.game.fen().split(' ')[0].split('/');
    const board = fenRows.map((row) => {
      const squares = [];
      row.split('').forEach((char) => {
        if (/\d/.test(char)) {
          for (let i = 0; i < Number(char); i += 1) squares.push(null);
        } else {
          squares.push(char);
        }
      });
      return squares;
    });

    for (let displayRow = 0; displayRow < 8; displayRow += 1) {
      const row = state.boardFlipped ? 7 - displayRow : displayRow;
      for (let displayCol = 0; displayCol < 8; displayCol += 1) {
        const col = state.boardFlipped ? 7 - displayCol : displayCol;
        const squareName = `${'abcdefgh'[col]}${8 - row}`;
        const square = document.createElement('div');
        const piece = board[row][col];
        const isLight = (row + col) % 2 === 0;
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        if (highlightMove && (squareName === highlightMove.from || squareName === highlightMove.to)) {
          square.classList.add('highlight');
        }
        if (piece) square.innerHTML = `<img src="${pieceImage(piece)}" class="piece" alt="${piece}" />`;
        el.board.appendChild(square);
      }
    }
  }

  function updateBoardStatus() {
    const turn = state.game.turn() === 'w' ? 'الأبيض' : 'الأسود';
    if (state.game.in_checkmate()) el.boardStatus.textContent = `كش مات. ${turn} خسر.`;
    else if (state.game.in_draw()) el.boardStatus.textContent = 'تعادل.';
    else if (state.game.in_check()) el.boardStatus.textContent = `${turn} في كش.`;
    else el.boardStatus.textContent = `دور ${turn}`;
  }

  function updateEvalBar(evalWhite) {
    if (!Number.isFinite(evalWhite)) evalWhite = 0;
    const percent = Math.max(4, Math.min(96, 50 + evalWhite * 6));
    el.evalFill.style.width = `${percent}%`;
    el.accuracyBar.style.width = `${percent}%`;
    const text = Math.abs(evalWhite) > 90 ? (evalWhite > 0 ? 'M+' : 'M-') : (evalWhite > 0 ? `+${evalWhite.toFixed(2)}` : evalWhite.toFixed(2));
    el.evalText.textContent = text;
    el.accuracyScore.textContent = text;
  }

  function hideAllMainSections() {
    el.historySection.classList.add('hidden');
    el.summarySection.classList.add('hidden');
    el.reviewSection.classList.add('hidden');
  }

  function showHistoryOnly() {
    hideStatus();
    hideAllMainSections();
    el.historySection.classList.remove('hidden');
  }

  function showSummaryOnly() {
    hideStatus();
    hideAllMainSections();
    el.summarySection.classList.remove('hidden');
  }

  function showStatus(text, progress = 0) {
    el.statusText.textContent = text;
    el.statusProgress.style.width = `${Math.round(progress * 100)}%`;
    el.statusBar.classList.remove('hidden');
  }

  function hideStatus() {
    el.statusBar.classList.add('hidden');
    el.statusProgress.style.width = '0%';
  }

  function showInputError(message) {
    el.inputError.textContent = message;
    el.inputError.classList.remove('hidden');
  }

  function hideInputError() {
    el.inputError.classList.add('hidden');
    el.inputError.textContent = '';
  }

  function createEmptyCounts() {
    return Object.keys(LABELS).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
  }

  function getUserColor(game) {
    return game.white.username.toLowerCase() === state.username.toLowerCase() ? 'w' : 'b';
  }

  function resultText(result) {
    if (result === 'win') return 'فوز';
    if (['checkmated', 'timeout', 'resigned', 'lose', 'loss', 'abandoned'].includes(result)) return 'خسارة';
    if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(result)) return 'تعادل';
    return result || 'غير محدد';
  }

  function resultClass(result) {
    if (result === 'win') return 'win';
    if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(result)) return 'draw';
    return 'loss';
  }

  function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTimeControl(value) {
    if (!value) return 'غير محدد';
    if (value.includes('+')) {
      const [base, inc] = value.split('+').map(Number);
      return `${Math.round(base / 60)}+${inc}`;
    }
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return `${Math.round(seconds / 60)} دقيقة`;
    return value;
  }

  function extractTermination(pgn) {
    const match = pgn.match(/\[Termination\s+"([^"]+)"\]/);
    return match ? match[1] : 'لا توجد تفاصيل نهاية المباراة.';
  }

  function uciToMove(chess, uci) {
    if (!uci || uci.length < 4) return null;
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined
    };
  }

  function formatUci(uci) {
    if (!uci || uci.length < 4) return uci || '';
    return `${uci.slice(0, 2)}-${uci.slice(2, 4)}${uci.length > 4 ? '=' + uci.slice(4).toUpperCase() : ''}`;
  }

  function pieceImage(piece) {
    const color = piece === piece.toUpperCase() ? 'w' : 'b';
    const type = piece.toLowerCase();
    const map = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' };
    return `https://www.chess.com/chess-themes/pieces/neo/150/${color}${map[type]}.png`;
  }

  function opposite(color) {
    return color === 'w' ? 'b' : 'w';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  init();
}());
