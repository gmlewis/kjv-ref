import { describe, it, expect } from 'vitest';
import { sessionModeFor } from './sessionMode';

describe('sessionModeFor', () => {
  it('maps recall to recall', () => {
    expect(sessionModeFor('recall')).toBe('recall');
  });

  it('maps multiple-choice to multiple-choice', () => {
    expect(sessionModeFor('multiple-choice')).toBe('multiple-choice');
  });

  it('maps reference to reference', () => {
    expect(sessionModeFor('reference')).toBe('reference');
  });

  it('maps lamp-path to the game bucket', () => {
    expect(sessionModeFor('lamp-path')).toBe('game');
  });

  it('maps the remaining practice modes to fill-blank (unchanged behavior)', () => {
    expect(sessionModeFor('word-bank')).toBe('fill-blank');
    expect(sessionModeFor('vanishing-cloze')).toBe('fill-blank');
    expect(sessionModeFor('first-letters')).toBe('fill-blank');
    expect(sessionModeFor('simplified-vanishing-cloze')).toBe('fill-blank');
  });
});