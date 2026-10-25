import type {
  Ack,
  GamePhase,
  GameSnapshot,
  KitchenStatus,
  LeaderboardEntry,
  MatchResults,
  PlayerInput,
  Role,
  RoomState,
  ServerError,
} from './types.js';
import type { ChefFace } from './kitchen.js';

export type EmptyPayload = Record<string, never>;

// ---------- Payloads ----------

export interface CreateRoomPayload {
  nickname?: string;
}

export interface SessionInfo {
  code: string;
  playerId: string;
  role: Role;
}

/** Returned to the host. `token` is secret and only ever sent to its owner. */
export interface HostSession extends SessionInfo {
  role: 'host';
  token: string;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
  /** Reconnect token from a previous join of this room, if any. */
  token?: string;
}

export interface PlayerSession extends SessionInfo {
  role: 'player';
  token: string;
  nickname: string;
  color: string;
  phase: GamePhase;
  /** True when an existing player was restored from a reconnect token. */
  resumed: boolean;
}

export interface ResumeHostPayload {
  code: string;
  token: string;
}

/** Lobby only: change your chef's colour and/or face. */
export interface CustomizePayload {
  color?: string;
  face?: string;
}

export interface GameStartedPayload {
  round: number;
  /** Server time (ms) when the countdown began. */
  serverTime: number;
  countdownMs: number;
  roundDurationMs: number;
  /** Server time (ms) when movement starts. */
  playStartsAt: number;
}

export interface GameEndedPayload {
  round: number;
  leaderboard: LeaderboardEntry[];
}

export interface PingResult {
  serverTime: number;
}

// ---------- Event maps ----------

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: Ack<HostSession>) => void;
  'room:join': (payload: JoinRoomPayload, ack: Ack<PlayerSession>) => void;
  /** Host reclaims its room after a reload/reconnect. */
  'room:resume-host': (payload: ResumeHostPayload, ack: Ack<HostSession>) => void;
  'game:start': (payload: EmptyPayload, ack: Ack<object>) => void;
  'game:rematch': (payload: EmptyPayload, ack: Ack<object>) => void;
  /** High-frequency; sent with volatile delivery. */
  'player:input': (payload: PlayerInput) => void;
  /** Head chef (or host screen), between shifts: set the next shift's length. */
  'room:settings': (payload: { roundMinutes: number }, ack: Ack<object>) => void;
  /** Lobby/results only: pick a free colour and a face cosmetic. */
  'player:customize': (payload: CustomizePayload, ack: Ack<{ color: string; face: ChefFace }>) => void;
  /** Informational: the phone recalibrated locally. */
  'player:recenter': (payload: EmptyPayload) => void;
  /** Connectivity test + clock sample. */
  'net:ping': (payload: EmptyPayload, ack: (result: PingResult) => void) => void;

  // Sizzle Scramble
  /** Start working at the station you're standing at. */
  'kitchen:interact': (payload: EmptyPayload) => void;
  /** One recognised gesture at your station (good, or a messed-up one). */
  'kitchen:rep': (payload: { good: boolean }) => void;
  /** Step away from the station (progress is kept). */
  'kitchen:cancel': (payload: EmptyPayload) => void;
  /** One recovery motion while stuck (mop / get up / shake off feathers / fan the fire). */
  'kitchen:recover': (payload: { good: boolean }) => void;
  /** Shook the phone hard: shove the chef standing right next to you. */
  'kitchen:push': (payload: EmptyPayload) => void;
  /** Send the finished dish at the pass. */
  'kitchen:serve': (payload: EmptyPayload) => void;
}

export interface ServerToClientEvents {
  'room:created': (payload: SessionInfo) => void;
  'room:state': (state: RoomState) => void;
  'game:started': (payload: GameStartedPayload) => void;
  'game:snapshot': (snapshot: GameSnapshot) => void;
  'game:ended': (payload: GameEndedPayload) => void;
  'server:error': (error: ServerError) => void;

  // Sizzle Scramble
  /** Sent ~10x/s to each phone: its own chef's recipe, progress and score. */
  'kitchen:status': (status: KitchenStatus) => void;
  /** Sent with game:ended: rankings + stats. */
  'game:results': (payload: MatchResults) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface InterServerEvents {}

/** Per-socket data the server stores on `socket.data`. */
export interface SocketData {
  code?: string;
  role?: Role;
  playerId?: string;
}
