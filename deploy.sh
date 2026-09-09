#!/bin/bash
# Manual deploy — build here, push to GHCR, pull and restart on the VPS.
# Same steps the GitHub Actions workflow would run, triggered by hand.

set -e  # stop at the first failure rather than pressing on

IMAGE="ghcr.io/stephenmachera/sweet1ne-api:latest"
SERVER="sweet1ne@167.233.252.230"
KEY="$HOME/.ssh/sweet1ne"

cd ~/Desktop/Sweet1NE/sweet1ne-backend

echo "→ Building"
docker build -t "$IMAGE" .

echo "→ Pushing"
docker push "$IMAGE"

echo "→ Deploying"
ssh -i "$KEY" "$SERVER" "cd ~/sweet1ne-backend && docker compose pull api && docker compose up -d api && docker image prune -f"

echo "→ Checking"
sleep 5
curl -s https://api.fgck-githurai44.com/health
echo
