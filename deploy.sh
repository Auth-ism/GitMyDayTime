#!/bin/bash
set -e

IMAGE="hub.umceko.com/byfeb/gitmydaytime"
TAG="${1:-latest}"

echo ">> Building image..."
docker build -t "$IMAGE:$TAG" .

echo ">> Pushing image..."
docker push "$IMAGE:$TAG"

echo ">> Rolling out..."
kubectl set image deployment/gitmydaytime gitmydaytime="$IMAGE:$TAG" -n feb
kubectl rollout restart deployment/gitmydaytime -n feb
kubectl rollout status deployment/gitmydaytime -n feb

echo ">> Done! Live at https://gmd.byfeb.com"
