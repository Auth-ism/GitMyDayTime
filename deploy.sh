#!/bin/bash
set -e

IMAGE="hub.umceko.com/byfeb/gitmydaytime"
BUMP="${1:-patch}"  # patch | minor | major

# Bump version in root package.json
OLD_VERSION=$(node -p "require('./package.json').version")

IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: ./deploy.sh [patch|minor|major]"; exit 1 ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update version in package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo ">> Version: $OLD_VERSION -> $NEW_VERSION"

# Git commit & tag
git add package.json
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Build & push Docker image
echo ">> Building image..."
docker build -t "$IMAGE:$NEW_VERSION" -t "$IMAGE:latest" .

echo ">> Pushing image..."
docker push "$IMAGE:$NEW_VERSION"
docker push "$IMAGE:latest"

# Deploy to Kubernetes
echo ">> Rolling out..."
kubectl set image deployment/gitmydaytime gitmydaytime="$IMAGE:$NEW_VERSION" -n feb
kubectl rollout restart deployment/gitmydaytime -n feb
kubectl rollout status deployment/gitmydaytime -n feb

# Push git
git push && git push --tags

echo ">> Done! v$NEW_VERSION live at https://gmd.byfeb.com"
