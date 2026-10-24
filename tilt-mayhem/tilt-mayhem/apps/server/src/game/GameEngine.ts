import {
  GAME_CONFIG,
  type Collectible,
  type GameConfig,
  type GamePhase,
  type GameSnapshot,
  type PickupEvent,
  type PlayerInput,
  type PublicPlayer,
} from '@tilt-mayhem/shared';
import type { EnginePlayer, InputResult, Standing, UpdateResult } from './types.js';

interface EnginePlayerMeta extends EnginePlayer {
  nickname: string;
  color: string;
}

/**
 * Authoritative game simulation for one room. Has no knowledge of sockets;
 * the caller feeds it wall-clock time and inputs, and reads snapshots back.
 */
export class GameEngine {
  readonly config: GameConfig;
  private readonly random: () => number;
  private readonly tickMs: number;

  private _phase: GamePhase = 'lobby';
  private _tick = 0;
  private readonly players = new Map<string, EnginePlayerMeta>();
  private collectibles: Collectible[] = [];
  private nextCollectibleId = 1;
  /** Ticks at which a replacement collectible should spawn. */
  private respawnQueue: number[] = [];
  private pendingEvents: PickupEvent[] = [];

  private lastUpdateAt: number | null = null;
  private accumulator = 0;
  /** Wall-clock deadlines (ms). */
  private countdownEndsAt = 0;
  private roundEndsAt = 0;

  constructor(config: Partial<GameConfig> = {}, random: () => number = Math.random) {
    this.config = { ...GAME_CONFIG, ...config };
    this.random = random;
    this.tickMs = 1000 / this.config.tickRate;
  }

  // ---------------------------------------------------------------- players

  get phase(): GamePhase {
    return this._phase;
  }

  get tick(): number {
    return this._tick;
  }

  get playerCount(): number {
    return this.players.size;
  }

  hasPlayer(id: string): boolean {
    return this.players.has(id);
  }

  addPlayer(id: string, nickname: string, color: string): void {
    if (this.players.has(id)) return;
    const p: EnginePlayerMeta = {
      id,
      nickname,
      color,
      x: this.config.arenaWidth / 2,
      y: this.config.arenaHeight / 2,
      score: 0,
      input: { x: 0, y: 0 },
      lastSeq: -1,
      connected: true,
    };
    this.players.set(id, p);
    this.layoutPlayers();
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = connected;
    p.input = { x: 0, y: 0 };
    // A new connection starts a fresh input sequence.
    if (connected) p.lastSeq = -1;
  }

  /** Stop a player's movement until their next input (e.g. while they recalibrate). */
  clearInput(id: string): void {
    const p = this.players.get(id);
    if (p) p.input = { x: 0, y: 0 };
  }

  /**
   * Validate and store the latest movement input. The caller should have
   * already checked that the input came from this player's own socket.
   */
  applyInput(id: string, input: PlayerInput): InputResult {
    const p = this.players.get(id);
    if (!p) return 'unknown';
    if (this._phase !== 'playing') return 'phase';
    const { seq, x, y } = input;
    if (!Number.isSafeInteger(seq) || seq < 0) return 'invalid';
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'invalid';
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return 'invalid';
    if (seq <= p.lastSeq) return 'stale';
    p.lastSeq = seq;
    // Limit the vector length to 1 so diagonals are not faster.
    const len = Math.hypot(x, y);
    p.input = len > 1 ? { x: x / len, y: y / len } : { x, y };
    return 'ok';
  }

  // ---------------------------------------------------------------- phases

  /** Start a countdown from the lobby or results phase. Resets scores and positions. */
  startCountdown(now: number): boolean {
    if (this._phase !== 'lobby' && this._phase !== 'results') return false;
    this._phase = 'countdown';
    this.countdownEndsAt = now + this.config.countdownMs;
    this.roundEndsAt = this.countdownEndsAt + this.config.roundDurationMs;
    this.lastUpdateAt = now;
    this.accumulator = 0;
    this.pendingEvents = [];
    this.respawnQueue = [];
    this.collectibles = [];
    for (const p of this.players.values()) {
      p.score = 0;
      p.input = { x: 0, y: 0 };
      p.lastSeq = -1;
    }
    this.layoutPlayers();
    for (let i = 0; i < this.config.collectibleCount; i++) this.spawnCollectible();
    return true;
  }

  /** Return to the lobby (e.g. so new players can join). */
  resetToLobby(): void {
    this._phase = 'lobby';
    this.collectibles = [];
    this.respawnQueue = [];
    this.pendingEvents = [];
    for (const p of this.players.values()) {
      p.score = 0;
      p.input = { x: 0, y: 0 };
    }
    this.layoutPlayers();
  }

  get playStartsAt(): number {
    return this.countdownEndsAt;
  }

  /**
   * Advance the simulation to wall-clock time `now` using a fixed-step
   * accumulator. Runs at most `maxCatchUpTicks` ticks per call; if the server
   * stalled for longer, the extra time is dropped instead of fast-forwarding.
   */
  update(now: number): UpdateResult {
    const result: UpdateResult = { ticks: 0, phaseChanged: null, scoresChanged: false };
    if (this._phase === 'lobby' || this._phase === 'results') {
      this.lastUpdateAt = now;
      return result;
    }
    if (this.lastUpdateAt === null) this.lastUpdateAt = now;
    const elapsed = Math.max(0, now - this.lastUpdateAt);
    this.lastUpdateAt = now;
    this.accumulator += elapsed;

    const maxBacklog = this.tickMs * this.config.maxCatchUpTicks;
    if (this.accumulator > maxBacklog) this.accumulator = maxBacklog;

    // Small epsilon so float error never swallows a whole tick.
    while (this.accumulator + 1e-6 >= this.tickMs) {
      this.accumulator = Math.max(0, this.accumulator - this.tickMs);
      if (this.step(this.tickMs / 1000)) result.scoresChanged = true;
      result.ticks++;
    }

    // Phase transitions use wall-clock deadlines so the round lasts exactly
    // its duration even if ticks were dropped.
    if (this._phase === 'countdown' && now >= this.countdownEndsAt) {
      this._phase = 'playing';
      result.phaseChanged = 'playing';
    }
    if (this._phase === 'playing' && now >= this.roundEndsAt) {
      this._phase = 'results';
      for (const p of this.players.values()) p.input = { x: 0, y: 0 };
      result.phaseChanged = 'results';
    }
    return result;
  }

  /** One fixed simulation tick. Returns true when any score changed. */
  private step(dt: number): boolean {
    this._tick++;
    if (this._phase !== 'playing') return false;

    const { arenaWidth: W, arenaHeight: H, playerRadius: r, maxSpeed } = this.config;
    const list = [...this.players.values()];

    for (const p of list) {
      const ix = p.connected ? p.input.x : 0;
      const iy = p.connected ? p.input.y : 0;
      p.x += ix * maxSpeed * dt;
      p.y += iy * maxSpeed * dt;
    }

    // Gentle separation so characters don't overlap (no momentum physics).
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = r * 2;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }

    for (const p of list) {
      p.x = clamp(p.x, r, W - r);
      p.y = clamp(p.y, r, H - r);
    }

    // Collectibles: each one can be claimed by exactly one player, once.
    let scored = false;
    const reach = r + this.config.collectibleRadius;
    const reach2 = reach * reach;
    const remaining: Collectible[] = [];
    for (const c of this.collectibles) {
      let winner: EnginePlayerMeta | null = null;
      let best = Infinity;
      for (const p of list) {
        if (!p.connected) continue;
        const d2 = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (d2 <= reach2 && d2 < best) {
          best = d2;
          winner = p;
        }
      }
      if (winner) {
        winner.score += c.value;
        scored = true;
        this.pendingEvents.push({ type: 'pickup', playerId: winner.id, x: c.x, y: c.y, value: c.value });
        this.respawnQueue.push(this._tick + this.config.collectibleRespawnTicks);
      } else {
        remaining.push(c);
      }
    }
    this.collectibles = remaining;

    // Respawns that are due.
    const due = this.respawnQueue.filter((t) => t <= this._tick).length;
    if (due > 0) {
      this.respawnQueue = this.respawnQueue.filter((t) => t > this._tick);
      for (let i = 0; i < due; i++) this.spawnCollectible();
    }
    return scored;
  }

  // ---------------------------------------------------------------- spawning

  private spawnCollectible(): void {
    const { arenaWidth: W, arenaHeight: H, collectibleRadius: cr } = this.config;
    const margin = cr + 20;
    let x = W / 2;
    let y = H / 2;
    // Try a few spots that are not right on top of a player or another item.
    for (let attempt = 0; attempt < 20; attempt++) {
      x = margin + this.random() * (W - margin * 2);
      y = margin + this.random() * (H - margin * 2);
      const nearPlayer = [...this.players.values()].some((p) => Math.hypot(p.x - x, p.y - y) < 80);
      const nearItem = this.collectibles.some((c) => Math.hypot(c.x - x, c.y - y) < 60);
      if (!nearPlayer && !nearItem) break;
    }
    const golden = this.random() < this.config.goldenChance;
    this.collectibles.push({
      id: this.nextCollectibleId++,
      x,
      y,
      value: golden ? this.config.goldenValue : this.config.normalValue,
    });
  }

  /** Test/debug helper: place a collectible at an exact position. */
  placeCollectible(x: number, y: number, value = this.config.normalValue): number {
    const id = this.nextCollectibleId++;
    this.collectibles.push({ id, x, y, value });
    return id;
  }

  /** Test/debug helper: remove all collectibles. */
  clearCollectibles(): void {
    this.collectibles = [];
    this.respawnQueue = [];
  }

  /** Test/debug helper: teleport a player. */
  setPlayerPosition(id: string, x: number, y: number): void {
    const p = this.players.get(id);
    if (p) {
      p.x = x;
      p.y = y;
    }
  }

  /** Spread players evenly on an ellipse around the arena centre. */
  private layoutPlayers(): void {
    const list = [...this.players.values()];
    const cx = this.config.arenaWidth / 2;
    const cy = this.config.arenaHeight / 2;
    const rx = this.config.arenaWidth * 0.32;
    const ry = this.config.arenaHeight * 0.3;
    list.forEach((p, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, list.length);
      p.x = cx + Math.cos(a) * rx;
      p.y = cy + Math.sin(a) * ry;
    });
  }

  // ---------------------------------------------------------------- output

  publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      x: round1(p.x),
      y: round1(p.y),
      score: p.score,
      connected: p.connected,
    }));
  }

  /** Build a snapshot. Drains pending one-off events. */
  snapshot(now: number): GameSnapshot {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    let timeLeftMs = 0;
    let countdownMs = 0;
    if (this._phase === 'countdown') {
      countdownMs = Math.max(0, this.countdownEndsAt - now);
      timeLeftMs = this.config.roundDurationMs;
    } else if (this._phase === 'playing') {
      timeLeftMs = Math.max(0, this.roundEndsAt - now);
    } else if (this._phase === 'lobby') {
      timeLeftMs = this.config.roundDurationMs;
    }
    return {
      tick: this._tick,
      phase: this._phase,
      serverTime: now,
      players: this.publicPlayers(),
      collectibles: this.collectibles.map((c) => ({ ...c, x: round1(c.x), y: round1(c.y) })),
      timeLeftMs: Math.round(timeLeftMs),
      countdownMs: Math.round(countdownMs),
      events,
    };
  }

  /** Scores sorted high to low (ties keep join order). */
  standings(): Standing[] {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
