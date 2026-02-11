import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const GRID_SIZE = 9;
const BOX_SIZE = 3;

const clampDigit = (value) => {
  const v = String(value ?? '').trim();
  if (v === '') return '';
  const d = Number(v);
  if (!Number.isInteger(d) || d < 1 || d > 9) return '';
  return String(d);
};

const makeEmptyGrid = () => Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(''));

const parseGridToNumbers = (grid) =>
  grid.map((row) => row.map((cell) => (cell === '' ? 0 : Number(cell))));

const formatNumbersToGrid = (numbers) =>
  numbers.map((row) => row.map((n) => (n === 0 ? '' : String(n))));

const deepCopyNumbers = (numbers) => numbers.map((r) => r.slice());

const getBoxIndex = (r, c) => ({
  br: Math.floor(r / BOX_SIZE) * BOX_SIZE,
  bc: Math.floor(c / BOX_SIZE) * BOX_SIZE,
});

const isValidPlacement = (board, row, col, value) => {
  // Row / col
  for (let i = 0; i < GRID_SIZE; i += 1) {
    if (board[row][i] === value) return false;
    if (board[i][col] === value) return false;
  }

  // Box
  const { br, bc } = getBoxIndex(row, col);
  for (let r = br; r < br + BOX_SIZE; r += 1) {
    for (let c = bc; c < bc + BOX_SIZE; c += 1) {
      if (board[r][c] === value) return false;
    }
  }

  return true;
};

const validateBoard = (board) => {
  // Returns a Set of "r,c" for conflicting cells.
  const conflicts = new Set();

  const markConflict = (r1, c1, r2, c2) => {
    conflicts.add(`${r1},${c1}`);
    conflicts.add(`${r2},${c2}`);
  };

  // Check rows
  for (let r = 0; r < GRID_SIZE; r += 1) {
    const seen = new Map(); // value -> col
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const v = board[r][c];
      if (v === 0) continue;
      if (seen.has(v)) {
        markConflict(r, c, r, seen.get(v));
      } else {
        seen.set(v, c);
      }
    }
  }

  // Check cols
  for (let c = 0; c < GRID_SIZE; c += 1) {
    const seen = new Map(); // value -> row
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const v = board[r][c];
      if (v === 0) continue;
      if (seen.has(v)) {
        markConflict(r, c, seen.get(v), c);
      } else {
        seen.set(v, r);
      }
    }
  }

  // Check boxes
  for (let br = 0; br < GRID_SIZE; br += BOX_SIZE) {
    for (let bc = 0; bc < GRID_SIZE; bc += BOX_SIZE) {
      const seen = new Map(); // value -> [r,c]
      for (let r = br; r < br + BOX_SIZE; r += 1) {
        for (let c = bc; c < bc + BOX_SIZE; c += 1) {
          const v = board[r][c];
          if (v === 0) continue;
          const key = `${v}`;
          if (seen.has(key)) {
            const [pr, pc] = seen.get(key);
            markConflict(r, c, pr, pc);
          } else {
            seen.set(key, [r, c]);
          }
        }
      }
    }
  }

  return conflicts;
};

const findEmpty = (board) => {
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (board[r][c] === 0) return { r, c };
    }
  }
  return null;
};

const solveBacktracking = (board) => {
  const empty = findEmpty(board);
  if (!empty) return true;

  const { r, c } = empty;
  for (let v = 1; v <= 9; v += 1) {
    if (isValidPlacement(board, r, c, v)) {
      board[r][c] = v;
      if (solveBacktracking(board)) return true;
      board[r][c] = 0;
    }
  }
  return false;
};

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  const [grid, setGrid] = useState(() => makeEmptyGrid());
  const [givens, setGivens] = useState(() => new Set());
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  // Avoid manipulating DOM directly beyond setting theme attribute (template behavior).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const boardNumbers = useMemo(() => parseGridToNumbers(grid), [grid]);
  const conflictSet = useMemo(() => validateBoard(boardNumbers), [boardNumbers]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const setCell = (r, c, raw) => {
    const next = clampDigit(raw);
    setGrid((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[r][c] = next;
      return copy;
    });
    setStatus({ type: 'idle', message: '' });
  };

  const markGivensFromCurrentGrid = () => {
    const nextGivens = new Set();
    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        if (grid[r][c] !== '') nextGivens.add(`${r},${c}`);
      }
    }
    setGivens(nextGivens);
  };

  const handleSolve = () => {
    if (conflictSet.size > 0) {
      setStatus({
        type: 'error',
        message: 'Fix conflicts before solving (duplicates in a row, column, or 3×3 box).',
      });
      return;
    }

    const board = deepCopyNumbers(boardNumbers);
    const solvable = solveBacktracking(board);

    if (!solvable) {
      setStatus({ type: 'error', message: 'No solution found for this puzzle.' });
      return;
    }

    setGrid(formatNumbersToGrid(board));
    markGivensFromCurrentGrid();
    setStatus({ type: 'success', message: 'Solved.' });
  };

  const handleReset = () => {
    setGrid(makeEmptyGrid());
    setGivens(new Set());
    setStatus({ type: 'idle', message: '' });
  };

  const handleClearSolutionKeepGivens = () => {
    // Clears non-given cells, keeping only the originally marked givens.
    setGrid((prev) => {
      const copy = prev.map((row) => row.slice());
      for (let r = 0; r < GRID_SIZE; r += 1) {
        for (let c = 0; c < GRID_SIZE; c += 1) {
          if (!givens.has(`${r},${c}`)) copy[r][c] = '';
        }
      }
      return copy;
    });
    setStatus({ type: 'idle', message: '' });
  };

  const handleMarkGivens = () => {
    markGivensFromCurrentGrid();
    setStatus({ type: 'info', message: 'Clues locked (givens marked).' });
  };

  const onCellKeyDown = (e, r, c) => {
    // Basic keyboard navigation for the grid (retro terminal vibe, fast entry).
    const key = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    e.preventDefault();
    const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;

    const nr = Math.max(0, Math.min(GRID_SIZE - 1, r + dr));
    const nc = Math.max(0, Math.min(GRID_SIZE - 1, c + dc));

    const nextId = `cell-${nr}-${nc}`;
    const el = document.getElementById(nextId);
    if (el) el.focus();
  };

  const statusClass =
    status.type === 'success'
      ? 'status status-success'
      : status.type === 'error'
        ? 'status status-error'
        : status.type === 'info'
          ? 'status status-info'
          : 'status';

  return (
    <div className="App">
      <header className="appShell">
        <div className="topBar">
          <div className="brand">
            <div className="brandMark" aria-hidden="true">
              S9
            </div>
            <div className="brandText">
              <h1 className="title">Sudoku Solver</h1>
              <p className="subtitle">Retro grid. Instant solve. Zero fluff.</p>
            </div>
          </div>

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            type="button"
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        <main className="container">
          <section className="panel" aria-label="Sudoku input">
            <div className="panelHeader">
              <h2 className="panelTitle">Puzzle</h2>
              <p className="panelHint">Type 1–9. Use arrow keys to move.</p>
            </div>

            <div className="gridWrap" role="group" aria-label="Sudoku grid">
              <div className="sudokuGrid" role="grid" aria-rowcount={GRID_SIZE} aria-colcount={GRID_SIZE}>
                {grid.map((row, r) =>
                  row.map((cell, c) => {
                    const key = `${r}-${c}`;
                    const isConflict = conflictSet.has(`${r},${c}`);
                    const isGiven = givens.has(`${r},${c}`);
                    const thickRight = (c + 1) % BOX_SIZE === 0 && c !== GRID_SIZE - 1;
                    const thickBottom = (r + 1) % BOX_SIZE === 0 && r !== GRID_SIZE - 1;

                    const classNames = [
                      'cell',
                      isGiven ? 'cell-given' : '',
                      isConflict ? 'cell-conflict' : '',
                      thickRight ? 'cell-thick-right' : '',
                      thickBottom ? 'cell-thick-bottom' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <input
                        key={key}
                        id={`cell-${r}-${c}`}
                        className={classNames}
                        value={cell}
                        inputMode="numeric"
                        pattern="[1-9]"
                        maxLength={1}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onKeyDown={(e) => onCellKeyDown(e, r, c)}
                        aria-label={`Row ${r + 1} column ${c + 1}`}
                        aria-invalid={isConflict ? 'true' : 'false'}
                        disabled={false}
                        type="text"
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div className="controls" role="group" aria-label="Controls">
              <button className="btn btnPrimary" onClick={handleSolve} type="button">
                Solve
              </button>
              <button className="btn" onClick={handleMarkGivens} type="button">
                Lock Clues
              </button>
              <button className="btn" onClick={handleClearSolutionKeepGivens} type="button" disabled={givens.size === 0}>
                Clear (keep clues)
              </button>
              <button className="btn btnDanger" onClick={handleReset} type="button">
                Reset
              </button>
            </div>

            <div className={statusClass} role={status.type === 'error' ? 'alert' : 'status'} aria-live="polite">
              {status.message || (conflictSet.size > 0 ? 'Conflicts detected: check highlighted cells.' : 'Ready.')}
            </div>
          </section>

          <section className="panel panelSide" aria-label="How it works">
            <h2 className="panelTitle">How to use</h2>
            <ul className="helpList">
              <li>Enter your puzzle numbers (leave blanks empty).</li>
              <li>Fix any <span className="helpEm">red</span> conflicts.</li>
              <li>Press <span className="helpEm">Solve</span> to fill the grid.</li>
              <li>Optional: press <span className="helpEm">Lock Clues</span> to mark givens.</li>
            </ul>

            <div className="helpFooter">
              <div className="chip">Backtracking solver</div>
              <div className="chip">No external API required</div>
              <div className="chip">Accessible inputs</div>
            </div>
          </section>
        </main>
      </header>
    </div>
  );
}

export default App;
