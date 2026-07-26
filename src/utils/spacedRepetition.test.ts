import { describe, it, expect } from 'vitest';
import {
  calculateNextReview,
  getInitialSchedule,
  isDue,
  getDaysUntilDue,
  getDifficultyLabel,
  formatVerseReference,
  extractKeywords,
  assessDifficulty,
  calculateStreak,
  formatRelativeDate,
  getProgressPercentage,
  generateBlankVerse,
} from './spacedRepetition';

describe('spacedRepetition utilities', () => {
  describe('getInitialSchedule', () => {
    it('returns initial schedule with 1 day interval', () => {
      const schedule = getInitialSchedule();
      expect(schedule.interval).toBe(1);
      expect(schedule.easeFactor).toBe(2.5);
    });
  });

  describe('calculateNextReview', () => {
    it('increases interval for excellent performance', () => {
      const schedule = getInitialSchedule();
      const next = calculateNextReview(schedule, 'excellent');
      expect(next.interval).toBeGreaterThan(schedule.interval);
      expect(next.easeFactor).toBeGreaterThan(schedule.easeFactor);
    });

    it('keeps same ease factor for good performance', () => {
      const schedule = getInitialSchedule();
      const next = calculateNextReview(schedule, 'good');
      expect(next.easeFactor).toBe(schedule.easeFactor);
      expect(next.interval).toBeGreaterThan(0);
    });

    it('resets interval for poor performance', () => {
      const schedule = getInitialSchedule();
      const next = calculateNextReview(schedule, 'poor');
      expect(next.interval).toBe(1);
      expect(next.easeFactor).toBeLessThan(schedule.easeFactor);
    });
  });

  describe('isDue', () => {
    it('returns true when due date is in the past', () => {
      const schedule = {
        interval: 1,
        easeFactor: 2.5,
        dueDate: new Date(Date.now() - 86400000),
      };
      expect(isDue(schedule)).toBe(true);
    });

    it('returns false when due date is in the future', () => {
      const schedule = {
        interval: 1,
        easeFactor: 2.5,
        dueDate: new Date(Date.now() + 86400000),
      };
      expect(isDue(schedule)).toBe(false);
    });
  });

  describe('getDifficultyLabel', () => {
    it('returns correct label for easy', () => {
      expect(getDifficultyLabel('easy')).toBe('Beginner');
    });

    it('returns correct label for medium', () => {
      expect(getDifficultyLabel('medium')).toBe('Intermediate');
    });

    it('returns correct label for hard', () => {
      expect(getDifficultyLabel('hard')).toBe('Advanced');
    });
  });

  describe('formatVerseReference', () => {
    it('formats reference correctly', () => {
      expect(formatVerseReference('Genesis', 1, 1)).toBe('Genesis 1:1');
    });

    it('handles different books', () => {
      expect(formatVerseReference('John', 3, 16)).toBe('John 3:16');
    });
  });

  describe('extractKeywords', () => {
    it('extracts keywords from text', () => {
      const text = 'In the beginning God created the heaven and the earth';
      const keywords = extractKeywords(text);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('beginning');
      expect(keywords).toContain('God');
      expect(keywords).toContain('created');
    });

    it('filters common words', () => {
      const text = 'the and but for';
      const keywords = extractKeywords(text);
      expect(keywords.length).toBe(0);
    });

    it('respects maxCount', () => {
      const text = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
      const keywords = extractKeywords(text, 5);
      expect(keywords.length).toBeLessThanOrEqual(5);
    });

    it('deduplicates before applying maxCount so later unique keywords are not crowded out', () => {
      // Eleven "love" tokens then a unique "grace". The unfixed code slices to
      // maxCount BEFORE deduping, so the slice is all "love" and "grace" is
      // dropped entirely — even though it is a distinct keyword.
      const text = 'love love love love love love love love love love love grace';
      const keywords = extractKeywords(text, 5);
      expect(keywords).toContain('love');
      expect(keywords).toContain('grace');
      expect(keywords.length).toBeLessThanOrEqual(5);
    });
  });

  describe('assessDifficulty', () => {
    it('classifies short verse as easy', () => {
      const text = 'The LORD is my shepherd';
      expect(assessDifficulty(text)).toBe('easy');
    });

    it('classifies long verse as hard', () => {
      const text = 'For God so loved the world that he gave his only begotten Son that whosoever believeth in him should not perish but have everlasting life';
      expect(assessDifficulty(text)).toBe('hard');
    });

    it('classifies medium verse as medium', () => {
      const text = 'I can do all things through Christ which strengtheneth me';
      expect(assessDifficulty(text)).toBe('medium');
    });

    it('does not let leading/trailing whitespace inflate the word count', () => {
      // A single 5-letter word has average word length 5 (> 4.5), so it is NOT
      // easy. The unfixed code counted the empty tokens produced by
      // split(/\s+/) on padded input, diluting the average and misclassifying
      // the verse as easy.
      expect(assessDifficulty(' hello ')).toBe('medium');
    });

    it('handles empty and whitespace-only input without crashing', () => {
      expect(['easy', 'medium', 'hard']).toContain(assessDifficulty(''));
      expect(['easy', 'medium', 'hard']).toContain(assessDifficulty('   '));
    });
  });

  describe('calculateStreak', () => {
    it('returns 0 for empty array', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('calculates consecutive days', () => {
      // Use noon to avoid midnight boundary issues with differenceInDays
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const dates = [
        new Date(today),
        new Date(today.getTime() - 86400000),
        new Date(today.getTime() - 86400000 * 2),
      ];
      expect(calculateStreak(dates)).toBe(3);
    });

    it('stops at gap', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const dates = [
        new Date(today),
        new Date(today.getTime() - 86400000 * 3),
      ];
      expect(calculateStreak(dates)).toBe(1);
    });

    it('returns 0 when the most recent practice is stale', () => {
      // A streak is only "current" if the most recent practice was today or
      // yesterday. The unfixed code returned 1 for any non-empty array, so a
      // user who last practiced a week ago was shown a phantom 1-day streak.
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const stale = new Date(today.getTime() - 86400000 * 7);
      expect(calculateStreak([stale])).toBe(0);
    });

    it('keeps a 1-day grace for yesterday', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 86400000);
      expect(calculateStreak([yesterday])).toBe(1);
    });
  });

  describe('getProgressPercentage', () => {
    it('calculates percentage correctly', () => {
      expect(getProgressPercentage(5, 10)).toBe(50);
    });

    it('returns 0 when total is 0', () => {
      expect(getProgressPercentage(5, 0)).toBe(0);
    });

    it('returns 100 when current equals total', () => {
      expect(getProgressPercentage(10, 10)).toBe(100);
    });
  });

  describe('generateBlankVerse', () => {
    it('replaces words with blanks', () => {
      const text = 'In the beginning God created the heaven';
      const blanked = generateBlankVerse(text);
      expect(blanked).toContain('_____');
    });

    it('handles short text', () => {
      const text = 'God is love';
      const blanked = generateBlankVerse(text);
      expect(blanked).toBe(text);
    });
  });
});
