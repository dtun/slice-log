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
