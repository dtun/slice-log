# slice-log

A decision journal for people who ship in thin slices. Each entry records one
experiment: **Question → Slice → Signal → Decision**. It is a Claude skill
named `slice`, built on [`bujo-cli`](https://github.com/paperstreetapp/bujo-cli):
entries are plain bujo bullets (markdown in `~/.bujo`) threaded to a Question
bullet. There's no app, server, or database, and no model call outside Claude.
The first slice isn't the feature, it's the measurement.

## Setup

Install bujo, then copy the skill (once, by hand):

```sh
npm install -g github:paperstreetapp/bujo-cli#v0.2.0
mkdir -p ~/.claude/skills/slice && cp skills/slice/SKILL.md ~/.claude/skills/slice/
```

The spec's install line is `npm install -g @paperstreetapp/bujo-cli`, but that
package isn't on the npm registry yet (404), so install from GitHub as shown.

You don't need to run `bujo init` yourself. The skill's first-run check runs at
the top of every `/slice` command: it prints the install line if `bujo` is
missing, runs `bujo init` (safe to repeat), and creates the `Patterns`
collection if it doesn't exist.

## Nag: SessionStart hook

`hooks/slice-inbox.sh` prints the `#slice` lines of `bujo digest` (Today, Week
ahead, Overdue) so every Claude Code session opens with what's due. It always
exits 0, and prints the install line if `bujo` is missing. To enable it, add
this to `~/.claude/settings.json`, using the absolute path to your checkout of
this repo:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "/abs/path/to/slice-log/hooks/slice-inbox.sh" }
        ]
      }
    ]
  }
}
```

If you already have a `hooks` key, merge this entry into it.

## Commands

| Command | What it does |
|---|---|
| `/slice new` | Log a Question and what's at stake, the day-one Slice, and a signal-due date. |
| `/slice signal <id>` | Record the observed signal and open a Decide task. |
| `/slice decide <id>` | Log one of KILL, PIVOT, DOUBLE DOWN, CONTINUE, or NO DECISION with a why, and draft a pattern. |
| `/slice inbox` | Show due `#slice` items from `bujo digest`. |
| `/slice show <id>` | Rebuild one entry from `bujo refs` and `bujo read`, with its derived status. |
| `/slice patterns` | Export every `#pattern` lesson as markdown. |

`<id>` is the entry ID, which is the Question bullet's ID. The skill also
offers advisory guidance: sharpen the question, go thinner, separate
observation from interpretation, force a decision, extract a pattern, and a
portability check before anything tagged `#work` is written.

## Entry conventions

Every bullet carries `#slice` and one context tag, `#work` or `#personal`.

| Step | Bullet | Tags |
|---|---|---|
| Question | `Q: <question> \| At stake: <decision>` | `#question` (+ `#sharpened` / `#thinned` if guidance was accepted) |
| Slice | `Slice: <what shipped day one>` | — |
| Signal due | task `Check signal: <short Q>`, dated the due date | `#signal-due` |
| Signal | `Check signal` done; note `Signal: <observed>`; task `Decide: <short Q>` dated today | `#signal`, `#decide` |
| Decision | `Decide` done; note `Decision: <LABEL> — <why>` | `#decision` |
| Pattern | `<portable lesson>` in the `patterns` collection | `#pattern` only |

Each bullet after the Question is threaded from the Question (`bujo thread`).

Status is derived from the journal and never stored:

- **Awaiting signal**: an open `Check signal` task exists.
- **Needs decision**: an open `Decide` task exists. It's dated today, so it
  shows as overdue in the digest until it's done.
- **Closed**: a `#decision` note exists.

## Measurement

Measurement comes from the journal itself, with no telemetry. `bujo search`
prints `<daily log path>:<line>: <bullet>`, and the path gives the date.

```sh
bujo search "#question"    # entries; group by path date for entries/week
bujo search "#decision"    # close rate = #decision count / #question count
bujo search "#signal "     # signal→decision time = days between #signal and #decision paths
bujo search "#sharpened"   # guidance acceptance (sharpen)
bujo search "#thinned"     # guidance acceptance (go thinner)
```

`bujo search` is a case-insensitive substring match, so `#signal` alone also
matches `#signal-due`. Hence the trailing space above. Use `bujo read <id>` or
`bujo refs <id>` to tie a Signal and a Decision to the same entry.

## Development

```sh
npm install
npm test
```

Tests use `node --test` and run the real `bujo` from the GitHub devDependency
against a fresh temp journal (`BUJO_HOME`) per test, so they never touch
`~/.bujo`. There are two test seams:

- **SKILL.md recipes**: each `### <recipe>` bash block in
  `skills/slice/SKILL.md` is extracted, run with its input variables, and
  checked against the resulting journal state.
- **The hook script**: `hooks/slice-inbox.sh` is run as a subprocess and its
  stdout and exit code are checked.

Recipes must be self-contained, because only `SKILL.md` is copied at install.

## Scope

Slices 4–6 (bujo collection types, plugin packaging, a hosted MCP server) are
gated per the spec (§7, §10) and are intentionally not built.
