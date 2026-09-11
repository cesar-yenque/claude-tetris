'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - nut (steel grey)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - nut (hollow center)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_KEY = 'tetris-theme';
const GRID_COLOR = { dark: '#22222e', light: '#d8d8e8' };
const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');

const highscoreEntryEl = document.getElementById('highscore-entry');
const highscoreNameInput = document.getElementById('highscore-name-input');
const highscoreSaveBtn = document.getElementById('highscore-save-btn');
const highscoreTableEl = document.getElementById('highscore-table');
const overlayStatsEl = document.getElementById('overlay-stats');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const resetConfirmEl = document.getElementById('reset-confirm');
const resetConfirmYes = document.getElementById('reset-confirm-yes');
const resetConfirmNo = document.getElementById('reset-confirm-no');

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const startHighscoreTableEl = document.getElementById('start-highscore-table');
const startStatsEl = document.getElementById('start-stats');
const startResetBtn = document.getElementById('start-reset-btn');
const startResetConfirmEl = document.getElementById('start-reset-confirm');
const startResetConfirmYes = document.getElementById('start-reset-confirm-yes');
const startResetConfirmNo = document.getElementById('start-reset-confirm-no');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, started;
let combo = 0;
let { bestCombo, bestClear } = loadStats();

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    let improved = false;
    if (combo > bestCombo) { bestCombo = combo; improved = true; }
    if (cleared > bestClear) { bestClear = cleared; improved = true; }
    if (improved) saveStats();
    updateHUD();
  } else {
    combo = 0;
  }
}

function loadHighscores() {
  try {
    const arr = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (e.g. private browsing) — score keeps working in-memory
  }
}

function loadStats() {
  try {
    const obj = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    return { bestCombo: obj.bestCombo || 0, bestClear: obj.bestClear || 0 };
  } catch {
    return { bestCombo: 0, bestClear: 0 };
  }
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ bestCombo, bestClear }));
  } catch {
    // storage unavailable — stats keep working in-memory
  }
}

function qualifiesForHighscore(s) {
  const list = loadHighscores();
  return list.length < MAX_HIGHSCORES || s > list[list.length - 1].score;
}

function renderHighscoreTable(tableEl, highlightEntry, list) {
  const data = list || loadHighscores();
  tableEl.innerHTML = '';
  if (!data.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    tableEl.appendChild(tr);
    return;
  }
  data.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (highlightEntry && entry === highlightEntry) tr.classList.add('highscore-highlight');
    const tdRank = document.createElement('td');
    tdRank.textContent = String(i + 1);
    const tdName = document.createElement('td');
    tdName.textContent = entry.name;
    const tdScore = document.createElement('td');
    tdScore.textContent = entry.score.toLocaleString();
    tr.append(tdRank, tdName, tdScore);
    tableEl.appendChild(tr);
  });
}

function renderStatsLine(el) {
  el.textContent = `Mejor combo: ${bestCombo} · Mejor jugada: ${bestClear} líneas`;
}

function refreshHighscoreUI(highlightEntry, list) {
  renderHighscoreTable(highscoreTableEl, highlightEntry, list);
  renderStatsLine(overlayStatsEl);
  renderHighscoreTable(startHighscoreTableEl, null, list);
  renderStatsLine(startStatsEl);
}

function saveHighscore() {
  const name = (highscoreNameInput.value.trim() || 'Jugador').slice(0, 12);
  const list = loadHighscores();
  const entry = { name, score };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.splice(MAX_HIGHSCORES);
  saveHighscores(list);
  highscoreEntryEl.classList.add('hidden');
  refreshHighscoreUI(entry, list);
}

function resetRecords() {
  try {
    localStorage.removeItem(HIGHSCORES_KEY);
    localStorage.removeItem(STATS_KEY);
  } catch {
    // storage unavailable — nothing persisted to clear
  }
  bestCombo = 0;
  bestClear = 0;
  refreshHighscoreUI();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  const isLight = document.body.classList.contains('light');
  ctx.strokeStyle = isLight ? GRID_COLOR.light : GRID_COLOR.dark;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  if (qualifiesForHighscore(score)) {
    highscoreEntryEl.classList.remove('hidden');
    highscoreNameInput.value = '';
    highscoreNameInput.focus();
  } else {
    highscoreEntryEl.classList.add('hidden');
  }
  renderHighscoreTable(highscoreTableEl, null);
  renderStatsLine(overlayStatsEl);
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggle.checked = theme === 'light';
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  started = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  draw();
  drawNext();
});

highscoreSaveBtn.addEventListener('click', saveHighscore);
highscoreNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveHighscore();
});

function wireResetConfirm(btn, confirmEl, yesBtn, noBtn) {
  btn.addEventListener('click', () => {
    btn.classList.add('hidden');
    confirmEl.classList.remove('hidden');
  });
  yesBtn.addEventListener('click', () => {
    resetRecords();
    confirmEl.classList.add('hidden');
    btn.classList.remove('hidden');
  });
  noBtn.addEventListener('click', () => {
    confirmEl.classList.add('hidden');
    btn.classList.remove('hidden');
  });
}

wireResetConfirm(resetScoresBtn, resetConfirmEl, resetConfirmYes, resetConfirmNo);
wireResetConfirm(startResetBtn, startResetConfirmEl, startResetConfirmYes, startResetConfirmNo);

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

loadTheme();
refreshHighscoreUI();
