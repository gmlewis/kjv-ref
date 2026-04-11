import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrongsPopover } from './StrongsPopover';
import type { StrongsEntry } from '../data/strongs';

const hebrewEntry: StrongsEntry = {
  strongs: 'H1254',
  lemma: 'בָּרָא',
  translit: 'bârâʼ',
  pronunciation: "baw-raw'",
  definition: '(absolutely) to create',
  kjv_def: 'create, creator',
};

const greekEntry: StrongsEntry = {
  strongs: 'G2316',
  lemma: 'θεός',
  translit: 'theós',
  pronunciation: 'theh-os',
  definition: 'a deity, especially the supreme Divinity',
  kjv_def: 'God',
};

describe('StrongsPopover', () => {
  it('renders the Strong\'s number badge', () => {
    render(<StrongsPopover entry={hebrewEntry} onClose={() => {}} />);
    expect(screen.getByText('H1254')).toBeDefined();
  });

  it('renders the lemma', () => {
    render(<StrongsPopover entry={hebrewEntry} onClose={() => {}} />);
    expect(screen.getByText('בָּרָא')).toBeDefined();
  });

  it('renders the transliteration', () => {
    render(<StrongsPopover entry={hebrewEntry} onClose={() => {}} />);
    expect(screen.getByText(/bârâʼ/)).toBeDefined();
  });

  it('renders the definition', () => {
    render(<StrongsPopover entry={hebrewEntry} onClose={() => {}} />);
    expect(screen.getByText(/\(absolutely\) to create/)).toBeDefined();
  });

  it('renders Greek entry', () => {
    render(<StrongsPopover entry={greekEntry} onClose={() => {}} />);
    expect(screen.getByText('G2316')).toBeDefined();
    expect(screen.getByText('θεός')).toBeDefined();
  });
});
