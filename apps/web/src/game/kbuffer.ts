import type { ChefSnap, GameSnapshot, KitchenEvent } from '@tilt-mayhem/shared';

export interface Frame {
  snap: GameSnapshot;
  chefs: ChefSnap[];
  timeLeftMs: number;
  countdownMs: number;
}

interface Entry {
  snap: GameSnapshot;
  recv: number;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Recent snapshots, blended ~100 ms behind live for smooth motion. Events are queued so none are missed. */
export class KitchenBuffer {
  private entries: Entry[] = [];
  private offset: number | null = null;
  private events: KitchenEvent[] = [];
  delayMs = 100;

  push(snap: GameSnapshot, recv: number = performance.now()) {
    const last = this.entries[this.entries.length - 1];
    if (last && snap.tick < last.snap.tick) {
      this.entries = [];
      this.offset = null;
    } else if (last && snap.tick === last.snap.tick) {
      return;
    }
    this.entries.push({ snap, recv });
    if (this.entries.length > 40) this.entries.shift();
    const sample = recv - snap.serverTime;
    if (this.offset === null || sample < this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.02;
    if (snap.events.length) this.events.push(...snap.events);
  }

  reset() {
    this.entries = [];
    this.offset = null;
    this.events = [];
  }

  drainEvents(): KitchenEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  frame(now: number = performance.now()): Frame | null {
    const n = this.entries.length;
    if (n === 0 || this.offset === null) return null;
    const target = now - this.offset - this.delayMs;
    let a = this.entries[0]!;
    let b = a;
    if (target >= this.entries[n - 1]!.snap.serverTime) {
      a = b = this.entries[n - 1]!;
    } else {
      for (let i = 0; i < n - 1; i++) {
        const cur = this.entries[i]!;
        const next = this.entries[i + 1]!;
        if (target >= cur.snap.serverTime && target < next.snap.serverTime) {
          a = cur;
          b = next;
          break;
        }
      }
    }
    const span = b.snap.serverTime - a.snap.serverTime;
    const t = span > 0 ? Math.min(1, Math.max(0, (target - a.snap.serverTime) / span)) : 1;
    const prev = new Map(a.snap.chefs.map((c) => [c.id, c]));
    const chefs = b.snap.chefs.map((cb) => {
      const ca = prev.get(cb.id) ?? cb;
      return { ...cb, x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t, facing: lerpAngle(ca.facing, cb.facing, t) };
    });
    return {
      snap: b.snap,
      chefs,
      timeLeftMs: a.snap.timeLeftMs + (b.snap.timeLeftMs - a.snap.timeLeftMs) * t,
      countdownMs: a.snap.countdownMs + (b.snap.countdownMs - a.snap.countdownMs) * t,
    };
  }
}
