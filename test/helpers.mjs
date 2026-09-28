import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_MD = join(ROOT, 'skills/slice/SKILL.md');
const BIN = join(ROOT, 'node_modules/.bin');

// Minimal PATH with bash, node and coreutils but no bujo.
const BASE_PATH = [dirname(process.execPath), '/usr/bin', '/bin'].join(':');
export const PATH_WITHOUT_BUJO = BASE_PATH;
export const PATH_WITH_BUJO = `${BIN}:${BASE_PATH}`;

for (const dir of BASE_PATH.split(':')) {
  if (existsSync(join(dir, 'bujo'))) {
    throw new Error(`bujo found in ${dir}; PATH_WITHOUT_BUJO would not be bujo-free`);
  }
}

// Extract the first ```bash block under the `### <heading>` heading.
export function recipe(heading, file = SKILL_MD) {
  const md = readFileSync(file, 'utf8');
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === `### ${heading}`);
  if (start === -1) throw new Error(`heading "### ${heading}" not found in ${file}`);
  let i = start + 1;
  while (i < lines.length && !/^#{1,3} /.test(lines[i]) && lines[i].trim() !== '```bash') i++;
  if (lines[i]?.trim() !== '```bash') throw new Error(`no bash block under "### ${heading}"`);
  const body = [];
  for (i++; i < lines.length && lines[i].trim() !== '```'; i++) body.push(lines[i]);
  return body.join('\n');
}

// A fresh journal path that does not exist yet (simulates a missing journal).
export function freshJournal() {
  return join(mkdtempSync(join(tmpdir(), 'slice-test-')), 'journal');
}

function shQuote(v) {
  return `'${String(v).replaceAll("'", `'\\''`)}'`;
}

// Run a script with `bash -c`, with variable assignments prepended — the way
// Claude runs a recipe. No shell options are added: a recipe must fail fast on
// its own (`set -euo pipefail` in the block).
export function runScript(script, { vars = {}, home, path = PATH_WITH_BUJO } = {}) {
  const assigns = Object.entries(vars).map(([k, v]) => `${k}=${shQuote(v)}`).join('\n');
  const full = `${assigns}\n${script}\n`;
  const r = spawnSync('/bin/bash', ['-c', full], {
    encoding: 'utf8',
    env: { PATH: path, BUJO_HOME: home ?? freshJournal(), BUJO_TZ: 'UTC', HOME: tmpdir() },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Run `bujo <args> --json` against the journal and return the parsed `data`.
export function bujoJson(home, ...args) {
  const r = spawnSync(join(BIN, 'bujo'), [...args, '--json'], {
    encoding: 'utf8',
    env: { PATH: PATH_WITH_BUJO, BUJO_HOME: home, BUJO_TZ: 'UTC', HOME: tmpdir() },
  });
  if (r.status !== 0) throw new Error(`bujo ${args.join(' ')} failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout).data;
}

export const HOOK = join(ROOT, 'hooks/slice-inbox.sh');

// Run an executable directly (no shell wrapper) with a controlled environment.
export function runExecutable(file, { env = {}, home, path = PATH_WITH_BUJO } = {}) {
  const r = spawnSync(file, [], {
    encoding: 'utf8',
    env: { PATH: path, BUJO_HOME: home ?? freshJournal(), BUJO_TZ: 'UTC', HOME: tmpdir(), ...env },
  });
  if (r.error) throw r.error;
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
