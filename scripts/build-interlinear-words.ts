#!/usr/bin/env bun
/**
 * scripts/build-interlinear-words.ts
 *
 * Downloads the STEPBible TAHOT (Hebrew OT) and TAGNT (Greek NT) datasets
 * (CC BY 4.0 — https://github.com/STEPBible/STEPBible-Data) and converts them
 * into compact per-book JSON files:
 *   public/interlinear/words/{bookAbbr}.json
 *
 * Each file maps verse keys (e.g. "Ge.1.1") to arrays of word tuples:
 *   [word, strongsNum, transliteration, gloss, parsingCode]
 *
 * Usage:  bun scripts/build-interlinear-words.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── STEPBible → our BOOK_ABBR_MAP abbreviation mapping ─────────────────────
const STEP_TO_ABBR: Record<string, string> = {
  // OT
  Gen: 'Ge',   Exo: 'Exo',  Lev: 'Lev',  Num: 'Num',  Deu: 'Deu',
  Jos: 'Josh', Jdg: 'Jdgs', Rut: 'Ruth', '1Sa': '1Sm', '2Sa': '2Sm',
  '1Ki': '1Ki','2Ki': '2Ki','1Ch': '1Chr','2Ch': '2Chr',Ezr: 'Ezra',
  Neh: 'Neh',  Est: 'Est',  Job: 'Job',  Psa: 'Psa',  Pro: 'Prv',
  Ecc: 'Eccl', Sng: 'SSol', Isa: 'Isa',  Jer: 'Jer',  Lam: 'Lam',
  Ezk: 'Eze',  Dan: 'Dan',  Hos: 'Hos',  Jol: 'Joel', Amo: 'Amos',
  Oba: 'Obad', Jon: 'Jonah',Mic: 'Mic',  Nam: 'Nahum',Hab: 'Hab',
  Zep: 'Zep',  Hag: 'Hag',  Zec: 'Zec',  Mal: 'Mal',
  // NT
  Mat: 'Mat',  Mrk: 'Mark', Luk: 'Luke', Jhn: 'John', Act: 'Acts',
  Rom: 'Rom',  '1Co': '1Cor','2Co': '2Cor',Gal: 'Gal', Eph: 'Eph',
  Php: 'Phi',  Col: 'Col',  '1Th': '1Th','2Th': '2Th','1Ti': '1Tim',
  '2Ti': '2Tim',Tit: 'Titus',Phm: 'Phmn',Heb: 'Heb', Jas: 'Jas',
  '1Pe': '1Pet','2Pe': '2Pet','1Jn': '1Jn','2Jn': '2Jn','3Jn': '3Jn',
  Jud: 'Jude', Rev: 'Rev',
};

// WordEntry tuple: [word, strongs, gloss]
// translit + full definition come from the existing Strong's lexicon at display time.
type WordEntry = [string, string, string];

// Output structure per book file: { "Ge.1.1": [[word, strongs, translit, gloss, parsing], ...] }
type BookWordMap = Record<string, WordEntry[]>;

// ─── STEPBible reference tail ────────────────────────────────────────────────
// A STEPBible reference is "Book.Ch.Vs" followed by an optional versification
// marker, then "#NN=EDITIONS":
//
//   [K.J]  KJV (Scrivener 1894 / Textus Receptus) numbering
//   {K.J}  "others" (Majority / Byzantine) numbering
//   (K.J)  Nestle-Aland numbering
//
// The primary numbers are the English (NRSV) versification, so when a KJV
// marker is present it is the one this app must key on: Mat.20.5[20.4] holds
// the tail of KJV Matthew 20:4 ("οἱ δὲ ἀπῆλθον" — "and they went their way"),
// and 2Co.13.13[13.14] holds KJV 2 Corinthians 13:14. At most one marker ever
// appears (verified across the whole corpus), and ignoring the marker silently
// drops every word of those verses.
const REF_TAIL_RE = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(\([^)]*\)|\[[^\]]*\]|\{[^}]*\})?#/;
const KJV_NUMBER_RE = /\[(\d+)\.(\d+)\]/;

/**
 * The verse key a line belongs to, in KJV numbering. `refMatch[4]` is the
 * versification marker, if the line carried one.
 */
function verseKeyFor(abbr: string, refMatch: RegExpExecArray): string {
  const kjv = KJV_NUMBER_RE.exec(refMatch[4] ?? '');
  return kjv
    ? `${abbr}.${kjv[1]}.${kjv[2]}`
    : `${abbr}.${refMatch[2]}.${refMatch[3]}`;
}

// ─── STEPBible editorial marks ───────────────────────────────────────────────
// Both TAHOT and TAGNT embed marks that are not part of the text:
//
//   ¶        pilcrow — paragraph break
//   ¬        line-break marker
//   [[ … ]]  brackets around a passage whose place in the text is disputed
//            (Mark 16:9-20, John 7:53-8:11, Luke 22:43-44, …)
//
// The words inside a disputed passage are Scripture — the KJV prints them — so
// only the marks themselves are removed, never the words. Left in place they
// render literally, e.g. "[[ὤφθη" at Luke.22.43 and "γῆν.]]" at Luke.22.44.
function stripEditorialMarks(text: string): string {
  return text
    .replace(/[¶¬]/g, '')
    .replace(/\[\[|\]\]/g, '');
}

// ─── Strong's number cleaner ──────────────────────────────────────────────────
// Input: "H7225G", "H0430G", "H0853_A", "G0976", "G2424G", "H9003" (pseudo, skip)
// Output: "H7225", "H430", "H853", "G976", "G2424", null for H9xxx
function cleanStrongs(raw: string): string | null {
  const m = /^([HG])0*(\d+)/.exec(raw.trim());
  if (!m) return null;
  const num = parseInt(m[2], 10);
  // H9001-H9999 are STEPBible-internal pseudo-numbers, not standard Strong's
  if (m[1] === 'H' && num >= 9000) return null;
  return `${m[1]}${num}`;
}

// ─── Hebrew word cleaner (TAHOT col 1) ───────────────────────────────────────
// Input: "בְּ/רֵאשִׁ֖ית", "הָ/אָֽרֶץ\׃", "עַל\־"
// Output: "בְּרֵאשִׁ֖ית", "הָאָרֶץ", "עַל"
function cleanHebrewWord(raw: string): string {
  // Everything after the first \ is punctuation/marker — discard
  const beforeBackslash = raw.split('\\')[0];
  // Remove prefix separators /
  return stripEditorialMarks(beforeBackslash.replace(/\//g, '')).trim();
}

// ─── Transliteration cleaner ─────────────────────────────────────────────────
// Input: "be./re.Shit", "ha./'A.retz"
// Output: "be.re.Shit", "ha.A.retz"
function cleanTranslit(raw: string): string {
  return raw
    .replace(/\//g, '')    // Remove morpheme separator
    .replace(/\\.*/g, '')  // Remove backslash markers
    .replace(/'/g, '')     // Remove stress marks
    .trim();
}

// ─── English gloss cleaner ───────────────────────────────────────────────────
// Input: "in/ beginning", "[was] over", "and/ <obj.>"
// Output: "in beginning", "[was] over", "and [obj.]"
function cleanGloss(raw: string): string {
  return stripEditorialMarks(raw)
    .replace(/\//g, '')      // Remove morpheme separator
    .replace(/\\/g, '')      // Remove backslash
    .replace(/</g, '[')
    .replace(/>/g, ']')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Parse TAHOT (Hebrew OT) lines ───────────────────────────────────────────
export function parseTAHOTLine(line: string): { abbr: string; verseKey: string; entry: WordEntry } | null {
  const cols = line.split('\t');
  if (cols.length < 6) return null;

  const ref = cols[0].trim(); // e.g. "Gen.1.1#01=L" or "Psa.3.1(3.2)#01=L"
  // The "(N.N)" marker on a Psalm is the Hebrew Masoretic number; the primary
  // number is already the KJV one.
  const refMatch = REF_TAIL_RE.exec(ref);
  if (!refMatch) return null;

  const stepAbbr = refMatch[1];
  const abbr = STEP_TO_ABBR[stepAbbr];
  if (!abbr) return null;

  const verseKey = verseKeyFor(abbr, refMatch);

  const word = cleanHebrewWord(cols[1] ?? '');
  const translit = cleanTranslit(cols[2] ?? '');
  const gloss = cleanGloss(cols[3] ?? '');
  const parsing = (cols[5] ?? '').trim().split('\\')[0]; // e.g. "HR/Ncfsa"

  // Strong's: col[8] (sStrong+Instance) is the cleanest semantic number
  const rawStrongs = (cols[8] ?? '').trim();
  const strongs = rawStrongs ? cleanStrongs(rawStrongs) : null;

  // If col[8] is empty or pseudo, try extracting from col[4]
  // col[4] format: "H9003/{H7225G}" — extract the {} content
  let finalStrongs = strongs;
  if (!finalStrongs) {
    const inBraces = /\{([HG][^}]+)\}/.exec(cols[4] ?? '');
    if (inBraces) finalStrongs = cleanStrongs(inBraces[1]);
  }

  if (!word) return null;

  return {
    abbr,
    verseKey,
    entry: [word, finalStrongs ?? '', translit, gloss, parsing],
  };
}

// ─── Parse TAGNT (Greek NT) lines ────────────────────────────────────────────
export interface ParsedWordLine {
  abbr: string;
  verseKey: string;
  entry: WordEntry;
  /** col[5] — the editions containing this reading, e.g. "NA28+…+TR+Byz" or "TR". */
  editions: string;
}

export function parseTAGNTLine(line: string): ParsedWordLine | null {
  const cols = line.split('\t');
  if (cols.length < 4) return null;

  const ref = cols[0].trim(); // e.g. "Mat.1.1#01=NKO" or "2Co.13.13[13.14]#01=NKO"
  const refMatch = REF_TAIL_RE.exec(ref);
  if (!refMatch) return null;

  const stepAbbr = refMatch[1];
  const abbr = STEP_TO_ABBR[stepAbbr];
  if (!abbr) return null;

  const verseKey = verseKeyFor(abbr, refMatch);

  // col[1]: "Βίβλος (Biblos)" — word and transliteration
  const col1 = (cols[1] ?? '').trim();
  const parenIdx = col1.lastIndexOf(' (');
  const word = stripEditorialMarks(parenIdx >= 0 ? col1.slice(0, parenIdx).trim() : col1);
  const translit = parenIdx >= 0 ? col1.slice(parenIdx + 2, -1) : '';

  const gloss = cleanGloss(cols[2] ?? '');

  // col[3]: "G0976=N-NSF" — Strong's and parsing
  const col3 = (cols[3] ?? '').trim();
  const eqIdx = col3.indexOf('=');
  const rawStrongs = eqIdx >= 0 ? col3.slice(0, eqIdx) : col3;
  const parsing = eqIdx >= 0 ? col3.slice(eqIdx + 1) : '';
  const strongs = cleanStrongs(rawStrongs) ?? '';

  if (!word) return null;

  return {
    abbr,
    verseKey,
    entry: [word, strongs, translit, gloss, parsing],
    editions: (cols[5] ?? '').trim(),
  };
}

// ─── TR epistle subscriptions (hypographai) ──────────────────────────────────
/**
 * Textus Receptus editions print a short scribal colophon after the last verse
 * of each epistle — "πρὸς Κορινθίους πρώτη ἐγράφη ἀπὸ Φιλίππων …" ("written to
 * the Corinthians the first time from Philippi …"). The colophons are not
 * Scripture and the KJV does not print them, but STEPBible tags their words
 * into the epistle's final verse.
 *
 * The TR-only edition tag cannot identify them on its own: genuine TR-only
 * Scripture carries the same tag, and cutting on it alone would delete the
 * Comma Johanneum (1Jn.5.7), Acts 8:37, and "it is hard for thee to kick
 * against the pricks" (Act.9.5). Two things together are unambiguous:
 *
 *   - the verse is one of the fourteen that end an epistle — a fixed, closed
 *     set in the TR, and
 *   - from the colophon's opening "πρός" ("to") to the end of the verse, every
 *     word is TR-only.
 *
 * Anchoring on "πρός" (rather than cutting the whole TR-only tail) keeps the
 * "ἀμήν" at Eph.6.24, which the KJV prints and STEPBible tags TR-only.
 */
export const EPISTLE_COLOPHON_VERSES = new Set([
  'Rom.16.27', '1Cor.16.24', '2Cor.13.14', 'Gal.6.18',  'Eph.6.24',
  'Phi.4.23',  'Col.4.18',   '1Th.5.28',   '2Th.3.18',  '1Tim.6.21',
  '2Tim.4.22', 'Titus.3.15', 'Phmn.1.25',  'Heb.13.25',
]);

/** Fold a Greek word to a bare comparison key (drop accents, case, punctuation). */
function normalizeGreek(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');
}

/**
 * Cut the trailing epistle colophon from each of {@link EPISTLE_COLOPHON_VERSES}.
 *
 * Returns the number of words removed. A verse that has no words, no editions
 * trail, or no colophon opener is left untouched and warned about — upstream
 * drift that would otherwise silently ship a colophon to readers.
 */
export function stripEpistleColophons(
  allBooks: Map<string, BookWordMap>,
  editions: Map<string, string[]>
): number {
  let removed = 0;
  for (const verseKey of EPISTLE_COLOPHON_VERSES) {
    const abbr = verseKey.slice(0, verseKey.indexOf('.'));
    const entries = allBooks.get(abbr)?.[verseKey];
    const eds = editions.get(verseKey);
    if (!entries || !eds) {
      console.warn(`  ⚠ colophon: no words found for ${verseKey}`);
      continue;
    }
    // Walk back over the trailing run of TR-only words …
    let start = entries.length;
    while (start > 0 && eds[start - 1] === 'TR') start--;
    // … and cut from the "πρός" that opens the colophon within it.
    const cut = entries.findIndex(
      (entry, i) => i >= start && normalizeGreek(entry[0]) === 'προς'
    );
    // cut === 0 would empty the verse, which means the anchor misfired.
    if (cut <= 0) {
      console.warn(`  ⚠ colophon: no opener found in ${verseKey}`);
      continue;
    }
    removed += entries.length - cut;
    entries.length = cut;
  }
  return removed;
}

// ─── Download + parse one file ────────────────────────────────────────────────
async function processFile(
  url: string,
  type: 'TAHOT' | 'TAGNT',
  allBooks: Map<string, BookWordMap>,
  /** Verse key → the editions column of each word, in order. TAGNT only. */
  editionsByVerse: Map<string, string[]>
): Promise<void> {
  console.log(`  Downloading: ${url.split('/').pop()}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const text = await res.text();

  let wordCount = 0;
  for (const rawLine of text.split('\n')) {
    // Strip BOM, skip comments and blank lines
    const line = rawLine.replace(/^\uFEFF/, '').trimEnd();
    if (!line || line.startsWith('#') || line.startsWith('\t')) continue;
    // Data lines start with a book abbreviation followed by '.'
    if (!/^[A-Za-z0-9]+\./.test(line)) continue;

    const parsed = type === 'TAHOT' ? parseTAHOTLine(line) : parseTAGNTLine(line);
    if (!parsed) continue;

    if (!allBooks.has(parsed.abbr)) allBooks.set(parsed.abbr, {});
    const bookMap = allBooks.get(parsed.abbr)!;
    if (!bookMap[parsed.verseKey]) {
      bookMap[parsed.verseKey] = [];
      editionsByVerse.set(parsed.verseKey, []);
    }
    bookMap[parsed.verseKey].push(parsed.entry);
    // TAHOT's parse carries no editions column (its col[5] is parsing), and
    // subscriptions are a Greek-NT-only phenomenon.
    if (type === 'TAGNT') editionsByVerse.get(parsed.verseKey)!.push(parsed.editions);
    wordCount++;
  }
  console.log(`    → ${wordCount} words parsed`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const outDir = join(import.meta.dir, '..', 'public', 'interlinear', 'words');
  mkdirSync(outDir, { recursive: true });

  const BASE = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/';
  const FILES: [string, 'TAHOT' | 'TAGNT'][] = [
    [`${BASE}TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`, 'TAHOT'],
    [`${BASE}TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`, 'TAHOT'],
    [`${BASE}TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`, 'TAHOT'],
    [`${BASE}TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt`, 'TAHOT'],
    [`${BASE}TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt`, 'TAGNT'],
    [`${BASE}TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt`, 'TAGNT'],
  ];

  const allBooks = new Map<string, BookWordMap>();
  const editionsByVerse = new Map<string, string[]>();

  for (const [url, type] of FILES) {
    await processFile(url, type, allBooks, editionsByVerse);
  }

  const colophonWords = stripEpistleColophons(allBooks, editionsByVerse);
  console.log(`\n✓ Removed ${colophonWords} words of TR epistle colophon from ${EPISTLE_COLOPHON_VERSES.size} verses`);

  let totalVerses = 0;
  let totalWords = 0;
  for (const [abbr, bookMap] of allBooks) {
    const filePath = join(outDir, `${abbr}.json`);
    const json = JSON.stringify(bookMap);
    writeFileSync(filePath, json);
    const verses = Object.keys(bookMap).length;
    const words = Object.values(bookMap).reduce((s, arr) => s + arr.length, 0);
    totalVerses += verses;
    totalWords += words;
  }

  console.log(`\n✓ Wrote ${allBooks.size} book files to public/interlinear/words/`);
  console.log(`  ${totalVerses.toLocaleString()} verses, ${totalWords.toLocaleString()} words total`);
  console.log(`  Books: ${[...allBooks.keys()].join(', ')}\n`);
}

if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1); });
}
