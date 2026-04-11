import { describe, it, expect } from 'vitest';
import { parseTAHOTLine, parseTAGNTLine } from './build-interlinear-words';

// ─── TAHOT (Hebrew OT) ────────────────────────────────────────────────────────

describe('parseTAHOTLine', () => {
  // Build a minimal valid TAHOT line with the standard 17-column format.
  // Columns: ref, word, translit, gloss, strongs+braces, parsing, _, _, sStrong, ...
  function makeLine(ref: string, word = 'שָׁלוֹם', strongs = 'H7965') {
    return [ref, word, 'sha.Lom', 'peace', `{${strongs}}`, 'HNcmsa', '', '', strongs, '', '', `{${strongs}=שָׁלוֹם=peace}`].join('\t');
  }

  // ─── Normal (no parenthetical) ────────────────────────────────────────────

  it('parses a standard reference with no parenthetical', () => {
    const result = parseTAHOTLine(makeLine('Gen.1.1#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Ge.1.1');
    expect(result!.abbr).toBe('Ge');
    expect(result!.entry[0]).toBe('שָׁלוֹם');
    expect(result!.entry[1]).toBe('H7965');
  });

  // ─── Parenthetical verse-offset format (the regression bug) ──────────────
  // STEPBible uses "Psa.3.1(3.2)#" where the primary number is KJV-aligned
  // and the parenthetical is the Hebrew Masoretic number.
  // The old regex /\.(\d+)#/ missed lines with "(N.N)" between digits and "#".

  it('parses a Psalm reference with parenthetical Hebrew verse offset', () => {
    const result = parseTAHOTLine(makeLine('Psa.3.1(3.2)#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Psa.3.1');  // uses primary (KJV) number, not parenthetical
  });

  it('parses a Psalm superscription (verse 0) with parenthetical', () => {
    const result = parseTAHOTLine(makeLine('Psa.3.0(3.1)#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Psa.3.0');
  });

  it('parses a two-verse superscription entry (Psalm 51)', () => {
    const result = parseTAHOTLine(makeLine('Psa.51.1(51.3)#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Psa.51.1');
  });

  it('parses a chapter-boundary offset (Gen 31:55 = Hebrew 32:1)', () => {
    const result = parseTAHOTLine(makeLine('Gen.31.55(32.1)#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Ge.31.55');
  });

  it('parses references with large parenthetical chapter numbers', () => {
    const result = parseTAHOTLine(makeLine('Psa.119.1(119.2)#01=L'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Psa.119.1');
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  it('returns null for unknown book abbreviation', () => {
    expect(parseTAHOTLine(makeLine('Xyz.1.1#01=L'))).toBeNull();
  });

  it('returns null for a line with too few columns', () => {
    expect(parseTAHOTLine('Psa.3.1(3.2)#01=L\tword')).toBeNull();
  });

  it('returns null for a blank line', () => {
    expect(parseTAHOTLine('')).toBeNull();
  });

  it('returns null for a comment line', () => {
    expect(parseTAHOTLine('# This is a comment')).toBeNull();
  });

  // ─── Strong's number handling ─────────────────────────────────────────────

  it('filters out H9xxx pseudo-Strong\'s numbers and falls back to col[4]', () => {
    // col[8] is H9003 (pseudo), col[4] has {H7225} — should use H7225
    const cols = ['Gen.1.1#01=L', 'בְּרֵאשִׁית', 'be.re.Shit', 'in beginning', 'H9003/{H7225G}', 'HR/Ncfsa', '', '', 'H9003', '', '', '{H7225=בְּרֵאשִׁית=beginning}'];
    const result = parseTAHOTLine(cols.join('\t'));
    expect(result).not.toBeNull();
    expect(result!.entry[1]).toBe('H7225');
  });

  it('uses col[8] Strong\'s number directly when valid', () => {
    const result = parseTAHOTLine(makeLine('Gen.1.1#01=L', 'אֱלֹהִים', 'H430'));
    expect(result!.entry[1]).toBe('H430');
  });
});

// ─── TAGNT (Greek NT) ────────────────────────────────────────────────────────

describe('parseTAGNTLine', () => {
  function makeNTLine(ref: string, wordTranslit = 'Βίβλος (Biblos)', gloss = 'book', strongsParsing = 'G0976=N-NSF') {
    return [ref, wordTranslit, gloss, strongsParsing].join('\t');
  }

  it('parses a standard NT reference', () => {
    const result = parseTAGNTLine(makeNTLine('Mat.1.1#01=NKO'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Mat.1.1');
    expect(result!.abbr).toBe('Mat');
    expect(result!.entry[0]).toBe('Βίβλος');
    expect(result!.entry[2]).toBe('Biblos');
    expect(result!.entry[1]).toBe('G976');
  });

  it('splits word and transliteration from "word (translit)" format', () => {
    const result = parseTAGNTLine(makeNTLine('Jhn.3.16#01=NKO', 'οὕτως (houtōs)', 'thus', 'G3779=ADV'));
    expect(result!.entry[0]).toBe('οὕτως');
    expect(result!.entry[2]).toBe('houtōs');
  });

  it('handles word with no transliteration parentheses', () => {
    const result = parseTAGNTLine(makeNTLine('Rev.1.1#01=NKO', 'Ἀποκάλυψις', 'revelation', 'G0602=N-NSF'));
    expect(result!.entry[0]).toBe('Ἀποκάλυψις');
    expect(result!.entry[2]).toBe('');
  });

  it('normalises Strong\'s number by stripping leading zeros', () => {
    const result = parseTAGNTLine(makeNTLine('Mat.1.1#01=NKO', 'Βίβλος (Biblos)', 'book', 'G0976=N-NSF'));
    expect(result!.entry[1]).toBe('G976');
  });

  it('returns null for unknown book abbreviation', () => {
    expect(parseTAGNTLine(makeNTLine('Xyz.1.1#01=NKO'))).toBeNull();
  });

  it('returns null for a line with too few columns', () => {
    expect(parseTAGNTLine('Mat.1.1#01=NKO\tword')).toBeNull();
  });
});
