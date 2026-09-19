#!/usr/bin/env bun
/**
 * scripts/build-interlinear.ts
 *
 * Downloads the Westminster Leningrad Codex (Hebrew OT, public domain) and
 * Textus Receptus (Greek NT, CC BY-NC-SA 4.0) from scrollmapper/bible_databases,
 * then converts them to compact verse-keyed maps:
 *   { "Ge.1.1": "בְּרֵאשִׁ֖ית בָּרָ֣א ...", ... }
 *
 * Output files:
 *   public/interlinear/hebrew.json  (~1.5 MB)
 *   public/interlinear/greek.json   (~800 KB)
 *
 * Usage:  bun scripts/build-interlinear.ts
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// ─── Book abbreviation map (mirrors src/data/kjv-bible.ts) ──────────────────
// Maps our internal abbreviations → full book name (for reverse lookup)
const BOOK_ABBR_MAP: Record<string, { name: string; testament: 'old' | 'new' }> = {
  Ge: { name: 'Genesis', testament: 'old' },
  Exo: { name: 'Exodus', testament: 'old' },
  Lev: { name: 'Leviticus', testament: 'old' },
  Num: { name: 'Numbers', testament: 'old' },
  Deu: { name: 'Deuteronomy', testament: 'old' },
  Josh: { name: 'Joshua', testament: 'old' },
  Jdgs: { name: 'Judges', testament: 'old' },
  Ruth: { name: 'Ruth', testament: 'old' },
  '1Sm': { name: '1 Samuel', testament: 'old' },
  '2Sm': { name: '2 Samuel', testament: 'old' },
  '1Ki': { name: '1 Kings', testament: 'old' },
  '2Ki': { name: '2 Kings', testament: 'old' },
  '1Chr': { name: '1 Chronicles', testament: 'old' },
  '2Chr': { name: '2 Chronicles', testament: 'old' },
  Ezra: { name: 'Ezra', testament: 'old' },
  Neh: { name: 'Nehemiah', testament: 'old' },
  Est: { name: 'Esther', testament: 'old' },
  Job: { name: 'Job', testament: 'old' },
  Psa: { name: 'Psalms', testament: 'old' },
  Prv: { name: 'Proverbs', testament: 'old' },
  Eccl: { name: 'Ecclesiastes', testament: 'old' },
  SSol: { name: 'Song of Solomon', testament: 'old' },
  Isa: { name: 'Isaiah', testament: 'old' },
  Jer: { name: 'Jeremiah', testament: 'old' },
  Lam: { name: 'Lamentations', testament: 'old' },
  Eze: { name: 'Ezekiel', testament: 'old' },
  Dan: { name: 'Daniel', testament: 'old' },
  Hos: { name: 'Hosea', testament: 'old' },
  Joel: { name: 'Joel', testament: 'old' },
  Amos: { name: 'Amos', testament: 'old' },
  Obad: { name: 'Obadiah', testament: 'old' },
  Jonah: { name: 'Jonah', testament: 'old' },
  Mic: { name: 'Micah', testament: 'old' },
  Nahum: { name: 'Nahum', testament: 'old' },
  Hab: { name: 'Habakkuk', testament: 'old' },
  Zep: { name: 'Zephaniah', testament: 'old' },
  Hag: { name: 'Haggai', testament: 'old' },
  Zec: { name: 'Zechariah', testament: 'old' },
  Mal: { name: 'Malachi', testament: 'old' },
  Mat: { name: 'Matthew', testament: 'new' },
  Mark: { name: 'Mark', testament: 'new' },
  Luke: { name: 'Luke', testament: 'new' },
  John: { name: 'John', testament: 'new' },
  Acts: { name: 'Acts', testament: 'new' },
  Rom: { name: 'Romans', testament: 'new' },
  '1Cor': { name: '1 Corinthians', testament: 'new' },
  '2Cor': { name: '2 Corinthians', testament: 'new' },
  Gal: { name: 'Galatians', testament: 'new' },
  Eph: { name: 'Ephesians', testament: 'new' },
  Phi: { name: 'Philippians', testament: 'new' },
  Col: { name: 'Colossians', testament: 'new' },
  '1Th': { name: '1 Thessalonians', testament: 'new' },
  '2Th': { name: '2 Thessalonians', testament: 'new' },
  '1Tim': { name: '1 Timothy', testament: 'new' },
  '2Tim': { name: '2 Timothy', testament: 'new' },
  Titus: { name: 'Titus', testament: 'new' },
  Phmn: { name: 'Philemon', testament: 'new' },
  Heb: { name: 'Hebrews', testament: 'new' },
  Jas: { name: 'James', testament: 'new' },
  '1Pet': { name: '1 Peter', testament: 'new' },
  '2Pet': { name: '2 Peter', testament: 'new' },
  '1Jn': { name: '1 John', testament: 'new' },
  '2Jn': { name: '2 John', testament: 'new' },
  '3Jn': { name: '3 John', testament: 'new' },
  Jude: { name: 'Jude', testament: 'new' },
  Rev: { name: 'Revelation', testament: 'new' },
};

// Build reverse map: full name → abbreviation
const NAME_TO_ABBR = new Map<string, string>(
  Object.entries(BOOK_ABBR_MAP).map(([abbr, info]) => [info.name.toLowerCase(), abbr])
);

// Alternate names that scrollmapper may use
const ALTERNATE_NAMES: Record<string, string> = {
  'song of songs': 'Song of Solomon',
  'song of song': 'Song of Solomon',
  'psalms': 'Psalms',
  'psalm': 'Psalms',
  '1 samuel': '1 Samuel',
  '2 samuel': '2 Samuel',
  '1 kings': '1 Kings',
  '2 kings': '2 Kings',
  '1 chronicles': '1 Chronicles',
  '2 chronicles': '2 Chronicles',
  '1 corinthians': '1 Corinthians',
  '2 corinthians': '2 Corinthians',
  '1 thessalonians': '1 Thessalonians',
  '2 thessalonians': '2 Thessalonians',
  '1 timothy': '1 Timothy',
  '2 timothy': '2 Timothy',
  '1 peter': '1 Peter',
  '2 peter': '2 Peter',
  '1 john': '1 John',
  '2 john': '2 John',
  '3 john': '3 John',
  'revelation of john': 'Revelation',
  'the revelation': 'Revelation',
  'philippians': 'Philippians',
  // Roman numeral variants used by some sources (e.g. WLC)
  'i samuel': '1 Samuel',
  'ii samuel': '2 Samuel',
  'i kings': '1 Kings',
  'ii kings': '2 Kings',
  'i chronicles': '1 Chronicles',
  'ii chronicles': '2 Chronicles',
  'i corinthians': '1 Corinthians',
  'ii corinthians': '2 Corinthians',
  'i thessalonians': '1 Thessalonians',
  'ii thessalonians': '2 Thessalonians',
  'i timothy': '1 Timothy',
  'ii timothy': '2 Timothy',
  'i peter': '1 Peter',
  'ii peter': '2 Peter',
  'i john': '1 John',
  'ii john': '2 John',
  'iii john': '3 John',
};

function resolveAbbr(rawName: string): string | null {
  const lower = rawName.toLowerCase().trim();
  const direct = NAME_TO_ABBR.get(lower);
  if (direct) return direct;
  const alt = ALTERNATE_NAMES[lower];
  if (alt) return NAME_TO_ABBR.get(alt.toLowerCase()) ?? null;
  return null;
}

interface ScrollmapperVerse {
  verse: number;
  text: string;
  name?: string;
}
interface ScrollmapperChapter {
  chapter: number;
  verses: ScrollmapperVerse[];
}
interface ScrollmapperBook {
  name: string;
  chapters: ScrollmapperChapter[];
}
interface ScrollmapperData {
  translation: string;
  books: ScrollmapperBook[];
}

async function downloadJSON(url: string): Promise<ScrollmapperData> {
  console.log(`  Downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Strip editorial/markup characters from the StatResGNT text (˚ ¶ etc.)
export function cleanText(text: string): string {
  return text
    .replace(/[˚¶]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip the editorial apparatus that scrollmapper's TR.json carries inline.
 *
 * Four kinds of non-Scriptural material leak through cleanText():
 *
 *  1. `[ … ]` epistle subscriptions (hypographai). Textus Receptus editions
 *     print a scribal colophon after the last verse of each epistle, e.g.
 *     1Cor.16.24 ends with
 *       "[προς κορινθιους πρωτη εγραφη απο φιλιππων δια στεφανα …]".
 *     These are absent from the KJV. The brackets are the source's own marker,
 *     and they occur in exactly these 14 verses (Rom.16.27, 1Cor.16.24,
 *     2Cor.13.14, Gal.6.18, Eph.6.24, Phi.4.23, Col.4.18, 1Th.5.28, 2Th.3.18,
 *     1Tim.6.21, 2Tim.4.22, Titus.3.15, Phmn.1.25, Heb.13.25) — always as a
 *     trailing span, never mid-verse.
 *  2. `(C:V)` versification notes the source prints where its numbering
 *     disagrees with the KJV (e.g. Mat.23.13 opens with "(23:14)"). These are
 *     cross-references, not text.
 *  3. `{P-GSM}` and similar morphology codes that leaked out of the apparatus
 *     (John.9.21, Col.4.10).
 *  4. Bare Strong's numbers stranded mid-sentence where the source annotates a
 *     single word (e.g. Mark.6.45 "εμβηναι 1684 εις το πλοιον").
 *
 * Greek text itself never contains Arabic digits, braces or parentheses, so
 * removing them is unambiguous. Not applied to the Hebrew builder: the WLC
 * text uses none of these forms.
 *
 * Remaining upstream quirk, deliberately left alone: the source prints variant
 * spellings side by side as two words (Mark.6.45 "βηθσαιδαν βηθσαιδα",
 * Luke.2.4 "ναζαρετ ναζαρεθ"). Removing one would mean guessing which reading
 * the KJV follows, so both are kept.
 */
export function stripGreekApparatus(text: string): string {
  return text
    .replace(/\s*\[[^\]]*\]\s*$/, '')  // (1) trailing epistle subscription
    .replace(/\(\d+:\d+\)/g, '')       // (2) inline versification notes
    .replace(/\{[^}]*\}/g, '')         // (3) stray morphology codes
    .replace(/\b\d+\b/g, '')           // (4) stray Strong's numbers
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildHebrew(): Promise<Record<string, string>> {
  const data = await downloadJSON(
    'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/WLC.json'
  );
  const result: Record<string, string> = {};
  let found = 0;
  let missed = 0;

  for (const book of data.books) {
    const abbr = resolveAbbr(book.name);
    if (!abbr) {
      console.warn(`  ⚠ Hebrew: unknown book name "${book.name}"`);
      missed++;
      continue;
    }
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const text = cleanText(verse.text);
        if (!text) continue;
        const key = `${abbr}.${chapter.chapter}.${verse.verse}`;
        result[key] = text;
        found++;
      }
    }
  }

  console.log(`  Hebrew: ${found} verses indexed, ${missed} books unresolved`);
  return result;
}

async function buildGreek(): Promise<Record<string, string>> {
  const data = await downloadJSON(
    'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/TR.json'
  );
  const result: Record<string, string> = {};
  let found = 0;

  for (const book of data.books) {
    const abbr = resolveAbbr(book.name);
    if (!abbr) continue; // OT stubs — silently skip
    const info = BOOK_ABBR_MAP[abbr];
    if (info?.testament !== 'new') continue; // TR only has NT text

    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const text = stripGreekApparatus(cleanText(verse.text));
        if (!text) continue;
        const key = `${abbr}.${chapter.chapter}.${verse.verse}`;
        result[key] = text;
        found++;
      }
    }
  }

  console.log(`  Greek: ${found} verses indexed`);
  return result;
}

async function main() {
  const outDir = join(import.meta.dir, '..', 'public', 'interlinear');
  mkdirSync(outDir, { recursive: true });

  console.log('\nBuilding Hebrew interlinear (WLC — public domain)...');
  const hebrew = await buildHebrew();
  const hebrewPath = join(outDir, 'hebrew.json');
  writeFileSync(hebrewPath, JSON.stringify(hebrew));
  const hebrewKB = Math.round(Buffer.byteLength(JSON.stringify(hebrew)) / 1024);
  console.log(`  ✓ Saved to public/interlinear/hebrew.json (${hebrewKB} KB)`);

  console.log('\nBuilding Greek interlinear (Textus Receptus — CC BY-NC-SA 4.0)...');
  const greek = await buildGreek();
  const greekPath = join(outDir, 'greek.json');
  writeFileSync(greekPath, JSON.stringify(greek));
  const greekKB = Math.round(Buffer.byteLength(JSON.stringify(greek)) / 1024);
  console.log(`  ✓ Saved to public/interlinear/greek.json (${greekKB} KB)`);

  console.log('\nDone!\n');
}

// Guard the network downloads so the pure helpers above can be imported by
// unit tests without triggering a fetch.
if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1); });
}
