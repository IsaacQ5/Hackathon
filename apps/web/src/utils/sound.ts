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

  // ---- Wobble Warriors slapstick sounds (all synthesized)

  private noise(durMs: number, gain = 0.2, lowpass = 1200): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const len = Math.floor((ctx.sampleRate * durMs) / 1000);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  bonk(power: number): void {
    this.tone(220 + Math.min(300, power / 3), 120, 'square', 0.08, 90);
    this.noise(70, 0.18, 900);
  }

  wham(): void {
    this.tone(140, 220, 'sawtooth', 0.1, 50);
    this.noise(140, 0.3, 700);
  }

  yeet(): void {
    this.tone(300, 380, 'triangle', 0.14, 1400);
  }

  boing(): void {
    this.tone(200, 260, 'sine', 0.16, 600);
  }

  slip(): void {
    this.tone(900, 420, 'sine', 0.13, 160);
  }

  pop(): void {
    this.tone(1200, 80, 'square', 0.06, 400);
  }

  fall(): void {
    this.tone(700, 900, 'sine', 0.13, 80);
  }

  splat(): void {
    this.noise(180, 0.32, 500);
  }

  powerup(): void {
    this.tone(520, 90, 'triangle', 0.12);
    setTimeout(() => this.tone(780, 90, 'triangle', 0.12), 80);
    setTimeout(() => this.tone(1040, 140, 'triangle', 0.12), 160);
  }

  warn(): void {
    this.tone(660, 140, 'square', 0.06);
    setTimeout(() => this.tone(520, 160, 'square', 0.06), 160);
  }

  crumble(): void {
    this.noise(260, 0.16, 400);
  }

  ding(): void {
    this.tone(1568, 700, 'sine', 0.18);
    setTimeout(() => this.tone(2093, 500, 'sine', 0.1), 60);
  }

  chop(): void {
    this.noise(40, 0.22, 2500);
    this.tone(320, 50, 'square', 0.05, 160);
  }

  sizzle(): void {
    this.noise(220, 0.08, 6000);
  }

  bloop(): void {
    this.tone(300 + Math.random() * 200, 90, 'sine', 0.1, 700);
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, i === 3 ? 600 : 160, 'triangle', 0.16), i * 140));
  }
}

export const sfx = new Sfx();
