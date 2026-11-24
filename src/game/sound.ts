let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playChime(
  kind: 'pickup' | 'lantern' | 'success' | 'ceremony' | 'error' | 'beat',
  enabled: boolean
): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notesByKind: Record<typeof kind, number[]> = {
      pickup: [523.25, 659.25],
      lantern: [587.33, 783.99],
      success: [523.25, 659.25, 783.99],
      ceremony: [392.0, 523.25, 659.25, 783.99, 1046.5],
      error: [261.63, 220.0],
      beat: [783.99],
    };

    const notes = notesByKind[kind];
    const start = ctx.currentTime;
    const peakGain = kind === 'beat' ? 0.04 : 0.07;
    const noteDuration = kind === 'beat' ? 0.14 : 0.32;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'error' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start + idx * 0.08);
      gain.gain.setValueAtTime(0.001, start + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + idx * 0.08 + noteDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + idx * 0.08);
      osc.stop(start + idx * 0.08 + noteDuration + 0.03);
    });
  } catch {
    // Audio playback is strictly optional enhancement
  }
}