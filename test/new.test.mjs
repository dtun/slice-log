import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bujoJson, freshJournal, recipe, runScript } from './helpers.mjs';

const VARS = {
  QUESTION: 'Will a weekly digest email bring lapsed users back?',
  AT_STAKE: 'whether we build the full notification system',
  SLICE: 'Sent one hand-written digest to 20 lapsed users',
  SHORT_Q: 'digest brings users back?',
  DUE: '2026-10-05',
  CTX: 'work',
};

// A journal prepared by the First-run check, then one `/slice new` entry.
function newEntry(vars = VARS) {
  const home = freshJournal();
  const setup = runScript(recipe('First-run check'), { home });
  assert.equal(setup.code, 0, setup.stderr);
  const r = runScript(recipe('New entry'), { home, vars });
  const ids = Object.fromEntries(
    [...r.stdout.matchAll(/^(question|slice|check)=(\S+)$/gm)].map((m) => [m[1], m[2]]),
  );
  return { home, r, ids };
}

const bulletRaw = (home, id) => bujoJson(home, 'read', id).bulletRaw;

test('new: writes the Question bullet with slice, question and ctx tags', () => {
  const { home, r, ids } = newEntry();
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.question, r.stdout);
  assert.match(
    bulletRaw(home, ids.question),
    /^- Q: Will a weekly digest email bring lapsed users back\? \| At stake: whether we build the full notification system #slice #question #work /,
  );
});

test('new: writes the Slice note with slice and ctx tags, threaded from the Question', () => {
  const { home, r, ids } = newEntry();
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.slice, r.stdout);
  assert.match(
    bulletRaw(home, ids.slice),
    /^- Slice: Sent one hand-written digest to 20 lapsed users #slice #work /,
  );
  const fwd = bujoJson(home, 'refs', ids.question).forwardRefs.map((ref) => ref.id);
  assert.ok(fwd.includes(ids.slice), `forwardRefs ${fwd} should include ${ids.slice}`);
});

test('new: opens a Check signal task on the due date, threaded and in the week ahead', () => {
  const { home, r, ids } = newEntry();
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.check, r.stdout);

  const read = bujoJson(home, 'read', ids.check);
  assert.equal(read.path, '2026/10/05/daily.md');
  assert.match(read.bulletRaw, /^- \[ \] Check signal: digest brings users back\? #slice #signal-due #work /);

  const fwd = bujoJson(home, 'refs', ids.question).forwardRefs.map((ref) => ref.id);
  assert.ok(fwd.includes(ids.check), `forwardRefs ${fwd} should include ${ids.check}`);

  const digest = bujoJson(home, 'digest', '--date', '2026-10-04');
  const due = digest.weekAhead.find((b) => b.id === ids.check);
  assert.ok(due, JSON.stringify(digest.weekAhead));
  assert.equal(due.state, 'open');
  assert.equal(due.date, '2026-10-05');
});

test('new: SHARPENED=1 adds #sharpened to the Question', () => {
  const { home, r, ids } = newEntry({ ...VARS, CTX: 'personal', SHARPENED: '1' });
  assert.equal(r.code, 0, r.stderr);
  assert.match(
    bulletRaw(home, ids.question),
    /^- Q: .* \| At stake: .* #slice #question #personal #sharpened /,
  );
});

test('new: an invalid CTX exits non-zero with a message and writes nothing', () => {
  const home = freshJournal();
  assert.equal(runScript(recipe('First-run check'), { home }).code, 0);
  const snapshot = () =>
    bujoJson(home, 'tree').files.map((f) => [f, bujoJson(home, 'read', f).content]);
  const before = snapshot();

  const r = runScript(recipe('New entry'), { home, vars: { ...VARS, CTX: 'client-x' } });
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /CTX must be work or personal/);
  assert.deepEqual(snapshot(), before);
});
