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

## /slice signal <id>

Record what was observed, then open a Decide task. `<id>` is the entry ID
(the Question bullet's ID).

1. Run the `First-run check`.
2. Read the entry (`bujo read <id> --bullet-only`, and its `bujo refs <id>`)
   so you know the question, its context tag, and the open `Check signal:`
   task. Take the **short Q** from that task's text.
3. **Check in** (advisory; the user accepts, edits, or dismisses): ask what
   was observed. Separate the observation (what literally happened: numbers,
   quotes, events) from its interpretation (what they think it means). Only
   the observation goes into `SIGNAL`; keep the signal line factual. Keep the
   interpretation out of the Signal note, or, if the user insists, mark it
   clearly (e.g. `… (interpretation: …)`).
4. **Portability check** (only when the entry is tagged `#work`): strip
   customer names, exact internal metrics, and confidential terms from the
   signal, and propose safe rewrites. Nothing is written until the user
   accepts the portable wording.
5. Run the `Record signal` recipe with the final values. It refuses (non-zero,
   writes nothing) if the ID is not a slice question or has no open
   `Check signal:` task.
6. Report the `signal=` and `decide=` IDs, and that the Decide task is due
   today (it shows as overdue in the digest until `/slice decide`).

## /slice decide <id>

Log the decision and draft the pattern. `<id>` is the entry ID (the Question
bullet's ID).

1. Run the `First-run check`.
2. Read the entry (`bujo read <id> --bullet-only`, and its `bujo refs <id>`)
   so you know the question, its context tag, and the open `Decide:` task.
   Show the user the entry's `Signal:` note before asking for a decision.
3. **Force the decision**: the user must pick exactly one label:
   `KILL`, `PIVOT`, `DOUBLE DOWN`, `CONTINUE`, or `NO DECISION`, plus a
   one-line **why**. Do not accept anything vaguer ("let's see", "maybe")
   and never default to a label. `NO DECISION` is allowed only when the user
   explicitly chooses it; never pick it for them because they hesitated.
4. **Extract the pattern** (advisory; the user accepts, edits, or dismisses):
   draft ONE portable lesson line learned from this slice. It must generalize
   beyond this entry: no company or customer names, no internal metrics. If
   the user dismisses it, leave `PATTERN` empty and no pattern is written.
5. **Portability check** (only when the entry is tagged `#work`): strip
   customer names, exact internal metrics, and confidential terms from the
   why (and the pattern), and propose safe rewrites. Nothing is written until
   the user accepts the portable wording.
6. Run the `Log decision` recipe with the final values. It refuses (non-zero,
   writes nothing) if the label is not one of the five, the why is empty, the
   ID is not a slice question, or there is no open `Decide:` task (no signal
   recorded yet, or already decided).
7. Report the `decision=` ID and, if written, the `pattern=` ID. The entry is
   now closed.

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
if ! node -e 'const d=process.argv[1];const t=new Date(d+"T00:00:00Z");process.exit(!isNaN(t)&&t.toISOString().slice(0,10)===d?0:1)' "$DUE"; then
  echo "DUE must be a real date (got: $DUE)" >&2; exit 1
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

### Record signal

Inputs: `ENTRY_ID` (the Question ID), `SIGNAL` (what was observed, factual),
`SHORT_Q` (take it from the entry's `Check signal:` task text). The context
tag (`work`/`personal`) is copied from the Question bullet.
Prints `signal=<id>` and `decide=<id>`.

```bash
read_id() { node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id'; }
for v in ENTRY_ID SIGNAL SHORT_Q; do
  if [ -z "${!v:-}" ]; then echo "$v is required" >&2; exit 1; fi
done
Q_LINE=$(bujo read "$ENTRY_ID" --bullet-only 2>/dev/null || true)
if [[ "$Q_LINE" != "- Q: "* || " $Q_LINE " != *" #slice "* || " $Q_LINE " != *" #question "* ]]; then
  echo "No slice question with ID $ENTRY_ID" >&2; exit 1
fi
CTX=""
for c in work personal; do
  if [[ " $Q_LINE " == *" #$c "* ]]; then CTX=$c; break; fi
done
if [ -z "$CTX" ]; then echo "Entry $ENTRY_ID has no #work or #personal tag" >&2; exit 1; fi
CHECK_ID=""
for ref in $(bujo refs "$ENTRY_ID" --json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.forwardRefs.map((r) => r.id).join(" ")'); do
  line=$(bujo read "$ref" --bullet-only)
  if [[ "$line" == "- [ ] "*"Check signal:"* ]]; then CHECK_ID=$ref; break; fi
done
if [ -z "$CHECK_ID" ]; then
  echo "No open Check signal task for entry $ENTRY_ID (signal already recorded?)" >&2; exit 1
fi
bujo done "$CHECK_ID" >/dev/null
SIGNAL_ID=$(bujo note "Signal: $SIGNAL" --tag slice --tag signal --tag "$CTX" --json | read_id)
bujo thread "$ENTRY_ID" "$SIGNAL_ID" >/dev/null
DECIDE_ID=$(bujo add "Decide: $SHORT_Q" --tag slice --tag decide --tag "$CTX" --json | read_id)
bujo thread "$ENTRY_ID" "$DECIDE_ID" >/dev/null
echo "signal=$SIGNAL_ID"
echo "decide=$DECIDE_ID"
```

### Log decision

Inputs: `ENTRY_ID` (the Question ID), `LABEL` (one of `KILL`, `PIVOT`,
`DOUBLE DOWN`, `CONTINUE`, `NO DECISION`), `WHY` (one line); optional
`PATTERN` (one portable lesson; leave empty to skip). The context tag is
copied from the Question bullet.
Prints `decision=<id>` and, when a pattern is written, `pattern=<id>`.

```bash
read_id() { node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.id'; }
for v in ENTRY_ID LABEL WHY; do
  if [ -z "${!v:-}" ]; then echo "$v is required" >&2; exit 1; fi
done
case "$LABEL" in
  KILL|PIVOT|"DOUBLE DOWN"|CONTINUE|"NO DECISION") ;;
  *) echo "LABEL must be one of: KILL, PIVOT, DOUBLE DOWN, CONTINUE, NO DECISION (got: $LABEL)" >&2; exit 1 ;;
esac
Q_LINE=$(bujo read "$ENTRY_ID" --bullet-only 2>/dev/null || true)
if [[ "$Q_LINE" != "- Q: "* || " $Q_LINE " != *" #slice "* || " $Q_LINE " != *" #question "* ]]; then
  echo "No slice question with ID $ENTRY_ID" >&2; exit 1
fi
CTX=""
for c in work personal; do
  if [[ " $Q_LINE " == *" #$c "* ]]; then CTX=$c; break; fi
done
if [ -z "$CTX" ]; then echo "Entry $ENTRY_ID has no #work or #personal tag" >&2; exit 1; fi
DECIDE_ID=""
for ref in $(bujo refs "$ENTRY_ID" --json | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.forwardRefs.map((r) => r.id).join(" ")'); do
  line=$(bujo read "$ref" --bullet-only)
  if [[ "$line" == "- [ ] "*"Decide:"* ]]; then DECIDE_ID=$ref; break; fi
done
if [ -z "$DECIDE_ID" ]; then
  echo "No open Decide task for entry $ENTRY_ID (record the signal first, or already decided?)" >&2; exit 1
fi
bujo done "$DECIDE_ID" >/dev/null
DECISION_ID=$(bujo note "Decision: $LABEL — $WHY" --tag slice --tag decision --tag "$CTX" --json | read_id)
bujo thread "$ENTRY_ID" "$DECISION_ID" >/dev/null
echo "decision=$DECISION_ID"
if [ -n "${PATTERN:-}" ]; then
  PATTERN_ID=$(bujo collection add patterns "$PATTERN" --tag pattern --json | read_id)
  bujo thread "$ENTRY_ID" "$PATTERN_ID" >/dev/null
  echo "pattern=$PATTERN_ID"
fi
```
