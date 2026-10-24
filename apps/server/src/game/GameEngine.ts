import {
  GAME_CONFIG,
  type ArenaId,
  type GameConfig,
  type GamePhase,
  type GameSnapshot,
  type PlayerAction,
  type PlayerInput,
  type PublicPlayer,
} from '@tilt-mayhem/shared';
import type { EnginePlayer, InputResult, Standing, UpdateResult } from './types.js';

interface EnginePlayerMeta extends EnginePlayer {
  nickname: string;
  color: string;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  alive: boolean;
  action: PlayerAction;
  actionTicks: number;
  punchRequested: boolean;
  grab: boolean;
  throwVector: { x: number; y: number } | null;
  punchCooldown: number;
  grabCooldown: number;
  heldBy: string | null;
  holding: string | null;
  lastAttacker: string | null;
  lastHitTick: number;
}

const ARENAS: ArenaId[] = ['train', 'ice', 'spinner', 'island'];

/** Authoritative gameplay simulation. Room and socket lifecycle are handled elsewhere. */
export class GameEngine {
  readonly config: GameConfig;
  private readonly random: () => number;
  private readonly tickMs: number;
  private _phase: GamePhase = 'lobby';
  private _tick = 0;
  private readonly players = new Map<string, EnginePlayerMeta>();
  private _arena: ArenaId = 'train';
  private lastUpdateAt: number | null = null;
  private accumulator = 0;
  private countdownEndsAt = 0;
  private roundEndsAt = 0;
  private arenaStartedAt = 0;

  constructor(config: Partial<GameConfig> = {}, random: () => number = Math.random) {
    this.config = { ...GAME_CONFIG, ...config };
    this.random = random;
    this.tickMs = 1000 / this.config.tickRate;
  }

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
    this.players.set(id, {
      id,
      nickname,
      color,
      x: this.config.arenaWidth / 2,
      y: this.config.arenaHeight / 2,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      score: 0,
      input: { x: 0, y: 0 },
      lastSeq: -1,
      connected: true,
      alive: true,
      action: 'idle',
      actionTicks: 0,
      punchRequested: false,
      grab: false,
      throwVector: null,
      punchCooldown: 0,
      grabCooldown: 0,
      heldBy: null,
      holding: null,
      lastAttacker: null,
      lastHitTick: -1,
    });
    this.layoutPlayers();
  }

  removePlayer(id: string): void {
    const p = this.players.get(id);
    if (p?.holding) {
      const held = this.players.get(p.holding);
      if (held) held.heldBy = null;
    }
    if (p?.heldBy) {
      const holder = this.players.get(p.heldBy);
      if (holder) holder.holding = null;
    }
    this.players.delete(id);
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = connected;
    p.input = { x: 0, y: 0 };
    p.grab = false;
    p.punchRequested = false;
    p.throwVector = null;
    if (p.holding) this.releaseHeld(p);
    if (connected) p.lastSeq = -1;
  }

  clearInput(id: string): void {
    const p = this.players.get(id);
    if (p) {
      p.input = { x: 0, y: 0 };
      p.grab = false;
      if (p.holding) this.releaseHeld(p);
    }
  }

  applyInput(id: string, input: PlayerInput): InputResult {
    const p = this.players.get(id);
    if (!p) return 'unknown';
    if (this._phase !== 'playing') return 'phase';
    const { seq, x, y } = input;
    if (!Number.isSafeInteger(seq) || seq < 0 || !Number.isFinite(x) || !Number.isFinite(y)) return 'invalid';
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return 'invalid';
    if (input.punch !== undefined && typeof input.punch !== 'boolean') return 'invalid';
    if (input.grab !== undefined && typeof input.grab !== 'boolean') return 'invalid';
    const throwX = input.throwX ?? 0;
    const throwY = input.throwY ?? 0;
    if (!Number.isFinite(throwX) || !Number.isFinite(throwY) || Math.abs(throwX) > 1 || Math.abs(throwY) > 1) {
      return 'invalid';
    }
    if (seq <= p.lastSeq) return 'stale';
    p.lastSeq = seq;
    const len = Math.hypot(x, y);
    p.input = len > 1 ? { x: x / len, y: y / len } : { x, y };
    p.punchRequested ||= input.punch === true;
    p.grab = input.grab === true;
    if (Math.hypot(throwX, throwY) > 0.2) p.throwVector = { x: throwX, y: throwY };
    return 'ok';
  }

  startCountdown(now: number): boolean {
    if (this._phase !== 'lobby' && this._phase !== 'results') return false;
    this._phase = 'countdown';
    this.countdownEndsAt = now + this.config.countdownMs;
    this.roundEndsAt = this.countdownEndsAt + this.config.roundDurationMs;
    this.lastUpdateAt = now;
    this.accumulator = 0;
    this.arenaStartedAt = this.countdownEndsAt;
    this._arena = ARENAS[Math.floor(this.random() * ARENAS.length)] ?? 'train';
    for (const p of this.players.values()) this.resetPlayer(p);
    this.layoutPlayers();
    return true;
  }

  resetToLobby(): void {
    this._phase = 'lobby';
    for (const p of this.players.values()) {
      this.resetPlayer(p);
      p.score = 0;
    }
    this.layoutPlayers();
  }

  get playStartsAt(): number {
    return this.countdownEndsAt;
  }

  update(now: number): UpdateResult {
    const result: UpdateResult = { ticks: 0, phaseChanged: null, scoresChanged: false };
    if (this._phase === 'lobby' || this._phase === 'results') {
      this.lastUpdateAt = now;
      return result;
    }
    if (this.lastUpdateAt === null) this.lastUpdateAt = now;
    this.accumulator += Math.max(0, now - this.lastUpdateAt);
    this.lastUpdateAt = now;
    this.accumulator = Math.min(this.accumulator, this.tickMs * this.config.maxCatchUpTicks);
    while (this.accumulator + 1e-6 >= this.tickMs) {
      this.accumulator = Math.max(0, this.accumulator - this.tickMs);
      if (this.step(this.tickMs / 1000, now)) result.scoresChanged = true;
      result.ticks++;
    }
    if (this._phase === 'countdown' && now >= this.countdownEndsAt) {
      this._phase = 'playing';
      result.phaseChanged = 'playing';
    }
    if (this._phase === 'playing' && (this.alivePlayers().length <= 1 || now >= this.roundEndsAt)) {
      if (this.alivePlayers().length === 1) {
        const winner = this.alivePlayers()[0]!;
        winner.score = Math.max(...[...this.players.values()].map((p) => p.score)) + 1;
        result.scoresChanged = true;
      }
      this._phase = 'results';
      for (const p of this.players.values()) p.input = { x: 0, y: 0 };
      result.phaseChanged = 'results';
    }
    return result;
  }

  private step(dt: number, now: number): boolean {
    this._tick++;
    if (this._phase !== 'playing') return false;
    const list = [...this.players.values()];
    const ice = this._arena === 'ice';
    let scoreChanged = false;

    for (const p of list) {
      if (!p.alive) continue;
      p.punchCooldown = Math.max(0, p.punchCooldown - 1);
      p.grabCooldown = Math.max(0, p.grabCooldown - 1);
      p.actionTicks = Math.max(0, p.actionTicks - 1);
      if (p.actionTicks === 0 && p.action !== 'out') p.action = 'idle';
      if (!p.connected) p.input = { x: 0, y: 0 };
      const { x, y } = p.input;
      if (Math.hypot(x, y) > 0.08) {
        const length = Math.hypot(x, y);
        p.facingX = x / length;
        p.facingY = y / length;
      }
      if (p.heldBy) {
        p.action = 'grab';
        p.actionTicks = 2;
        continue;
      }
      const drag = ice ? 0.93 : 0.76;
      p.vx = p.vx * drag + x * this.config.maxSpeed * (1 - drag);
      p.vy = p.vy * drag + y * this.config.maxSpeed * (1 - drag);
      if (this._arena === 'train' && Math.floor(this._tick / (this.config.tickRate * 7)) % 2 === 1) {
        p.vx += 10 * dt;
      }
      if (this._arena === 'spinner') {
        const dx = p.x - this.config.arenaWidth / 2;
        const dy = p.y - this.config.arenaHeight / 2;
        p.vx += -dy * 0.035 * dt;
        p.vy += dx * 0.035 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (const p of list) {
      if (!p.alive || !p.connected) continue;
      if (p.punchRequested && p.punchCooldown === 0) {
        p.action = 'punch';
        p.actionTicks = 7;
        p.punchCooldown = this.config.punchCooldownTicks;
        const target = this.findTarget(p, this.config.punchReach, true);
        if (target) this.hit(p, target, this.config.punchImpulse);
      }
      p.punchRequested = false;
      if (p.grab && !p.holding && p.grabCooldown === 0) {
        const target = this.findTarget(p, this.config.grabReach, false);
        if (target && !target.heldBy) {
          p.holding = target.id;
          target.heldBy = p.id;
          target.vx = 0;
          target.vy = 0;
          p.action = 'grab';
          p.actionTicks = 6;
        }
      }
      if (p.throwVector) {
        if (p.holding) {
          const target = this.players.get(p.holding);
          if (target?.alive) {
            const direction = normalized(p.throwVector.x, p.throwVector.y, p.facingX, p.facingY);
            this.releaseHeld(p);
            p.grabCooldown = this.config.punchCooldownTicks;
            target.vx = direction.x * this.config.throwImpulse;
            target.vy = direction.y * this.config.throwImpulse;
            target.lastAttacker = p.id;
            target.lastHitTick = this._tick;
            target.action = 'thrown';
            target.actionTicks = 18;
          }
        }
        p.throwVector = null;
      }
      if (!p.grab && p.holding) this.releaseHeld(p);
    }

    for (const p of list) {
      if (!p.alive || !p.holding) continue;
      const held = this.players.get(p.holding);
      if (!held?.alive) {
        this.releaseHeld(p);
        continue;
      }
      held.x = p.x + p.facingX * this.config.playerRadius * 2.2;
      held.y = p.y + p.facingY * this.config.playerRadius * 2.2;
    }

    const elapsed = Math.max(0, now - this.arenaStartedAt);
    const platformScale =
      this._arena === 'island'
        ? Math.max(0.42, 1 - Math.max(0, elapsed - 12_000) / this.config.islandCollapseMs)
        : 1;
    const halfW = (this.config.arenaWidth * platformScale) / 2;
    const halfH = (this.config.arenaHeight * platformScale) / 2;
    const left = this.config.arenaWidth / 2 - halfW;
    const right = this.config.arenaWidth / 2 + halfW;
    const top = this.config.arenaHeight / 2 - halfH;
    const bottom = this.config.arenaHeight / 2 + halfH;
    for (const p of list) {
      if (!p.alive || p.heldBy) continue;
      if (
        p.x < left + this.config.arenaMargin ||
        p.x > right - this.config.arenaMargin ||
        p.y < top + this.config.arenaMargin ||
        p.y > bottom - this.config.arenaMargin
      ) {
        p.alive = false;
        p.action = 'out';
        p.vx = 0;
        p.vy = 0;
        p.grab = false;
        if (p.holding) this.releaseHeld(p);
        if (p.lastAttacker && this._tick - p.lastHitTick <= this.config.tickRate * 3) {
          const attacker = this.players.get(p.lastAttacker);
          if (attacker) {
            attacker.score++;
            scoreChanged = true;
          }
        }
      }
    }
    return scoreChanged;
  }

  private hit(attacker: EnginePlayerMeta, target: EnginePlayerMeta, impulse: number): void {
    if (target.heldBy) {
      const holder = this.players.get(target.heldBy);
      if (holder) holder.holding = null;
      target.heldBy = null;
    }
    if (target.holding) this.releaseHeld(target);
    const direction = normalized(target.x - attacker.x, target.y - attacker.y, attacker.facingX, attacker.facingY);
    target.vx += direction.x * impulse;
    target.vy += direction.y * impulse;
    target.lastAttacker = attacker.id;
    target.lastHitTick = this._tick;
    target.action = 'thrown';
    target.actionTicks = 12;
  }

  private findTarget(attacker: EnginePlayerMeta, reach: number, inFront: boolean): EnginePlayerMeta | null {
    let target: EnginePlayerMeta | null = null;
    let distance = reach;
    for (const candidate of this.players.values()) {
      if (!candidate.alive || !candidate.connected || candidate.id === attacker.id) continue;
      const dx = candidate.x - attacker.x;
      const dy = candidate.y - attacker.y;
      const d = Math.hypot(dx, dy);
      if (d >= distance) continue;
      const dot = (dx * attacker.facingX + dy * attacker.facingY) / Math.max(d, 1);
      if (inFront && dot < 0.25) continue;
      distance = d;
      target = candidate;
    }
    return target;
  }

  private releaseHeld(holder: EnginePlayerMeta): void {
    if (!holder.holding) return;
    const held = this.players.get(holder.holding);
    if (held) held.heldBy = null;
    holder.holding = null;
  }

  private resetPlayer(p: EnginePlayerMeta): void {
    p.score = 0;
    p.vx = 0;
    p.vy = 0;
    p.input = { x: 0, y: 0 };
    p.lastSeq = -1;
    p.alive = true;
    p.action = 'idle';
    p.actionTicks = 0;
    p.punchRequested = false;
    p.grab = false;
    p.throwVector = null;
    p.punchCooldown = 0;
    p.grabCooldown = 0;
    p.heldBy = null;
    p.holding = null;
    p.lastAttacker = null;
    p.lastHitTick = -1;
  }

  private alivePlayers(): EnginePlayerMeta[] {
    return [...this.players.values()].filter((p) => p.alive);
  }

  setPlayerPosition(id: string, x: number, y: number): void {
    const p = this.players.get(id);
    if (p) {
      p.x = x;
      p.y = y;
    }
  }

  setPlayerScore(id: string, score: number): void {
    const p = this.players.get(id);
    if (p && Number.isFinite(score)) p.score = score;
  }

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

  publicPlayers(): PublicPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      x: round1(p.x),
      y: round1(p.y),
      score: p.score,
      connected: p.connected,
      alive: p.alive,
      action: p.action,
    }));
  }

  snapshot(now: number): GameSnapshot {
    const countdownMs = this._phase === 'countdown' ? Math.max(0, this.countdownEndsAt - now) : 0;
    const timeLeftMs =
      this._phase === 'playing'
        ? Math.max(0, this.roundEndsAt - now)
        : this._phase === 'countdown'
          ? this.config.roundDurationMs
          : this._phase === 'lobby'
            ? this.config.roundDurationMs
            : 0;
    const elapsed = Math.max(0, now - this.arenaStartedAt);
    return {
      tick: this._tick,
      phase: this._phase,
      serverTime: now,
      players: this.publicPlayers(),
      arena: this._arena,
      platformScale:
        this._arena === 'island'
          ? Math.max(0.42, 1 - Math.max(0, elapsed - 12_000) / this.config.islandCollapseMs)
          : 1,
      timeLeftMs: Math.round(timeLeftMs),
      countdownMs: Math.round(countdownMs),
    };
  }

  standings(): Standing[] {
    return [...this.players.values()]
      .map((p) => ({ id: p.id, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }
}

function normalized(x: number, y: number, fallbackX: number, fallbackY: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: fallbackX, y: fallbackY };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
