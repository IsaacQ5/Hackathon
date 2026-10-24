/** Tiny WebAudio sound effects — no audio files needed. */
class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  /** Call from a click handler so browsers allow audio. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) this.ctx = new Ctor();
      }
      void this.ctx?.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + durMs / 1000);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durMs / 1000 + 0.02);
  }

  pickup(value: number): void {
    if (value > 1) {
      this.tone(660, 90, 'triangle', 0.14);
      setTimeout(() => this.tone(990, 160, 'triangle', 0.14), 70);
    } else {
      this.tone(880, 90, 'square', 0.05, 1320);
    }
  }

  tick(final = false): void {
    this.tone(final ? 880 : 440, final ? 400 : 140, 'sine', 0.15);
  }

  end(): void {
    this.tone(523, 180, 'triangle', 0.15);
    setTimeout(() => this.tone(659, 180, 'triangle', 0.15), 160);
    setTimeout(() => this.tone(784, 420, 'triangle', 0.15), 320);
  }
}

export const sfx = new Sfx();
