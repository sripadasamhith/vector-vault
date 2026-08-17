#!/usr/bin/env node
/**
 * Static guard against unqualified DELETE/UPDATE in migrations.
 *
 * WHY: Supabase loads the pg-safeupdate extension for the API roles, so a
 * statement like `delete from _cc_new_files;` raises
 *   21000 "DELETE requires a WHERE clause"
 * at runtime for any `authenticated` caller. Stock Postgres does NOT have
 * that extension, so `npm run verify:sql` (Docker) passes happily while the
 * live database fails — which is exactly how this shipped once: every real
 * commit returned 400 and wrote nothing, while 21/21 local assertions passed.
 *
 * Use `truncate` for temp tables, or add a WHERE clause.
 * Run: npm run lint:sql (also runs as the first step of verify:sql)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

/** Strip -- line comments and block comments, preserving statement structure. */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

const problems = [];

// Scan for the statement KEYWORD anywhere, then look ahead to the next ';'
// for a WHERE. Splitting the file on ';' and anchoring with ^ does not work:
// inside a plpgsql body the first statement after `as $$ begin` lands in the
// same chunk as the `create function` header, so `^delete` never matches —
// which is precisely the case that shipped broken.
const RULES = [
  { kind: 'DELETE', re: /\bdelete\s+from\s+[\w."]+/gi },
  // `update <ident> set` only — never matches `for update` / `on update`.
  { kind: 'UPDATE', re: /\bupdate\s+[\w."]+\s+set\b/gi },
];

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
  const clean = stripComments(readFileSync(join(DIR, file), 'utf8'));

  for (const { kind, re } of RULES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(clean)) !== null) {
      const end = clean.indexOf(';', m.index);
      const span = clean.slice(m.index, end === -1 ? clean.length : end);
      if (/\bwhere\b/i.test(span)) continue;

      const line = clean.slice(0, m.index).split('\n').length;
      const stmt = span.trim().replace(/\s+/g, ' ');
      problems.push({
        file,
        line,
        kind,
        stmt: stmt.length > 90 ? `${stmt.slice(0, 90)}…` : stmt,
      });
    }
  }
}

problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (problems.length) {
  console.error('✗ Unqualified DELETE/UPDATE found in migrations.\n');
  console.error('  Supabase runs pg-safeupdate for API roles: these raise');
  console.error('  21000 "DELETE requires a WHERE clause" at runtime, even though');
  console.error('  a plain Postgres container accepts them.\n');
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ${p.kind} without WHERE`);
    console.error(`    ${p.stmt}\n`);
  }
  console.error('  Fix: use `truncate` for temp tables, or add a WHERE clause.');
  process.exit(1);
}

console.log('✓ No unqualified DELETE/UPDATE in migrations');
