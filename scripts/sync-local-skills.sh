#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC_DIR="${ROOT_DIR}/skills"

declare -a SKILLS_TO_SYNC=()

TARGET="both"
DRY_RUN="false"
SKILLS_ARG=""

usage() {
  cat <<'EOF'
Usage:
  scripts/sync-local-skills.sh [--target codex|claude|both] [--skills name1,name2] [--dry-run]

Description:
  Sync local Sophie Hub skills into Codex and/or Claude local skill folders.

Defaults:
  --target both
  --skills all local skills in ./skills

Environment overrides:
  CODEX_HOME (default: ~/.codex)
  CLAUDE_HOME (default: ~/.claude)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --target" >&2
        exit 1
      fi
      TARGET="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --skills)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --skills" >&2
        exit 1
      fi
      SKILLS_ARG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${TARGET}" != "codex" && "${TARGET}" != "claude" && "${TARGET}" != "both" ]]; then
  echo "Invalid --target '${TARGET}'. Use codex, claude, or both." >&2
  exit 1
fi

CODEX_HOME_DIR="${CODEX_HOME:-${HOME}/.codex}"
CLAUDE_HOME_DIR="${CLAUDE_HOME:-${HOME}/.claude}"
CODEX_SKILLS_DIR="${CODEX_HOME_DIR}/skills"
CLAUDE_SKILLS_DIR="${CLAUDE_HOME_DIR}/skills"

load_skills_to_sync() {
  if [[ -n "${SKILLS_ARG}" ]]; then
    IFS=',' read -r -a SKILLS_TO_SYNC <<< "${SKILLS_ARG}"
  else
    while IFS= read -r -d '' path; do
      SKILLS_TO_SYNC+=("$(basename "${path}")")
    done < <(find "${SKILLS_SRC_DIR}" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)
  fi

  if [[ ${#SKILLS_TO_SYNC[@]} -eq 0 ]]; then
    echo "No skills selected to sync." >&2
    exit 1
  fi
}

validate_skill_name() {
  local skill_name="$1"
  if [[ ! "${skill_name}" =~ ^[a-z0-9._-]+$ ]]; then
    echo "Invalid skill name '${skill_name}'." >&2
    exit 1
  fi
}

safe_remove_path() {
  local dest_root="$1"
  local dest_path="$2"

  case "${dest_path}" in
    "${dest_root}"|"/"|"" )
      echo "Refusing to remove unsafe path: ${dest_path}" >&2
      exit 1
      ;;
  esac

  case "${dest_path}" in
    "${dest_root}/"* )
      rm -rf -- "${dest_path}"
      ;;
    * )
      echo "Refusing to remove path outside destination root: ${dest_path}" >&2
      exit 1
      ;;
  esac
}

copy_skill() {
  local skill_name="$1"
  local dest_root="$2"
  local source_path="${SKILLS_SRC_DIR}/${skill_name}"
  local dest_path="${dest_root}/${skill_name}"

  validate_skill_name "${skill_name}"

  if [[ ! -d "${source_path}" ]]; then
    echo "Source skill not found: ${source_path}" >&2
    exit 1
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] sync ${source_path} -> ${dest_path}"
    return 0
  fi

  mkdir -p "${dest_root}"
  safe_remove_path "${dest_root}" "${dest_path}"
  cp -R "${source_path}" "${dest_path}"
  echo "Synced ${skill_name} -> ${dest_path}"
}

sync_target() {
  local target_name="$1"
  local dest_root="$2"

  echo "Syncing skills to ${target_name}: ${dest_root}"
  for skill_name in "${SKILLS_TO_SYNC[@]}"; do
    copy_skill "${skill_name}" "${dest_root}"
  done
}

load_skills_to_sync

echo "Skills selected: ${SKILLS_TO_SYNC[*]}"

if [[ "${TARGET}" == "codex" || "${TARGET}" == "both" ]]; then
  sync_target "codex" "${CODEX_SKILLS_DIR}"
fi

if [[ "${TARGET}" == "claude" || "${TARGET}" == "both" ]]; then
  sync_target "claude" "${CLAUDE_SKILLS_DIR}"
fi

echo "Done."
