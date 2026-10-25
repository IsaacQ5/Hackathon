import type { StationId } from './kitchen.js';

/**
 * Phone gesture recognisers for the six stations. Pure functions of sensor
 * samples (no DOM), so they can be unit-tested with synthetic motion.
 *
 * Everything is measured relative to GRAVITY, not the phone's own axes, so
 * it works however the phone is held and regardless of the sign conventions
 * that differ between iOS and Android:
 *   v  = acceleration along gravity (up/down)
 *   hx = horizontal acceleration along the phone's left/right edge
 *   hy = horizontal acceleration along the phone's top/bottom edge
 */

export interface MotionSample {
  /** ms */
  t: number;
  /** Linear acceleration, gravity removed (m/s^2), device axes. */
  ax: number;
  ay: number;
  az: number;
  /** Gravity vector (m/s^2), device axes, any sign convention. */
  gx: number;
  gy: number;
  gz: number;
  /** Rotation rate (deg/s): alpha = about z, beta = about x, gamma = about y. */
  ra: number;
  rb: number;
  rg: number;
}

export type RepResult = 'good' | 'bad' | null;

export interface GestureDetector {
  push(s: MotionSample): RepResult;
  /** 0..1: how strongly the current motion matches (drives a live meter). */
  energy(): number;
  /** Coaching text for right now. */
  prompt(): string;
  reset(): void;
}

// ------------------------------------------------------------------ vector helpers

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-6 ? scale(a, 1 / l) : [0, 0, 1];
};

/** Split a sample into gravity-relative components. */
export function decompose(s: MotionSample): { v: number; hx: number; hy: number; g: V3 } {
  const g = norm([s.gx, s.gy, s.gz]);
  const a: V3 = [s.ax, s.ay, s.az];
  // Horizontal basis: the phone's x axis (or y if x is near-vertical) flattened onto the floor plane.
  let ex = sub([1, 0, 0], scale(g, g[0]));
  if (len(ex) < 0.3) ex = sub([0, 1, 0], scale(g, g[1]));
  ex = norm(ex);
  const ey = norm(cross(g, ex));
  return { v: dot(a, g), hx: dot(a, ex), hy: dot(a, ey), g };
}

/** Rolling max of |value| over a time window. */
class WindowMax {
  private items: { t: number; v: number }[] = [];
  constructor(private readonly ms: number) {}
  push(t: number, v: number) {
    this.items.push({ t, v: Math.abs(v) });
    while (this.items.length && t - this.items[0]!.t > this.ms) this.items.shift();
  }
  max() {
    return this.items.reduce((m, i) => Math.max(m, i.v), 0);
  }
  clear() {
    this.items = [];
  }
}

// ------------------------------------------------------------------ 1. CHOP: sharp up/down strokes

export class ChopDetector implements GestureDetector {
  private last = -1e9;
  private e = 0;
  private tooSide = false;

  push(s: MotionSample): RepResult {
    const { v, hx, hy } = decompose(s);
    const vert = Math.abs(v);
    const side = Math.hypot(hx, hy);
    this.e = Math.max(this.e * 0.9, Math.min(1, vert / 14));
    this.tooSide = side > 9 && side > vert;
    if (vert > 11 && vert > side * 1.1 && s.t - this.last > 160) {
      this.last = s.t;
      return 'good';
    }
    return null;
  }
  energy() {
    return this.e;
  }
  prompt() {
    return this.tooSide ? 'Straight DOWN, like a knife!' : 'CHOP! CHOP! CHOP!';
  }
  reset() {
    this.last = -1e9;
    this.e = 0;
  }
}

// ------------------------------------------------------------------ 2. FLIP: flick the front of the phone up

/** Flick strength (deg/s-ish) that counts as a flip, and what counts as settled again. */
const FLIP_AT = 120;
const FLIP_SETTLED = 70;

export class FlipDetector implements GestureDetector {
  private phase: 'idle' | 'cool' = 'idle';
  private t0 = 0;
  private e = 0;
  private msg = 'Flick it up!';
  private prevG: V3 | null = null;
  private prevT = 0;

  push(s: MotionSample): RepResult {
    const gyro = s.ra !== 0 || s.rb !== 0 || s.rg !== 0;
    const { v, g } = decompose(s);
    // Three ways to see a flick, whichever is strongest:
    //  1. Gyro: rotation about a horizontal axis (front, side or corner coming up). Spinning the
    //     phone flat like a steering wheel is rotation about z (alpha) and doesn't count.
    //  2. How fast the phone is actually tipping, measured from the gravity direction. This works
    //     on every phone, whatever units (or lack of) its gyro reports.
    //  3. The upward jolt of the flick itself.
    const rot = gyro ? Math.hypot(s.rb, s.rg) : 0;
    const spin = gyro ? Math.abs(s.ra) : 0;
    let tipRate = 0;
    if (this.prevG && s.t > this.prevT) {
      const deg = (Math.acos(Math.max(-1, Math.min(1, dot(g, this.prevG)))) * 180) / Math.PI;
      tipRate = deg / ((s.t - this.prevT) / 1000);
    }
    this.prevG = g;
    this.prevT = s.t;
    const mag = Math.max(rot >= spin * 0.9 ? rot : 0, tipRate, Math.abs(v) * 22);
    this.e = Math.max(this.e * 0.9, Math.min(1, mag / 250));

    if (this.phase === 'cool') {
      // Wait for the pan to settle (this also swallows the return swing), but not for long.
      if ((s.t - this.t0 > 180 && mag < FLIP_SETTLED) || s.t - this.t0 > 550) this.phase = 'idle';
      return null;
    }
    if (rot > 2600) {
      this.phase = 'cool';
      this.t0 = s.t;
      this.msg = 'Whoa! Too wild, the food flew off!';
      return 'bad';
    }
    // Count the flick the moment it happens; a slow tilt or a flat twist doesn't count.
    if (mag > FLIP_AT) {
      this.phase = 'cool';
      this.t0 = s.t;
      this.msg = 'Nice flip!';
      return 'good';
    }
    return null;
  }
  energy() {
    return this.e;
  }
  prompt() {
    return this.msg;
  }
  reset() {
    this.phase = 'idle';
    this.e = 0;
    this.msg = 'Flick it up!';
    this.prevG = null;
    this.prevT = 0;
  }
}

// ------------------------------------------------------------------ 3. STIR: full circles in the horizontal plane

export class StirDetector implements GestureDetector {
  private prev: number | null = null;
  private acc = 0;
  private quietSince = 0;
  private msg = 'Big circles!';

  push(s: MotionSample): RepResult {
    const { hx, hy } = decompose(s);
    const mag = Math.hypot(hx, hy);
    if (mag < 1.0) {
      if (!this.quietSince) this.quietSince = s.t;
      if (s.t - this.quietSince > 600) {
        this.acc *= 0.9;
        this.prev = null;
      }
      return null;
    }
    this.quietSince = 0;
    const ang = Math.atan2(hy, hx);
    if (this.prev !== null) {
      let d = ang - this.prev;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) > 1.0) {
        // A jump in direction = back-and-forth shaking, not a circle.
        this.acc *= 0.5;
        this.msg = 'Smooth circles, not shaking!';
      } else {
        this.acc += d;
        this.msg = 'Keep going round!';
      }
    }
    this.prev = ang;
    if (Math.abs(this.acc) >= Math.PI * 2 * 0.85) {
      this.acc = 0;
      this.msg = 'One full stir!';
      return 'good';
    }
    return null;
  }
  energy() {
    return Math.min(1, Math.abs(this.acc) / (Math.PI * 2 * 0.85));
  }
  prompt() {
    return this.msg;
  }
  reset() {
    this.prev = null;
    this.acc = 0;
    this.msg = 'Big circles!';
  }
}

// ------------------------------------------------------------------ shared: alternating strokes on one axis

/**
 * Counts strokes that alternate direction along one horizontal axis while the
 * other axis stays quiet (so circles don't count). Returns the period of each
 * completed stroke pair for rhythm checks.
 */
class AlternationTracker {
  private lastSign = 0;
  private lastT = 0;
  private otherMax = new WindowMax(320);
  private mainMax = new WindowMax(320);

  constructor(
    private readonly min: number,
    private readonly maxAmp: number,
    /** How loud the other axis may be, relative to the main one. */
    private readonly cleanRatio = 0.55,
  ) {}

  /** Returns 'stroke' when the motion reverses direction cleanly, 'violent' if too hard. */
  push(t: number, main: number, other: number): { kind: 'stroke' | 'violent' | null; dt: number } {
    this.otherMax.push(t, other);
    this.mainMax.push(t, main);
    const a = Math.abs(main);
    // Any recent stroke that was too hard poisons the window (wild flailing).
    if (a > this.maxAmp || this.mainMax.max() > this.maxAmp) return { kind: 'violent', dt: 0 };
    if (a < this.min) return { kind: null, dt: 0 };
    const sign = Math.sign(main);
    if (sign === this.lastSign) return { kind: null, dt: 0 };
    const clean = this.otherMax.max() < this.mainMax.max() * this.cleanRatio;
    const dt = t - this.lastT;
    const first = this.lastSign === 0;
    this.lastSign = sign;
    this.lastT = t;
    if (first || !clean) return { kind: null, dt: 0 };
    return { kind: 'stroke', dt };
  }

  reset() {
    this.lastSign = 0;
    this.lastT = 0;
    this.otherMax.clear();
    this.mainMax.clear();
  }
}

// ------------------------------------------------------------------ 4. KNEAD: forward/back strokes

export class KneadDetector implements GestureDetector {
  private tr = new AlternationTracker(2.9, 30, 0.65);
  private push_ = true;
  private e = 0;
  private msg = 'Push... and pull...';

  push(s: MotionSample): RepResult {
    const { hx, hy } = decompose(s);
    this.e = Math.max(this.e * 0.93, Math.min(1, Math.abs(hy) / 4));
    const r = this.tr.push(s.t, hy, hx);
    if (r.kind !== 'stroke') return null;
    if (r.dt < 170) {
      // Frantic shaking does not knead dough.
      this.msg = 'Slow down! Bigger pushes.';
      return null;
    }
    if (r.dt > 1600) {
      this.msg = 'Push... and pull...';
      return null;
    }
    // Every push and every pull counts.
    this.push_ = !this.push_;
    this.msg = this.push_ ? 'Push!' : 'Pull!';
    return 'good';
  }
  energy() {
    return this.e;
  }
  prompt() {
    return this.msg;
  }
  reset() {
    this.tr.reset();
    this.push_ = true;
    this.e = 0;
    this.msg = 'Push... and pull...';
  }
}

// ------------------------------------------------------------------ 5. MIX: small controlled side-to-side shakes

export class MixDetector implements GestureDetector {
  private tr = new AlternationTracker(2.2, 24);
  private e = 0;
  private msg = 'Left, right, left, right!';

  push(s: MotionSample): RepResult {
    const { hx, hy } = decompose(s);
    this.e = Math.max(this.e * 0.9, Math.min(1, Math.abs(hx) / 8));
    const r = this.tr.push(s.t, hx, hy);
    if (r.kind === 'violent') {
      this.msg = 'Gentle! Small shakes.';
      return null;
    }
    if (r.kind !== 'stroke') return null;
    if (r.dt < 80 || r.dt > 700) return null;
    this.msg = 'Mixing!';
    return 'good';
  }
  energy() {
    return this.e;
  }
  prompt() {
    return this.msg;
  }
  reset() {
    this.tr.reset();
    this.e = 0;
  }
}

// ------------------------------------------------------------------ 6. POUR: tilt sideways, then back

export type PourStage = 'upright' | 'sideways';

/**
 * How far gravity must swing onto the phone's short (x) axis: past `sideways` counts as
 * tipped over, back under `upright` counts as returned. One tilt over + back = one pour.
 */
export const POUR = { sideways: 0.75, upright: 0.4 } as const;

export class PourDetector implements GestureDetector {
  private stage: PourStage = 'upright';
  /** 0..1 how far the phone is tipped sideways right now. */
  tilt = 0;

  push(s: MotionSample): RepResult {
    const g = norm([s.gx, s.gy, s.gz]);
    this.tilt = Math.min(1, Math.abs(g[0]) / POUR.sideways);
    if (this.stage === 'upright' && Math.abs(g[0]) > POUR.sideways) {
      this.stage = 'sideways';
      return null;
    }
    if (this.stage === 'sideways' && Math.abs(g[0]) < POUR.upright) {
      this.stage = 'upright';
      return 'good';
    }
    return null;
  }

  getStage(): PourStage {
    return this.stage;
  }
  energy() {
    return this.tilt;
  }
  prompt() {
    return this.stage === 'upright' ? 'Tilt it SIDEWAYS…' : '…and back UP!';
  }
  reset() {
    this.stage = 'upright';
    this.tilt = 0;
  }
}

export function createDetector(station: StationId): GestureDetector {
  switch (station) {
    case 'chop':
      return new ChopDetector();
    case 'fry':
      return new FlipDetector();
    case 'stir':
      return new StirDetector();
    case 'knead':
      return new KneadDetector();
    case 'mix':
      return new MixDetector();
    case 'juice':
      return new PourDetector();
  }
}
