import { describe, it, expect } from 'vitest';
import { cleanText, stripGreekApparatus } from './build-interlinear';

// ─── cleanText ───────────────────────────────────────────────────────────────

describe('cleanText', () => {
  it('strips the StatResGNT markup characters and collapses whitespace', () => {
    expect(cleanText('και ˚ευθεως¶  ηναγκασεν')).toBe('και ευθεως ηναγκασεν');
  });

  it('trims', () => {
    expect(cleanText('  λογος  ')).toBe('λογος');
  });
});

// ─── stripGreekApparatus ─────────────────────────────────────────────────────
//
// scrollmapper's TR.json carries four kinds of non-Scriptural material inline.
// Each case below is a real verse from the shipped data.

describe('stripGreekApparatus', () => {
  it('removes a trailing epistle subscription (hypographe)', () => {
    // 1Cor.16.24 — the reported bug: the colophon ran on past the KJV's "Amen."
    expect(
      stripGreekApparatus('η αγαπη μου μετα παντων υμων εν χριστω ιησου αμην [ προς κορινθιους πρωτη εγραφη απο φιλιππων]')
    ).toBe('η αγαπη μου μετα παντων υμων εν χριστω ιησου αμην');
  });

  it('removes a subscription even when the verse also opens with a verse note', () => {
    // 2Cor.13.14
    expect(
      stripGreekApparatus('(13:13) η χαρις του κυριου ιησου χριστου μετα παντων υμων αμην [ προς κορινθιους δευτερα εγραφη]')
    ).toBe('η χαρις του κυριου ιησου χριστου μετα παντων υμων αμην');
  });

  it('keeps a bracket that is not a trailing subscription', () => {
    // Only a trailing span is a colophon; a mid-verse bracket is left for a
    // human to look at rather than silently deleted.
    expect(stripGreekApparatus('λογος [τι] αλλος')).toBe('λογος [τι] αλλος');
  });

  it('removes inline versification notes', () => {
    // Mat.20.4 ends with the source's "(20:5)" cross-reference.
    expect(stripGreekApparatus('κακεινοις ειπεν υπαγετε (20:5) οι δε απηλθον')).toBe(
      'κακεινοις ειπεν υπαγετε οι δε απηλθον'
    );
    // Mat.23.13 opens with one.
    expect(stripGreekApparatus('(23:14) ουαι δε υμιν γραμματεις')).toBe('ουαι δε υμιν γραμματεις');
  });

  it('removes stray morphology codes', () => {
    // Col.4.10
    expect(stripGreekApparatus('βαρναβα 921 {N-GSM} {N-DSM} περι ου')).toBe('βαρναβα περι ου');
  });

  it('removes stray Strong\'s numbers stranded mid-sentence', () => {
    // Mark.6.45 — "εμβηναι {G1684} εις το πλοιον"
    expect(stripGreekApparatus('εμβηναι 1684 εις το πλοιον')).toBe('εμβηναι εις το πλοιον');
    // Rev.7.4 — the Greek numeral ρμδ ("144") is text and must survive; 1540 is not.
    expect(stripGreekApparatus('εσφραγισμενων ρμδ 1540 χιλιαδες')).toBe('εσφραγισμενων ρμδ χιλιαδες');
    // Heb.3.6 — a stray zero
    expect(stripGreekApparatus('εανπερ 0 την παρρησιαν')).toBe('εανπερ την παρρησιαν');
  });

  it('leaves clean text untouched', () => {
    expect(stripGreekApparatus('εν αρχη εποιησεν ο θεος')).toBe('εν αρχη εποιησεν ο θεος');
  });
});
