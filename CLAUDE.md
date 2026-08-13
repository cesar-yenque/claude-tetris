# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A playable Tetris implementation in vanilla JavaScript using HTML5 Canvas. No dependencies, no build step, no package.json — just three files: `index.html`, `style.css`, `game.js`.

## Running the game

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test command — there is no package.json or tooling configured in this repo. Verify changes by opening `index.html` in a browser and playing.

## Architecture

Everything lives in `game.js` (~300 lines), organized around a single game loop:

- **Board model**: `board` is a `ROWS × COLS` matrix (`createBoard()`); each cell is `0` (empty) or an index 1–7 identifying the locked piece's color.
- **Pieces**: `PIECES` holds the 7 tetrominoes plus a bonus 3×3 "nut" piece (a hollow ring — center cell is `0`) as square matrices. `randomPiece()` picks one; `rotateCW()` rotates via transpose + row-reverse.
- **Collision**: `collide(shape, ox, oy)` checks board bounds and overlap with locked cells; used by movement, rotation, and drop logic.
- **Wall kicks**: `tryRotate()` rotates the current piece and, on collision, retries at ±1/±2 column offsets before giving up.
- **Locking / clearing**: `lockPiece()` merges the piece into `board` (`merge()`), then `clearLines()` sweeps bottom-up, removing full rows and unshifting empty ones at the top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/cell, soft drop 1 pt/row.
- **Level/speed**: level increases every 10 lines; drop speed is `max(100, 1000 - (level - 1) * 90)` ms.
- **Ghost piece**: `ghostY()` projects the current piece's landing row; drawn in `draw()` with reduced alpha.
- **Game loop**: `loop(ts)`, driven by `requestAnimationFrame`, accumulates elapsed time and advances the piece down once `dropAccum` exceeds `dropInterval`.
- **Input**: a single `keydown` listener dispatches to move/rotate/soft-drop/hard-drop/pause handlers.
- **Game over**: triggered from `spawn()` when a freshly spawned piece immediately collides; shows the overlay via `endGame()`.

Flow: `init()` → `createBoard()`, pick `next`, `spawn()` (moves `next` into `current`, generates a new `next`), then starts `requestAnimationFrame(loop)`.

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).
