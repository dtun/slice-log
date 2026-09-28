import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bujoJson, freshJournal, recipe, runScript } from './helpers.mjs';

const NEW_VARS = {
  QUESTION: 'Will a weekly digest email bring lapsed users back?',
  AT_STAKE: 'whether we build the full notification system',
  SLICE: 'Sent one hand-written digest to 20 lapsed users',
  SHORT_Q: 'digest brings users back?',
  DUE: '2026-10-05',
  CTX: 'work',
};

const SIGNAL_VARS = {
  SIGNAL: '4 of 20 lapsed users opened the app within a week',
  SHORT_Q: 'digest brings users back?',
};

// A journal prepared by the First-run check, then one `/slice new` entry.
function newEntry(vars = NEW_VARS) {
  const home = freshJournal();
  const setup = runScript(recipe('First-run check'), { home });
  assert.equal(setup.code, 0, setup.stderr);
  const r = runScript(recipe('New entry'), { home, vars });
  assert.equal(r.code, 0, r.stderr);
  const ids = parseIds(r.stdout);
  return { home, ids };
}

function parseIds(stdout) {
  return Object.fromEntries([...stdout.matchAll(/^(\w+)=(\S+)$/gm)].map((m) => [m[1], m[2]]));
}

function recordSignal(home, entryId, vars = SIGNAL_VARS) {
  const r = runScript(recipe('Record signal'), { home, vars: { ENTRY_ID: entryId, ...vars } });
  return { r, ids: parseIds(r.stdout) };
}

const bulletRaw = (home, id) => bujoJson(home, 'read', id).bulletRaw;
const forwardRefs = (home, id) => bujoJson(home, 'refs', id).forwardRefs.map((ref) => ref.id);
const snapshot = (home) =>
  bujoJson(home, 'tree').files.map((f) => [f, bujoJson(home, 'read', f).content]);

test('signal: completes the open Check signal task', () => {
  const { home, ids } = newEntry();
  const { r } = recordSignal(home, ids.question);
  assert.equal(r.code, 0, r.stderr);
  assert.match(bulletRaw(home, ids.check), /^- \[x\] Check signal: digest brings users back\? #slice #signal-due #work /);
});

test('signal: writes the Signal note with slice, signal and ctx tags, threaded from the Question', () => {
  const { home, ids: entry } = newEntry();
  const { r, ids } = recordSignal(home, entry.question);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.signal, r.stdout);
  assert.match(
    bulletRaw(home, ids.signal),
    /^- Signal: 4 of 20 lapsed users opened the app within a week #slice #signal #work /,
  );
  const fwd = forwardRefs(home, entry.question);
  assert.ok(fwd.includes(ids.signal), `forwardRefs ${fwd} should include ${ids.signal}`);
});

test("signal: opens a Decide task on today's daily, tagged and threaded from the Question", () => {
  const { home, ids: entry } = newEntry();
  const { r, ids } = recordSignal(home, entry.question);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.decide, r.stdout);
  const read = bujoJson(home, 'read', ids.decide);
  assert.equal(read.path, bujoJson(home, 'daily').path);
  assert.match(read.bulletRaw, /^- \[ \] Decide: digest brings users back\? #slice #decide #work /);
  const fwd = forwardRefs(home, entry.question);
  assert.ok(fwd.includes(ids.decide), `forwardRefs ${fwd} should include ${ids.decide}`);
});

test('signal: an unknown ENTRY_ID exits non-zero with a message and writes nothing', () => {
  const { home } = newEntry();
  const before = snapshot(home);
  const { r } = recordSignal(home, 'zzzzzzzz');
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /No slice question with ID zzzzzzzz/);
  assert.deepEqual(snapshot(home), before);
});

test('signal: a second run on the same entry exits non-zero and writes nothing', () => {
  const { home, ids: entry } = newEntry();
  const first = recordSignal(home, entry.question);
  assert.equal(first.r.code, 0, first.r.stderr);
  const before = snapshot(home);
  const { r } = recordSignal(home, entry.question);
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /No open Check signal task/);
  assert.deepEqual(snapshot(home), before);
});
