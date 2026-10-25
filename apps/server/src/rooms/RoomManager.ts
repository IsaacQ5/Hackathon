import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  GAME_CONFIG,
  PLAYER_COLORS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROUND_MINUTE_OPTIONS,
  isChefFace,
  type ChefFace,
  type GameConfig,
  type LeaderboardEntry,
  type Role,
  type RoomState,
  type ServerError,
} from '@tilt-mayhem/shared';
import { GameEngine } from '../game/GameEngine.js';
import { isToken, normalizeRoomCode, sanitizeNickname } from '../utils/validation.js';

export interface PlayerRecord {
  id: string;
  nickname: string;
  color: string;
  face: ChefFace;
  token: string;
  socketId: string | null;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostNickname: string;
  hostToken: string;
  hostSocketId: string | null;
  hostId: string;
  createdAt: number;
  lastActivityAt: number;
  round: number;
  players: Map<string, PlayerRecord>;
  engine: GameEngine;
}

export interface SocketBinding {
  code: string;
  role: Role;
  playerId: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ServerError };

export interface RoomManagerOptions {
  gameConfig?: Partial<GameConfig>;
  /** How long a disconnected player keeps their slot while in the lobby/results. */
  reconnectGraceMs?: number;
  /** Remove a room after nobody has been connected to it for this long. */
  roomIdleMs?: number;
  /** Hard cap on room lifetime. */
  maxRoomAgeMs?: number;
  now?: () => number;
  random?: () => number;
}

const fail = (code: ServerError['code'], message: string): { ok: false; error: ServerError } => ({
  ok: false,
  error: { code, message },
});

const newToken = (): string => randomBytes(16).toString('hex');

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly sockets = new Map<string, SocketBinding>();
  private readonly gameConfig: GameConfig;
  private readonly reconnectGraceMs: number;
  private readonly roomIdleMs: number;
  private readonly maxRoomAgeMs: number;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(options: RoomManagerOptions = {}) {
    this.gameConfig = { ...GAME_CONFIG, ...options.gameConfig };
    this.reconnectGraceMs = options.reconnectGraceMs ?? 60_000;
    this.roomIdleMs = options.roomIdleMs ?? 10 * 60_000;
    this.maxRoomAgeMs = options.maxRoomAgeMs ?? 6 * 60 * 60_000;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  allRooms(): Room[] {
    return [...this.rooms.values()];
  }

  getRoom(rawCode: unknown): Room | undefined {
    const code = normalizeRoomCode(rawCode);
    return code ? this.rooms.get(code) : undefined;
  }

  bySocket(socketId: string): { room: Room; binding: SocketBinding } | null {
    const binding = this.sockets.get(socketId);
    if (!binding) return null;
    const room = this.rooms.get(binding.code);
    if (!room) {
      this.sockets.delete(socketId);
      return null;
    }
    return { room, binding };
  }

  isHost(room: Room, socketId: string): boolean {
    return room.hostSocketId === socketId;
  }

  // ------------------------------------------------------------ host

  createRoom(socketId: string, rawNickname?: unknown): { room: Room; token: string; left: SocketBinding | null } {
    const left = this.detachSocket(socketId);
    const code = this.generateCode();
    const now = this.now();
    const token = newToken();
    const room: Room = {
      code,
      hostNickname: sanitizeNickname(rawNickname) ?? 'Host',
      hostToken: token,
      hostSocketId: socketId,
      hostId: randomUUID(),
      createdAt: now,
      lastActivityAt: now,
      round: 0,
      players: new Map(),
      engine: new GameEngine(this.gameConfig, this.random),
    };
    this.rooms.set(code, room);
    this.sockets.set(socketId, { code, role: 'host', playerId: room.hostId });
    return { room, token, left };
  }

  resumeHost(
    rawCode: unknown,
    rawToken: unknown,
    socketId: string,
  ): Result<{ room: Room; token: string; previousSocketId: string | null; left: SocketBinding | null }> {
    const room = this.getRoom(rawCode);
    if (!room) return fail('ROOM_NOT_FOUND', 'That room does not exist (it may have expired).');
    if (!isToken(rawToken) || rawToken !== room.hostToken) {
      return fail('INVALID_SESSION', 'This screen is not the host of that room.');
    }
    const previousSocketId = room.hostSocketId !== socketId ? room.hostSocketId : null;
    if (previousSocketId) this.sockets.delete(previousSocketId);
    const left = this.detachSocket(socketId);
    room.hostSocketId = socketId;
    room.hostToken = newToken();
    room.lastActivityAt = this.now();
    this.sockets.set(socketId, { code: room.code, role: 'host', playerId: room.hostId });
    return { ok: true, value: { room, token: room.hostToken, previousSocketId, left } };
  }

  // ------------------------------------------------------------ players

  joinRoom(
    rawCode: unknown,
    rawNickname: unknown,
    rawToken: unknown,
    socketId: string,
  ): Result<{
    room: Room;
    player: PlayerRecord;
    resumed: boolean;
    previousSocketId: string | null;
    left: SocketBinding | null;
  }> {
    const room = this.getRoom(rawCode);
    if (!room) return fail('ROOM_NOT_FOUND', 'Room not found. Check the code on the big screen.');
    const now = this.now();

    // 1) Reconnect with a valid token: restore the same player.
    if (isToken(rawToken)) {
      const existing = [...room.players.values()].find((p) => p.token === rawToken);
      if (existing) {
        const previousSocketId = existing.socketId !== socketId ? existing.socketId : null;
        if (previousSocketId) this.sockets.delete(previousSocketId);
        const left = this.detachSocket(socketId);
        existing.socketId = socketId;
        existing.disconnectedAt = null;
        existing.token = newToken(); // rotate on every resume
        room.engine.setConnected(existing.id, true);
        room.lastActivityAt = now;
        this.sockets.set(socketId, { code: room.code, role: 'player', playerId: existing.id });
        return { ok: true, value: { room, player: existing, resumed: true, previousSocketId, left } };
      }
    }

    // 2) New player.
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) return fail('INVALID_NICKNAME', 'Please enter a nickname.');
    const phase = room.engine.phase;
    if (phase !== 'lobby' && phase !== 'results') {
      return fail('INVALID_PHASE', 'A round is in progress. You can join when it ends.');
    }
    this.pruneDisconnected(room, now);
    if (room.players.size >= this.gameConfig.maxPlayers) {
      return fail('ROOM_FULL', `This room is full (${this.gameConfig.maxPlayers} players max).`);
    }

    const left = this.detachSocket(socketId);
    const player: PlayerRecord = {
      id: randomUUID(),
      nickname: this.uniqueNickname(room, nickname),
      color: this.freeColor(room),
      face: 'plain',
      token: newToken(),
      socketId,
      disconnectedAt: null,
    };
    room.players.set(player.id, player);
    room.engine.addPlayer(player.id, player.nickname, player.color, player.face);
    room.lastActivityAt = now;
    this.sockets.set(socketId, { code: room.code, role: 'player', playerId: player.id });
    return { ok: true, value: { room, player, resumed: false, previousSocketId: null, left } };
  }

  /** Handle a socket disconnect. Returns what it was bound to, if anything. */
  disconnect(socketId: string): { room: Room; binding: SocketBinding } | null {
    const found = this.bySocket(socketId);
    if (!found) return null;
    this.detachSocket(socketId);
    return found;
  }

  /** Remove any association the socket has (it is joining something else or leaving). */
  private detachSocket(socketId: string): SocketBinding | null {
    const binding = this.sockets.get(socketId);
    if (!binding) return null;
    this.sockets.delete(socketId);
    const room = this.rooms.get(binding.code);
    if (!room) return binding;
    const now = this.now();
    room.lastActivityAt = now;
    if (binding.role === 'host') {
      if (room.hostSocketId === socketId) room.hostSocketId = null;
    } else {
      const p = room.players.get(binding.playerId);
      if (p && p.socketId === socketId) {
        p.socketId = null;
        p.disconnectedAt = now;
        room.engine.setConnected(p.id, false);
      }
    }
    return binding;
  }

  /** Change a player's colour and/or face between rounds. Colours stay unique per room. */
  customize(room: Room, playerId: string, rawColor: unknown, rawFace: unknown): Result<{ color: string; face: ChefFace }> {
    const p = room.players.get(playerId);
    if (!p) return fail('INVALID_SESSION', 'You are not in this room.');
    const phase = room.engine.phase;
    if (phase !== 'lobby' && phase !== 'results') return fail('INVALID_PHASE', 'You can only change your chef between rounds.');
    let color = p.color;
    if (rawColor !== undefined) {
      if (typeof rawColor !== 'string' || !(PLAYER_COLORS as readonly string[]).includes(rawColor)) {
        return fail('INVALID_INPUT', 'Unknown colour.');
      }
      if ([...room.players.values()].some((o) => o.id !== p.id && o.color === rawColor)) {
        return fail('COLOR_TAKEN', 'Another chef already has that colour.');
      }
      color = rawColor;
    }
    let face = p.face;
    if (rawFace !== undefined) {
      if (!isChefFace(rawFace)) return fail('INVALID_INPUT', 'Unknown face.');
      face = rawFace;
    }
    p.color = color;
    p.face = face;
    room.engine.setLook(p.id, color, face);
    room.lastActivityAt = this.now();
    return { ok: true, value: { color, face } };
  }

  // ------------------------------------------------------------ game flow

  connectedPlayerCount(room: Room): number {
    let n = 0;
    for (const p of room.players.values()) if (p.socketId) n++;
    return n;
  }

  /** The head chef: the first phone that joined and is still connected (next in line if they leave). */
  captainId(room: Room): string | null {
    for (const p of room.players.values()) if (p.socketId) return p.id;
    return null;
  }

  /** The head chef's phone (or the host screen) runs the lobby. */
  canControl(room: Room, socketId: string): boolean {
    if (this.isHost(room, socketId)) return true;
    const b = this.sockets.get(socketId);
    return !!b && b.code === room.code && b.role === 'player' && b.playerId === this.captainId(room);
  }

  /** Set the next shift's length (whole minutes from ROUND_MINUTE_OPTIONS). */
  setRoundLength(room: Room, socketId: string, rawMinutes: unknown): Result<void> {
    if (!this.canControl(room, socketId)) return fail('NOT_HOST', 'Only the head chef can change the shift length.');
    const phase = room.engine.phase;
    if (phase !== 'lobby' && phase !== 'results') return fail('INVALID_PHASE', 'Change the shift length between rounds.');
    if (typeof rawMinutes !== 'number' || !(ROUND_MINUTE_OPTIONS as readonly number[]).includes(rawMinutes)) {
      return fail('INVALID_INPUT', 'Pick one of the listed shift lengths.');
    }
    room.engine.setRoundDuration(rawMinutes * 60_000);
    room.lastActivityAt = this.now();
    return { ok: true, value: undefined };
  }

  startGame(room: Room, socketId: string, kind: 'start' | 'rematch'): Result<void> {
    if (!this.canControl(room, socketId)) return fail('NOT_HOST', 'Only the head chef can start the game.');
    const phase = room.engine.phase;
    const allowed = kind === 'start' ? phase === 'lobby' || phase === 'results' : phase === 'results';
    if (!allowed) return fail('INVALID_PHASE', `Cannot ${kind} while the game is in "${phase}".`);
    const now = this.now();
    this.pruneDisconnected(room, now);
    const n = this.connectedPlayerCount(room);
    if (n < this.gameConfig.minPlayers) {
      return fail('NOT_ENOUGH_PLAYERS', `Need at least ${this.gameConfig.minPlayers} players (have ${n}).`);
    }
    room.round++;
    room.engine.startCountdown(now);
    room.lastActivityAt = now;
    return { ok: true, value: undefined };
  }

  /** Called once when the engine enters the results phase. */
  finishRound(room: Room): LeaderboardEntry[] {
    const standings = room.engine.standings();
    const board: LeaderboardEntry[] = [];
    let lastScore = Number.NaN;
    let lastRank = 0;
    standings.forEach((s, i) => {
      const p = room.players.get(s.id);
      if (!p) return;
      const rank = s.score === lastScore ? lastRank : i + 1;
      lastScore = s.score;
      lastRank = rank;
      board.push({ rank, id: s.id, nickname: p.nickname, color: p.color, score: s.score });
    });
    return board;
  }

  /** Drop players who have been gone longer than the grace period (lobby/results only). */
  pruneDisconnected(room: Room, now: number = this.now()): boolean {
    const phase = room.engine.phase;
    if (phase !== 'lobby' && phase !== 'results') return false;
    let changed = false;
    for (const p of [...room.players.values()]) {
      if (p.socketId === null && p.disconnectedAt !== null && now - p.disconnectedAt > this.reconnectGraceMs) {
        room.players.delete(p.id);
        room.engine.removePlayer(p.id);
        changed = true;
      }
    }
    return changed;
  }

  /** Periodic cleanup. Returns removed room codes and rooms whose player list changed. */
  sweep(now: number = this.now()): { removed: string[]; changed: Room[] } {
    const removed: string[] = [];
    const changed: Room[] = [];
    for (const room of [...this.rooms.values()]) {
      const anyoneConnected = room.hostSocketId !== null || this.connectedPlayerCount(room) > 0;
      const idle = !anyoneConnected && now - room.lastActivityAt > this.roomIdleMs;
      const tooOld = now - room.createdAt > this.maxRoomAgeMs;
      if (idle || tooOld) {
        this.removeRoom(room.code);
        removed.push(room.code);
        continue;
      }
      if (this.pruneDisconnected(room, now)) changed.push(room);
    }
    return { removed, changed };
  }

  removeRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const [sid, b] of [...this.sockets.entries()]) if (b.code === code) this.sockets.delete(sid);
    this.rooms.delete(code);
  }

  roomState(room: Room): RoomState {
    return {
      code: room.code,
      phase: room.engine.phase,
      round: room.round,
      hostConnected: room.hostSocketId !== null,
      minPlayers: this.gameConfig.minPlayers,
      maxPlayers: this.gameConfig.maxPlayers,
      players: room.engine.publicPlayers(),
      captainId: this.captainId(room),
      roundDurationMs: room.engine.config.roundDurationMs,
    };
  }

  // ------------------------------------------------------------ helpers

  private generateCode(): string {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a room code');
  }

  private uniqueNickname(room: Room, nickname: string): string {
    const taken = new Set([...room.players.values()].map((p) => p.nickname.toLowerCase()));
    if (!taken.has(nickname.toLowerCase())) return nickname;
    for (let n = 2; n < 100; n++) {
      const candidate = `${nickname.slice(0, 13)} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return nickname;
  }

  private freeColor(room: Room): string {
    const used = new Set([...room.players.values()].map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[room.players.size % PLAYER_COLORS.length]!;
  }
}
