export interface BibleBook {
  name: string;
  abbr: string;
  testament: 'old' | 'new';
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Genesis', abbr: 'Gen', testament: 'old', chapters: 50 },
  { name: 'Exodus', abbr: 'Ex', testament: 'old', chapters: 40 },
  { name: 'Leviticus', abbr: 'Lev', testament: 'old', chapters: 27 },
  { name: 'Numbers', abbr: 'Num', testament: 'old', chapters: 36 },
  { name: 'Deuteronomy', abbr: 'Deut', testament: 'old', chapters: 34 },
  { name: 'Joshua', abbr: 'Josh', testament: 'old', chapters: 24 },
  { name: 'Judges', abbr: 'Judg', testament: 'old', chapters: 21 },
  { name: 'Ruth', abbr: 'Ruth', testament: 'old', chapters: 4 },
  { name: '1 Samuel', abbr: '1Sam', testament: 'old', chapters: 31 },
  { name: '2 Samuel', abbr: '2Sam', testament: 'old', chapters: 24 },
  { name: '1 Kings', abbr: '1Kgs', testament: 'old', chapters: 22 },
  { name: '2 Kings', abbr: '2Kgs', testament: 'old', chapters: 25 },
  { name: '1 Chronicles', abbr: '1Chr', testament: 'old', chapters: 29 },
  { name: '2 Chronicles', abbr: '2Chr', testament: 'old', chapters: 36 },
  { name: 'Ezra', abbr: 'Ezra', testament: 'old', chapters: 10 },
  { name: 'Nehemiah', abbr: 'Neh', testament: 'old', chapters: 13 },
  { name: 'Esther', abbr: 'Esth', testament: 'old', chapters: 10 },
  { name: 'Job', abbr: 'Job', testament: 'old', chapters: 42 },
  { name: 'Psalms', abbr: 'Ps', testament: 'old', chapters: 150 },
  { name: 'Proverbs', abbr: 'Prov', testament: 'old', chapters: 31 },
  { name: 'Ecclesiastes', abbr: 'Eccl', testament: 'old', chapters: 12 },
  { name: 'Song of Solomon', abbr: 'Song', testament: 'old', chapters: 8 },
  { name: 'Isaiah', abbr: 'Isa', testament: 'old', chapters: 66 },
  { name: 'Jeremiah', abbr: 'Jer', testament: 'old', chapters: 52 },
  { name: 'Lamentations', abbr: 'Lam', testament: 'old', chapters: 5 },
  { name: 'Ezekiel', abbr: 'Ezek', testament: 'old', chapters: 48 },
  { name: 'Daniel', abbr: 'Dan', testament: 'old', chapters: 12 },
  { name: 'Hosea', abbr: 'Hos', testament: 'old', chapters: 14 },
  { name: 'Joel', abbr: 'Joel', testament: 'old', chapters: 3 },
  { name: 'Amos', abbr: 'Amos', testament: 'old', chapters: 9 },
  { name: 'Obadiah', abbr: 'Obad', testament: 'old', chapters: 1 },
  { name: 'Jonah', abbr: 'Jonah', testament: 'old', chapters: 4 },
  { name: 'Micah', abbr: 'Mic', testament: 'old', chapters: 7 },
  { name: 'Nahum', abbr: 'Nah', testament: 'old', chapters: 3 },
  { name: 'Habakkuk', abbr: 'Hab', testament: 'old', chapters: 3 },
  { name: 'Zephaniah', abbr: 'Zeph', testament: 'old', chapters: 3 },
  { name: 'Haggai', abbr: 'Hag', testament: 'old', chapters: 2 },
  { name: 'Zechariah', abbr: 'Zech', testament: 'old', chapters: 14 },
  { name: 'Malachi', abbr: 'Mal', testament: 'old', chapters: 4 },
  { name: 'Matthew', abbr: 'Matt', testament: 'new', chapters: 28 },
  { name: 'Mark', abbr: 'Mark', testament: 'new', chapters: 16 },
  { name: 'Luke', abbr: 'Luke', testament: 'new', chapters: 24 },
  { name: 'John', abbr: 'John', testament: 'new', chapters: 21 },
  { name: 'Acts', abbr: 'Acts', testament: 'new', chapters: 28 },
  { name: 'Romans', abbr: 'Rom', testament: 'new', chapters: 16 },
  { name: '1 Corinthians', abbr: '1Cor', testament: 'new', chapters: 16 },
  { name: '2 Corinthians', abbr: '2Cor', testament: 'new', chapters: 13 },
  { name: 'Galatians', abbr: 'Gal', testament: 'new', chapters: 6 },
  { name: 'Ephesians', abbr: 'Eph', testament: 'new', chapters: 6 },
  { name: 'Philippians', abbr: 'Phil', testament: 'new', chapters: 4 },
  { name: 'Colossians', abbr: 'Col', testament: 'new', chapters: 4 },
  { name: '1 Thessalonians', abbr: '1Thes', testament: 'new', chapters: 5 },
  { name: '2 Thessalonians', abbr: '2Thes', testament: 'new', chapters: 3 },
  { name: '1 Timothy', abbr: '1Tim', testament: 'new', chapters: 6 },
  { name: '2 Timothy', abbr: '2Tim', testament: 'new', chapters: 4 },
  { name: 'Titus', abbr: 'Titus', testament: 'new', chapters: 3 },
  { name: 'Philemon', abbr: 'Phlm', testament: 'new', chapters: 1 },
  { name: 'Hebrews', abbr: 'Heb', testament: 'new', chapters: 13 },
  { name: 'James', abbr: 'Jas', testament: 'new', chapters: 5 },
  { name: '1 Peter', abbr: '1Pet', testament: 'new', chapters: 5 },
  { name: '2 Peter', abbr: '2Pet', testament: 'new', chapters: 3 },
  { name: '1 John', abbr: '1John', testament: 'new', chapters: 5 },
  { name: '2 John', abbr: '2John', testament: 'new', chapters: 1 },
  { name: '3 John', abbr: '3John', testament: 'new', chapters: 1 },
  { name: 'Jude', abbr: 'Jude', testament: 'new', chapters: 1 },
  { name: 'Revelation', abbr: 'Rev', testament: 'new', chapters: 22 },
];

export function getPrevNextChapter(bookName: string, chapterNum: number) {
  const idx = BIBLE_BOOKS.findIndex(b => b.name === bookName);
  const book = BIBLE_BOOKS[idx];

  let prevBook: BibleBook, prevChapter: number;
  if (chapterNum > 1) {
    prevBook = book; prevChapter = chapterNum - 1;
  } else if (idx > 0) {
    prevBook = BIBLE_BOOKS[idx - 1]; prevChapter = prevBook.chapters;
  } else {
    prevBook = BIBLE_BOOKS[BIBLE_BOOKS.length - 1]; prevChapter = prevBook.chapters;
  }

  let nextBook: BibleBook, nextChapter: number;
  if (chapterNum < book.chapters) {
    nextBook = book; nextChapter = chapterNum + 1;
  } else if (idx < BIBLE_BOOKS.length - 1) {
    nextBook = BIBLE_BOOKS[idx + 1]; nextChapter = 1;
  } else {
    nextBook = BIBLE_BOOKS[0]; nextChapter = 1;
  }

  return {
    prev: { book: prevBook.name, chapter: prevChapter },
    next: { book: nextBook.name, chapter: nextChapter },
  };
}
