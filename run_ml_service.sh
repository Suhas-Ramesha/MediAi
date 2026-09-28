#!/usr/bin/env bash
# Start ML risk API from repo root (uvicorn must run with cwd = ml_service so "main" imports).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/ml_service"

if [ -f ".venv/bin/python" ]; then
  exec .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 5050
else
  exec python3 -m uvicorn main:app --host 127.0.0.1 --port 5050
fi
