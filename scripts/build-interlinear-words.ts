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
  return beforeBackslash.replace(/\//g, '').trim();
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
  return raw
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
  // Optional "(N.N)" after verse digits = Hebrew versification offset (parenthetical = Hebrew, primary = KJV)
  const refMatch = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\([^)]*\))?#/.exec(ref);
  if (!refMatch) return null;

  const stepAbbr = refMatch[1];
  const chapter = refMatch[2];
  const verse = refMatch[3];
  const abbr = STEP_TO_ABBR[stepAbbr];
  if (!abbr) return null;

  const verseKey = `${abbr}.${chapter}.${verse}`;

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
export function parseTAGNTLine(line: string): { abbr: string; verseKey: string; entry: WordEntry } | null {
  const cols = line.split('\t');
  if (cols.length < 4) return null;

  const ref = cols[0].trim(); // e.g. "Mat.1.1#01=NKO"
  const refMatch = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)#/.exec(ref);
  if (!refMatch) return null;

  const stepAbbr = refMatch[1];
  const chapter = refMatch[2];
  const verse = refMatch[3];
  const abbr = STEP_TO_ABBR[stepAbbr];
  if (!abbr) return null;

  const verseKey = `${abbr}.${chapter}.${verse}`;

  // col[1]: "Βίβλος (Biblos)" — word and transliteration
  const col1 = (cols[1] ?? '').trim();
  const parenIdx = col1.lastIndexOf(' (');
  const word = parenIdx >= 0 ? col1.slice(0, parenIdx).trim() : col1;
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
  };
}

// ─── Download + parse one file ────────────────────────────────────────────────
async function processFile(
  url: string,
  type: 'TAHOT' | 'TAGNT',
  allBooks: Map<string, BookWordMap>
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
    if (!bookMap[parsed.verseKey]) bookMap[parsed.verseKey] = [];
    bookMap[parsed.verseKey].push(parsed.entry);
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

  for (const [url, type] of FILES) {
    await processFile(url, type, allBooks);
  }

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
