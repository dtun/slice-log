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

function parseIds(stdout) {
  return Object.fromEntries([...stdout.matchAll(/^(\w+)=(\S+)$/gm)].map((m) => [m[1], m[2]]));
}

function newEntry() {
  const home = freshJournal();
  const setup = runScript(recipe('First-run check'), { home });
  assert.equal(setup.code, 0, setup.stderr);
  const r = runScript(recipe('New entry'), { home, vars: NEW_VARS });
  assert.equal(r.code, 0, r.stderr);
  return { home, ids: parseIds(r.stdout) };
}

function signalledEntry() {
  const { home, ids } = newEntry();
  const r = runScript(recipe('Record signal'), {
    home,
    vars: { ENTRY_ID: ids.question, SIGNAL: '4 of 20 lapsed users opened the app within a week', SHORT_Q: NEW_VARS.SHORT_Q },
  });
  assert.equal(r.code, 0, r.stderr);
  return { home, ids: { ...ids, ...parseIds(r.stdout) } };
}

function decidedEntry() {
  const { home, ids } = signalledEntry();
  const r = runScript(recipe('Log decision'), {
    home,
    vars: {
      ENTRY_ID: ids.question,
      LABEL: 'DOUBLE DOWN',
      WHY: 'a fifth of lapsed users came back from one manual email',
      PATTERN: 'A manual version of a feature can prove demand before you build it',
    },
  });
  assert.equal(r.code, 0, r.stderr);
  return { home, ids: { ...ids, ...parseIds(r.stdout) } };
}

const show = (home, id) => runScript(recipe('Show entry'), { home, vars: { ENTRY_ID: id } });

test('show: a fresh entry shows the Question, Slice and Check signal lines and is awaiting signal', () => {
  const { home, ids } = newEntry();
  const r = show(home, ids.question);
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.match(lines[0], /^- Q: Will a weekly digest email bring lapsed users back\? \| At stake: whether we build the full notification system #slice #question #work .*\(\d{4}\/\d{2}\/\d{2}\/daily\.md\)$/);
  assert.match(lines[1], /^- Slice: Sent one hand-written digest to 20 lapsed users #slice #work .*\(\d{4}\/\d{2}\/\d{2}\/daily\.md\)$/);
  assert.match(lines[2], /^- \[ \] Check signal: digest brings users back\? #slice #signal-due #work .*\(\S+\.md\)$/);
  assert.equal(lines.at(-1), 'Status: Awaiting signal');
});

test('show: after a signal shows the Signal and open Decide lines and needs a decision', () => {
  const { home, ids } = signalledEntry();
  const r = show(home, ids.question);
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.match(lines[2], /^- \[x\] Check signal: digest brings users back\? #slice #signal-due #work /);
  assert.match(lines[3], /^- Signal: 4 of 20 lapsed users opened the app within a week #slice #signal #work .*\(\d{4}\/\d{2}\/\d{2}\/daily\.md\)$/);
  assert.match(lines[4], /^- \[ \] Decide: digest brings users back\? #slice #decide #work /);
  assert.equal(lines.at(-1), 'Status: Needs decision');
});

test('show: after a decision with a pattern shows the Decision and Pattern lines and is closed', () => {
  const { home, ids } = decidedEntry();
  const r = show(home, ids.question);
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.match(lines[4], /^- \[x\] Decide: digest brings users back\? #slice #decide #work /);
  assert.match(lines[5], /^- Decision: DOUBLE DOWN — a fifth of lapsed users came back from one manual email #slice #decision #work .*\(\d{4}\/\d{2}\/\d{2}\/daily\.md\)$/);
  assert.match(lines[6], /^- \[ \] A manual version of a feature can prove demand before you build it #pattern .*\(collections\/patterns\.md\)$/);
  assert.equal(lines.at(-1), 'Status: Closed');
});

test("show: the Signal note's ID resolves to the same entry", () => {
  const { home, ids } = decidedEntry();
  const byQuestion = show(home, ids.question);
  const r = show(home, ids.signal);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^- Q: Will a weekly digest email bring lapsed users back\?/);
  assert.equal(r.stdout, byQuestion.stdout);
});

test('show: an unknown ID exits non-zero with a clear message', () => {
  const { home } = newEntry();
  const r = show(home, 'zzzzzzzz');
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /No slice entry for ID zzzzzzzz/);
  assert.equal(r.stdout, '');
});

test('show: leaves the journal unchanged', () => {
  const { home, ids } = decidedEntry();
  const snapshot = () => bujoJson(home, 'tree').files.map((f) => [f, bujoJson(home, 'read', f).content]);
  const before = snapshot();
  assert.equal(show(home, ids.question).code, 0);
  assert.equal(show(home, ids.signal).code, 0);
  assert.deepEqual(snapshot(), before);
});
