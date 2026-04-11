import { describe, it, expect } from 'vitest';
import {
  bibleHubInterlinearUrl,
  bibleHubLexiconUrl,
  blueBibleUrl,
  stepBibleUrl,
} from './studyLinks';

describe('bibleHubInterlinearUrl', () => {
  it('builds URL for a single-word book name', () => {
    expect(bibleHubInterlinearUrl('Genesis', 2, 1))
      .toBe('https://biblehub.com/interlinear/genesis/2-1.htm');
  });
  it('replaces spaces with underscores in multi-word book names', () => {
    expect(bibleHubInterlinearUrl('Song of Solomon', 1, 1))
      .toBe('https://biblehub.com/interlinear/song_of_solomon/1-1.htm');
  });
  it('handles numbered books', () => {
    expect(bibleHubInterlinearUrl('1 Samuel', 3, 4))
      .toBe('https://biblehub.com/interlinear/1_samuel/3-4.htm');
  });
  it('handles NT books', () => {
    expect(bibleHubInterlinearUrl('John', 3, 16))
      .toBe('https://biblehub.com/interlinear/john/3-16.htm');
  });
});

describe('bibleHubLexiconUrl', () => {
  it('builds Hebrew lexicon URL', () => {
    expect(bibleHubLexiconUrl('H3615'))
      .toBe('https://biblehub.com/hebrew/3615.htm');
  });
  it('builds Greek lexicon URL', () => {
    expect(bibleHubLexiconUrl('G976'))
      .toBe('https://biblehub.com/greek/976.htm');
  });
  it('falls back to root for unrecognized input', () => {
    expect(bibleHubLexiconUrl('???')).toBe('https://biblehub.com/');
  });
});

describe('blueBibleUrl', () => {
  it('builds Hebrew BLB lexicon URL with wlc source', () => {
    expect(blueBibleUrl('H3615'))
      .toBe('https://www.blueletterbible.org/lexicon/h3615/kjv/wlc/0-1/');
  });
  it('builds Greek BLB lexicon URL with tr source', () => {
    expect(blueBibleUrl('G976'))
      .toBe('https://www.blueletterbible.org/lexicon/g976/kjv/tr/0-1/');
  });
  it('falls back to root for unrecognized input', () => {
    expect(blueBibleUrl('???')).toBe('https://www.blueletterbible.org/');
  });
});

describe('stepBibleUrl', () => {
  it('builds STEP Bible URL for OT book', () => {
    expect(stepBibleUrl('Genesis', 2, 1))
      .toBe('https://www.stepbible.org/?q=reference=Gen.2.1');
  });
  it('builds STEP Bible URL for NT book', () => {
    expect(stepBibleUrl('Matthew', 1, 1))
      .toBe('https://www.stepbible.org/?q=reference=Mat.1.1');
  });
  it('builds STEP Bible URL for multi-word book', () => {
    expect(stepBibleUrl('Song of Solomon', 1, 1))
      .toBe('https://www.stepbible.org/?q=reference=Sng.1.1');
  });
  it('builds STEP Bible URL for John', () => {
    expect(stepBibleUrl('John', 3, 16))
      .toBe('https://www.stepbible.org/?q=reference=Jhn.3.16');
  });
});
