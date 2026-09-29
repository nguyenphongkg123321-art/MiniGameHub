import { addPlayTime, getData, recordResult } from '../utils/storage.js';
import { sound } from '../utils/sound.js';

const BOARD_SIZE = 19;
const WIN_LENGTH = 5;

export function checkCaroWin(board, row, col, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [rowStep, colStep] of directions) {
    const cells = [[row, col]];
    for (const sign of [-1, 1]) {
      let nextRow = row + rowStep * sign;
      let nextCol = col + colStep * sign;
      while (board[nextRow]?.[nextCol] === player) {
        cells.push([nextRow, nextCol]);
        nextRow += rowStep * sign;
        nextCol += colStep * sign;
      }
    }
    if (cells.length >= WIN_LENGTH) return cells;
  }
  return null;
}

export function createCaroGame({ onBack }) {
  const startedAt = Date.now();
  let board = [];
  let currentPlayer = 'X';
  let lastCell = null;
  let gameEnded = false;
  let moves = 0;
  let gameMode = 'cpu';
  let aiDifficulty = 'medium';
  let aiThinking = false;
  let aiTimer = null;

  const root = document.createElement('section');
  root.className = 'game-shell caro-game enter';
  root.innerHTML = `
    <div class="game-topbar">
      <button class="back-button">← <span>VỀ KHO TRÒ CHƠI</span></button>
      <div class="game-label"><i></i> CỜ CARO // NĂM QUÂN LIÊN TIẾP</div>
      <button class="restart-icon" aria-label="Chơi lại">↻</button>
    </div>
    <div class="game-layout caro-layout">
      <aside class="game-sidebar glass">
        <div class="sidebar-title">TRẠNG THÁI TRẬN ĐẤU</div>
        <div class="caro-mode" role="group" aria-label="Chọn chế độ chơi">
          <button data-mode="cpu" class="active">ĐẤU VỚI MÁY</button>
          <button data-mode="pvp">HAI NGƯỜI</button>
        </div>
        <div class="difficulty-picker">
          <small>ĐỘ KHÓ CỦA MÁY</small>
          <div role="group" aria-label="Chọn độ khó">
            <button data-difficulty="medium" class="active">VỪA</button>
            <button data-difficulty="hard">KHÓ</button>
          </div>
        </div>
        <div class="turn-card"><small>LƯỢT HIỆN TẠI</small><strong class="turn-value x">NGƯỜI CHƠI X</strong></div>
        <div class="versus-score">
          <div><span class="player-symbol x">X</span><small id="x-label">BẠN</small><strong id="x-wins">0</strong></div>
          <b>ĐẤU</b>
          <div><span class="player-symbol o">O</span><small id="o-label">MÁY</small><strong id="o-wins">0</strong></div>
        </div>
        <div class="game-rules"><strong>CÁCH CHIẾN THẮNG</strong><p>Đặt 5 quân liên tiếp theo hàng ngang, dọc hoặc đường chéo.</p></div>
        <button class="secondary-button restart-button">↻ TRẬN MỚI</button>
      </aside>
      <div class="board-wrap glass">
        <div class="caro-board" role="grid" aria-label="Bàn cờ Caro 15 x 15"></div>
        <div class="game-message" aria-live="polite"></div>
      </div>
    </div>`;

  const boardElement = root.querySelector('.caro-board');
  const turnValue = root.querySelector('.turn-value');
  const message = root.querySelector('.game-message');

  function updateWins() {
    const scores = getData().scores;
    root.querySelector('#x-wins').textContent = scores.caroX;
    root.querySelector('#o-wins').textContent = scores.caroO;
  }

  function reset() {
    clearTimeout(aiTimer);
    aiTimer = null;
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(''));
    currentPlayer = 'X';
    lastCell = null;
    gameEnded = false;
    aiThinking = false;
    moves = 0;
    message.className = 'game-message';
    message.innerHTML = '';
    boardElement.innerHTML = '';
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = document.createElement('button');
        cell.className = 'caro-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Hàng ${row + 1}, cột ${col + 1}`);
        boardElement.append(cell);
      }
    }
    drawTurn();
  }

  function drawTurn() {
    const isCpuTurn = gameMode === 'cpu' && currentPlayer === 'O';
    turnValue.textContent = isCpuTurn ? (aiThinking ? 'MÁY ĐANG SUY NGHĨ...' : 'MÁY') : `NGƯỜI CHƠI ${currentPlayer}`;
    turnValue.className = `turn-value ${currentPlayer.toLowerCase()}`;
    boardElement.classList.toggle('ai-thinking', isCpuTurn);
  }

  function finish(winner, winningCells = []) {
    clearTimeout(aiTimer);
    gameEnded = true;
    const score = winner === 'X' ? getData().scores.caroX + 1 : getData().scores.caroO + 1;
    recordResult('CARO', score, { winner });
    winningCells.forEach(([row, col]) => boardElement.children[row * BOARD_SIZE + col].classList.add('winner'));
    message.className = 'game-message visible win-message';
    const winnerName = gameMode === 'cpu' ? (winner === 'X' ? 'BẠN CHIẾN THẮNG!' : 'MÁY CHIẾN THẮNG!') : `NGƯỜI CHƠI ${winner} THẮNG!`;
    message.innerHTML = `<small>TRẬN ĐẤU KẾT THÚC</small><strong>${winnerName}</strong><button>CHƠI LẠI</button>`;
    message.querySelector('button').addEventListener('click', reset, { once: true });
    updateWins();
    sound.win();
  }

  function placeMove(row, col, player) {
    if (gameEnded || board[row][col]) return false;
    const cell = boardElement.children[row * BOARD_SIZE + col];
    board[row][col] = player;
    moves += 1;
    if (lastCell) lastCell.classList.remove('last-move');
    lastCell = cell;
    cell.textContent = player;
    cell.classList.add(player.toLowerCase(), 'last-move', 'placed');
    sound.click();
    const winningCells = checkCaroWin(board, row, col, player);
    if (winningCells) {
      finish(player, winningCells);
      return true;
    }
    if (moves === BOARD_SIZE * BOARD_SIZE) {
      gameEnded = true;
      recordResult('CARO', 0);
      message.className = 'game-message visible';
      message.innerHTML = '<small>TRẬN ĐẤU KẾT THÚC</small><strong>HÒA</strong><button>CHƠI LẠI</button>';
      message.querySelector('button').addEventListener('click', reset, { once: true });
      return true;
    }
    currentPlayer = player === 'X' ? 'O' : 'X';
    drawTurn();
    return true;
  }

  function handleMove(event) {
    const cell = event.target.closest('.caro-cell');
    if (!cell || gameEnded || aiThinking || (gameMode === 'cpu' && currentPlayer === 'O')) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (!placeMove(row, col, currentPlayer) || gameEnded) return;
    if (gameMode === 'cpu') scheduleAiMove();
  }

  function scheduleAiMove() {
    aiThinking = true;
    drawTurn();
    aiTimer = setTimeout(() => {
      if (gameEnded || gameMode !== 'cpu') return;
      const move = chooseAiMove();
      aiThinking = false;
      if (move) placeMove(move.row, move.col, 'O');
    }, { medium: 420, hard: 580 }[aiDifficulty]);
  }

  function chooseAiMove() {
    if (moves === 0) return { row: 7, col: 7 };
    const candidates = getCandidateMoves();
    const winningMove = findImmediateMove(candidates, 'O');
    if (winningMove) return winningMove;

    const blockingMove = findImmediateMove(candidates, 'X');
    if (blockingMove) return blockingMove;
    return candidates
      .map((move) => ({ ...move, score: evaluateMove(move.row, move.col) }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function findImmediateMove(candidates, player) {
    for (const move of candidates) {
      board[move.row][move.col] = player;
      const wins = checkCaroWin(board, move.row, move.col, player);
      board[move.row][move.col] = '';
      if (wins) return move;
    }
    return null;
  }

  function getCandidateMoves() {
    const candidates = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (board[row][col]) continue;
        let nearStone = false;
        for (let rowOffset = -2; rowOffset <= 2 && !nearStone; rowOffset += 1) {
          for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
            if (board[row + rowOffset]?.[col + colOffset]) {
              nearStone = true;
              break;
            }
          }
        }
        if (nearStone) candidates.push({ row, col });
      }
    }
    return candidates.length ? candidates : [{ row: 7, col: 7 }];
  }

  function evaluateMove(row, col) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const hard = aiDifficulty === 'hard';
    const weights = hard ? [0, 5, 42, 380, 4200, 100000] : [0, 3, 18, 110, 900, 10000];
    let score = 14 - Math.abs(7 - row) - Math.abs(7 - col) + (hard ? 0 : Math.random() * 2);
    for (const [rowStep, colStep] of directions) {
      score += lineScore(row, col, rowStep, colStep, 'O', weights) * (hard ? 1.35 : 1.15);
      score += lineScore(row, col, rowStep, colStep, 'X', weights) * (hard ? 1.2 : 1);
    }
    if (hard) score += evaluateFutureThreats(row, col) * 5000;
    return score;
  }

  function evaluateFutureThreats(row, col) {
    board[row][col] = 'O';
    const nextCandidates = getCandidateMoves();
    let winningThreats = 0;
    for (const move of nextCandidates) {
      board[move.row][move.col] = 'O';
      if (checkCaroWin(board, move.row, move.col, 'O')) winningThreats += 1;
      board[move.row][move.col] = '';
    }
    board[row][col] = '';
    return winningThreats;
  }

  function lineScore(row, col, rowStep, colStep, player, weights) {
    let count = 1;
    let openEnds = 0;
    for (const sign of [-1, 1]) {
      let distance = 1;
      while (board[row + rowStep * distance * sign]?.[col + colStep * distance * sign] === player) {
        count += 1;
        distance += 1;
      }
      if (board[row + rowStep * distance * sign]?.[col + colStep * distance * sign] === '') openEnds += 1;
    }
    return weights[Math.min(count, 5)] * (openEnds === 2 ? 1.8 : openEnds === 1 ? 1 : 0.15);
  }

  boardElement.addEventListener('click', handleMove);
  root.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    gameMode = button.dataset.mode;
    root.querySelector('[data-mode].active')?.classList.remove('active');
    button.classList.add('active');
    root.querySelector('#x-label').textContent = gameMode === 'cpu' ? 'BẠN' : 'NGƯỜI CHƠI X';
    root.querySelector('#o-label').textContent = gameMode === 'cpu' ? 'MÁY' : 'NGƯỜI CHƠI O';
    root.querySelector('.difficulty-picker').classList.toggle('hidden', gameMode !== 'cpu');
    sound.click();
    reset();
  }));
  root.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
    aiDifficulty = button.dataset.difficulty;
    root.querySelector('[data-difficulty].active')?.classList.remove('active');
    button.classList.add('active');
    sound.click();
  }));
  root.querySelectorAll('.restart-button, .restart-icon').forEach((button) => button.addEventListener('click', () => { sound.click(); reset(); }));
  root.querySelector('.back-button').addEventListener('click', onBack);
  updateWins();
  reset();

  return {
    element: root,
    destroy() {
      clearTimeout(aiTimer);
      boardElement.removeEventListener('click', handleMove);
      addPlayTime((Date.now() - startedAt) / 1000);
    },
  };
}
