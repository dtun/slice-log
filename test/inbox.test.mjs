import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bujoJson, freshJournal, recipe, runScript } from './helpers.mjs';

// Fixed reference date for the digest, far from the real "today" on which the
// New entry recipe writes its Question/Slice notes.
const DIGEST_DATE = '2030-06-01';

const NEW_VARS = {
  QUESTION: 'Will a weekly digest email bring lapsed users back?',
  AT_STAKE: 'whether we build the full notification system',
  SLICE: 'Sent one hand-written digest to 20 lapsed users',
  SHORT_Q: 'digest brings users back?',
  DUE: '2030-06-04',
  CTX: 'work',
};

// A journal prepared by the First-run check.
function journal() {
  const home = freshJournal();
  const setup = runScript(recipe('First-run check'), { home });
  assert.equal(setup.code, 0, setup.stderr);
  return home;
}

function newEntry(home, vars = NEW_VARS) {
  const r = runScript(recipe('New entry'), { home, vars });
  assert.equal(r.code, 0, r.stderr);
  return Object.fromEntries([...r.stdout.matchAll(/^(\w+)=(\S+)$/gm)].map((m) => [m[1], m[2]]));
}

const inbox = (home, date = DIGEST_DATE) => runScript(recipe('Inbox'), { home, vars: { DIGEST_DATE: date } });

// The lines of the `## <name>` section of the output (up to the next heading).
function section(stdout, name) {
  const lines = stdout.split('\n');
  const start = lines.indexOf(`## ${name}`);
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('#'));
  return lines.slice(start + 1, end === -1 ? undefined : end).filter((l) => l.trim());
}

test('inbox: lists a Check signal task due in 3 days under Week ahead', () => {
  const home = journal();
  const ids = newEntry(home);
  const r = inbox(home);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(section(r.stdout, 'Week ahead'), [
    `- [ ] Check signal: digest brings users back? #slice #signal-due #work ← ^${ids.question} ^${ids.check}`,
  ]);
});

test('inbox: excludes non-slice tasks', () => {
  const home = journal();
  newEntry(home);
  bujoJson(home, 'add', 'Buy milk', '--date', '2030-06-03');
  bujoJson(home, 'add', 'Renew passport', '--date', '2030-05-20');
  const r = inbox(home);
  assert.equal(r.code, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /Buy milk/);
  assert.doesNotMatch(r.stdout, /Renew passport/);
  assert.match(r.stdout, /Check signal: digest brings users back\?/);
});

test('inbox: lists an overdue Decide task under Overdue', () => {
  const home = journal();
  const entry = newEntry(home);
  const sig = runScript(recipe('Record signal'), {
    home,
    vars: { ENTRY_ID: entry.question, SIGNAL: '4 of 20 lapsed users came back', SHORT_Q: 'digest brings users back?' },
  });
  assert.equal(sig.code, 0, sig.stderr);
  const decideId = sig.stdout.match(/^decide=(\S+)$/m)[1];
  // The Decide task is dated today (BUJO_TZ); run the digest the day after.
  const [y, m, d] = bujoJson(home, 'read', decideId).path.split('/');
  const tomorrow = new Date(Date.UTC(+y, m - 1, +d + 1)).toISOString().slice(0, 10);
  const r = inbox(home, tomorrow);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(section(r.stdout, 'Overdue'), [
    `- [ ] Decide: digest brings users back? #slice #decide #work ← ^${entry.question} ^${decideId}`,
  ]);
});

test('inbox: nothing due prints nothing and exits 0', () => {
  const home = journal();
  bujoJson(home, 'add', 'Buy milk', '--date', '2030-06-03');
  const r = inbox(home);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '');
});
