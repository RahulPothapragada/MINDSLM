#!/bin/bash

cd "$(dirname "$0")"

echo "Starting MindSLM backend..."
python3 mindslm_pipeline_api.py &
BACKEND_PID=$!

echo "Starting frontend..."
cd frontend-react && npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
