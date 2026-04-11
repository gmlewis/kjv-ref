/**
 * One-time preprocessing script.
 * Downloads 66 book JSON files from kaiserlik/kjv (KJV text with inline Strong's numbers),
 * and builds public/strongs/word-index.json:
 *   { "BOOKABBR.CHAP.VERSE": ["H7225", "H430", ...], ... }
 * Keys use BOOK_ABBR_MAP abbreviations from src/data/kjv-bible.ts.
 *
 * Usage: bun run scripts/build-strongs-index.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://raw.githubusercontent.com/kaiserlik/kjv/master';
const OUT_DIR = join(import.meta.dir, '..', 'public', 'strongs');
const OUT_FILE = join(OUT_DIR, 'word-index.json');

// Map from full book name → our BOOK_ABBR_MAP key (from src/data/kjv-bible.ts)
const FULL_NAME_TO_ABBR: Record<string, string> = {
  'Genesis': 'Ge',
  'Exodus': 'Exo',
  'Leviticus': 'Lev',
  'Numbers': 'Num',
  'Deuteronomy': 'Deu',
  'Joshua': 'Josh',
  'Judges': 'Jdgs',
  'Ruth': 'Ruth',
  '1 Samuel': '1Sm',
  '2 Samuel': '2Sm',
  '1 Kings': '1Ki',
  '2 Kings': '2Ki',
  '1 Chronicles': '1Chr',
  '2 Chronicles': '2Chr',
  'Ezra': 'Ezra',
  'Nehemiah': 'Neh',
  'Esther': 'Est',
  'Job': 'Job',
  'Psalms': 'Psa',
  'Proverbs': 'Prv',
  'Ecclesiastes': 'Eccl',
  'Song of Songs': 'SSol',
  'Song of Solomon': 'SSol',
  'Isaiah': 'Isa',
  'Jeremiah': 'Jer',
  'Lamentations': 'Lam',
  'Ezekiel': 'Eze',
  'Daniel': 'Dan',
  'Hosea': 'Hos',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obadiah': 'Obad',
  'Jonah': 'Jonah',
  'Micah': 'Mic',
  'Nahum': 'Nahum',
  'Habakkuk': 'Hab',
  'Zephaniah': 'Zep',
  'Haggai': 'Hag',
  'Zechariah': 'Zec',
  'Malachi': 'Mal',
  'Matthew': 'Mat',
  'Mark': 'Mark',
  'Luke': 'Luke',
  'John': 'John',
  'Acts': 'Acts',
  'Romans': 'Rom',
  '1 Corinthians': '1Cor',
  '2 Corinthians': '2Cor',
  'Galatians': 'Gal',
  'Ephesians': 'Eph',
  'Philippians': 'Phi',
  'Colossians': 'Col',
  '1 Thessalonians': '1Th',
  '2 Thessalonians': '2Th',
  '1 Timothy': '1Tim',
  '2 Timothy': '2Tim',
  'Titus': 'Titus',
  'Philemon': 'Phmn',
  'Hebrews': 'Heb',
  'James': 'Jas',
  '1 Peter': '1Pet',
  '2 Peter': '2Pet',
  '1 John': '1Jn',
  '2 John': '2Jn',
  '3 John': '3Jn',
  'Jude': 'Jude',
  'Revelation': 'Rev',
};

const STRONGS_RE = /\[([HG]\d+)\]/g;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse failed for ${url}: ${e}`);
  }
}

// Robust extractor: uses regex on raw text to avoid JSON encoding issues.
// Returns map of verseKey (e.g. "Ge.1.1") → positional strongs array.
// Each array entry corresponds to one whitespace-delimited word token in the
// kaiserlik "en" field. Words without a Strong's number get an empty string so
// that strongs[i] always aligns with the i-th word token (no position drift).
function extractFromRaw(raw: string, myAbbr: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const versePattern = /\|(\d+)\|(\d+)"\s*:\s*\{[^}]*?"en"\s*:\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = versePattern.exec(raw)) !== null) {
    const chapter = parseInt(m[1], 10);
    const verse = parseInt(m[2], 10);
    const en = m[3];
    // One entry per space-delimited token; '' means no Strong's for that word.
    const strongs = en.split(/\s+/).filter(Boolean).map(wt => {
      const sm = /\[([HG]\d+)\]/.exec(wt);
      return sm ? sm[1] : '';
    });
    if (strongs.some(s => s !== '')) {
      result[`${myAbbr}.${chapter}.${verse}`] = strongs;
    }
  }
  return result;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Fetching books list...');
  const booksData = await fetchJSON(`${BASE_URL}/books.json`);
  const books: { fullName: string; kaiserlikAbbr: string }[] = booksData.books.map((obj: any) => {
    const [fullName, kaiserlikAbbr] = Object.entries(obj)[0] as [string, string];
    return { fullName, kaiserlikAbbr };
  });

  const wordIndex: Record<string, string[]> = {};
  let total = 0;

  for (const { fullName, kaiserlikAbbr } of books) {
    const myAbbr = FULL_NAME_TO_ABBR[fullName];
    if (!myAbbr) {
      console.warn(`No abbreviation mapping for: ${fullName}`);
      continue;
    }

    process.stdout.write(`Fetching ${fullName} (${kaiserlikAbbr})...`);
    const rawBytes = await fetchBytes(`${BASE_URL}/${kaiserlikAbbr}.json`);
    const raw = Buffer.from(rawBytes).toString('latin1'); // use latin1 to avoid UTF-8 decode errors
    const extracted = extractFromRaw(raw, myAbbr);
    const count = Object.keys(extracted).length;
    Object.assign(wordIndex, extracted);
    total += count;
    console.log(` ${count} verses`);
  }

  const json = JSON.stringify(wordIndex);
  writeFileSync(OUT_FILE, json);

  const gzipSize = await Bun.gzipSync(Buffer.from(json)).byteLength;
  console.log(`\nDone! ${total} verses indexed.`);
  console.log(`Output: ${OUT_FILE}`);
  console.log(`Size: ${(json.length / 1024 / 1024).toFixed(2)} MB uncompressed, ${(gzipSize / 1024 / 1024).toFixed(2)} MB gzipped`);

  // Spot-checks
  console.log('\nSpot-checks:');
  console.log('Ge.1.1:', JSON.stringify(wordIndex['Ge.1.1']));
  console.log('John.3.16:', JSON.stringify(wordIndex['John.3.16']));
  console.log('Psa.23.1:', JSON.stringify(wordIndex['Psa.23.1']));
}

main().catch(e => { console.error(e); process.exit(1); });
