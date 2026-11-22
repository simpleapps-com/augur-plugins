#!/usr/bin/env bash
#
# Block commits and pushes that contain strings which MUST NOT be published.
# The list lives outside the repo, so this public script holds no strings.
#
# Usage:
#   check-banned-strings.sh --cached   scan the staged tree (pre-commit)
#   check-banned-strings.sh --push     scan every commit being pushed; reads
#                                      the pre-push hook's ref lines on stdin
#
# List: one string per line, matched case-insensitively as a fixed string.
# Blank lines and lines starting with # are ignored.
# Default location: <repo>/../.simpleapps/banned-strings.txt
# Override: BANNED_STRINGS_FILE=/path/to/list
#
# Contract:
#   @requires cwd ∈ a git work tree      (run from inside the repo; hooks do)
#   @ensures  exit 0 ⇒ ∀ s ∈ list. s ∉ scanned
#                                        (success means no listed string is in
#                                         the staged tree, or in any pushed commit)
#   @ensures  list missing ∨ list empty ⇒ exit 1
#                                        (fails closed: a machine without the
#                                         list cannot commit or push unchecked)
#   @ensures  exit ≠ 0 on any git error  (an error never reads as "clean")

set -euo pipefail

mode="${1:-}"
case "$mode" in
  --cached | --push) ;;
  *)
    echo "usage: $0 --cached | --push" >&2
    exit 2
    ;;
esac

repo_root="$(git rev-parse --show-toplevel)"
list_file="${BANNED_STRINGS_FILE:-$repo_root/../.simpleapps/banned-strings.txt}"

if [ ! -f "$list_file" ]; then
  echo "banned-strings: list not found at $list_file" >&2
  echo "banned-strings: create it (one string per line) before committing" >&2
  exit 1
fi

# An empty pattern matches every line, so strip blanks and comments first.
patterns_file="$(mktemp)"
trap 'rm -f "$patterns_file"' EXIT
grep -v -e '^[[:space:]]*$' -e '^[[:space:]]*#' "$list_file" > "$patterns_file" || true

if [ ! -s "$patterns_file" ]; then
  echo "banned-strings: list at $list_file has no entries" >&2
  exit 1
fi

found=0

# git grep exits 0 on a match, 1 on no match, and >1 on error.
scan() {
  local status=0
  git grep -n -I -i -F -f "$patterns_file" "$@" || status=$?
  case "$status" in
    0) found=1 ;;
    1) ;;
    *)
      echo "banned-strings: git grep failed (exit $status)" >&2
      exit "$status"
      ;;
  esac
}

if [ "$mode" = "--cached" ]; then
  scan --cached
else
  zero_sha="0000000000000000000000000000000000000000"
  while read -r local_ref local_sha remote_ref remote_sha; do
    [ -z "${local_ref:-}" ] && continue
    # Deleting a remote branch pushes no content.
    [ "$local_sha" = "$zero_sha" ] && continue
    if [ "$remote_sha" = "$zero_sha" ]; then
      range=("$local_sha" --not --remotes)
    else
      range=("$remote_sha..$local_sha")
    fi
    for commit in $(git rev-list "${range[@]}"); do
      scan "$commit"
    done
  done
fi

if [ "$found" -eq 1 ]; then
  echo "banned-strings: blocked. Remove the matches above and try again." >&2
  exit 1
fi
