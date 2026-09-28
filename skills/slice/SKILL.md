---
name: slice
description: Decision journal for thin-slice experiments (Question → Slice → Signal → Decision), stored in bujo. Use when the user runs /slice (new, signal, decide, inbox, show, patterns) or wants to log a thin-slice experiment, record a signal, make a KILL/PIVOT/DOUBLE DOWN/CONTINUE decision, or review lessons/patterns from past slices.
allowed-tools: Bash
---

# slice

A decision journal for people who ship in thin slices. Each entry records one
experiment: **Question → Slice → Signal → Decision**. Everything is stored as
bujo bullets (markdown in the bujo journal) that thread to the Question bullet.

## How to use the recipes

Each step below is a `### <recipe>` heading with one `bash` block. Set the
documented shell variables, then run the block as-is with the Bash tool.
Recipes are self-contained and print what they create.

**Run the `First-run check` recipe at the top of every `/slice` command.** If it
exits non-zero, stop and show the user its output (e.g. the install command);
do not run any other recipe. When everything is already set up it prints nothing.

## /slice new

Start a new entry: **Question → Slice → Signal due**.

1. Collect from the user:
   - **Question**: what they want to learn.
   - **What's at stake**: the decision that depends on the answer.
   - **Day-one slice**: what they will ship (or shipped) first.
   - **Signal-due date**: when to check for a signal, as `YYYY-MM-DD`.
   - **Context**: `work` or `personal`.
   - A **short Q** (a few words) for the task titles, drafted by you.
2. Offer the guidance moments below. Each is advisory: show your suggestion
   and let the user accept it, edit it, or dismiss it. Never apply one silently.
   - **Sharpen**: if the question has no decision at stake (nothing would
     change whatever the answer), say so and propose a rewrite that names the
     decision. If the user accepts it (as-is or edited), set `SHARPENED=1`.
   - **Go thinner**: propose a thinner slice, biased toward only capturing
     data (a manual version, a fake door, a log line) before building. If the
     user accepts it, set `THINNED=1`.
   - **Portability check** (only when the context is `work`): strip customer
     names, exact internal metrics, and confidential terms from the question,
     stake, slice and short Q, and propose safe rewrites (e.g. "a large
     customer", "conversion dropped noticeably"). Nothing tagged `#work` is
     written until the user accepts the portable wording.
3. Run the `First-run check`, then the `New entry` recipe with the final values.
4. Report the entry ID (the `question=` ID) and the signal-due date.

## Recipes

### First-run check

Inputs: none.

```bash
if ! command -v bujo >/dev/null 2>&1; then
  echo "npm install -g @paperstreetapp/bujo-cli"
  exit 1
fi
bujo init >/dev/null
if ! bujo collection list --json | node -e '
  const { data } = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const all = [...data.active, ...data.archived];
  process.exit(all.some((c) => c.slug === "patterns") ? 0 : 1);
'; then
  bujo collection new "Patterns" >/dev/null
fi
```

### New entry

Inputs: `QUESTION`, `AT_STAKE`, `SLICE`, `SHORT_Q`, `DUE` (`YYYY-MM-DD`),
`CTX` (`work` or `personal`); optional `SHARPENED=1`, `THINNED=1`.
Prints `question=<id>`, `slice=<id>`, `check=<id>`; the question ID is the entry ID.

```bash
read_id() { node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id'; }
for v in QUESTION AT_STAKE SLICE SHORT_Q DUE CTX; do
  if [ -z "${!v:-}" ]; then echo "$v is required" >&2; exit 1; fi
done
case "$CTX" in
  work|personal) ;;
  *) echo "CTX must be work or personal (got: $CTX)" >&2; exit 1 ;;
esac
if ! [[ "$DUE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "DUE must be YYYY-MM-DD (got: $DUE)" >&2; exit 1
fi
Q_TAGS=(--tag slice --tag question --tag "$CTX")
[ "${SHARPENED:-}" = 1 ] && Q_TAGS+=(--tag sharpened)
[ "${THINNED:-}" = 1 ] && Q_TAGS+=(--tag thinned)
Q_ID=$(bujo note "Q: $QUESTION | At stake: $AT_STAKE" "${Q_TAGS[@]}" --json | read_id)
SLICE_ID=$(bujo note "Slice: $SLICE" --tag slice --tag "$CTX" --json | read_id)
bujo thread "$Q_ID" "$SLICE_ID" >/dev/null
CHECK_ID=$(bujo add "Check signal: $SHORT_Q" --tag slice --tag signal-due --tag "$CTX" --date "$DUE" --json | read_id)
bujo thread "$Q_ID" "$CHECK_ID" >/dev/null
echo "question=$Q_ID"
echo "slice=$SLICE_ID"
echo "check=$CHECK_ID"
```
