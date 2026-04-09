#!/usr/bin/env bash
# Run the full test suite.
# Usage: ./scripts/run_tests.sh [pytest args]

set -euo pipefail

cd "$(dirname "$0")/../apps/backend"

# Activate venv if it exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

echo "Running GCC Decision Intelligence Platform tests..."
python -m pytest tests/ -v --tb=short "$@"
