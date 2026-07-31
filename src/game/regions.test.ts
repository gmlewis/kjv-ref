import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { starterRegions, unlockedRegions, buildRoad, masteryProgress, resolveRefsToVerses } from './regions';
import { KJV_VERSES } from '../data/kjv-verses';
import { _setBibleForTesting } from '../data/kjv-bible';
import type { ProgressEntry } from './types';

const KJV_RAW = readFileSync(join(__dirname, '../../kjv.txt'), 'utf-8');

describe('starterRegions', () => {
  it('returns 3 regions', () => {
    expect(starterRegions().length).toBe(3);
  });
  it('partitions all curated verses by difficulty', () => {
    const regions = starterRegions();
    const allRefs = regions.flatMap(r => r.verses.map(v => v.reference)).sort();
    const curated = KJV_VERSES.map(v => v.reference).sort();
    expect(allRefs).toEqual(curated);
  });
  it('region 1 is easy and always unlocked', () => {
    const r1 = starterRegions()[0];
    expect(r1.verses.every(v => v.difficulty === 'easy')).toBe(true);
    expect(r1.unlockRequirement.masteredInPriorRegions).toBe(0);
  });
  it('region 2 is medium, region 3 is hard', () => {
    const r = starterRegions();
    expect(r[1].verses.every(v => v.difficulty === 'medium')).toBe(true);
    expect(r[2].verses.every(v => v.difficulty === 'hard')).toBe(true);
  });
  it('uses the fixed region ids and names', () => {
    const r = starterRegions();
    expect(r.map(x => x.id)).toEqual(['gate', 'hills', 'river']);
    expect(r.map(x => x.name)).toEqual(['The Gate', 'The Hills', 'The River']);
  });
  it('has the documented unlock requirements', () => {
    const r = starterRegions();
    expect(r[0].unlockRequirement.masteredInPriorRegions).toBe(0);
    expect(r[1].unlockRequirement.masteredInPriorRegions).toBe(5);
    expect(r[2].unlockRequirement.masteredInPriorRegions).toBe(12);
  });
});

describe('unlockedRegions', () => {
  const regions = starterRegions();
  it('region 1 always unlocked', () => {
    expect(unlockedRegions(regions, 0).map(r => r.id)).toEqual(['gate']);
  });
  it('region 2 unlocks at 5 mastered', () => {
    expect(unlockedRegions(regions, 5).map(r => r.id)).toEqual(['gate', 'hills']);
    expect(unlockedRegions(regions, 4).map(r => r.id)).toEqual(['gate']);
  });
  it('region 3 unlocks at 12 mastered', () => {
    expect(unlockedRegions(regions, 12).map(r => r.id)).toEqual(['gate', 'hills', 'river']);
    expect(unlockedRegions(regions, 11).map(r => r.id)).toEqual(['gate', 'hills']);
  });
  it('returns regions in order', () => {
    expect(unlockedRegions(regions, 100).map(r => r.id)).toEqual(['gate', 'hills', 'river']);
  });
});

describe('buildRoad', () => {
  it('constructs a region from references', () => {
    const refs = ['John 3:16', 'Psalm 23:1'];
    const road = buildRoad('My Road', refs, KJV_VERSES);
    expect(road.verses.map(v => v.reference)).toEqual(refs);
    expect(road.name).toBe('My Road');
    expect(road.unlockRequirement.masteredInPriorRegions).toBe(0);
  });
  it('skips unknown references', () => {
    const road = buildRoad('Road', ['John 3:16', 'Not A Verse 9:99'], KJV_VERSES);
    expect(road.verses.map(v => v.reference)).toEqual(['John 3:16']);
  });
  it('id is a stable slug of the name', () => {
    expect(buildRoad('Romans 8 Spur', [], KJV_VERSES).id).toBe('romans-8-spur');
  });
  it('preserves refs order', () => {
    const refs = ['Psalm 23:1', 'John 3:16', 'Genesis 1:1'];
    const road = buildRoad('Ordered', refs, KJV_VERSES);
    expect(road.verses.map(v => v.reference)).toEqual(refs);
  });
  it('produces empty verses for no matches', () => {
    const road = buildRoad('Empty', ['Unknown 1:1'], KJV_VERSES);
    expect(road.verses).toEqual([]);
    expect(road.id).toBe('empty');
  });
});

describe('masteryProgress', () => {
  it('counts mastered lamps', () => {
    const regions = starterRegions();
    const region = regions[0];
    const mastered = region.verses.slice(0, 2).map(v => v.reference);
    const progress: ProgressEntry[] = mastered.map(r => ({ verse: { reference: r }, status: 'mastered', timesRecited: 10, streak: 6, accuracy: 95 }));
    const mp = masteryProgress(region, progress);
    expect(mp.lit).toBe(2);
    expect(mp.total).toBe(region.verses.length);
  });
  it('ignores non-mastered entries', () => {
    const regions = starterRegions();
    const region = regions[0];
    const ref0 = region.verses[0].reference;
    const progress: ProgressEntry[] = [{ verse: { reference: ref0 }, status: 'reviewing', timesRecited: 3, streak: 2, accuracy: 80 }];
    expect(masteryProgress(region, progress).lit).toBe(0);
  });
  it('only counts entries that match region verses', () => {
    const regions = starterRegions();
    const region = regions[0];
    const outside = regions[1].verses[0].reference;
    const progress: ProgressEntry[] = [{ verse: { reference: outside }, status: 'mastered', timesRecited: 5, streak: 3, accuracy: 90 }];
    expect(masteryProgress(region, progress).lit).toBe(0);
  });
  it('returns total = region verses length with empty progress', () => {
    const regions = starterRegions();
    const region = regions[0];
    const mp = masteryProgress(region, []);
    expect(mp.lit).toBe(0);
    expect(mp.total).toBe(region.verses.length);
  });
});
describe('resolveRefsToVerses', () => {
  beforeAll(() => _setBibleForTesting(KJV_RAW));

  it('reuses curated verses by their full record', async () => {
    const out = await resolveRefsToVerses(['Psalm 23:1'], KJV_VERSES);
    expect(out.length).toBe(1);
    expect(out[0].reference).toBe('Psalm 23:1');
    // Curated record carries keywords/difficulty/theme, not the stub defaults.
    expect(out[0].keywords.length).toBeGreaterThan(0);
    expect(out[0].theme).toBe('faith');
  });

  it('fetches a non-curated verse from the full Bible', async () => {
    // John 3:17 is not in the curated set (only John 3:16 is).
    const out = await resolveRefsToVerses(['John 3:17'], KJV_VERSES);
    expect(out.length).toBe(1);
    expect(out[0].reference).toBe('John 3:17');
    expect(out[0].text.length).toBeGreaterThan(0);
    expect(out[0].difficulty).toBe('medium');
    expect(out[0].theme).toBe('custom');
    expect(out[0].keywords).toEqual([]);
  });

  it('expands a verse range into one verse per lamp', async () => {
    const out = await resolveRefsToVerses(['John 3:1-3'], KJV_VERSES);
    expect(out.map((v) => v.reference)).toEqual(['John 3:1', 'John 3:2', 'John 3:3']);
  });

  it('mixes curated, non-curated, and ranges, dropping duplicates', async () => {
    const out = await resolveRefsToVerses(
      ['Psalm 23:1', 'John 3:1-2', 'Psalm 23:1'],
      KJV_VERSES,
    );
    expect(out.map((v) => v.reference)).toEqual(['Psalm 23:1', 'John 3:1', 'John 3:2']);
  });

  it('skips references not found in the Bible', async () => {
    const out = await resolveRefsToVerses(['Hezekiah 99:99'], KJV_VERSES);
    expect(out).toEqual([]);
  });
});
