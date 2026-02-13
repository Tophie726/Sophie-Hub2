#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Run Google Workspace connector smoke flow against a local Sophie Hub server.

Usage:
  COOKIE_HEADER="next-auth.session-token=..." ./scripts/smoke-google-workspace.sh [options]

Options:
  --with-bootstrap      Run /api/google-workspace/staff/bootstrap before auto-match.
  --base-url URL        Base URL for API requests (default: http://localhost:3000).
  --cookie VALUE        Cookie header value (alternative to COOKIE_HEADER env var).
  -h, --help            Show this help.

Notes:
  - Cookie value should be the header VALUE only, not "Cookie: ...".
  - Requires an authenticated admin session cookie.
EOF
}

BASE_URL="http://localhost:3000"
WITH_BOOTSTRAP=0
COOKIE_VALUE="${COOKIE_HEADER:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-bootstrap)
      WITH_BOOTSTRAP=1
      ;;
    --base-url)
      shift
      BASE_URL="${1:-}"
      ;;
    --cookie)
      shift
      COOKIE_VALUE="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$COOKIE_VALUE" ]]; then
  echo "Missing cookie. Set COOKIE_HEADER env var or pass --cookie." >&2
  exit 1
fi

# Allow accidental "Cookie: ..." input by normalizing to header value only.
COOKIE_VALUE="${COOKIE_VALUE#Cookie: }"

if [[ "$COOKIE_VALUE" == *"<your-session-cookie>"* ]]; then
  echo "Placeholder cookie detected. Replace <your-session-cookie> with a real browser session cookie value." >&2
  exit 1
fi

# If only a raw token is provided, try common NextAuth/Auth.js cookie names.
if [[ "$COOKIE_VALUE" != *"="* ]]; then
  COOKIE_VALUE="next-auth.session-token=${COOKIE_VALUE}; __Secure-next-auth.session-token=${COOKIE_VALUE}; authjs.session-token=${COOKIE_VALUE}; __Secure-authjs.session-token=${COOKIE_VALUE}"
fi

BASE_URL="${BASE_URL%/}"

call_api() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local jq_assert="${4:-}"
  local jq_message="${5:-Semantic assertion failed}"
  local response
  local http_status
  local body

  echo
  echo ">>> ${method} ${path}"

  if [[ -n "$payload" ]]; then
    response="$(
      curl -sS -X "$method" "${BASE_URL}${path}" \
        -H "Cookie: ${COOKIE_VALUE}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        -w $'\n%{http_code}'
    )"
  else
    response="$(
      curl -sS -X "$method" "${BASE_URL}${path}" \
        -H "Cookie: ${COOKIE_VALUE}" \
        -w $'\n%{http_code}'
    )"
  fi

  http_status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  echo "HTTP ${http_status}"
  if command -v jq >/dev/null 2>&1; then
    echo "$body" | jq .
  else
    echo "$body"
  fi

  if [[ ! "$http_status" =~ ^2 ]]; then
    echo "Request failed: ${method} ${path}" >&2
    exit 1
  fi

  if [[ -n "$jq_assert" ]]; then
    if command -v jq >/dev/null 2>&1; then
      if ! echo "$body" | jq -e "$jq_assert" >/dev/null; then
        echo "Semantic check failed for ${method} ${path}: ${jq_message}" >&2
        echo "$body" | jq . >&2 || true
        exit 1
      fi
    else
      echo "Warning: jq not installed; skipping semantic assertion for ${method} ${path}" >&2
    fi
  fi
}

echo "Running Google Workspace smoke flow against ${BASE_URL}"
call_api POST /api/google-workspace/test-connection "" \
  '.success == true and (.data.connected == true)' \
  'test-connection must report connected=true'
call_api POST /api/google-workspace/sync "" \
  '.success == true and (.data.success == true)' \
  'sync must report data.success=true'
call_api GET /api/google-workspace/sync/status "" \
  '.success == true and (.data.snapshot_stats | type == "object") and ((.data.has_snapshot // false) == true or (.data.setup_required // false) == true)' \
  'sync status must return snapshot stats and a valid snapshot/setup state'
call_api GET /api/google-workspace/users "" \
  '.success == true and (.data.users | type == "array") and (.data.total | type == "number")' \
  'users endpoint must return users array and numeric total'

if [[ "$WITH_BOOTSTRAP" -eq 1 ]]; then
  call_api POST /api/google-workspace/staff/bootstrap "" \
    '.success == true and (.data.created_staff | type == "number") and (.data.mapped_existing_staff | type == "number")' \
    'staff bootstrap must return created/mapped counts'
fi

call_api POST /api/google-workspace/mappings/staff/auto-match "" \
  '.success == true and (.data.matched | type == "number")' \
  'auto-match must return matched count'
call_api POST /api/google-workspace/enrich-staff "" \
  '.success == true and (.data.enriched | type == "number") and (.data.skipped | type == "number")' \
  'enrich-staff must return enriched/skipped counts'
call_api GET /api/google-workspace/mappings/staff "" \
  '.success == true and (.data.mappings | type == "array")' \
  'mappings endpoint must return mappings array'
call_api GET /api/google-workspace/staff-approvals "" \
  '.success == true and (.data.approvals | type == "array") and (.data.counts | type == "object")' \
  'staff-approvals endpoint must return approvals and counts'

echo
echo "Smoke flow complete."
