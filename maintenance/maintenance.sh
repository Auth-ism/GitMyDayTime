#!/bin/bash
# Maintenance mode helpers for GMD
# Usage:
#   ./maintenance/maintenance.sh on   — enable maintenance page
#   ./maintenance/maintenance.sh off  — disable maintenance page

set -e

NAMESPACE="feb"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

maintenance_on() {
  echo ">> Enabling maintenance mode..."

  # Create/update ConfigMap from actual HTML file
  kubectl create configmap gitmydaytime-maintenance \
    --from-file=index.html="$SCRIPT_DIR/index.html" \
    --from-file=nginx.conf=<(cat <<'NGINXEOF'
server {
  listen 80;
  root /usr/share/nginx/html;
  location / {
    try_files $uri /index.html =503;
    add_header Cache-Control "no-cache, no-store";
    add_header Retry-After "60";
  }
  location /api/health {
    return 503 '{"status":"maintenance"}';
    add_header Content-Type application/json;
  }
}
NGINXEOF
) \
    -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  # Deploy maintenance pod
  kubectl apply -f "$SCRIPT_DIR/k8s-maintenance.yaml" 2>/dev/null || true
  kubectl rollout status deployment/gitmydaytime-maintenance -n "$NAMESPACE" --timeout=30s 2>/dev/null || true

  # Switch ingress to maintenance service
  kubectl patch ingress gitmydaytime-ingress -n "$NAMESPACE" --type=json \
    -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/name","value":"gitmydaytime-maintenance-service"}]'

  echo ">> Maintenance mode ON"
}

maintenance_off() {
  echo ">> Disabling maintenance mode..."

  # Switch ingress back to app service
  kubectl patch ingress gitmydaytime-ingress -n "$NAMESPACE" --type=json \
    -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/name","value":"gitmydaytime-service"}]'

  # Scale down maintenance pod (keep resources for next time)
  kubectl scale deployment/gitmydaytime-maintenance -n "$NAMESPACE" --replicas=0 2>/dev/null || true

  echo ">> Maintenance mode OFF"
}

case "${1:-}" in
  on)  maintenance_on ;;
  off) maintenance_off ;;
  *)   echo "Usage: $0 [on|off]"; exit 1 ;;
esac
