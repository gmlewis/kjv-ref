import { describe, it, expect } from 'vitest';
import { parseBibleQuery, wildcardToRegex, matchWord, verseWords, hasWildcardChars } from './bibleQueryParser';

describe('wildcardToRegex', () => {
  it('converts * to .*', () => {
    const re = wildcardToRegex('lov*');
    expect(re.test('love')).toBe(true);
    expect(re.test('loved')).toBe(true);
    expect(re.test('loving')).toBe(true);
    expect(re.test('lov')).toBe(true);
    expect(re.test('lovedx')).toBe(true);
  });

  it('converts ? to . (single char)', () => {
    const re = wildcardToRegex('l?ve');
    expect(re.test('love')).toBe(true);
    expect(re.test('live')).toBe(true);
    expect(re.test('luve')).toBe(true);
    expect(re.test('lve')).toBe(false);
    expect(re.test('loove')).toBe(false);
  });

  it('preserves character classes', () => {
    const re = wildcardToRegex('l[ai]ve');
    expect(re.test('live')).toBe(true);
    expect(re.test('lave')).toBe(true);
    expect(re.test('love')).toBe(false);
  });

  it('handles character ranges', () => {
    const re = wildcardToRegex('l[a-e]ve');
    expect(re.test('lave')).toBe(true);
    expect(re.test('leve')).toBe(true);
    expect(re.test('lfve')).toBe(false);
  });

  it('escapes regex metacharacters in literal text', () => {
    const re = wildcardToRegex('a.b+c');
    expect(re.test('a.b+c')).toBe(true);
    expect(re.test('axbyc')).toBe(false);
  });

  it('is case-insensitive', () => {
    const re = wildcardToRegex('LOVE');
    expect(re.test('love')).toBe(true);
    expect(re.test('Love')).toBe(true);
    expect(re.test('LOVE')).toBe(true);
  });

  it('combines * and ?', () => {
    const re = wildcardToRegex('l?ve*');
    expect(re.test('loved')).toBe(true);
    expect(re.test('lives')).toBe(true);
    expect(re.test('lo')).toBe(false);
  });
});

describe('hasWildcardChars', () => {
  it('detects *', () => { expect(hasWildcardChars('lov*')).toBe(true); });
  it('detects ?', () => { expect(hasWildcardChars('l?ve')).toBe(true); });
  it('detects [', () => { expect(hasWildcardChars('l[ai]ve')).toBe(true); });
  it('detects ]', () => { expect(hasWildcardChars('l[a]ve')).toBe(true); });
  it('returns false for plain words', () => { expect(hasWildcardChars('love')).toBe(false); });
});

describe('matchWord', () => {
  it('matches plain word exactly (case-insensitive)', () => {
    expect(matchWord('LOVE', { type: 'word', value: 'love' })).toBe(true);
    expect(matchWord('Love', { type: 'word', value: 'love' })).toBe(true);
    expect(matchWord('love', { type: 'word', value: 'love' })).toBe(true);
    // NOT a substring match — must be the whole word
    expect(matchWord('loved', { type: 'word', value: 'love' })).toBe(false);
    expect(matchWord('glove', { type: 'word', value: 'love' })).toBe(false);
    expect(matchWord('hate', { type: 'word', value: 'love' })).toBe(false);
  });

  it('matches wildcard nodes', () => {
    const node = { type: 'wildcard' as const, regex: wildcardToRegex('lov*'), pattern: 'lov*' };
    expect(matchWord('love', node)).toBe(true);
    expect(matchWord('loved', node)).toBe(true);
    expect(matchWord('hate', node)).toBe(false);
  });

  it('anyWord matches anything', () => {
    expect(matchWord('anything', { type: 'anyWord' })).toBe(true);
    expect(matchWord('', { type: 'anyWord' })).toBe(true);
  });
});

describe('verseWords', () => {
  it('splits verse text into lowercase words', () => {
    const words = verseWords('In the beginning God created');
    expect(words).toEqual(['in', 'the', 'beginning', 'god', 'created']);
  });

  it('handles punctuation', () => {
    const words = verseWords('The LORD is my shepherd; I shall not want.');
    expect(words).toEqual(['the', 'lord', 'is', 'my', 'shepherd', 'i', 'shall', 'not', 'want']);
  });

  it('handles empty string', () => {
    expect(verseWords('')).toEqual([]);
  });
});

describe('parseBibleQuery', () => {
  // ─── Single word ──────────────────────────────────────────────────────

  it('parses a single word', () => {
    const q = parseBibleQuery('love');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
    expect(q.exclude).toHaveLength(0);
  });

  it('lowercases word values', () => {
    const q = parseBibleQuery('LOVE');
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
  });

  it('strips surrounding punctuation from words', () => {
    const q = parseBibleQuery("'love'");
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
  });

  // ─── Multiple words (AND) ─────────────────────────────────────────────

  it('parses multiple words as AND', () => {
    const q = parseBibleQuery('love god');
    expect(q.include).toHaveLength(2);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
    expect(q.include[1]).toEqual({ type: 'word', value: 'god' });
  });

  // ─── Quoted phrases ───────────────────────────────────────────────────

  it('parses a quoted phrase', () => {
    const q = parseBibleQuery('"the love of God"');
    expect(q.include).toHaveLength(1);
    expect(q.include[0].type).toBe('phrase');
    if (q.include[0].type === 'phrase') {
      expect(q.include[0].words).toHaveLength(4);
      expect(q.include[0].words[0]).toEqual({ type: 'word', value: 'the' });
      expect(q.include[0].words[1]).toEqual({ type: 'word', value: 'love' });
      expect(q.include[0].words[2]).toEqual({ type: 'word', value: 'of' });
      expect(q.include[0].words[3]).toEqual({ type: 'word', value: 'god' });
    }
  });

  it('single-word quoted phrase becomes a plain word node', () => {
    const q = parseBibleQuery('"love"');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
  });

  // ─── OR operator (|) ──────────────────────────────────────────────────

  it('parses OR with |', () => {
    const q = parseBibleQuery('love|charity');
    expect(q.include).toHaveLength(1);
    expect(q.include[0].type).toBe('or');
    if (q.include[0].type === 'or') {
      expect(q.include[0].alternatives).toHaveLength(2);
      expect(q.include[0].alternatives[0]).toEqual({ type: 'word', value: 'love' });
      expect(q.include[0].alternatives[1]).toEqual({ type: 'word', value: 'charity' });
    }
  });

  it('parses three-way OR', () => {
    const q = parseBibleQuery('love|charity|hope');
    expect(q.include[0].type).toBe('or');
    if (q.include[0].type === 'or') {
      expect(q.include[0].alternatives).toHaveLength(3);
    }
  });

  it('parses OR with phrases: "the Lord"|God', () => {
    const q = parseBibleQuery('"the Lord"|God');
    expect(q.include).toHaveLength(1);
    expect(q.include[0].type).toBe('or');
    if (q.include[0].type === 'or') {
      expect(q.include[0].alternatives).toHaveLength(2);
      expect(q.include[0].alternatives[0].type).toBe('phrase');
      expect(q.include[0].alternatives[1]).toEqual({ type: 'word', value: 'god' });
    }
  });

  // ─── Wildcards ────────────────────────────────────────────────────────

  it('parses trailing wildcard lov*', () => {
    const q = parseBibleQuery('lov*');
    expect(q.include).toHaveLength(1);
    expect(q.include[0].type).toBe('wildcard');
    if (q.include[0].type === 'wildcard') {
      expect(q.include[0].pattern).toBe('lov*');
      expect(q.include[0].regex.test('love')).toBe(true);
      expect(q.include[0].regex.test('loved')).toBe(true);
    }
  });

  it('parses single-char wildcard l?ve', () => {
    const q = parseBibleQuery('l?ve');
    expect(q.include[0].type).toBe('wildcard');
    if (q.include[0].type === 'wildcard') {
      expect(q.include[0].regex.test('love')).toBe(true);
      expect(q.include[0].regex.test('live')).toBe(true);
    }
  });

  it('parses character class wildcard l[ai]ve', () => {
    const q = parseBibleQuery('l[ai]ve');
    expect(q.include[0].type).toBe('wildcard');
    if (q.include[0].type === 'wildcard') {
      expect(q.include[0].regex.test('live')).toBe(true);
      expect(q.include[0].regex.test('lave')).toBe(true);
      expect(q.include[0].regex.test('love')).toBe(false);
    }
  });

  // ─── Any-word placeholder (*) ─────────────────────────────────────────

  it('parses * as anyWord in a phrase', () => {
    const q = parseBibleQuery('"the * of God"');
    expect(q.include[0].type).toBe('phrase');
    if (q.include[0].type === 'phrase') {
      expect(q.include[0].words).toHaveLength(4);
      expect(q.include[0].words[1]).toEqual({ type: 'anyWord' });
    }
  });

  it('parses standalone * between words', () => {
    const q = parseBibleQuery('the * of God');
    // Should produce: word(the), anyWord, word(of), word(god)
    // But standalone * as a separate term is meaningless for AND — it always matches.
    // The parser should still produce it as an include term.
    expect(q.include.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Exclude (-) ──────────────────────────────────────────────────────

  it('parses -word as exclude', () => {
    const q = parseBibleQuery('love -Satan');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
    expect(q.exclude).toHaveLength(1);
    expect(q.exclude[0]).toEqual({ type: 'word', value: 'satan' });
  });

  it('parses -"phrase" as exclude phrase', () => {
    const q = parseBibleQuery('love -"the devil"');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
    expect(q.exclude).toHaveLength(1);
    expect(q.exclude[0].type).toBe('phrase');
  });

  it('parses exclude without include', () => {
    const q = parseBibleQuery('-Satan');
    expect(q.include).toHaveLength(0);
    expect(q.exclude).toHaveLength(1);
  });

  // ─── Combined expressions ─────────────────────────────────────────────

  it('parses phrase + exclude + OR', () => {
    const q = parseBibleQuery('"the love of God" -hate love|charity');
    expect(q.include).toHaveLength(2);
    expect(q.include[0].type).toBe('phrase');
    expect(q.include[1].type).toBe('or');
    expect(q.exclude).toHaveLength(1);
    expect(q.exclude[0]).toEqual({ type: 'word', value: 'hate' });
  });

  it('parses wildcard + phrase', () => {
    const q = parseBibleQuery('lov* "of God"');
    expect(q.include).toHaveLength(2);
    expect(q.include[0].type).toBe('wildcard');
    expect(q.include[1].type).toBe('phrase');
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it('handles empty query', () => {
    const q = parseBibleQuery('');
    expect(q.include).toHaveLength(0);
    expect(q.exclude).toHaveLength(0);
  });

  it('handles whitespace-only query', () => {
    const q = parseBibleQuery('   ');
    expect(q.include).toHaveLength(0);
    expect(q.exclude).toHaveLength(0);
  });

  it('handles leading pipe', () => {
    const q = parseBibleQuery('|love');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
  });

  it('handles trailing pipe', () => {
    const q = parseBibleQuery('love|');
    expect(q.include).toHaveLength(1);
    expect(q.include[0]).toEqual({ type: 'word', value: 'love' });
  });

  it('handles multiple spaces between words', () => {
    const q = parseBibleQuery('love    god');
    expect(q.include).toHaveLength(2);
  });
});