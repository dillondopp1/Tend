// Loads content/weeks/<N>.json into the linked cloud project as approved weeks.
// New weeks are inserted; an existing week is only replaced while it is still a
// "[DEV PLACEHOLDER]" row, so edits made in the database are never overwritten.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = 'content/weeks';
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && (!only.length || only.includes(f.replace('.json', ''))));
const q = (v) => `$tend$${v}$tend$`;

const stmts = files.map((f) => {
  const w = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const content = { keyPhraseRef: w.keyPhraseRef, theme: w.theme, sparks: w.sparks, gameSparks: w.gameSparks, phraseMeaning: w.phraseMeaning };
  for (const s of w.sparks) {
    if (s.cards.map((c) => c.type).join() !== 'hook,verse,meaning,try') throw new Error(`${f} day ${s.day}: cards must be hook,verse,meaning,try`);
  }
  return `insert into public.weeks (id, start_date, end_date, title, scripture_block, manual_url, key_phrase, content, status, approved_at)
values (${w.id}, '${w.startDate}', '${w.endDate}', ${q(w.title)}, ${q(w.scriptureBlock)}, ${q(w.manualUrl)}, ${q(w.keyPhrase)}, ${q(JSON.stringify(content))}::jsonb, 'approved', now())
on conflict (id) do update set start_date = excluded.start_date, end_date = excluded.end_date, title = excluded.title,
  scripture_block = excluded.scripture_block, manual_url = excluded.manual_url, key_phrase = excluded.key_phrase,
  content = excluded.content, status = 'approved', approved_at = now()
where public.weeks.title like '[DEV PLACEHOLDER]%';`;
});

const path = join(mkdtempSync(join(tmpdir(), 'tend-content-')), 'load.sql');
writeFileSync(path, stmts.join('\n') + `\nselect id, title, status, jsonb_array_length(content->'sparks') as sparks from public.weeks order by id;\n`);
const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', path], { encoding: 'utf8', shell: true });
console.log(out);
