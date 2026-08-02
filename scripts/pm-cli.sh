#!/usr/bin/env bash
# GMD Project Management CLI
# Used by Claude to auto-create/close issues as bugs are reported and fixed.
#
# Requires one env var:
#   GMD_API_TOKEN  — Personal Access Token (Profile → API Tokens in pm.byfeb.com)
#
# Optional:
#   GMD_PROJECT    — project key, name, or UUID; resolved through /api/projects
#   GMD_PROJECT_ID — legacy UUID fallback
#   GMD_API_BASE   — defaults to https://pm.byfeb.com
#
# Usage:
#   ./scripts/pm-cli.sh projects
#   ./scripts/pm-cli.sh --project GMD list
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

API_BASE="${GMD_API_BASE:-https://pm.byfeb.com}"

AUTH_HEADER=""
CT_HEADER="Content-Type: application/json"

require_auth() {
  : "${GMD_API_TOKEN:?GMD_API_TOKEN env var not set — run: pm auth <api_key>}"
  AUTH_HEADER="Authorization: Bearer $GMD_API_TOKEN"
}

env_file_path() {
  printf '%s\n' "$(dirname "$0")/../.env.local"
}

write_env_value() {
  local key="$1" value="$2" env_file
  env_file="$(env_file_path)"
  umask 077
  ENV_FILE="$env_file" ENV_KEY="$key" ENV_VALUE="$value" python3 -c '
import os, re
from pathlib import Path

path = Path(os.environ["ENV_FILE"])
key = os.environ["ENV_KEY"]
value = os.environ["ENV_VALUE"]
text = path.read_text() if path.exists() else ""
line = key + "=" + value
pattern = r"(?m)^" + re.escape(key) + r"=.*$"
if re.search(pattern, text):
    text = re.sub(pattern, line, text)
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
path.write_text(text)
'
  chmod 600 "$env_file"
}

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

cmd_projects() {
  local res
  res=$(api GET "/api/projects")
  PROJECTS_COMPLETION="${1:-}" python3 -c '
import json, sys
import os
data = json.load(sys.stdin)
if not isinstance(data, list):
    print(data.get("error", "Unexpected projects response"), file=sys.stderr)
    sys.exit(1)
if os.environ.get("PROJECTS_COMPLETION") == "--complete":
    for project in data:
        print("{}:{}".format(project.get("projectKey", ""), project.get("name", "")))
    sys.exit(0)
for project in data:
    print("{:<20} {:<8} {}".format(
        project.get("name", "<unnamed>"),
        project.get("projectKey", ""),
        project.get("id", "")
    ))
' <<<"$res"
}

resolve_project() {
  local selector="${1:-}"

  # Keep supporting the old UUID-only configuration.
  if [ -z "$selector" ] && [ -n "${GMD_PROJECT_ID:-}" ]; then
    return
  fi
  if [ -z "$selector" ]; then
    echo "ERROR: No project selected. Use --project <key-or-name> or set GMD_PROJECT." >&2
    echo "Run 'pm projects' to see available projects." >&2
    exit 1
  fi

  local res resolved
  res=$(api GET "/api/projects")
  if ! resolved=$(printf '%s' "$res" | SELECTOR="$selector" python3 -c '
import json, os, sys
data = json.load(sys.stdin)
selector = os.environ["SELECTOR"].strip().lower()
projects = data if isinstance(data, list) else []
matches = [
    p for p in projects
    if any(str(p.get(field, "")).lower() == selector for field in ("id", "projectKey", "name"))
]
if len(matches) == 1:
    print(matches[0].get("id", ""))
elif len(matches) > 1:
    print("ERROR: Project selector is ambiguous: {}".format(selector), file=sys.stderr)
    sys.exit(1)
else:
    print("ERROR: Project not found: {}".format(selector), file=sys.stderr)
    print("Run pm projects to see available projects.", file=sys.stderr)
    sys.exit(1)
'); then
    exit 1
  fi
  GMD_PROJECT_ID="$resolved"
}

cmd_auth() {
  if [ "$#" -ne 1 ] || [ -z "${1:-}" ]; then
    echo "Usage: pm auth <api_key>" >&2
    exit 1
  fi
  write_env_value "GMD_API_TOKEN" "$1"
  echo "API token saved to .env.local"
}

cmd_config() {
  local subcommand="${1:-}"
  case "$subcommand" in
    use-board)
      if [ "$#" -ne 2 ] || [ -z "${2:-}" ]; then
        echo "Usage: pm config use-board <key-or-name>" >&2
        exit 1
      fi
      require_auth
      resolve_project "$2"
      write_env_value "GMD_PROJECT" "$2"
      echo "Default board set to $2"
      ;;
    *)
      echo "Usage: pm config use-board <key-or-name>" >&2
      exit 1
      ;;
  esac
}

cmd_completion() {
  local shell="${1:-zsh}"
  case "$shell" in
    zsh)
      cat <<'EOF'
#compdef pm
_pm_project_keys() {
  local -a boards
  boards=("${(@f)$(pm projects --complete 2>/dev/null)}")
  _describe 'board' boards
}
_pm_issue_keys() {
  local -a issues
  issues=("${(@f)$(pm list --complete 2>/dev/null)}")
  compadd -- "${issues[@]}"
}
_pm_status_names() {
  local -a statuses
  statuses=("${(@f)$(pm statuses --complete 2>/dev/null)}")
  compadd -- "${statuses[@]}"
}
_pm() {
  local -a commands config_commands
  local command_index=2 command
  if [[ "$words[2]" == --project || "$words[2]" == -p ]]; then
    if (( CURRENT == 3 )); then _pm_project_keys; fi
    command_index=4
  fi
  command="$words[$command_index]"
  if (( CURRENT == command_index )); then
    commands=(
      'auth:save API token'
      'config:configuration commands'
      'completion:print shell completion'
      'create:create issue'
      'done:close issue'
      'help:show help'
      'list:list open issues'
      'projects:list accessible boards'
      'status:change issue status'
      'statuses:list workflow statuses'
    )
    _describe 'command' commands
    return
  fi
  case "$command" in
    config)
      if (( CURRENT == command_index + 1 )); then
        config_commands=('use-board:set default board')
        _describe 'config command' config_commands
      elif [[ "$words[$((command_index + 1))]" == use-board ]] && (( CURRENT == command_index + 2 )); then
        _pm_project_keys
      fi
      ;;
    done)
      if (( CURRENT == command_index + 1 )); then _pm_issue_keys; fi
      ;;
    status)
      if (( CURRENT == command_index + 1 )); then
        _pm_issue_keys
      elif (( CURRENT == command_index + 2 )); then
        _pm_status_names
      fi
      ;;
    create)
      if (( CURRENT == command_index + 3 )); then
        compadd -- bug task story epic sub_task
      elif (( CURRENT == command_index + 4 )); then
        compadd -- critical high medium low none
      fi
      ;;
  esac
}
compdef _pm pm
EOF
      ;;
    bash)
      cat <<'EOF'
_pm_complete() {
  local cur prev commands boards issues statuses command command_index=1
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]:-}"
  commands="auth config completion create done help list projects status statuses"
  if [[ "${COMP_WORDS[1]:-}" == "--project" || "${COMP_WORDS[1]:-}" == "-p" ]]; then
    if (( COMP_CWORD == 2 )); then
      boards="$(pm projects --complete 2>/dev/null | awk -F: '{print $1}')"
      COMPREPLY=( $(compgen -W "$boards" -- "$cur") )
      return
    fi
    command_index=3
  fi
  command="${COMP_WORDS[$command_index]:-}"
  if (( COMP_CWORD == command_index )); then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
  elif [[ "$command" == "config" ]] && (( COMP_CWORD == command_index + 1 )); then
    COMPREPLY=( $(compgen -W "use-board" -- "$cur") )
  elif [[ "$command" == "config" && "${COMP_WORDS[$((command_index+1))]:-}" == "use-board" ]] && (( COMP_CWORD == command_index + 2 )); then
    boards="$(pm projects --complete 2>/dev/null | awk -F: '{print $1}')"
    COMPREPLY=( $(compgen -W "$boards" -- "$cur") )
  elif [[ "$command" == "done" ]] && (( COMP_CWORD == command_index + 1 )); then
    issues="$(pm list --complete 2>/dev/null)"
    COMPREPLY=( $(compgen -W "$issues" -- "$cur") )
  elif [[ "$command" == "status" ]] && (( COMP_CWORD == command_index + 1 )); then
    issues="$(pm list --complete 2>/dev/null)"
    COMPREPLY=( $(compgen -W "$issues" -- "$cur") )
  elif [[ "$command" == "status" ]] && (( COMP_CWORD == command_index + 2 )); then
    statuses="$(pm statuses --complete 2>/dev/null)"
    COMPREPLY=( $(compgen -W "$statuses" -- "$cur") )
  elif [[ "$command" == "create" ]] && (( COMP_CWORD == command_index + 3 )); then
    COMPREPLY=( $(compgen -W "bug task story epic sub_task" -- "$cur") )
  elif [[ "$command" == "create" ]] && (( COMP_CWORD == command_index + 4 )); then
    COMPREPLY=( $(compgen -W "critical high medium low none" -- "$cur") )
  fi
}
complete -F _pm_complete pm
EOF
      ;;
    *)
      echo "Usage: pm completion [zsh|bash]" >&2
      exit 1
      ;;
  esac
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

  if [ "${1:-}" = "--complete" ]; then
    python3 -c '
import json, sys
data = json.load(sys.stdin)
cols = data.get("columns", {}) or {}
for col in cols.values():
    if col.get("status", {}).get("category") == "done":
        continue
    for issue in col.get("issues", []):
        print(issue.get("issueKey", ""))
' <<<"$res"
    return
  fi

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
  if [ "${1:-}" = "--complete" ]; then
    api GET "/api/projects/$GMD_PROJECT_ID/statuses" | \
      python3 -c '
import json, sys
for status in json.load(sys.stdin):
    print(status.get("name", ""))
'
    return
  fi
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
Usage: pm [--project <key-or-name>] <command> [args]

Commands:

Issue management:
  create <title> [description] [type] [priority]
      Create a new issue. Defaults: type=task, priority=medium.
      Types: bug, task, story, epic, sub_task
      Priorities: critical, high, medium, low, none
      Example: pm create "bug: plan reorder broken" "Details..." bug high

  list
      Show all non-done issues on the board, grouped by status.

  done <ISSUE-KEY>
      Move an issue to the 'done' category.
      Example: pm done GMD-42

  status <ISSUE-KEY> <status-name-or-category>
      Move issue to arbitrary status. Matches by name or category.
      Example: pm status GMD-42 "In Progress"

Project and board selection:
  projects
      List projects available to the API token.

  config use-board <key-or-name>
      Set the default board without using its UUID.

  statuses
      List all workflow statuses for this project.

Authentication:
  auth <api-key>
      Save the PM API token to the git-ignored .env.local.

Shell integration:
  completion [zsh|bash]
      Print shell autocompletion code.

  help, -h, --help
      Show this help message.

Env:
  GMD_API_TOKEN   required — from Profile → API Tokens
  GMD_PROJECT    optional — project key, name, or UUID
  GMD_PROJECT_ID  optional — legacy UUID fallback
  GMD_API_BASE    optional — default https://pm.byfeb.com

Options:
  -p, --project <key-or-name>
      Select a project for this command without using its UUID.
EOF
}

# Parse project selection before the command.
PROJECT_SELECTOR="${GMD_PROJECT:-}"
case "${1:-}" in
  -p|--project)
    PROJECT_SELECTOR="${2:?Usage: $0 --project <key-or-name> <command> [args]}"
    shift 2
    ;;
  --project=*)
    PROJECT_SELECTOR="${1#*=}"
    shift
    ;;
esac

case "${1:-}" in
  projects|auth|config|completion|-h|--help|help|"") ;;
  create|list|done|status|statuses)
    require_auth
    resolve_project "$PROJECT_SELECTOR"
    ;;
esac

case "${1:-}" in
  projects) require_auth; shift; cmd_projects "$@" ;;
  auth) shift; cmd_auth "$@" ;;
  config) shift; cmd_config "$@" ;;
  completion) shift; cmd_completion "$@" ;;
  create)   shift; cmd_create "$@" ;;
  list)     shift; cmd_list "$@" ;;
  done)     shift; cmd_done "$@" ;;
  status)   shift; cmd_status "$@" ;;
  statuses) shift; cmd_statuses "$@" ;;
  -h|--help|help|"") usage ;;
  *) echo "Unknown command: $1" >&2; usage; exit 1 ;;
esac
