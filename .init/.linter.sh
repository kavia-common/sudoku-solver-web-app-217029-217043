#!/bin/bash
cd /home/kavia/workspace/code-generation/sudoku-solver-web-app-217029-217043/sudoku_solver_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

