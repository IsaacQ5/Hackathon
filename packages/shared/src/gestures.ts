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

// ------------------------------------------------------------------ 2. FLIP: phone flat, lift the top edge up

/** Lifting the top edge this far from flat is a flip; back within FLIP_FLAT_DEG gets ready for the next. */
const FLIP_LIFT_DEG = 25;
const FLIP_FLAT_DEG = 12;
/** Gyro shortcut: a quick top-edge-up rotation (deg/s about the phone's x axis) also counts. */
const FLIP_PITCH_RATE = 160;

export class FlipDetector implements GestureDetector {
  /** waiting: not flat yet. armed: flat and ready. lifted: just flipped, waiting to come back to flat. */
  private phase: 'waiting' | 'armed' | 'lifted' = 'waiting';
  private liftedAt = 0;
  private e = 0;
  private msg = 'Hold your phone flat…';
  private prevPitch: number | null = null;
  private prevT = 0;

  push(s: MotionSample): RepResult {
    const g = norm([s.gx, s.gy, s.gz]);
    // How far the top edge is tipped from flat: gravity moving off the screen axis (z) onto the
    // long axis (y). Sign conventions differ between phones, so only the size is used.
    const pitch = (Math.atan2(Math.abs(g[1]), Math.abs(g[2])) * 180) / Math.PI;
    const flat = pitch < FLIP_FLAT_DEG && Math.abs(g[0]) < 0.4;
    const gyro = s.ra !== 0 || s.rb !== 0 || s.rg !== 0;
    const pitchRate = gyro ? Math.abs(s.rb) : 0;
    const otherRate = gyro ? Math.max(Math.abs(s.ra), Math.abs(s.rg)) : 0;
    let tipRate = 0;
    if (this.prevPitch !== null && s.t > this.prevT) tipRate = Math.abs(pitch - this.prevPitch) / ((s.t - this.prevT) / 1000);
    this.prevPitch = pitch;
    this.prevT = s.t;
    this.e = Math.max(this.e * 0.9, Math.min(1, Math.max(tipRate, pitchRate >= otherRate ? pitchRate : 0) / 220));

    if (pitchRate > 2600 && this.phase !== 'lifted') {
      this.phase = 'lifted';
      this.liftedAt = s.t;
      this.msg = 'Whoa! Too wild, the food flew off!';
      return 'bad';
    }
    switch (this.phase) {
      case 'waiting':
        if (flat) {
          this.phase = 'armed';
          this.msg = 'Lift the top edge up!';
        }
        return null;
      case 'armed':
        if (pitch > FLIP_LIFT_DEG || (pitchRate > FLIP_PITCH_RATE && pitchRate >= otherRate)) {
          this.phase = 'lifted';
          this.liftedAt = s.t;
          this.msg = 'Nice flip! Back to flat…';
          return 'good';
        }
        return null;
      case 'lifted':
        // Back down to flat (and settled) gets it ready for the next flip.
        if (flat && s.t - this.liftedAt > 200 && pitchRate < 80) {
          this.phase = 'armed';
          this.msg = 'Lift the top edge up!';
        }
        return null;
    }
  }
  energy() {
    return this.e;
  }
  prompt() {
    return this.msg;
  }
  reset() {
    this.phase = 'waiting';
    this.e = 0;
    this.msg = 'Hold your phone flat…';
    this.prevPitch = null;
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
  private e = 0;
  private prevT = 0;

  push(s: MotionSample): RepResult {
    const g = norm([s.gx, s.gy, s.gz]);
    const tilt = Math.min(1, Math.abs(g[0]) / POUR.sideways);
    // Match meter: high while tipping over or coming back (about one tilt per half second = full),
    // fading while held still, so just holding it sideways doesn't count as pouring.
    const dt = this.prevT ? (s.t - this.prevT) / 1000 : 0;
    this.prevT = s.t;
    const rate = dt > 0 ? Math.abs(tilt - this.tilt) / dt : 0;
    this.e = Math.max(this.e * 0.93, Math.min(1, rate / 2));
    this.tilt = tilt;
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
    return this.e;
  }
  prompt() {
    return this.stage === 'upright' ? 'Tilt it SIDEWAYS…' : '…and back UP!';
  }
  reset() {
    this.stage = 'upright';
    this.tilt = 0;
    this.e = 0;
    this.prevT = 0;
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
