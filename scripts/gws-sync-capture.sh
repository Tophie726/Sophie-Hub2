#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_HEADER="${COOKIE_HEADER:-}"
OUT_DIR="${OUT_DIR:-/tmp/gws-sync-capture-$(date +%Y%m%d-%H%M%S)}"
RUN_SYNC=1
ZIP_OUTPUT=1

usage() {
  cat <<'EOF'
Usage:
  COOKIE_HEADER='next-auth.session-token=...' ./scripts/gws-sync-capture.sh [options]

Optional env vars:
  BASE_URL=http://localhost:3000
  OUT_DIR=/tmp/gws-sync-capture-YYYYMMDD-HHMMSS

Options:
  --cookie VALUE    Cookie header value only (alternative to COOKIE_HEADER env var)
  --base-url URL    Base URL (default: http://localhost:3000)
  --out-dir PATH    Output folder path
  --no-sync         Skip POST /api/google-workspace/sync
  --no-zip          Do not create tar.gz artifact bundle
  -h, --help        Show help

What it does:
  1) POST /api/google-workspace/test-connection
  2) POST /api/google-workspace/sync (unless --no-sync)
  3) GET  /api/google-workspace/sync/status
  4) GET  /api/google-workspace/users

Outputs:
  - JSON response files
  - HTTP header files
  - per-request timing/size metric files
  - summary.md with key counts/statuses

Safety:
  - This script does NOT call /staff/bootstrap, /mappings/*, or /enrich-staff.
  - It does not write into staff CRM rows.
  - It only touches Google connector endpoints and snapshot status.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cookie)
      shift
      COOKIE_HEADER="${1:-}"
      ;;
    --base-url)
      shift
      BASE_URL="${1:-}"
      ;;
    --out-dir)
      shift
      OUT_DIR="${1:-}"
      ;;
    --no-sync)
      RUN_SYNC=0
      ;;
    --no-zip)
      ZIP_OUTPUT=0
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

if [[ -z "${COOKIE_HEADER}" ]]; then
  echo "Missing COOKIE_HEADER." >&2
  echo "Run: COOKIE_HEADER='next-auth.session-token=...' ./scripts/gws-sync-capture.sh" >&2
  exit 1
fi

COOKIE_HEADER="${COOKIE_HEADER#Cookie: }"
BASE_URL="${BASE_URL%/}"

mkdir -p "${OUT_DIR}"

request() {
  local name="$1"
  local method="$2"
  local url="$3"

  local headers_file="${OUT_DIR}/${name}.headers.txt"
  local body_file="${OUT_DIR}/${name}.json"
  local metrics_file="${OUT_DIR}/${name}.metrics.tsv"

  curl -sS \
    -X "${method}" \
    -D "${headers_file}" \
    -H "Cookie: ${COOKIE_HEADER}" \
    -H "Content-Type: application/json" \
    --connect-timeout 10 \
    --max-time 180 \
    -w "%{http_code}\t%{time_total}\t%{size_download}\n" \
    "${url}" \
    -o "${body_file}" > "${metrics_file}"
}

request "01-test-connection" "POST" "${BASE_URL}/api/google-workspace/test-connection"
if [[ "${RUN_SYNC}" -eq 1 ]]; then
  request "02-sync" "POST" "${BASE_URL}/api/google-workspace/sync"
else
  cat > "${OUT_DIR}/02-sync.skipped.txt" <<EOF
Skipped by --no-sync at $(date -u +"%Y-%m-%d %H:%M:%S UTC")
EOF
fi
request "03-sync-status" "GET" "${BASE_URL}/api/google-workspace/sync/status"
request "04-users" "GET" "${BASE_URL}/api/google-workspace/users"

status_code() {
  local headers_file="$1"
  awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "${headers_file}"
}

if [[ "${RUN_SYNC}" -eq 1 ]]; then
  sync_code="$(status_code "${OUT_DIR}/02-sync.headers.txt")"
else
  sync_code="SKIPPED"
fi
status_code_val="$(status_code "${OUT_DIR}/03-sync-status.headers.txt")"
users_code="$(status_code "${OUT_DIR}/04-users.headers.txt")"

sync_total="-"
sync_upserted="-"
sync_tombstoned="-"
snapshot_total="-"
snapshot_people="-"
snapshot_shared="-"
users_count="-"
users_payload_bytes="-"

if command -v jq >/dev/null 2>&1; then
  if [[ "${RUN_SYNC}" -eq 1 ]]; then
    sync_total="$(jq -r '.data.total_pulled // .total_pulled // "-"' "${OUT_DIR}/02-sync.json" 2>/dev/null || echo "-")"
    sync_upserted="$(jq -r '.data.upserted // .upserted // "-"' "${OUT_DIR}/02-sync.json" 2>/dev/null || echo "-")"
    sync_tombstoned="$(jq -r '.data.tombstoned // .tombstoned // "-"' "${OUT_DIR}/02-sync.json" 2>/dev/null || echo "-")"
  fi
  snapshot_total="$(jq -r '.data.snapshot_stats.total // "-"' "${OUT_DIR}/03-sync-status.json" 2>/dev/null || echo "-")"
  snapshot_people="$(jq -r '.data.snapshot_stats.active_people // "-"' "${OUT_DIR}/03-sync-status.json" 2>/dev/null || echo "-")"
  snapshot_shared="$(jq -r '.data.snapshot_stats.active_shared // "-"' "${OUT_DIR}/03-sync-status.json" 2>/dev/null || echo "-")"
  users_count="$(jq -r '.data | if type=="array" then length else "-" end' "${OUT_DIR}/04-users.json" 2>/dev/null || echo "-")"
fi
users_payload_bytes="$(wc -c < "${OUT_DIR}/04-users.json" | tr -d ' ')"

sync_time="-"
status_time="-"
users_time="-"
if [[ "${RUN_SYNC}" -eq 1 && -f "${OUT_DIR}/02-sync.metrics.tsv" ]]; then
  sync_time="$(cut -f2 "${OUT_DIR}/02-sync.metrics.tsv" | tail -n1)"
fi
if [[ -f "${OUT_DIR}/03-sync-status.metrics.tsv" ]]; then
  status_time="$(cut -f2 "${OUT_DIR}/03-sync-status.metrics.tsv" | tail -n1)"
fi
if [[ -f "${OUT_DIR}/04-users.metrics.tsv" ]]; then
  users_time="$(cut -f2 "${OUT_DIR}/04-users.metrics.tsv" | tail -n1)"
fi

cat > "${OUT_DIR}/summary.md" <<EOF
# Google Workspace Sync Capture

- Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- Base URL: ${BASE_URL}
- Run sync endpoint: $(if [[ "${RUN_SYNC}" -eq 1 ]]; then echo "yes"; else echo "no (--no-sync)"; fi)

## HTTP Status

- test-connection: $(status_code "${OUT_DIR}/01-test-connection.headers.txt")
- sync: ${sync_code}
- sync/status: ${status_code_val}
- users: ${users_code}

## Key Metrics

- total_pulled: ${sync_total}
- upserted: ${sync_upserted}
- tombstoned: ${sync_tombstoned}
- snapshot_total: ${snapshot_total}
- active_people: ${snapshot_people}
- active_shared: ${snapshot_shared}
- users_count: ${users_count}
- users_payload_bytes: ${users_payload_bytes}

## Timings (seconds)

- sync: ${sync_time}
- sync/status: ${status_time}
- users: ${users_time}

## Notes

- This run only validates Google sync/snapshot paths.
- No staff bootstrap, mapping writes, or enrich actions were executed.
- Share this folder with developers: ${OUT_DIR}
EOF

echo "Capture complete: ${OUT_DIR}"
echo "Summary: ${OUT_DIR}/summary.md"

if [[ "${ZIP_OUTPUT}" -eq 1 ]]; then
  BUNDLE_PATH="${OUT_DIR}.tar.gz"
  tar -czf "${BUNDLE_PATH}" -C "$(dirname "${OUT_DIR}")" "$(basename "${OUT_DIR}")"
  echo "Bundle: ${BUNDLE_PATH}"
fi
