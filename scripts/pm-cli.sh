#!/usr/bin/env bash
# GMD Project Management CLI
# Used by Claude to auto-create/close issues as bugs are reported and fixed.
#
# Requires two env vars:
#   GMD_API_TOKEN  — Personal Access Token (Profile → API Tokens in gmd.byfeb.com)
#   GMD_PROJECT_ID — UUID of the target project (URL: /projects/<ID>/board)
#
# Optional:
#   GMD_API_BASE   — defaults to https://gmd.byfeb.com
#
# Usage:
#   ./scripts/pm-cli.sh create "bug: toast 5sn kayboluyor" "Geri Al 5sn fakat bazen 3sn" [bug|task|story] [critical|high|medium|low]
#   ./scripts/pm-cli.sh list
#   ./scripts/pm-cli.sh done <ISSUE-KEY>
#   ./scripts/pm-cli.sh status <ISSUE-KEY> <status-name>

set -euo pipefail

# Load .env.local if present (git-ignored)
if [ -f "$(dirname "$0")/../.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$(dirname "$0")/../.env.local"
  set +a
fi

: "${GMD_API_TOKEN:?GMD_API_TOKEN env var not set — create one at Profile → API Tokens}"
: "${GMD_PROJECT_ID:?GMD_PROJECT_ID env var not set — see project URL in pm.byfeb.com}"
API_BASE="${GMD_API_BASE:-https://gmd.byfeb.com}"

AUTH_HEADER="Authorization: Bearer $GMD_API_TOKEN"
CT_HEADER="Content-Type: application/json"

# Minimal JSON helpers using python (no jq dependency)
json_encode() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

json_get() {
  # usage: echo "$json" | json_get '.key.path'
  python3 -c "
import json,sys
data=json.load(sys.stdin)
path=sys.argv[1].strip('.').split('.')
for p in path:
  if isinstance(data, list):
    data = data[int(p)] if p.isdigit() else None
  elif isinstance(data, dict):
    data = data.get(p)
  if data is None:
    break
print('' if data is None else data)
" "$1"
}

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" -H "$AUTH_HEADER" -H "$CT_HEADER" -d "$body" "$API_BASE$path"
  else
    curl -sS -X "$method" -H "$AUTH_HEADER" "$API_BASE$path"
  fi
}

cmd_create() {
  local title="${1:?Usage: create \"title\" \"description\" [type] [priority]}"
  local desc="${2:-}"
  local type="${3:-task}"
  local priority="${4:-medium}"

  local title_json desc_json
  title_json=$(printf '%s' "$title" | json_encode)
  desc_json=$(printf '%s' "$desc" | json_encode)

  local payload
  payload=$(cat <<EOF
{
  "title": $title_json,
  "description": $desc_json,
  "issueType": "$type",
  "priority": "$priority",
  "labels": ["claude"]
}
EOF
)

  local res
  res=$(api POST "/api/projects/$GMD_PROJECT_ID/issues" "$payload")

  local key id err
  err=$(printf '%s' "$res" | json_get '.error')
  if [ -n "$err" ]; then
    echo "ERROR: $err" >&2
    exit 1
  fi
  key=$(printf '%s' "$res" | json_get '.issueKey')
  id=$(printf '%s' "$res" | json_get '.id')
  echo "$key  $id  $title"
}

cmd_list() {
  local res
  res=$(api GET "/api/projects/$GMD_PROJECT_ID/board")

  # Parse board: {columns: {<statusId>: {status, issues}}}
  python3 -c '
import json, sys
data = json.load(sys.stdin)
cols = data.get("columns", {}) or {}
# Sort by status.sortOrder so output is stable
entries = list(cols.values())
entries.sort(key=lambda c: c.get("status", {}).get("sortOrder", 0))
for col in entries:
    status = col.get("status", {})
    cat = status.get("category", "")
    if cat == "done":
        continue
    name = status.get("name", "")
    for issue in col.get("issues", []):
        key = issue.get("issueKey", "")
        title = issue.get("title", "")
        print("[%14s] %-8s  %s" % (name, key, title))
' <<<"$res"
}

cmd_statuses() {
  api GET "/api/projects/$GMD_PROJECT_ID/statuses" | \
    python3 -c '
import json, sys
for s in json.load(sys.stdin):
    print("%14s  cat=%-12s  id=%s" % (s["name"], s["category"], s["id"]))
'
}

# Resolve issue-key (GMD-42) to issue id via board scan
resolve_key_to_id() {
  local key="$1"
  api GET "/api/projects/$GMD_PROJECT_ID/board" | \
    KEY="$key" python3 -c '
import json, os, sys
key = os.environ["KEY"]
data = json.load(sys.stdin)
cols = data.get("columns", {}) or {}
for col in cols.values():
    for i in col.get("issues", []):
        if i.get("issueKey") == key:
            print(i.get("id"))
            sys.exit(0)
'
}

# Resolve status name → id (case-insensitive, matches category fallback)
resolve_status_id() {
  local target="$1"
  api GET "/api/projects/$GMD_PROJECT_ID/statuses" | \
    TARGET="$target" python3 -c '
import json, os, sys
t = os.environ["TARGET"].lower()
for s in json.load(sys.stdin):
    if s.get("name","").lower() == t or s.get("category","").lower() == t:
        print(s.get("id"))
        sys.exit(0)
'
}

cmd_done() {
  local key="${1:?Usage: done <ISSUE-KEY>}"
  local id status_id
  id=$(resolve_key_to_id "$key")
  if [ -z "$id" ]; then
    echo "ERROR: Issue $key not found on board" >&2
    exit 1
  fi

  # Pick the first status with category='done'
  status_id=$(api GET "/api/projects/$GMD_PROJECT_ID/statuses" | \
    python3 -c '
import json, sys
for s in json.load(sys.stdin):
    if s.get("category") == "done":
        print(s.get("id"))
        sys.exit(0)
')

  if [ -z "$status_id" ]; then
    echo "ERROR: No 'done' status configured" >&2
    exit 1
  fi

  local payload="{\"statusId\":\"$status_id\"}"
  api PATCH "/api/projects/$GMD_PROJECT_ID/issues/$id/status" "$payload" >/dev/null
  echo "OK: $key → done"
}

cmd_status() {
  local key="${1:?Usage: status <ISSUE-KEY> <status-name>}"
  local target="${2:?Usage: status <ISSUE-KEY> <status-name>}"
  local id status_id
  id=$(resolve_key_to_id "$key")
  if [ -z "$id" ]; then
    echo "ERROR: Issue $key not found" >&2
    exit 1
  fi
  status_id=$(resolve_status_id "$target")
  if [ -z "$status_id" ]; then
    echo "ERROR: Status '$target' not found" >&2
    exit 1
  fi
  local payload="{\"statusId\":\"$status_id\"}"
  api PATCH "/api/projects/$GMD_PROJECT_ID/issues/$id/status" "$payload" >/dev/null
  echo "OK: $key → $target"
}

usage() {
  cat <<EOF
Usage: $0 <command> [args]

Commands:
  create <title> [description] [type] [priority]
      Create a new issue. Defaults: type=task, priority=medium.
      Types: bug, task, story, epic, sub_task
      Priorities: critical, high, medium, low, none
      Example: $0 create "bug: plan reorder broken" "Details..." bug high

  list
      Show all non-done issues on the board, grouped by status.

  done <ISSUE-KEY>
      Move an issue to the 'done' category.
      Example: $0 done GMD-42

  status <ISSUE-KEY> <status-name-or-category>
      Move issue to arbitrary status. Matches by name or category.
      Example: $0 status GMD-42 "In Progress"

  statuses
      List all workflow statuses for this project.

Env:
  GMD_API_TOKEN   required — from Profile → API Tokens
  GMD_PROJECT_ID  required — UUID of the target project
  GMD_API_BASE    optional — default https://gmd.byfeb.com
EOF
}

case "${1:-}" in
  create)   shift; cmd_create "$@" ;;
  list)     shift; cmd_list "$@" ;;
  done)     shift; cmd_done "$@" ;;
  status)   shift; cmd_status "$@" ;;
  statuses) shift; cmd_statuses "$@" ;;
  -h|--help|help|"") usage ;;
  *) echo "Unknown command: $1" >&2; usage; exit 1 ;;
esac
