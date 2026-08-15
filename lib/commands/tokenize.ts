// A small hand-written, quote-aware tokenizer for the command bar
// (PLAN.md §6). Deliberately not a CLI-parser library — just enough to split
// a line into argv-style tokens while keeping double-quoted strings intact.

export class TokenizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenizeError';
  }
}

/**
 * Splits a command line into tokens. Whitespace separates tokens; a
 * double-quoted span (`"two words"`) is kept as a single token with the
 * quotes stripped, and `\"` inside a quoted span is an escaped literal quote.
 *
 * `commit -m "two words"` → ['commit', '-m', 'two words']
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasToken = false; // true once current has content, even if empty-string quoted ("")

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '\\' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      hasToken = true;
      continue;
    }

    if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }

    current += ch;
    hasToken = true;
  }

  if (inQuotes) {
    throw new TokenizeError('unterminated quoted string');
  }
  if (hasToken) {
    tokens.push(current);
  }

  return tokens;
}
