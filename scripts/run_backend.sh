#!/usr/bin/env bash
# Start the backend server in development mode.
# Usage: ./scripts/run_backend.sh

set -euo pipefail

cd "$(dirname "$0")/../apps/backend"

# Activate venv if it exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

echo "Starting GCC Decision Intelligence Platform backend..."
echo "API docs: http://localhost:8000/docs"

uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
