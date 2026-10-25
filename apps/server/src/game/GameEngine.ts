import {
  GAME_CONFIG,
  INGREDIENTS,
  KITCHEN,
  RECIPES,
  SCORING,
  recipeById,
  stationById,
  type ChefFace,
  type ChefResult,
  type ChefSnap,
  type GameConfig,
  type GamePhase,
  type GameSnapshot,
  type KitchenEvent,
  type KitchenStatus,
  type MatchResults,
  type PlayerInput,
  type PublicPlayer,
  type StationId,
} from '@tilt-mayhem/shared';
import type { Chef, InputResult, InteractResult, Standing, UpdateResult } from './types.js';

const R = KITCHEN.chefR;
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Sizzle Scramble simulation for one room. Same public surface the room
 * manager and socket layer already use (addPlayer, startCountdown, update,
 * snapshot, standings...), plus kitchen entry points (interact, rep, cancel,
 * serve). Has no knowledge of sockets.
 */
export class GameEngine {
  readonly config: GameConfig;
  private readonly random: () => number;
  private readonly tickMs: number;

  private _phase: GamePhase = 'lobby';
  private _tick = 0;
  private readonly chefs = new Map<string, Chef>();
  private pendingEvents: KitchenEvent[] = [];

  private playMs = 0;
  private rush = false;
  private round = 0;
  private lastResults: MatchResults | null = null;

  private lastUpdateAt: number | null = null;
  private accumulator = 0;
  private countdownEndsAt = 0;
  private roundEndsAt = 0;
  private scoresDirty = false;

  constructor(config: Partial<GameConfig> = {}, random: () => number = Math.random) {
    this.config = { ...GAME_CONFIG, ...config };
    this.random = random;
    this.tickMs = 1000 / this.config.tickRate;
  }

  // ================================================================ players

  get phase(): GamePhase {
    return this._phase;
  }

  get tick(): number {
    return this._tick;
  }

  get playerCount(): number {
    return this.chefs.size;
  }

  hasPlayer(id: string): boolean {
    return this.chefs.has(id);
  }

  addPlayer(id: string, nickname: string, color: string, face: ChefFace = 'stache'): void {
    if (this.chefs.has(id)) return;
    this.chefs.set(id, this.blankChef(id, nickname, color, face));
    this.layout();
  }

  /** Lobby customisation: new colour and/or face. */
  setLook(id: string, color: string, face: ChefFace): void {
    const c = this.chefs.get(id);
    if (!c) return;
    c.color = color;
    c.face = face;
  }

  removePlayer(id: string): void {
    this.chefs.delete(id);
  }

  setConnected(id: string, connected: boolean): void {
    const c = this.chefs.get(id);
    if (!c) return;
    c.connected = connected;
    c.input = { x: 0, y: 0 };
    if (connected) c.lastSeq = -1;
  }

  clearInput(id: string): void {
    const c = this.chefs.get(id);
    if (c) c.input = { x: 0, y: 0 };
  }

  applyInput(id: string, input: PlayerInput): InputResult {
    const c = this.chefs.get(id);
    if (!c) return 'unknown';
    if (this._phase !== 'playing') return 'phase';
    const { seq, x, y } = input;
    if (!Number.isSafeInteger(seq) || seq < 0) return 'invalid';
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'invalid';
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return 'invalid';
    if (seq <= c.lastSeq) return 'stale';
    c.lastSeq = seq;
    const len = Math.hypot(x, y);
    c.input = len > 1 ? { x: x / len, y: y / len } : { x, y };
    return 'ok';
  }

  // ================================================================ phases

  startCountdown(now: number): boolean {
    if (this._phase !== 'lobby' && this._phase !== 'results') return false;
    this.round++;
    this._phase = 'countdown';
    this.countdownEndsAt = now + this.config.countdownMs;
    this.roundEndsAt = this.countdownEndsAt + this.config.roundDurationMs;
    this.lastUpdateAt = now;
    this.accumulator = 0;
    this.playMs = 0;
    this.rush = false;
    this.lastResults = null;
    this.pendingEvents = [];
    for (const old of [...this.chefs.values()]) {
      const c = this.blankChef(old.id, old.nickname, old.color, old.face);
      c.connected = old.connected;
      this.chefs.set(c.id, c);
    }
    this.layout();
    return true;
  }

  resetToLobby(): void {
    this._phase = 'lobby';
    this.pendingEvents = [];
    this.layout();
  }

  /** Length of the next round (takes effect at the next countdown). */
  setRoundDuration(ms: number): void {
    if (this._phase === 'lobby' || this._phase === 'results') this.config.roundDurationMs = ms;
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
    const elapsed = Math.max(0, now - this.lastUpdateAt);
    this.lastUpdateAt = now;
    this.accumulator += elapsed;
    const maxBacklog = this.tickMs * this.config.maxCatchUpTicks;
    if (this.accumulator > maxBacklog) this.accumulator = maxBacklog;
    while (this.accumulator + 1e-6 >= this.tickMs) {
      this.accumulator = Math.max(0, this.accumulator - this.tickMs);
      this.step(this.tickMs / 1000);
      result.ticks++;
    }

    if (this._phase === 'countdown' && now >= this.countdownEndsAt) {
      this._phase = 'playing';
      result.phaseChanged = 'playing';
    }
    if (this._phase === 'playing') {
      if (!this.rush && this.roundEndsAt - now <= SCORING.rushMs) {
        this.rush = true;
        this.pendingEvents.push({ type: 'rush' });
      }
      if (now >= this.roundEndsAt) {
        this.finish();
        result.phaseChanged = 'results';
      }
    }
    if (this.scoresDirty) {
      result.scoresChanged = true;
      this.scoresDirty = false;
    }
    return result;
  }

  // ================================================================ kitchen actions

  /** Start working at the station the chef is standing at. */
  interact(id: string): InteractResult {
    const c = this.chefs.get(id);
    if (!c || this._phase !== 'playing') return 'phase';
    if (c.working) return 'busy';
    if (!c.near || c.near === 'pass') return 'not-near';
    const station = c.near;
    const ingredient = this.neededAt(c, station);
    if (!ingredient) return c.have.size && this.recipeNeedsStation(c, station) ? 'already-have' : 'not-needed';
    c.working = { station, ingredient, reps: c.partial.get(ingredient) ?? 0, lastRepAt: -1e9 };
    c.vx = 0;
    c.vy = 0;
    // Two cooks can share a station: step into a free spot so nobody overlaps.
    const spot = KITCHEN.spots.find((s) => s.id === station)!;
    const taken = [...this.chefs.values()].filter((o) => o !== c && o.working?.station === station).map((o) => o.x);
    const slots = [spot.fx - 30, spot.fx + 30];
    const free = slots.filter((x) => !taken.some((t) => Math.abs(t - x) < 20));
    c.x = free.sort((a, b) => Math.abs(a - c.x) - Math.abs(b - c.x))[0] ?? c.x;
    c.y = spot.fy;
    return 'ok';
  }

  /** One gesture from the phone. Rate-limited per station so mashing doesn't help. */
  rep(id: string, good: boolean): boolean {
    const c = this.chefs.get(id);
    if (!c || !c.working || this._phase !== 'playing') return false;
    const w = c.working;
    const def = stationById(w.station);
    const t = this.playMs;
    if (t - w.lastRepAt < def.minRepMs) return false;
    w.lastRepAt = t;
    if (good) {
      w.reps++;
      c.stats.gestures++;
      c.stats.perStation[w.station] = (c.stats.perStation[w.station] ?? 0) + 1;
    } else {
      w.reps = Math.max(0, w.reps - def.badPenalty);
      c.stats.oops++;
    }
    this.pendingEvents.push({ type: 'rep', chef: c.id, station: w.station, good });
    if (w.reps >= def.reps) {
      c.have.add(w.ingredient);
      c.partial.delete(w.ingredient);
      c.working = null;
      this.pendingEvents.push({ type: 'made', chef: c.id, station: w.station, ingredient: w.ingredient });
    }
    return true;
  }

  /** Step away from the station; partial progress is remembered. */
  cancel(id: string): void {
    const c = this.chefs.get(id);
    if (!c || !c.working) return;
    c.partial.set(c.working.ingredient, c.working.reps);
    c.working = null;
  }

  /** Send the finished dish. Returns points scored (0 if not possible). */
  serve(id: string): number {
    const c = this.chefs.get(id);
    if (!c || this._phase !== 'playing' || c.working) return 0;
    const recipe = recipeById(c.recipeId);
    if (!recipe || c.near !== 'pass' || !recipe.ingredients.every((i) => c.have.has(i))) return 0;
    const took = this.playMs - c.ticketAt;
    let points = SCORING.recipe;
    if (took <= SCORING.fastMs) points += SCORING.fastBonus;
    else if (took <= SCORING.quickMs) points += SCORING.quickBonus;
    if (this.rush) points *= 2;
    c.score += points;
    c.served++;
    c.stats.fastestMs = c.stats.fastestMs === null ? took : Math.min(c.stats.fastestMs, took);
    this.pendingEvents.push({ type: 'served', chef: c.id, recipeId: recipe.id, points, fast: took <= SCORING.fastMs });
    this.newTicket(c);
    this.scoresDirty = true;
    return points;
  }

  private neededAt(c: Chef, station: StationId): string | null {
    const recipe = recipeById(c.recipeId);
    if (!recipe) return null;
    for (const ing of recipe.ingredients) {
      if (INGREDIENTS.get(ing)?.station === station && !c.have.has(ing)) return ing;
    }
    return null;
  }

  private recipeNeedsStation(c: Chef, station: StationId): boolean {
    const recipe = recipeById(c.recipeId);
    return !!recipe?.ingredients.some((i) => INGREDIENTS.get(i)?.station === station);
  }

  private newTicket(c: Chef) {
    let next = c.recipeId;
    for (let i = 0; i < 8 && next === c.recipeId; i++) {
      next = RECIPES[Math.floor(this.random() * RECIPES.length)]?.id ?? RECIPES[0]!.id;
    }
    c.recipeId = next;
    c.ticketAt = this.playMs;
    c.have.clear();
    c.partial.clear();
    c.working = null;
  }

  // ================================================================ simulation

  private step(dt: number): void {
    this._tick++;
    if (this._phase !== 'playing') return;
    this.playMs += dt * 1000;
    const list = [...this.chefs.values()];
    const f = KITCHEN.floor;
    const pass = KITCHEN.pass;

    for (const c of list) {
      if (c.working || !c.connected) {
        c.vx *= 0.5;
        c.vy *= 0.5;
      } else {
        const tx = c.input.x * this.config.maxSpeed;
        const ty = c.input.y * this.config.maxSpeed;
        const k = Math.min(1, 12 * dt);
        c.vx += (tx - c.vx) * k;
        c.vy += (ty - c.vy) * k;
        if (Math.hypot(c.input.x, c.input.y) > 0.25) c.facing = Math.atan2(c.input.y, c.input.x);
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
    }

    // Chefs bump each other a little.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < R * 1.9 && !(a.working && b.working)) {
          const push = (R * 1.9 - d) / 2;
          if (!a.working) {
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
          }
          if (!b.working) {
            b.x += (dx / d) * push;
            b.y += (dy / d) * push;
          }
        }
      }
    }

    for (const c of list) {
      // Walls / counters.
      c.x = clamp(c.x, f.x0 + R, f.x1 - R);
      c.y = clamp(c.y, f.y0 + R, f.y1 - R);
      // The pass table in the middle is solid.
      const dx = c.x - pass.x;
      const dy = c.y - pass.y;
      const d = Math.hypot(dx, dy);
      const min = pass.r + R;
      if (d < min) {
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        c.x = pass.x + ux * min;
        c.y = pass.y + uy * min;
      }
      c.near = this.nearOf(c);
      // If somehow moved away from the station, stop working (keep progress).
      if (c.working && c.near !== c.working.station) this.cancel(c.id);
    }
  }

  private nearOf(c: Chef): StationId | 'pass' | null {
    // The pass wins: every station's standing spot is outside its zone.
    if (Math.hypot(c.x - KITCHEN.pass.x, c.y - KITCHEN.pass.y) <= KITCHEN.pass.serveR) return 'pass';
    let best: StationId | null = null;
    let bestD: number = KITCHEN.interactR;
    for (const s of KITCHEN.spots) {
      const d = Math.hypot(c.x - s.fx, c.y - s.fy);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  }

  private layout() {
    const list = [...this.chefs.values()];
    list.forEach((c, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, list.length);
      c.x = KITCHEN.pass.x + Math.cos(a) * 190;
      c.y = KITCHEN.pass.y + Math.sin(a) * 110;
      c.facing = Math.atan2(KITCHEN.pass.y - c.y, KITCHEN.pass.x - c.x);
      c.near = this.nearOf(c);
    });
  }

  private blankChef(id: string, nickname: string, color: string, face: ChefFace): Chef {
    const c: Chef = {
      id,
      nickname,
      color,
      face,
      x: KITCHEN.pass.x,
      y: KITCHEN.pass.y + 150,
      vx: 0,
      vy: 0,
      facing: -Math.PI / 2,
      score: 0,
      input: { x: 0, y: 0 },
      lastSeq: -1,
      connected: true,
      recipeId: RECIPES[0]!.id,
      ticketAt: 0,
      have: new Set(),
      partial: new Map(),
      working: null,
      near: null,
      served: 0,
      stats: { gestures: 0, oops: 0, perStation: {}, fastestMs: null },
    };
    c.recipeId = RECIPES[Math.floor(this.random() * RECIPES.length)]?.id ?? RECIPES[0]!.id;
    return c;
  }

  private finish() {
    this._phase = 'results';
    const list = [...this.chefs.values()];
    for (const c of list) {
      c.input = { x: 0, y: 0 };
      c.working = null;
    }
    const sorted = [...list].sort((a, b) => b.score - a.score || b.served - a.served);
    const results: ChefResult[] = [];
    sorted.forEach((c, i) => {
      const prev = sorted[i - 1];
      const placement = prev && prev.score === c.score ? results[i - 1]!.placement : i + 1;
      const fav = (Object.entries(c.stats.perStation) as [StationId, number][]).sort((a, b) => b[1] - a[1])[0];
      results.push({
        id: c.id,
        nickname: c.nickname,
        color: c.color,
        face: c.face,
        placement,
        score: c.score,
        served: c.served,
        fastestMs: c.stats.fastestMs === null ? null : Math.round(c.stats.fastestMs),
        favoriteStation: fav ? fav[0] : null,
        gestures: c.stats.gestures,
        oops: c.stats.oops,
      });
    });
    this.lastResults = {
      round: this.round,
      durationMs: Math.round(this.playMs),
      winnerIds: results.filter((r) => r.placement === 1 && r.score > 0).map((r) => r.id),
      results,
    };
    this.scoresDirty = true;
  }

  // ================================================================ output

  publicPlayers(): PublicPlayer[] {
    return [...this.chefs.values()].map((c) => ({
      id: c.id,
      nickname: c.nickname,
      color: c.color,
      face: c.face,
      x: round1(c.x),
      y: round1(c.y),
      score: c.score,
      connected: c.connected,
    }));
  }

  results(): MatchResults | null {
    return this.lastResults;
  }

  status(id: string, now: number): KitchenStatus | null {
    const c = this.chefs.get(id);
    if (!c) return null;
    const ranked = [...this.chefs.values()].sort((a, b) => b.score - a.score);
    const rank = 1 + ranked.filter((o) => o.score > c.score).length;
    const recipe = recipeById(c.recipeId);
    const canInteract =
      this._phase === 'playing' && !c.working && !!c.near && c.near !== 'pass' && this.neededAt(c, c.near) !== null;
    const canServe =
      this._phase === 'playing' && !c.working && c.near === 'pass' && !!recipe && recipe.ingredients.every((i) => c.have.has(i));
    return {
      recipeId: c.recipeId,
      have: [...c.have],
      working: c.working ? this.workSnap(c) : null,
      near: c.near,
      canInteract,
      canServe,
      score: c.score,
      served: c.served,
      rank,
      timeLeftMs: this.timeLeft(now),
      rush: this.rush,
    };
  }

  private workSnap(c: Chef) {
    const w = c.working!;
    return {
      station: w.station,
      ingredient: w.ingredient,
      progress: Math.min(1, w.reps / stationById(w.station).reps),
      sinceRep: Math.max(0, Math.round(this.playMs - w.lastRepAt)),
    };
  }

  private timeLeft(now: number): number {
    if (this._phase === 'countdown') return this.config.roundDurationMs;
    if (this._phase === 'playing') return Math.max(0, this.roundEndsAt - now);
    if (this._phase === 'lobby') return this.config.roundDurationMs;
    return 0;
  }

  snapshot(now: number): GameSnapshot {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    const chefs: ChefSnap[] = [...this.chefs.values()].map((c) => ({
      id: c.id,
      nickname: c.nickname,
      color: c.color,
      face: c.face,
      x: round1(c.x),
      y: round1(c.y),
      vx: Math.round(c.vx),
      vy: Math.round(c.vy),
      facing: Math.round(c.facing * 100) / 100,
      connected: c.connected,
      score: c.score,
      served: c.served,
      recipeId: c.recipeId,
      have: [...c.have],
      working: c.working ? this.workSnap(c) : null,
      near: c.near,
    }));
    return {
      tick: this._tick,
      phase: this._phase,
      serverTime: now,
      timeLeftMs: Math.round(this.timeLeft(now)),
      countdownMs: this._phase === 'countdown' ? Math.max(0, Math.round(this.countdownEndsAt - now)) : 0,
      rush: this.rush,
      chefs,
      events,
    };
  }

  /** Ranked best first by points. */
  standings(): Standing[] {
    return [...this.chefs.values()]
      .map((c) => ({ id: c.id, score: c.score, served: c.served }))
      .sort((a, b) => b.score - a.score || b.served - a.served)
      .map(({ id, score }) => ({ id, score }));
  }

  // ================================================================ test helpers

  /** Test/debug: teleport a chef (also updates which station they're at). */
  setPlayerPosition(id: string, x: number, y: number): void {
    const c = this.chefs.get(id);
    if (!c) return;
    c.x = x;
    c.y = y;
    c.vx = 0;
    c.vy = 0;
    c.near = this.nearOf(c);
  }

  /** Test/debug: hand a chef a specific ticket. */
  setRecipe(id: string, recipeId: string): void {
    const c = this.chefs.get(id);
    if (!c || !recipeById(recipeId)) return;
    c.recipeId = recipeId;
    c.have.clear();
    c.partial.clear();
    c.working = null;
  }

  /** Test/debug: read a chef's internal state. */
  peek(id: string): Readonly<Chef> | undefined {
    return this.chefs.get(id);
  }
}
