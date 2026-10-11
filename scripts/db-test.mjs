// Runs supabase/tests/database/*.test.sql against the linked project without Docker.
// Each file runs in one transaction that rolls back. This pgTAP version doesn't keep
// results, so every top-level assertion is rewritten to also store its TAP line in a
// temp table that we read just before the rollback.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = process.env.TEND_DBTEST_DIR ?? 'supabase/tests/database';
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => f.endsWith('.test.sql') && (!only || f.includes(only))).sort();
const tmp = mkdtempSync(join(tmpdir(), 'tend-dbtest-'));
let failed = 0;
let passed = 0;

for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8');
  if (!sql.includes('select * from finish();')) throw new Error(`${f}: missing "select * from finish();"`);
  // These run against the cloud project: a file must never be able to keep its changes.
  if (!/^\s*begin;/.test(sql) || !/rollback;\s*$/.test(sql) || /^\s*(commit|end)\s*;/im.test(sql)) {
    throw new Error(`${f}: must start with "begin;", end with "rollback;" and never commit`);
  }
  const wrapped = sql
    .replace('select no_plan();',
      'select no_plan();\ncreate temp table _tap (n int generated always as identity, line text);\ngrant all on _tap to public;')
    .replace(/^select ((?:is|isnt|ok|throws_ok|lives_ok|matches)\()/gm, 'insert into _tap (line) select $1')
    .replace('select * from finish();', 'select n, line from _tap order by n;');
  const path = join(tmp, f);
  writeFileSync(path, wrapped);
  let out;
  try {
    out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--output-format', 'json', '-f', `"${path}"`],
      { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: the file errored before finishing\n${(e.stdout ?? '') + (e.stderr ?? '')}`);
    continue;
  }
  const json = JSON.parse(out.slice(out.indexOf('{')));
  const rows = json.rows ?? [];
  const bad = rows.filter((r) => r.line.startsWith('not ok'));
  passed += rows.length - bad.length;
  failed += bad.length;
  for (const r of bad) console.log(`${f}: ${r.line}`);
  console.log(`${f}: ${rows.length - bad.length}/${rows.length} ok`);
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
