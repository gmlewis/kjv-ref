import { describe, it, expect, beforeEach } from 'vitest';
import { setAudioMuted, isAudioMuted, playTileSnapSound, playTileErrorSound, playLampLitSound } from './audio';

describe('audio synth module', () => {
  beforeEach(() => {
    setAudioMuted(true);
  });

  it('toggles audio muted state correctly', () => {
    expect(isAudioMuted()).toBe(true);
    setAudioMuted(false);
    expect(isAudioMuted()).toBe(false);
    setAudioMuted(true);
    expect(isAudioMuted()).toBe(true);
  });

  it('safely handles sound calls when muted without throwing', () => {
    setAudioMuted(true);
    expect(() => playTileSnapSound()).not.toThrow();
    expect(() => playTileErrorSound()).not.toThrow();
    expect(() => playLampLitSound(3)).not.toThrow();
  });
});
