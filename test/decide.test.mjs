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

const DECIDE_VARS = {
  LABEL: 'DOUBLE DOWN',
  WHY: 'a fifth of lapsed users came back from one manual email',
  PATTERN: 'A manual version of a feature can prove demand before you build it',
};

function parseIds(stdout) {
  return Object.fromEntries([...stdout.matchAll(/^(\w+)=(\S+)$/gm)].map((m) => [m[1], m[2]]));
}

// A journal prepared by the First-run check, then one `/slice new` entry.
function newEntry(vars = NEW_VARS) {
  const home = freshJournal();
  const setup = runScript(recipe('First-run check'), { home });
  assert.equal(setup.code, 0, setup.stderr);
  const r = runScript(recipe('New entry'), { home, vars });
  assert.equal(r.code, 0, r.stderr);
  return { home, ids: parseIds(r.stdout) };
}

// A `/slice new` entry with its signal recorded, so a Decide task is open.
function signalledEntry() {
  const { home, ids } = newEntry();
  const r = runScript(recipe('Record signal'), { home, vars: { ENTRY_ID: ids.question, ...SIGNAL_VARS } });
  assert.equal(r.code, 0, r.stderr);
  return { home, ids: { ...ids, ...parseIds(r.stdout) } };
}

function logDecision(home, entryId, vars = DECIDE_VARS) {
  const r = runScript(recipe('Log decision'), { home, vars: { ENTRY_ID: entryId, ...vars } });
  return { r, ids: parseIds(r.stdout) };
}

const bulletRaw = (home, id) => bujoJson(home, 'read', id).bulletRaw;
const forwardRefs = (home, id) => bujoJson(home, 'refs', id).forwardRefs.map((ref) => ref.id);
const snapshot = (home) =>
  bujoJson(home, 'tree').files.map((f) => [f, bujoJson(home, 'read', f).content]);

test('decide: completes the open Decide task', () => {
  const { home, ids } = signalledEntry();
  const { r } = logDecision(home, ids.question);
  assert.equal(r.code, 0, r.stderr);
  assert.match(bulletRaw(home, ids.decide), /^- \[x\] Decide: digest brings users back\? #slice #decide #work /);
});

test('decide: writes the Decision note with label, em dash and why, tagged and threaded from the Question', () => {
  const { home, ids: entry } = signalledEntry();
  const { r, ids } = logDecision(home, entry.question);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.decision, r.stdout);
  assert.match(
    bulletRaw(home, ids.decision),
    /^- Decision: DOUBLE DOWN — a fifth of lapsed users came back from one manual email #slice #decision #work /,
  );
  const fwd = forwardRefs(home, entry.question);
  assert.ok(fwd.includes(ids.decision), `forwardRefs ${fwd} should include ${ids.decision}`);
});

test('decide: writes the pattern to the patterns collection with #pattern, threaded from the Question', () => {
  const { home, ids: entry } = signalledEntry();
  const { r, ids } = logDecision(home, entry.question);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.pattern, r.stdout);
  const read = bujoJson(home, 'read', ids.pattern);
  assert.equal(read.path, 'collections/patterns.md');
  assert.match(read.bulletRaw, /^- \[ \] A manual version of a feature can prove demand before you build it #pattern /);
  const fwd = forwardRefs(home, entry.question);
  assert.ok(fwd.includes(ids.pattern), `forwardRefs ${fwd} should include ${ids.pattern}`);
});

test('decide: an empty PATTERN writes no pattern', () => {
  const { home, ids: entry } = signalledEntry();
  const before = bujoJson(home, 'read', 'collections/patterns.md').content;
  const { r, ids } = logDecision(home, entry.question, { ...DECIDE_VARS, PATTERN: '' });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ids.decision, r.stdout);
  assert.equal(ids.pattern, undefined);
  assert.equal(bujoJson(home, 'read', 'collections/patterns.md').content, before);
});

test('decide: an invalid LABEL exits non-zero listing the valid labels and writes nothing', () => {
  const { home, ids: entry } = signalledEntry();
  const before = snapshot(home);
  const { r } = logDecision(home, entry.question, { ...DECIDE_VARS, LABEL: 'MAYBE' });
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /KILL, PIVOT, DOUBLE DOWN, CONTINUE, NO DECISION/);
  assert.deepEqual(snapshot(home), before);
});

test('decide: before a signal (no open Decide task) exits non-zero and writes nothing', () => {
  const { home, ids: entry } = newEntry();
  const before = snapshot(home);
  const { r } = logDecision(home, entry.question);
  assert.notEqual(r.code, 0);
  assert.match(r.stdout + r.stderr, /No open Decide task/);
  assert.deepEqual(snapshot(home), before);
});
