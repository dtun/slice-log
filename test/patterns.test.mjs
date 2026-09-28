import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bujoJson, freshJournal, recipe, runScript } from './helpers.mjs';

function parseIds(stdout) {
  return Object.fromEntries([...stdout.matchAll(/^(\w+)=(\S+)$/gm)].map((m) => [m[1], m[2]]));
}

function run(home, heading, vars) {
  const r = runScript(recipe(heading), { home, vars });
  assert.equal(r.code, 0, r.stderr);
  return parseIds(r.stdout);
}

function journal() {
  const home = freshJournal();
  run(home, 'First-run check');
  return home;
}

function decidedEntry(home, { question, shortQ, ctx, label, pattern }) {
  const { question: id } = run(home, 'New entry', {
    QUESTION: question,
    AT_STAKE: 'whether we invest further',
    SLICE: 'Shipped the smallest version by hand',
    SHORT_Q: shortQ,
    DUE: '2026-10-05',
    CTX: ctx,
  });
  run(home, 'Record signal', { ENTRY_ID: id, SIGNAL: 'A few users responded', SHORT_Q: shortQ });
  run(home, 'Log decision', { ENTRY_ID: id, LABEL: label, WHY: 'the signal was clear enough', PATTERN: pattern });
  return id;
}

const exportPatterns = (home) => runScript(recipe('Export patterns'), { home });

test('patterns: two decided entries export one clean markdown bullet per lesson', () => {
  const home = journal();
  decidedEntry(home, {
    question: 'Will a weekly digest email bring lapsed users back?',
    shortQ: 'digest brings users back?',
    ctx: 'work',
    label: 'DOUBLE DOWN',
    pattern: 'A manual version of a feature can prove demand before you build it',
  });
  decidedEntry(home, {
    question: 'Does journaling before bed improve my sleep?',
    shortQ: 'journaling improves sleep?',
    ctx: 'personal',
    label: 'KILL',
    pattern: 'Measure the baseline for a week before changing anything',
  });
  const r = exportPatterns(home);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(
    r.stdout,
    '# Patterns\n\n' +
      '- A manual version of a feature can prove demand before you build it\n' +
      '- Measure the baseline for a week before changing anything\n',
  );
  assert.doesNotMatch(r.stdout, /\^|#pattern|\[ \]|←|→/);
});

test('patterns: an entry decided with an empty PATTERN adds nothing, even if its question mentions #pattern', () => {
  const home = journal();
  decidedEntry(home, {
    question: 'Will a weekly digest email bring lapsed users back?',
    shortQ: 'digest brings users back?',
    ctx: 'work',
    label: 'DOUBLE DOWN',
    pattern: 'A manual version of a feature can prove demand before you build it',
  });
  decidedEntry(home, {
    question: 'Is a #pattern tag worth adding to every retro note?',
    shortQ: 'tag retro notes?',
    ctx: 'personal',
    label: 'NO DECISION',
    pattern: '',
  });
  const r = exportPatterns(home);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '# Patterns\n\n- A manual version of a feature can prove demand before you build it\n');
});

test('patterns: with no patterns prints the heading and an empty-state line', () => {
  const home = journal();
  const r = exportPatterns(home);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '# Patterns\n\n_No patterns yet._\n');
});

test('patterns: leaves the journal unchanged', () => {
  const home = journal();
  decidedEntry(home, {
    question: 'Will a weekly digest email bring lapsed users back?',
    shortQ: 'digest brings users back?',
    ctx: 'work',
    label: 'DOUBLE DOWN',
    pattern: 'A manual version of a feature can prove demand before you build it',
  });
  const snapshot = () => bujoJson(home, 'tree').files.map((f) => [f, bujoJson(home, 'read', f).content]);
  const before = snapshot();
  assert.equal(exportPatterns(home).code, 0);
  assert.deepEqual(snapshot(), before);
});
