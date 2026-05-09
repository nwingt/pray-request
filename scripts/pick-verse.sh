#!/usr/bin/env bash
# Picks a verse from prayrequest-verses.json based on PR title and diff
# shape, formats it as a PrayRequest comment body, writes to stdout.
#
# Reads (env):
#   PR_TITLE         — PR title (case-insensitive matched against tags)
#   PR_ADDITIONS     — line additions (massive-diff threshold: >500)
#   PR_CHANGED_FILES — files changed (massive-diff threshold: >20)
#   VERSES_FILE      — path to verse JSON (default: .github/prayrequest-verses.json)

set -euo pipefail

verses_file="${VERSES_FILE:-.github/prayrequest-verses.json}"
title_lc=$(printf '%s' "${PR_TITLE:-}" | tr '[:upper:]' '[:lower:]')

match=""

# Massive-diff override
if [ "${PR_ADDITIONS:-0}" -gt 500 ] || [ "${PR_CHANGED_FILES:-0}" -gt 20 ]; then
  match=$(jq -c '.verses[] | select(.tags | index("massive"))' "$verses_file" | head -n 1)
fi

# Tag keyword match in title; first verse with any matching tag wins
if [ -z "$match" ]; then
  count=$(jq '.verses | length' "$verses_file")
  for i in $(seq 0 $((count - 1))); do
    tags=$(jq -r ".verses[$i].tags[]" "$verses_file")
    for tag in $tags; do
      if printf '%s' "$title_lc" | grep -qE "(^|[^[:alnum:]])${tag}([^[:alnum:]]|$)"; then
        match=$(jq -c ".verses[$i]" "$verses_file")
        break 2
      fi
    done
  done
fi

# Default fallback
if [ -z "$match" ]; then
  match=$(jq -c '.default' "$verses_file")
fi

verse=$(printf '%s' "$match" | jq -r '.verse')
ref=$(printf '%s' "$match" | jq -r '.ref')

printf '> %s\n> — *%s*\n\n*— 🙏 PrayRequest*\n' "$verse" "$ref"
