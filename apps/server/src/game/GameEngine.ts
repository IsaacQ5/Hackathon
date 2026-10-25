import {
  GAME_CONFIG,
  HAZARDS,
  INGREDIENTS,
  KITCHEN,
  RECIPES,
  SCORING,
  STATION_IDS,
  STUCK,
  recipeById,
  stationById,
  type ChefFace,
  type ChefResult,
  type ChefSnap,
  type GameConfig,
  type GamePhase,
  type GameSnapshot,
  type HazardKind,
  type HazardSnap,
  type KitchenEvent,
  type KitchenStatus,
  type MatchResults,
  type PlayerInput,
  type PublicPlayer,
  type StationId,
  type StuckKind,
} from '@tilt-mayhem/shared';
import type { Chef, Hazard, InputResult, InteractResult, Standing, UpdateResult } from './types.js';

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

  private hazards: Hazard[] = [];
  private nextHazardId = 1;
  /** playMs when the next random hazard appears (0 = not scheduled yet). */
  private nextHazardAt = 0;

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

  addPlayer(id: string, nickname: string, color: string, face: ChefFace = 'plain'): void {
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
    this.hazards = [];
    this.nextHazardAt = 0;
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
    if (c.working || c.stuck) return 'busy';
    if (!c.near || c.near === 'pass') return 'not-near';
    const station = c.near;
    // A burning station has to be fanned out before anyone can cook there.
    const fire = this.fireAt(station);
    if (fire) {
      this.setStuck(c, 'fire', fire.id);
      return 'ok';
    }
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

  /** One recovery motion from a stuck chef's phone. Returns true if it counted. */
  recover(id: string, good: boolean): boolean {
    const c = this.chefs.get(id);
    if (!c || !c.stuck || this._phase !== 'playing' || !good) return false;
    const s = c.stuck;
    const def = STUCK[s.kind];
    if (this.playMs - s.lastRepAt < stationById(def.gesture).minRepMs) return false;
    s.lastRepAt = this.playMs;
    s.reps++;
    const h = s.hazardId === null ? undefined : this.hazards.find((x) => x.id === s.hazardId);
    const cleans = s.kind === 'slip' || s.kind === 'fire';
    if (h && cleans) h.progress = Math.max(h.progress, s.reps / def.reps);
    if (s.reps >= def.reps) {
      if (h && cleans) {
        // Spill mopped / fire out: gone for everyone, and anyone else stuck on it is free too.
        this.hazards = this.hazards.filter((x) => x !== h);
        for (const o of this.chefs.values()) if (o !== c && o.stuck?.hazardId === h.id) this.free(o);
      }
      this.free(c);
    }
    return true;
  }

  /** Send the finished dish. Returns points scored (0 if not possible). */
  serve(id: string): number {
    const c = this.chefs.get(id);
    if (!c || this._phase !== 'playing' || c.working || c.stuck) return 0;
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
      if (c.working || c.stuck || !c.connected) {
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
        const aFixed = !!(a.working || a.stuck);
        const bFixed = !!(b.working || b.stuck);
        if (d > 0 && d < R * 1.9 && !(aFixed && bFixed)) {
          const push = (R * 1.9 - d) / 2;
          if (!aFixed) {
            a.x -= (dx / d) * push;
            a.y -= (dy / d) * push;
          }
          if (!bFixed) {
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
      // The serve table in the middle and the diner sitting at it are solid.
      for (const ob of [pass, KITCHEN.customer]) {
        const dx = c.x - ob.x;
        const dy = c.y - ob.y;
        const d = Math.hypot(dx, dy);
        const min = ob.r + R;
        if (d < min) {
          const ux = d > 0.01 ? dx / d : 0;
          const uy = d > 0.01 ? dy / d : 1;
          c.x = ob.x + ux * min;
          c.y = ob.y + uy * min;
        }
      }
      c.near = this.nearOf(c);
      // If somehow moved away from the station, stop working (keep progress).
      if (c.working && c.near !== c.working.station) this.cancel(c.id);
    }

    this.updateHazards(dt * 1000);
  }

  // ================================================================ kitchen chaos

  private fireAt(station: StationId): Hazard | undefined {
    return this.hazards.find((h) => h.kind === 'fire' && h.station === station);
  }

  private setStuck(c: Chef, kind: StuckKind, hazardId: number | null) {
    if (c.working) this.cancel(c.id);
    c.stuck = { kind, reps: 0, hazardId, lastRepAt: -1e9 };
    c.vx = 0;
    c.vy = 0;
    c.input = { x: 0, y: 0 };
    this.pendingEvents.push({ type: 'stuck', chef: c.id, kind });
  }

  private free(c: Chef) {
    if (!c.stuck) return;
    this.pendingEvents.push({ type: 'recovered', chef: c.id, kind: c.stuck.kind });
    c.stuck = null;
    c.immuneUntil = this.playMs + 2000;
  }

  /** Can this chef be taken out by a hazard right now? */
  private hittable(c: Chef): boolean {
    return !c.stuck && c.connected && this.playMs >= c.immuneUntil;
  }

  /** Spawn schedule + per-hazard behaviour. Called every tick while playing. */
  private updateHazards(dtMs: number) {
    const dur = this.config.roundDurationMs;
    const p = Math.min(1, this.playMs / dur);
    if (this.nextHazardAt === 0) this.nextHazardAt = dur * HAZARDS.startAt;
    // `hazards: 0` turns off random spawning; hazards placed by hand still behave normally.
    if (this.config.hazards && this.playMs >= this.nextHazardAt) {
      this.spawnRandomHazard(p);
      const base = HAZARDS.intervalStartMs + (HAZARDS.intervalEndMs - HAZARDS.intervalStartMs) * p;
      this.nextHazardAt = this.playMs + base * (this.rush ? 0.8 : 1) * (0.75 + this.random() * 0.5);
    }

    const f = KITCHEN.floor;
    const chefs = [...this.chefs.values()];
    for (const h of [...this.hazards]) {
      switch (h.kind) {
        case 'spill':
          for (const c of chefs) {
            if (!c.working && this.hittable(c) && Math.hypot(c.x - h.x, c.y - h.y) < h.r) this.setStuck(c, 'slip', h.id);
          }
          break;
        case 'meteor':
          if (h.warnMs > 0) {
            h.warnMs -= dtMs;
            if (h.warnMs <= 0) {
              h.warnMs = 0;
              h.ttl = HAZARDS.meteor.landedMs;
              this.pendingEvents.push({ type: 'impact', kind: 'meteor', x: h.x, y: h.y });
              for (const c of chefs) if (this.hittable(c) && Math.hypot(c.x - h.x, c.y - h.y) < h.r + R * 0.5) this.setStuck(c, 'bonk', null);
            }
          } else {
            h.ttl -= dtMs;
            if (h.ttl <= 0) this.removeHazard(h);
          }
          break;
        case 'cheese':
          if (h.warnMs > 0) {
            h.warnMs -= dtMs;
            if (h.warnMs <= 0) {
              h.warnMs = 0;
              this.pendingEvents.push({ type: 'impact', kind: 'cheese', x: h.x, y: h.y });
            }
            break;
          }
          h.x += (h.dir * HAZARDS.cheese.speed * dtMs) / 1000;
          for (const c of chefs) {
            if (h.hit.has(c.id) || !this.hittable(c)) continue;
            if (Math.abs(c.x - h.x) < h.r + R && Math.abs(c.y - h.y) < h.r + R * 0.6) {
              h.hit.add(c.id);
              this.setStuck(c, 'bonk', null);
            }
          }
          if (h.x < f.x0 - 120 || h.x > f.x1 + 120) this.removeHazard(h);
          break;
        case 'chicken': {
          h.age += dtMs;
          if (h.age >= h.turnAt) {
            const a = this.random() * Math.PI * 2;
            h.vx = Math.cos(a) * HAZARDS.chicken.speed;
            h.vy = Math.sin(a) * HAZARDS.chicken.speed * 0.7;
            h.turnAt = h.age + 700 + this.random() * 900;
          }
          h.x += (h.vx * dtMs) / 1000;
          h.y += (h.vy * dtMs) / 1000;
          if (h.x < f.x0 + h.r) h.vx = Math.abs(h.vx);
          if (h.x > f.x1 - h.r) h.vx = -Math.abs(h.vx);
          if (h.y < f.y0 + h.r) h.vy = Math.abs(h.vy);
          if (h.y > f.y1 - h.r) h.vy = -Math.abs(h.vy);
          h.x = clamp(h.x, f.x0 + h.r, f.x1 - h.r);
          h.y = clamp(h.y, f.y0 + h.r, f.y1 - h.r);
          for (const ob of [KITCHEN.pass, KITCHEN.customer]) {
            const d = Math.hypot(h.x - ob.x, h.y - ob.y);
            if (d < ob.r + h.r && d > 0.01) {
              h.x = ob.x + ((h.x - ob.x) / d) * (ob.r + h.r);
              h.y = ob.y + ((h.y - ob.y) / d) * (ob.r + h.r);
              h.vx = -h.vx;
              h.vy = -h.vy;
            }
          }
          if (Math.abs(h.vx) > 1) h.dir = Math.sign(h.vx);
          for (const c of chefs) {
            if (!c.working && this.hittable(c) && Math.hypot(c.x - h.x, c.y - h.y) < h.r + R) this.setStuck(c, 'feathers', null);
          }
          if (h.age > HAZARDS.chicken.lifeMs) this.removeHazard(h);
          break;
        }
        case 'fire':
          break;
      }
    }
  }

  private removeHazard(h: Hazard) {
    this.hazards = this.hazards.filter((x) => x !== h);
  }

  /** Pick what happens next. Bigger events unlock as the shift goes on. */
  private spawnRandomHazard(p: number) {
    const count = (k: HazardKind) => this.hazards.filter((h) => h.kind === k).length;
    const bigOne = count('meteor') + count('cheese') > 0;
    const options: [HazardKind, number][] = [];
    if (count('spill') < 1 + Math.floor(p * 3)) options.push(['spill', HAZARDS.spill.weight]);
    if (p >= HAZARDS.chicken.unlockAt && count('chicken') === 0) options.push(['chicken', HAZARDS.chicken.weight]);
    if (p >= HAZARDS.fire.unlockAt && count('fire') < (p > 0.75 ? 2 : 1)) options.push(['fire', HAZARDS.fire.weight]);
    if (p >= HAZARDS.meteor.unlockAt && !bigOne) options.push(['meteor', HAZARDS.meteor.weight]);
    if (p >= HAZARDS.cheese.unlockAt && !bigOne) options.push(['cheese', HAZARDS.cheese.weight]);
    const total = options.reduce((n, o) => n + o[1], 0);
    if (!total) return;
    let roll = this.random() * total;
    for (const [kind, w] of options) {
      roll -= w;
      if (roll <= 0) {
        this.spawnHazard(kind);
        return;
      }
    }
  }

  /** A random open floor spot (away from the serve table and, optionally, the stations). */
  private floorPoint(margin: number, avoidStations: boolean): { x: number; y: number } {
    const f = KITCHEN.floor;
    let pt = { x: f.x0 + margin, y: f.y0 + margin };
    for (let i = 0; i < 25; i++) {
      pt = { x: f.x0 + margin + this.random() * (f.x1 - f.x0 - margin * 2), y: f.y0 + margin + this.random() * (f.y1 - f.y0 - margin * 2) };
      const nearPass = Math.hypot(pt.x - KITCHEN.pass.x, pt.y - KITCHEN.pass.y) < KITCHEN.pass.serveR + margin;
      const nearStation = avoidStations && KITCHEN.spots.some((s) => Math.hypot(pt.x - s.fx, pt.y - s.fy) < 60);
      if (!nearPass && !nearStation) break;
    }
    return pt;
  }

  /** Start a hazard now. Random placement unless a spot (or station, for fire) is given. Returns its id. */
  spawnHazard(kind: HazardKind, at?: { x: number; y: number }, station?: StationId): number {
    const f = KITCHEN.floor;
    const h: Hazard = {
      id: this.nextHazardId++,
      kind,
      x: 0,
      y: 0,
      r: 0,
      warnMs: 0,
      station: null,
      progress: 0,
      dir: 1,
      ttl: 0,
      vx: 0,
      vy: 0,
      age: 0,
      turnAt: 0,
      hit: new Set(),
    };
    switch (kind) {
      case 'spill': {
        const pt = at ?? this.floorPoint(HAZARDS.spill.r + 10, true);
        Object.assign(h, pt, { r: HAZARDS.spill.r });
        break;
      }
      case 'meteor': {
        // Aim near a random chef so it matters, but never dead-on.
        const targets = [...this.chefs.values()].filter((c) => c.connected && !c.stuck);
        const t = targets[Math.floor(this.random() * targets.length)];
        const pt = at ?? (t
          ? { x: clamp(t.x + (this.random() - 0.5) * 120, f.x0 + 40, f.x1 - 40), y: clamp(t.y + (this.random() - 0.5) * 120, f.y0 + 40, f.y1 - 40) }
          : this.floorPoint(60, false));
        Object.assign(h, pt, { r: HAZARDS.meteor.r, warnMs: HAZARDS.warnMs });
        break;
      }
      case 'cheese': {
        const dir = this.random() < 0.5 ? 1 : -1;
        const y = at?.y ?? (this.random() < 0.5 ? f.y0 + 32 : f.y1 - 32);
        Object.assign(h, { x: at?.x ?? (dir > 0 ? f.x0 - 60 : f.x1 + 60), y, dir, r: HAZARDS.cheese.r, warnMs: HAZARDS.warnMs });
        break;
      }
      case 'chicken': {
        const dir = this.random() < 0.5 ? 1 : -1;
        const pt = at ?? { x: dir > 0 ? f.x0 + 30 : f.x1 - 30, y: f.y0 + 60 + this.random() * (f.y1 - f.y0 - 120) };
        Object.assign(h, pt, { dir, r: HAZARDS.chicken.r, vx: dir * HAZARDS.chicken.speed, vy: 0, turnAt: 900 });
        break;
      }
      case 'fire': {
        const free = STATION_IDS.filter((s) => !this.fireAt(s));
        const st = station ?? free[Math.floor(this.random() * free.length)];
        if (!st) return -1;
        const spot = KITCHEN.spots.find((s) => s.id === st)!;
        Object.assign(h, { x: spot.x, y: spot.y, r: 50, station: st });
        // Whoever was cooking there jumps back (their progress is kept).
        for (const c of this.chefs.values()) if (c.working?.station === st) this.cancel(c.id);
        break;
      }
    }
    this.hazards.push(h);
    this.pendingEvents.push({ type: 'hazard', kind, x: Math.round(h.x), y: Math.round(h.y), station: h.station });
    return h.id;
  }

  private hazardSnap(h: Hazard): HazardSnap {
    return {
      id: h.id,
      kind: h.kind,
      x: round1(h.x),
      y: round1(h.y),
      r: h.r,
      warnMs: Math.max(0, Math.round(h.warnMs)),
      station: h.station,
      progress: Math.round(h.progress * 100) / 100,
      dir: h.dir,
      ttl: Math.max(0, Math.round(h.ttl)),
    };
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
      stuck: null,
      immuneUntil: 0,
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
      c.stuck = null;
    }
    this.hazards = [];
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
    const atStation = this._phase === 'playing' && !c.working && !c.stuck && !!c.near && c.near !== 'pass';
    const fireHere = atStation && !!this.fireAt(c.near as StationId);
    const canInteract = atStation && (fireHere || this.neededAt(c, c.near as StationId) !== null);
    const canServe =
      this._phase === 'playing' &&
      !c.working &&
      !c.stuck &&
      c.near === 'pass' &&
      !!recipe &&
      recipe.ingredients.every((i) => c.have.has(i));
    return {
      recipeId: c.recipeId,
      have: [...c.have],
      working: c.working ? this.workSnap(c) : null,
      near: c.near,
      canInteract,
      canServe,
      fireHere,
      stuck: this.stuckSnap(c),
      score: c.score,
      served: c.served,
      rank,
      timeLeftMs: this.timeLeft(now),
      rush: this.rush,
    };
  }

  private stuckSnap(c: Chef) {
    return c.stuck ? { kind: c.stuck.kind, progress: Math.min(1, c.stuck.reps / STUCK[c.stuck.kind].reps) } : null;
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
      stuck: this.stuckSnap(c),
    }));
    return {
      tick: this._tick,
      phase: this._phase,
      serverTime: now,
      timeLeftMs: Math.round(this.timeLeft(now)),
      countdownMs: this._phase === 'countdown' ? Math.max(0, Math.round(this.countdownEndsAt - now)) : 0,
      rush: this.rush,
      chefs,
      hazards: this.hazards.map((h) => this.hazardSnap(h)),
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
