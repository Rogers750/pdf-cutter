#!/bin/bash
echo "Starting FastAPI backend (venv)..."
(cd server && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000) &
echo "Starting React client (Vite)..."
(cd client && npm run dev)
