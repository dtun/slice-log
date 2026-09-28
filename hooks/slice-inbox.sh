#!/usr/bin/env bash
# Claude Code SessionStart hook: surfaces due slice items from the bujo journal.
# Must never break session start, so it always exits 0.

if ! command -v bujo >/dev/null 2>&1; then
  echo "slice: bujo is not installed. Install it with:"
  echo "npm install -g @paperstreetapp/bujo-cli"
  exit 0
fi

# BUJO_HOME / BUJO_TZ pass through from the environment.
# SLICE_DIGEST_DATE (YYYY-MM-DD) is test-only: pins `bujo digest --date` so
# tests are deterministic. Leave it unset in real use (digest defaults to today).
args=(digest)
if [[ -n "${SLICE_DIGEST_DATE:-}" ]]; then
  args+=(--date "$SLICE_DIGEST_DATE")
fi

# `bujo digest | grep '#slice'`, but keep each section heading (## Today,
# ## Week ahead, ## Overdue) above its slice lines; drop empty sections.
bujo "${args[@]}" 2>/dev/null | awk '
  /^## / { heading = $0; shown = 0; next }
  /#slice([^[:alnum:]_-]|$)/ {
    if (!shown) { if (printed) print ""; print heading; shown = 1; printed = 1 }
    print
  }
'
exit 0
