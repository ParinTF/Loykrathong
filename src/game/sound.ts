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

export function startFestivalMusic(): () => void {
  const melody = [293.66, 369.99, 440, 554.37, 440, 369.99, 329.63, 440];
  let step = 0;
  let timer: number | undefined;
  let group: GainNode | undefined;
  let disposed = false;

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
    if (group) {
      const { currentTime } = group.context;
      const previous = group;
      previous.gain.setTargetAtTime(0, currentTime, 0.08);
      window.setTimeout(() => previous.disconnect(), 400);
      group = undefined;
    }
  }

  function sync() {
    if (disposed) return;
    if (document.hidden) {
      stop();
      return;
    }
    if (timer !== undefined) return;
    try {
      const audio = getAudioContext();
      if (!audio || audio.state !== 'running') return;
      const mix = audio.createGain();
      group = mix;
      mix.gain.value = 0.16;
      mix.connect(audio.destination);
      const note = (frequency: number, start: number, length: number, volume: number) => {
        const tone = audio.createOscillator();
        const envelope = audio.createGain();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        envelope.gain.setValueAtTime(0.001, start);
        envelope.gain.exponentialRampToValueAtTime(volume, start + 0.34);
        envelope.gain.exponentialRampToValueAtTime(0.001, start + length);
        tone.connect(envelope);
        envelope.connect(mix);
        tone.onended = () => {
          tone.disconnect();
          envelope.disconnect();
        };
        tone.start(start);
        tone.stop(start + length + 0.1);
      };
      const phrase = () => {
        const start = audio.currentTime + 0.025;
        note(melody[step], start, 2.6, 0.17);
        if (step % 2 === 0) note(melody[(step + 2) % melody.length] * 0.5, start, 3.6, 0.10);
        step = (step + 1) % melody.length;
      };
      phrase();
      timer = window.setInterval(phrase, 1560);
    } catch {
      stop();
    }
  }

  function resumeOnInput() {
    if (disposed || timer !== undefined) return;
    try { void getAudioContext()?.resume().then(sync, () => {}); }
    catch { /* Audio is optional on browsers with a blocked output device. */ }
  }

  sync();
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pointerdown', resumeOnInput);
  window.addEventListener('keydown', resumeOnInput);
  return () => {
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pointerdown', resumeOnInput);
    window.removeEventListener('keydown', resumeOnInput);
  };
}
