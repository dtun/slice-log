import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { bujoJson, freshJournal, recipe, runScript, PATH_WITHOUT_BUJO } from './helpers.mjs';

test('first-run check: bujo missing prints the install line and fails', () => {
  const r = runScript(recipe('First-run check'), { path: PATH_WITHOUT_BUJO });
  assert.notEqual(r.code, 0);
  assert.match(r.stdout, /^npm install -g github:paperstreetapp\/bujo-cli#v0\.2\.0$/m);
});

test('first-run check: missing journal is initialized with a patterns collection', () => {
  const home = freshJournal();
  assert.equal(existsSync(home), false);

  const r = runScript(recipe('First-run check'), { home });
  assert.equal(r.code, 0, r.stderr);

  const tree = bujoJson(home, 'tree');
  assert.ok(tree.files.includes('index.md'));
  const slugs = bujoJson(home, 'collection', 'list').active.map((c) => c.slug);
  assert.deepEqual(slugs, ['patterns']);
});

test('first-run check: running twice is idempotent and quiet once set up', () => {
  const home = freshJournal();
  assert.equal(runScript(recipe('First-run check'), { home }).code, 0);

  const r = runScript(recipe('First-run check'), { home });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '');

  const slugs = bujoJson(home, 'collection', 'list').active.map((c) => c.slug);
  assert.deepEqual(slugs, ['patterns']);
});
