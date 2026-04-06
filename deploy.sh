#!/bin/bash
set -e

IMAGE="hub.umceko.com/byfeb/gitmydaytime"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAINTENANCE="${SCRIPT_DIR}/maintenance/maintenance.sh"

# Parse flags
BUMP="patch"
USE_MAINTENANCE=false
for arg in "$@"; do
  case "$arg" in
    --maintenance|-m) USE_MAINTENANCE=true ;;
    patch|minor|major) BUMP="$arg" ;;
  esac
done

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

# Auto-generate changelog entry from commits since last release
node scripts/update-changelog.mjs "$OLD_VERSION" "$NEW_VERSION" "$BUMP"

# Git commit & tag
git add package.json packages/web/src/data/changelog.ts
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Build & push Docker image
echo ">> Building image..."
docker build -t "$IMAGE:$NEW_VERSION" -t "$IMAGE:latest" .

echo ">> Pushing image..."
docker push "$IMAGE:$NEW_VERSION"
docker push "$IMAGE:latest"

# Enable maintenance mode if requested
if $USE_MAINTENANCE; then
  "$MAINTENANCE" on
fi

# Deploy to Kubernetes
echo ">> Rolling out..."
kubectl set image deployment/gitmydaytime gitmydaytime="$IMAGE:$NEW_VERSION" -n feb
kubectl rollout restart deployment/gitmydaytime -n feb
kubectl rollout status deployment/gitmydaytime -n feb

# Disable maintenance mode
if $USE_MAINTENANCE; then
  "$MAINTENANCE" off
fi

# Push git
git push && git push --tags

echo ">> Done! v$NEW_VERSION live at https://gmd.byfeb.com"
