export class GameAudio {
  private context?: AudioContext;
  play(kind: 'ui' | 'jump' | 'win', enabled: boolean) {
    if (!enabled) return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      void ctx.resume().catch(() => {});
      const notes = kind === 'win' ? [392, 494, 587, 784] : kind === 'jump' ? [320, 190] : [520];
      for (const [i, frequency] of notes.entries()) {
        const start = ctx.currentTime + i * .085, oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .8, start + .16);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .2);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + .21);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
    } catch { /* Audio is optional. */ }
  }
}
