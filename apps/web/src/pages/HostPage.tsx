import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameEndedPayload, GameSnapshot, LeaderboardEntry, RoomState, ServerError } from '@tilt-mayhem/shared';
import { Arena } from '../components/Arena';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { Leaderboard } from '../components/Leaderboard';
import { Lobby } from '../components/Lobby';
import { Scoreboard } from '../components/Scoreboard';
import { useConnection } from '../hooks/useConnection';
import { storage } from '../network/session';
import { api, socket } from '../network/socket';
import { SnapshotBuffer } from '../utils/interpolation';
import { joinUrlFor, navigate } from '../utils/router';
import { sfx } from '../utils/sound';
import '../styles/host.css';

type Status = 'claiming' | 'ready' | 'lost';

/** Fallback when the host reloads during results and missed game:ended. */
function leaderboardFrom(room: RoomState): LeaderboardEntry[] {
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  let lastScore = Number.NaN;
  let lastRank = 0;
  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1;
    lastScore = p.score;
    lastRank = rank;
    return { rank, id: p.id, nickname: p.nickname, color: p.color, score: p.score };
  });
}

export function HostPage({ code }: { code: string }) {
  const connected = useConnection();
  const [status, setStatus] = useState<Status>('claiming');
  const [fatal, setFatal] = useState<ServerError | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [results, setResults] = useState<GameEndedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ServerError | null>(null);
  const [muted, setMuted] = useState(false);
  const buffer = useMemo(() => new SnapshotBuffer(), []);
  const claimingRef = useRef(false);
  const joinUrl = joinUrlFor(code);

  /** (Re)claim the host role. Runs on mount and after every reconnect. */
  const claim = useCallback(async () => {
    if (claimingRef.current) return;
    const token = storage.hostToken(code);
    if (!token) {
      setStatus('lost');
      setFatal({ code: 'INVALID_SESSION', message: 'This screen is not the host of that room.' });
      return;
    }
    claimingRef.current = true;
    const res = await api.resumeHost(code, token);
    claimingRef.current = false;
    if (res.ok) {
      storage.setHostToken(code, res.token);
      setStatus('ready');
      setFatal(null);
    } else if (res.error.code === 'TIMEOUT') {
      // Will retry on next connect.
    } else {
      storage.setHostToken(code, null);
      setStatus('lost');
      setFatal(res.error);
    }
  }, [code]);

  useEffect(() => {
    const onState = (s: RoomState) => {
      if (s.code !== code) return;
      setRoom(s);
    };
    const onStarted = () => {
      setResults(null);
      setActionError(null);
      buffer.reset();
    };
    const onEnded = (p: GameEndedPayload) => {
      setResults(p);
      sfx.end();
    };
    const onError = (e: ServerError) => {
      if (e.code === 'INVALID_SESSION') {
        setStatus('lost');
        setFatal(e);
      }
    };
    const onSnapshot = (s: GameSnapshot) => buffer.push(s);
    socket.on('room:state', onState);
    socket.on('game:started', onStarted);
    socket.on('game:snapshot', onSnapshot);
    socket.on('game:ended', onEnded);
    socket.on('server:error', onError);
    socket.on('connect', claim);
    if (socket.connected) void claim();
    return () => {
      socket.off('room:state', onState);
      socket.off('game:started', onStarted);
      socket.off('game:snapshot', onSnapshot);
      socket.off('game:ended', onEnded);
      socket.off('server:error', onError);
      socket.off('connect', claim);
    };
  }, [buffer, claim, code]);

  const start = async (kind: 'start' | 'rematch') => {
    sfx.unlock();
    setBusy(true);
    setActionError(null);
    const res = kind === 'start' ? await api.startGame() : await api.rematch();
    setBusy(false);
    if (!res.ok) setActionError(res.error);
  };

  const toggleMute = () => {
    sfx.unlock();
    sfx.muted = !muted;
    setMuted(!muted);
  };

  if (status === 'lost') {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>Can't host this room</h2>
          <p className="muted">{fatal?.message ?? 'The room is no longer available.'}</p>
          <button className="btn btn--big" onClick={() => navigate('/')}>
            Create a new room
          </button>
        </div>
      </div>
    );
  }

  const phase = room?.phase ?? 'lobby';
  const connectedPlayers = room?.players.filter((p) => p.connected).length ?? 0;

  return (
    <div className="host">
      <header className="host__bar">
        <h1 className="logo logo--sm">
          TILT <span>MAYHEM</span>
        </h1>
        <div className="host__join">
          Join at <b>{joinUrl.replace(/^https?:\/\//, '').replace(/\/play\/.*/, '')}</b> · code{' '}
          <b className="host__code">{code}</b>
        </div>
        <div className="host__right">
          {room && room.round > 0 && <span className="pill">Round {room.round}</span>}
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <ConnectionBadge connected={connected && status === 'ready'} />
        </div>
      </header>

      <main className="host__main">
        {!room ? (
          <div className="center-screen">
            <p className="muted">Connecting to room {code}…</p>
          </div>
        ) : phase === 'lobby' ? (
          <Lobby room={room} joinUrl={joinUrl} onStart={() => void start('start')} starting={busy} error={actionError} />
        ) : phase === 'results' ? (
          <Leaderboard
            entries={results?.leaderboard ?? leaderboardFrom(room)}
            round={results?.round ?? room.round}
            code={code}
            onRematch={() => void start('rematch')}
            busy={busy}
            error={actionError}
            canRematch={connectedPlayers >= room.minPlayers}
          />
        ) : (
          <div className="host__game">
            <Arena buffer={buffer} />
            <Scoreboard players={room.players} />
          </div>
        )}
      </main>
    </div>
  );
}
