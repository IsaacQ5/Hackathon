import type { ArenaId, GamePhase, GameSnapshot, PublicPlayer } from '@tilt-mayhem/shared';

export interface RenderPlayer extends PublicPlayer {
  /** Approximate velocity in units/s, for facing direction. */
  vx: number;
  vy: number;
}

export interface RenderFrame {
  phase: GamePhase;
  tick: number;
  players: RenderPlayer[];
  arena: ArenaId;
  platformScale: number;
  timeLeftMs: number;
  countdownMs: number;
}

interface Entry {
  snap: GameSnapshot;
  recv: number;
}

/**
 * Holds recent server snapshots and produces smoothly interpolated frames.
 * Rendering runs ~INTERP_DELAY behind the newest data so there is almost
 * always a pair of snapshots to blend between.
 */
export class SnapshotBuffer {
  private entries: Entry[] = [];
  /** Estimated (local clock - server clock) at minimum latency. */
  private offset: number | null = null;
  delayMs = 100;

  push(snap: GameSnapshot, recv: number = performance.now()): void {
    const last = this.entries[this.entries.length - 1];
    if (last && snap.tick < last.snap.tick) {
      // Server restarted the tick counter? Start fresh.
      this.entries = [];
      this.offset = null;
    } else if (last && snap.tick === last.snap.tick) {
      return;
    }
    this.entries.push({ snap, recv });
    if (this.entries.length > 40) this.entries.shift();

    const sample = recv - snap.serverTime;
    if (this.offset === null || sample < this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.02; // drift slowly if latency rises
  }

  reset(): void {
    this.entries = [];
    this.offset = null;
  }

  latest(): GameSnapshot | null {
    return this.entries[this.entries.length - 1]?.snap ?? null;
  }

  frame(now: number = performance.now()): RenderFrame | null {
    const n = this.entries.length;
    if (n === 0 || this.offset === null) return null;
    const target = now - this.offset - this.delayMs;

    let a = this.entries[0]!;
    let b = a;
    if (target >= this.entries[n - 1]!.snap.serverTime) {
      a = b = this.entries[n - 1]!;
      if (n > 1) a = this.entries[n - 2]!;
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
    const dtSec = span > 0 ? span / 1000 : 1;

    const prev = new Map(a.snap.players.map((p) => [p.id, p]));
    const players: RenderPlayer[] = b.snap.players.map((pb) => {
      const pa = prev.get(pb.id) ?? pb;
      return {
        ...pb,
        x: pa.x + (pb.x - pa.x) * t,
        y: pa.y + (pb.y - pa.y) * t,
        vx: (pb.x - pa.x) / dtSec,
        vy: (pb.y - pa.y) / dtSec,
      };
    });

    return {
      phase: t < 1 ? a.snap.phase : b.snap.phase,
      tick: b.snap.tick,
      players,
      arena: b.snap.arena,
      platformScale: a.snap.platformScale + (b.snap.platformScale - a.snap.platformScale) * t,
      timeLeftMs: a.snap.timeLeftMs + (b.snap.timeLeftMs - a.snap.timeLeftMs) * t,
      countdownMs: a.snap.countdownMs + (b.snap.countdownMs - a.snap.countdownMs) * t,
    };
  }
}
