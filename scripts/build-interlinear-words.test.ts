import { describe, it, expect, vi } from 'vitest';
import {
  parseTAHOTLine,
  parseTAGNTLine,
  stripEpistleColophons,
  EPISTLE_COLOPHON_VERSES,
  type BookWordMap,
} from './build-interlinear-words';

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

  // ─── Versification markers ────────────────────────────────────────────────
  // STEPBible's primary numbers are the English (NRSV) versification. A
  // "[K.J]" marker carries the KJV numbering, which is what the app displays.
  // The old regex /\.(\d+)#/ failed to match any of these, silently dropping
  // every word of the verse.

  it('keys a "[K.J]" marker to the KJV verse number', () => {
    // Mat.20.5[20.4] holds the tail of KJV Matthew 20:4 — "and they went their way".
    const result = parseTAGNTLine(makeNTLine('Mat.20.5[20.4]#01=NKO', 'οἱ (hoi)', 'the'));
    expect(result).not.toBeNull();
    expect(result!.verseKey).toBe('Mat.20.4');
  });

  it('keys a chapter-boundary "[K.J]" marker to the KJV verse number', () => {
    // 2Co.13.13[13.14] is KJV 2 Corinthians 13:14 (the chapter is one shorter).
    expect(parseTAGNTLine(makeNTLine('2Co.13.13[13.14]#01=NKO'))!.verseKey).toBe('2Cor.13.14');
  });

  it('ignores a "{K.J}" marker and keeps the primary verse number', () => {
    // Braces name the Byzantine/"others" numbering, not the KJV.
    expect(parseTAGNTLine(makeNTLine('Rom.16.27{14.26}#01=NKO'))!.verseKey).toBe('Rom.16.27');
    expect(parseTAGNTLine(makeNTLine('1Ti.6.21{6.22}#01=NKO'))!.verseKey).toBe('1Tim.6.21');
  });

  it('ignores a "(K.J)" marker and keeps the primary verse number', () => {
    // Parentheses name the Nestle-Aland numbering.
    expect(parseTAGNTLine(makeNTLine('Mrk.12.15(12.14)#01=NKO'))!.verseKey).toBe('Mark.12.15');
  });

  // ─── Editorial marks ──────────────────────────────────────────────────────
  // ¶, ¬ and the [[…]] disputed-passage brackets are markup, not text. Left in
  // they render literally, e.g. "[[ὤφθη" at Luke 22:43.

  it('strips a pilcrow from the word and gloss', () => {
    const result = parseTAGNTLine(makeNTLine('Mat.1.11#01=NKO', 'Βαβυλῶνος.¶ (Babylōnos)', 'to Babylon.¶'));
    expect(result!.entry[0]).toBe('Βαβυλῶνος.');
    expect(result!.entry[3]).toBe('to Babylon.');
  });

  it('strips disputed-passage brackets but keeps the words inside them', () => {
    // The KJV prints Mark 16:9-20, so the words must survive.
    const opening = parseTAGNTLine(makeNTLine('Mrk.16.9#01=NKO', '[[Ἀναστὰς (Anastas)', 'Having risen'));
    expect(opening!.entry[0]).toBe('Ἀναστὰς');
    const closing = parseTAGNTLine(makeNTLine('Mrk.16.8#01=NKO', 'ἀμήν.¶]] (amēn)', 'Amen.'));
    expect(closing!.entry[0]).toBe('ἀμήν.');
  });

  it('strips a line-break marker', () => {
    const result = parseTAGNTLine(makeNTLine('Mat.11.17#01=NKO', 'ὠρχήσασθε,¶¬ (ōrchēsasthe)', 'danced'));
    expect(result!.entry[0]).toBe('ὠρχήσασθε,');
  });
});

// ─── TR epistle colophons (hypographai) ──────────────────────────────────────

describe('stripEpistleColophons', () => {
  const TR = 'NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz';
  const word = (w: string) => [w, 'G0001', 'x', 'gloss', 'N-NSM'] as [string, string, string, string, string];

  /** Build the maps stripEpistleColophons expects for a single verse. */
  function build(verseKey: string, words: [string, string][]) {
    const abbr = verseKey.slice(0, verseKey.indexOf('.'));
    const allBooks = new Map<string, BookWordMap>([[abbr, { [verseKey]: words.map(([w]) => word(w)) }]]);
    const editions = new Map<string, string[]>([[verseKey, words.map(([, e]) => e)]]);
    return { allBooks, editions };
  }

  it('covers the fourteen epistles that carry a subscription', () => {
    expect([...EPISTLE_COLOPHON_VERSES].sort()).toEqual(
      [
        '1Cor.16.24', '1Th.5.28', '1Tim.6.21', '2Cor.13.14', '2Th.3.18', '2Tim.4.22',
        'Col.4.18', 'Eph.6.24', 'Gal.6.18', 'Heb.13.25', 'Phmn.1.25', 'Phi.4.23',
        'Rom.16.27', 'Titus.3.15',
      ].sort()
    );
  });

  it('cuts the colophon and keeps the closing "ἀμήν"', () => {
    // 1Cor.16.24: "… ἐν Χριστῷ Ἰησοῦ. ἀμήν [πρὸς Κορινθίους πρώτη ἐγράφη …]"
    const { allBooks, editions } = build('1Cor.16.24', [
      ['ἡ', TR], ['ἀγάπη', TR], ['ἀμήν', TR],
      ['πρός', 'TR'], ['Κορινθίους', 'TR'], ['πρώτη', 'TR'], ['ἐγράφη', 'TR'],
    ]);
    expect(stripEpistleColophons(allBooks, editions)).toBe(4);
    expect(allBooks.get('1Cor')!['1Cor.16.24'].map(e => e[0])).toEqual(['ἡ', 'ἀγάπη', 'ἀμήν']);
  });

  it('keeps a TR-only "ἀμήν" that precedes the colophon (Eph.6.24)', () => {
    // The KJV prints "… in sincerity. Amen." — STEPBible tags that Amen TR-only,
    // so it sits inside the TR-only tail and must survive.
    const { allBooks, editions } = build('Eph.6.24', [
      ['ἀφθαρσίᾳ', TR], ['ἀμήν', 'TR'],
      ['πρός', 'TR'], ['Εφέσιους', 'TR'], ['ἐγράφη', 'TR'],
    ]);
    expect(stripEpistleColophons(allBooks, editions)).toBe(3);
    expect(allBooks.get('Eph')!['Eph.6.24'].map(e => e[0])).toEqual(['ἀφθαρσίᾳ', 'ἀμήν']);
  });

  it('leaves TR-only Scripture alone when the verse is not an epistle ending', () => {
    // Act.9.5 ends "… σκληρόν σοι πρὸς κέντρα λακτίζειν" — TR-only, but the KJV
    // prints it, so nothing may be cut.
    const { allBooks, editions } = build('Acts.9.5', [
      ['εἶπεν', TR], ['σκληρόν', 'TR'], ['σοι', 'TR'], ['πρός', 'TR'], ['κέντρα', 'TR'], ['λακτίζειν', 'TR'],
    ]);
    expect(stripEpistleColophons(allBooks, editions)).toBe(0);
    expect(allBooks.get('Acts')!['Acts.9.5']).toHaveLength(6);
  });

  it('leaves the verse intact when there is no TR-only tail to cut', () => {
    const { allBooks, editions } = build('1Cor.16.24', [['ἡ', TR], ['ἀγάπη', TR]]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(stripEpistleColophons(allBooks, editions)).toBe(0);
    expect(allBooks.get('1Cor')!['1Cor.16.24']).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no opener found in 1Cor.16.24'));
    warn.mockRestore();
  });

  it('warns rather than silently shipping a colophon when the verse is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(stripEpistleColophons(new Map(), new Map())).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no words found for Rom.16.27'));
    warn.mockRestore();
  });
});
