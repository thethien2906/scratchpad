#!/usr/bin/env bash
set -euo pipefail

# Ensure script is executed from the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Starting Erwining Deployment ==="

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo >&2 "Error: docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo >&2 "Error: docker compose is not available."; exit 1; }

# Pull latest code if this is a Git repository
if [ -d .git ]; then
  echo "--> Pulling latest changes from Git..."
  git pull --rebase || echo "Warning: git pull failed or dirty working tree. Continuing with local files."
fi

# Deploy with docker compose
echo "--> Building and starting container..."
docker compose up -d --build --remove-orphans

# Clean up dangling images to save VPS disk space
echo "--> Cleaning up unused images..."
docker image prune -f

# Verify container status
echo "--> Container status:"
docker compose ps

PORT="${PORT:-8080}"
echo "=== Deployment finished successfully! ==="
echo "App is accessible at: http://<YOUR_VPS_IP>:${PORT}"
