import { addPlayTime, getData, recordResult } from '../utils/storage.js';
import { sound } from '../utils/sound.js';

const SIZE = 8;
const SHAPES = [
  { name: 'MỘT Ô', weight: 2.2, cells: [[0, 0]] },
  { name: 'NGANG 2 Ô', weight: 1.6, cells: [[0, 0], [0, 1]] },
  { name: 'DỌC 2 Ô', weight: 1.6, cells: [[0, 0], [1, 0]] },
  { name: 'NGANG 3 Ô', weight: 1.35, cells: [[0, 0], [0, 1], [0, 2]] },
  { name: 'DỌC 3 Ô', weight: 1.35, cells: [[0, 0], [1, 0], [2, 0]] },
  { name: 'NGANG 4 Ô', weight: 0.9, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: 'NGANG 5 Ô', weight: 0.55, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { name: 'HÌNH VUÔNG', weight: 1, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: 'KHỐI 2 × 3', weight: 0.5, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { name: 'KHỐI 3 × 3', weight: 0.15, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
  { name: 'HÌNH CHỮ L', weight: 0.85, cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: 'HÌNH CHỮ L NGƯỢC', weight: 0.85, cells: [[0, 1], [1, 1], [2, 0], [2, 1]] },
  { name: 'HÌNH CHỮ L', weight: 0.85, cells: [[0, 0], [0, 1], [0, 2], [1, 0]] },
  { name: 'TIA SÉT', weight: 1.1, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { name: 'HÌNH CHỮ T', weight: 0.9, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
];
const COLORS = ['cyan', 'pink', 'lime', 'purple', 'orange'];
const ROTATIONS = [0, 90, 180, 270];

export function rotateBlockCells(cells, rotation) {
  let rotated = cells.map(([row, col]) => [row, col]);
  const turns = Math.round(rotation / 90) % 4;
  for (let turn = 0; turn < turns; turn += 1) {
    const maxRow = Math.max(...rotated.map(([row]) => row));
    rotated = rotated.map(([row, col]) => [col, maxRow - row]);
  }
  return rotated.sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
}

function randomShape() {
  const totalWeight = SHAPES.reduce((total, shape) => total + (shape.weight ?? 1), 0);
  let randomWeight = Math.random() * totalWeight;
  for (const shape of SHAPES) {
    randomWeight -= shape.weight ?? 1;
    if (randomWeight < 0) return shape;
  }
  return SHAPES[SHAPES.length - 1];
}

export function createBlockGame({ onBack }) {
  const startedAt = Date.now();
  let board;
  let tray;
  let score;
  let combo;
  let ended;
  let locked;
  let recorded;
  let selectedIndex = null;
  let dragState = null;
  let clearTimer = null;

  const root = document.createElement('section');
  root.className = 'game-shell block-game enter';
  root.innerHTML = `
    <div class="game-topbar">
      <button class="back-button">← <span>VỀ KHO TRÒ CHƠI</span></button>
      <div class="game-label"><i></i> XẾP KHỐI // CHẾ ĐỘ GIẢI ĐỐ</div>
      <button class="restart-icon" aria-label="Chơi lại">↻</button>
    </div>
    <div class="block-hud glass">
      <div><small>ĐIỂM</small><strong id="block-score">0000</strong></div>
      <div class="block-title"><b>XẾP</b><span>KHỐI</span></div>
      <div><small>ĐIỂM CAO NHẤT</small><strong id="block-high">0</strong></div>
      <div><small>LIÊN HOÀN</small><strong id="block-combo">×0</strong></div>
    </div>
    <div class="block-stage">
      <div class="block-board-wrap glass">
        <div class="block-board" aria-label="Bảng Block 8 x 8"></div>
        <div class="block-shatter-layer" aria-hidden="true"></div>
        <div class="block-praise" aria-live="polite"><i>✦</i><strong></strong><small></small><i>✦</i></div>
        <div class="canvas-overlay block-overlay"><small>KHÔNG CÒN NƯỚC ĐI</small><strong>TRÒ CHƠI KẾT THÚC</strong><span>Điểm <b>0</b></span><button>CHƠI LẠI</button></div>
      </div>
      <div class="pieces-area glass">
        <div class="pieces-heading"><span>KHỐI ĐANG CÓ</span><small>KÉO HOẶC CHẠM ĐỂ ĐẶT</small></div>
        <div class="piece-tray"></div>
        <div class="combo-flash">LIÊN HOÀN <b>×2</b></div>
      </div>
    </div>
    <div class="block-actions"><p><i></i> Lấp đầy một hàng hoặc cột để phá khối</p><button class="secondary-button restart-button">↻ CHƠI LẠI</button></div>
    <div class="drag-ghost"></div>`;

  const boardElement = root.querySelector('.block-board');
  const trayElement = root.querySelector('.piece-tray');
  const ghost = root.querySelector('.drag-ghost');
  const overlay = root.querySelector('.block-overlay');
  const shatterLayer = root.querySelector('.block-shatter-layer');

  function createRandomPiece() {
    const source = randomShape();
    const rotation = ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
    return {
      ...source,
      rotation,
      cells: rotateBlockCells(source.cells, rotation),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }

  function renderBoard() {
    boardElement.innerHTML = '';
    board.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      const square = document.createElement('button');
      square.className = `block-cell ${cell ? `filled ${cell}` : ''}`;
      square.dataset.row = rowIndex;
      square.dataset.col = colIndex;
      square.setAttribute('aria-label', `Hàng ${rowIndex + 1}, cột ${colIndex + 1}`);
      boardElement.append(square);
    }));
  }

  function pieceMarkup(piece) {
    if (!piece) return '';
    const rows = Math.max(...piece.cells.map(([row]) => row)) + 1;
    const cols = Math.max(...piece.cells.map(([, col]) => col)) + 1;
    return `<div class="piece-shape color-${piece.color}" style="--rows:${rows};--cols:${cols}">
      ${piece.cells.map(([row, col]) => `<i style="--row:${row};--col:${col}"></i>`).join('')}
    </div>`;
  }

  function renderTray() {
    trayElement.innerHTML = tray.map((piece, index) => `<button class="piece-slot ${piece ? '' : 'used'} ${selectedIndex === index ? 'selected' : ''}" data-index="${index}" ${piece ? '' : 'disabled'}>
      ${pieceMarkup(piece)}<small>${piece?.name || 'ĐÃ ĐẶT'}</small>
    </button>`).join('');
  }

  function updateHud() {
    root.querySelector('#block-score').textContent = String(score).padStart(4, '0');
    root.querySelector('#block-high').textContent = Math.max(score, getData().scores.block).toLocaleString('vi-VN');
    root.querySelector('#block-combo').textContent = `×${combo}`;
  }

  function canPlace(piece, startRow, startCol) {
    return piece?.cells.every(([row, col]) => {
      const targetRow = startRow + row;
      const targetCol = startCol + col;
      return targetRow >= 0 && targetRow < SIZE && targetCol >= 0 && targetCol < SIZE && !board[targetRow][targetCol];
    });
  }

  function showPreview(piece, startRow, startCol) {
    clearBoardPreview();
    if (!piece) return;
    const valid = canPlace(piece, startRow, startCol);
    piece.cells.forEach(([row, col]) => {
      const targetRow = startRow + row;
      const targetCol = startCol + col;
      const cell = boardElement.children[targetRow * SIZE + targetCol];
      cell?.classList.add(valid ? 'preview' : 'invalid');
      if (valid) cell?.classList.add(`preview-${piece.color}`);
    });
  }

  function clearBoardPreview() {
    boardElement.querySelectorAll('.preview, .invalid').forEach((cell) => {
      cell.classList.remove('preview', 'invalid', ...COLORS.map((color) => `preview-${color}`));
    });
  }

  function completedLines() {
    const rows = [];
    const cols = [];
    for (let index = 0; index < SIZE; index += 1) {
      if (board[index].every(Boolean)) rows.push(index);
      if (board.every((row) => row[index])) cols.push(index);
    }
    return { rows, cols };
  }

  function finishTurn(lines) {
    locked = false;
    selectedIndex = null;
    if (tray.every((piece) => !piece)) tray = [createRandomPiece(), createRandomPiece(), createRandomPiece()];
    renderBoard(); renderTray(); updateHud();
    if (!tray.some((piece) => piece && hasAnyMove(piece))) gameOver();
  }

  function clearLines(lines) {
    const indexes = new Set();
    lines.rows.forEach((row) => { for (let col = 0; col < SIZE; col += 1) indexes.add(row * SIZE + col); });
    lines.cols.forEach((col) => { for (let row = 0; row < SIZE; row += 1) indexes.add(row * SIZE + col); });
    indexes.forEach((index) => {
      boardElement.children[index].classList.add('clearing');
      createShatterEffect(index);
    });
    const totalLines = lines.rows.length + lines.cols.length;
    combo += 1;
    const earnedPoints = indexes.size * 5 + totalLines * 50 * combo;
    score += earnedPoints;
    updateHud(); sound.blockBreak(combo, totalLines);
    triggerBoardImpact(totalLines);
    showPraise(totalLines, earnedPoints);
    const scoreValue = root.querySelector('#block-score');
    scoreValue.classList.remove('score-gain'); void scoreValue.offsetWidth; scoreValue.classList.add('score-gain');
    const flash = root.querySelector('.combo-flash');
    flash.querySelector('b').textContent = `×${combo}`;
    flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show');
    clearTimer = setTimeout(() => {
      lines.rows.forEach((row) => { for (let col = 0; col < SIZE; col += 1) board[row][col] = null; });
      lines.cols.forEach((col) => { for (let row = 0; row < SIZE; row += 1) board[row][col] = null; });
      clearTimer = null;
      finishTurn(lines);
    }, 460);
  }

  function triggerBoardImpact(totalLines) {
    const frame = root.querySelector('.block-board-wrap');
    frame.classList.remove('shatter-impact', 'impact-heavy');
    void frame.offsetWidth;
    frame.classList.add('shatter-impact');
    if (totalLines > 1) frame.classList.add('impact-heavy');
  }

  function showPraise(totalLines, earnedPoints) {
    const praise = root.querySelector('.block-praise');
    const normalPraise = ['TUYỆT VỜI!', 'CHÍNH XÁC!', 'LÀM TỐT LẮM!'];
    let message = normalPraise[Math.floor(Math.random() * normalPraise.length)];
    if (combo >= 4) message = 'HUỶ DIỆT!';
    else if (totalLines >= 2) message = 'XUẤT SẮC!';
    else if (combo >= 2) message = 'QUÁ ĐỈNH!';
    praise.querySelector('strong').textContent = message;
    praise.querySelector('small').textContent = `+${earnedPoints} ĐIỂM  •  LIÊN HOÀN ×${combo}`;
    praise.classList.remove('show');
    void praise.offsetWidth;
    praise.classList.add('show');
  }

  function createShatterEffect(index) {
    const cell = boardElement.children[index];
    if (!cell) return;
    const color = COLORS.find((name) => cell.classList.contains(name)) || 'cyan';
    const cellRect = cell.getBoundingClientRect();
    const layerRect = shatterLayer.getBoundingClientRect();
    const centerX = cellRect.left - layerRect.left + cellRect.width / 2;
    const centerY = cellRect.top - layerRect.top + cellRect.height / 2;

    const ring = document.createElement('i');
    ring.className = `block-burst-ring shard-${color}`;
    ring.style.left = `${centerX}px`;
    ring.style.top = `${centerY}px`;
    ring.style.width = `${cellRect.width * .78}px`;
    ring.style.height = `${cellRect.height * .78}px`;
    shatterLayer.append(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });

    const shardShapes = [
      'polygon(0 0, 100% 14%, 72% 100%, 12% 78%)',
      'polygon(18% 0, 100% 32%, 76% 100%, 0 68%)',
      'polygon(0 18%, 84% 0, 100% 76%, 28% 100%)',
    ];
    for (let pieceIndex = 0; pieceIndex < 7; pieceIndex += 1) {
      const shard = document.createElement('i');
      const travelX = (Math.random() - .5) * Math.max(68, cellRect.width * 1.8);
      const riseY = -(28 + Math.random() * Math.max(38, cellRect.height));
      shard.className = `block-shard shard-${color}`;
      shard.style.left = `${centerX + (Math.random() - .5) * cellRect.width * .55}px`;
      shard.style.top = `${centerY + (Math.random() - .5) * cellRect.height * .45}px`;
      shard.style.width = `${Math.max(5, cellRect.width * (.13 + Math.random() * .14))}px`;
      shard.style.height = `${Math.max(5, cellRect.height * (.12 + Math.random() * .13))}px`;
      shard.style.clipPath = shardShapes[pieceIndex % shardShapes.length];
      shard.style.setProperty('--mid-x', `${travelX * .58}px`);
      shard.style.setProperty('--mid-y', `${riseY}px`);
      shard.style.setProperty('--end-x', `${travelX}px`);
      shard.style.setProperty('--end-y', `${riseY + 62 + Math.random() * 36}px`);
      shard.style.setProperty('--spin', `${(Math.random() - .5) * 620}deg`);
      shard.style.setProperty('--shard-delay', `${Math.random() * 70}ms`);
      shatterLayer.append(shard);
      shard.addEventListener('animationend', () => shard.remove(), { once: true });
    }
  }

  function placePiece(index, row, col) {
    const piece = tray[index];
    if (locked || ended || !canPlace(piece, row, col)) return false;
    locked = true;
    piece.cells.forEach(([cellRow, cellCol]) => { board[row + cellRow][col + cellCol] = piece.color; });
    score += piece.cells.length * 10;
    tray[index] = null;
    sound.click();
    renderBoard(); renderTray(); updateHud();
    const lines = completedLines();
    if (lines.rows.length || lines.cols.length) clearLines(lines);
    else { combo = 0; finishTurn(lines); }
    return true;
  }

  function hasAnyMove(piece) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) if (canPlace(piece, row, col)) return true;
    }
    return false;
  }

  function gameOver() {
    ended = true;
    if (!recorded) { recordResult('BLOCK', score); recorded = true; }
    overlay.querySelector('b').textContent = score.toLocaleString('vi-VN');
    overlay.classList.add('visible');
    sound.gameOver();
  }

  function restart() {
    clearTimeout(clearTimer);
    clearTimer = null;
    shatterLayer.innerHTML = '';
    root.querySelector('.block-board-wrap').classList.remove('shatter-impact', 'impact-heavy');
    root.querySelector('.block-praise').classList.remove('show');
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tray = [createRandomPiece(), createRandomPiece(), createRandomPiece()];
    score = 0; combo = 0; ended = false; locked = false; recorded = false; selectedIndex = null;
    overlay.classList.remove('visible');
    renderBoard(); renderTray(); updateHud();
  }

  function boardPosition(clientX, clientY, piece) {
    const firstCell = boardElement.children[0]?.getBoundingClientRect();
    const nextCol = boardElement.children[1]?.getBoundingClientRect();
    const nextRow = boardElement.children[SIZE]?.getBoundingClientRect();
    if (!firstCell || !nextCol || !nextRow) return null;
    const colStep = nextCol.left - firstCell.left;
    const rowStep = nextRow.top - firstCell.top;
    const cols = Math.max(...piece.cells.map(([, col]) => col)) + 1;
    const rows = Math.max(...piece.cells.map(([row]) => row)) + 1;
    const shapeWidth = (cols - 1) * colStep + firstCell.width;
    const shapeHeight = (rows - 1) * rowStep + firstCell.height;
    return {
      row: Math.round((clientY - shapeHeight / 2 - firstCell.top) / rowStep),
      col: Math.round((clientX - shapeWidth / 2 - firstCell.left) / colStep),
      cellWidth: firstCell.width,
      cellHeight: firstCell.height,
      colStep,
      rowStep,
    };
  }

  function pointerDown(event) {
    const slot = event.target.closest('.piece-slot:not(.used)');
    if (!slot || locked || ended) return;
    event.preventDefault();
    const index = Number(slot.dataset.index);
    selectedIndex = index;
    sound.whoosh();
    dragState = {
      index,
      pointerId: event.pointerId,
      dropTarget: null,
      lift: event.pointerType === 'touch' ? 72 : 24,
    };
    root.classList.add('block-dragging');
    ghost.innerHTML = pieceMarkup(tray[index]);
    ghost.classList.add('visible');
    updateDragPosition(event.clientX, event.clientY);
    slot.setPointerCapture?.(event.pointerId);
    renderTray();
  }

  function pointerMove(event) {
    if (!dragState) return;
    event.preventDefault();
    updateDragPosition(event.clientX, event.clientY);
  }

  function pointerUp(event) {
    if (!dragState) return;
    const { index, dropTarget } = dragState;
    if (dropTarget?.valid) placePiece(index, dropTarget.row, dropTarget.col);
    dragState = null;
    root.classList.remove('block-dragging');
    ghost.className = 'drag-ghost';
    clearBoardPreview();
    renderTray();
  }

  function setGhostCellSize(position) {
    const shape = ghost.querySelector('.piece-shape');
    if (!shape || !position) return;
    shape.style.setProperty('--piece-step-x', `${position.colStep}px`);
    shape.style.setProperty('--piece-step-y', `${position.rowStep}px`);
    shape.style.setProperty('--piece-width', `${position.cellWidth}px`);
    shape.style.setProperty('--piece-height', `${position.cellHeight}px`);
  }

  function moveGhost(x, y, position) {
    ghost.classList.remove('snapped', 'valid', 'invalid-drop');
    setGhostCellSize(position);
    ghost.style.transform = `translate3d(${x}px, ${y - dragState.lift}px, 0) translate(-50%, -50%)`;
  }

  function snapGhost(position, valid) {
    const targetCell = boardElement.children[position.row * SIZE + position.col];
    const targetRect = targetCell.getBoundingClientRect();
    setGhostCellSize(position);
    ghost.classList.add('snapped', valid ? 'valid' : 'invalid-drop');
    ghost.style.transform = `translate3d(${targetRect.left}px, ${targetRect.top}px, 0)`;
  }

  function updateDragPosition(clientX, clientY) {
    const piece = tray[dragState.index];
    const position = boardPosition(clientX, clientY - dragState.lift, piece);
    clearBoardPreview();
    if (!position) {
      dragState.dropTarget = null;
      moveGhost(clientX, clientY, position);
      return;
    }

    const fullyInside = piece.cells.every(([row, col]) => {
      const targetRow = position.row + row;
      const targetCol = position.col + col;
      return targetRow >= 0 && targetRow < SIZE && targetCol >= 0 && targetCol < SIZE;
    });
    if (!fullyInside) {
      dragState.dropTarget = null;
      moveGhost(clientX, clientY, position);
      return;
    }

    const valid = canPlace(piece, position.row, position.col);
    dragState.dropTarget = { row: position.row, col: position.col, valid };
    showPreview(piece, position.row, position.col);
    snapGhost(position, valid);
  }

  function boardClick(event) {
    if (selectedIndex === null || dragState || locked) return;
    const cell = event.target.closest('.block-cell');
    if (!cell) return;
    placePiece(selectedIndex, Number(cell.dataset.row), Number(cell.dataset.col));
  }

  trayElement.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove, { passive: false });
  window.addEventListener('pointerup', pointerUp);
  window.addEventListener('pointercancel', pointerUp);
  boardElement.addEventListener('click', boardClick);
  root.querySelector('.back-button').addEventListener('click', onBack);
  root.querySelectorAll('.restart-button, .restart-icon').forEach((button) => button.addEventListener('click', restart));
  overlay.querySelector('button').addEventListener('click', restart);
  restart();

  return {
    element: root,
    destroy() {
      clearTimeout(clearTimer);
      shatterLayer.innerHTML = '';
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      addPlayTime((Date.now() - startedAt) / 1000);
    },
  };
}
