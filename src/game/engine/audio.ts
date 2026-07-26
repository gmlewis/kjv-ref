// Web Audio API synthesizer for "Lamp of the Path".
//
// Synthesizes pleasant chimes, tile snaps, and feedback without external audio files.
// Respects sound setting (`settings.sound` in `kjv-game-state`).

let audioCtx: AudioContext | null = null;
let isMuted = true; // default off per spec; loaded from state

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

/** Soft tile snap / drop sound */
export function playTileSnapSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/** Tile error / return sound */
export function playTileErrorSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

/** Ascending chord chime for lamp lighting; frequency scales with combo! */
export function playLampLitSound(combo: number = 0) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Base frequencies: C5, E5, G5, C6 notes with combo pitch shift
  const baseFreqs = [523.25, 659.25, 783.99, 1046.50];
  const pitchMult = 1 + Math.min(combo, 10) * 0.05;

  baseFreqs.forEach((freq, idx) => {
    const startTime = ctx.currentTime + idx * 0.06;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * pitchMult, startTime);

    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}
