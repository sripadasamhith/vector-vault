import { describe, expect, it } from 'vitest';
import { tokenize, TokenizeError } from '../tokenize';

describe('tokenize', () => {
  it('splits plain whitespace-separated tokens', () => {
    expect(tokenize('log -n 5')).toEqual(['log', '-n', '5']);
  });

  it('commit -m "two words" -> 3 tokens', () => {
    expect(tokenize('commit -m "two words"')).toEqual(['commit', '-m', 'two words']);
  });

  it('commit -m "a b" --amend -> 4 tokens (BUILD.md T1.7 verify case)', () => {
    expect(tokenize('commit -m "a b" --amend')).toEqual(['commit', '-m', 'a b', '--amend']);
  });

  it('collapses repeated whitespace', () => {
    expect(tokenize('status    ')).toEqual(['status']);
    expect(tokenize('  ls   .')).toEqual(['ls', '.']);
  });

  it('returns an empty array for a blank line', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('handles an escaped quote inside a quoted string', () => {
    expect(tokenize('commit -m "say \\"hi\\""')).toEqual(['commit', '-m', 'say "hi"']);
  });

  it('preserves an empty quoted token', () => {
    expect(tokenize('tag ""')).toEqual(['tag', '']);
  });

  it('allows a quoted span to abut unquoted text in the same token', () => {
    expect(tokenize('share --note "hi"there')).toEqual(['share', '--note', 'hithere']);
  });

  it('throws TokenizeError on an unterminated quote', () => {
    expect(() => tokenize('commit -m "unterminated')).toThrow(TokenizeError);
  });
});
