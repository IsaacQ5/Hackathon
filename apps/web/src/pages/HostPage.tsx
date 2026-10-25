import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameEndedPayload, GameSnapshot, MatchResults, RoomState, ServerError } from '@tilt-mayhem/shared';
import { KitchenArena } from '../components/KitchenArena';
import { KitchenLobby } from '../components/KitchenLobby';
import { KitchenResults } from '../components/KitchenResults';
import { KitchenBuffer } from '../game/kbuffer';
import { storage } from '../network/session';
import { api, socket } from '../network/socket';
import { joinUrlFor, navigate } from '../utils/router';
import { sfx } from '../utils/sound';
import '../styles/sizzle.css';

type Status = 'claiming' | 'ready' | 'lost';

/** How long the kitchen shows the winner before the results table. */
const WINNER_SPOTLIGHT_MS = 3500;

/** Fallback when the host reloads during results and missed game:results. */
function resultsFrom(room: RoomState, ended: GameEndedPayload | null): MatchResults {
  const order = ended?.leaderboard ?? [...room.players].sort((a, b) => b.score - a.score).map((p, i) => ({ rank: i + 1, id: p.id }));
  return {
    round: room.round,
    durationMs: 0,
    winnerIds: order.filter((e) => e.rank === 1).map((e) => e.id),
    results: order.map((e) => {
      const p = room.players.find((x) => x.id === e.id);
      return {
        id: e.id,
        nickname: p?.nickname ?? '?',
        color: p?.color ?? '#fff',
        face: p?.face ?? 'stache',
        placement: e.rank,
        score: p?.score ?? 0,
        served: 0,
        fastestMs: null,
        favoriteStation: null,
        gestures: 0,
        oops: 0,
      };
    }),
  };
}

export function HostPage({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>('claiming');
  const [fatal, setFatal] = useState<ServerError | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [results, setResults] = useState<GameEndedPayload | null>(null);
  const [match, setMatch] = useState<MatchResults | null>(null);
  const [showTable, setShowTable] = useState(true);
  const buffer = useMemo(() => new KitchenBuffer(), []);
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
      setMatch(null);
      buffer.reset();
    };
    const onEnded = (p: GameEndedPayload) => setResults(p);
    const onMatch = (m: MatchResults) => {
      setMatch(m);
      setShowTable(false);
      window.setTimeout(() => setShowTable(true), WINNER_SPOTLIGHT_MS);
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
    socket.on('game:results', onMatch);
    socket.on('server:error', onError);
    socket.on('connect', claim);
    if (socket.connected) void claim();
    return () => {
      socket.off('room:state', onState);
      socket.off('game:started', onStarted);
      socket.off('game:snapshot', onSnapshot);
      socket.off('game:ended', onEnded);
      socket.off('game:results', onMatch);
      socket.off('server:error', onError);
      socket.off('connect', claim);
    };
  }, [buffer, claim, code]);

  // The head chef starts shifts from their phone, so the TV may never be clicked.
  // Browsers only allow sound after a click: any click on this page unlocks it.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  if (status === 'lost') {
    return (
      <div className="center-screen">
        <div className="kcard narrow">
          <h2>Can't host this kitchen</h2>
          <p className="muted">{fatal?.message ?? 'The room is no longer available.'}</p>
          <button className="kbtn" onClick={() => navigate('/')}>
            Open a new kitchen
          </button>
        </div>
      </div>
    );
  }

  const phase = room?.phase ?? 'lobby';
  const showKitchen = phase === 'countdown' || phase === 'playing' || (phase === 'results' && !showTable && match);

  return (
    <div className="khost">
      <header className="khost__bar">
        <h1 className="klogo klogo--sm">
          SIZZLE <span>SCRAMBLE</span>
        </h1>
        <div className="khost__join">
          Join at <b>{joinUrl.replace(/^https?:\/\//, '').replace(/\/play\/.*/, '')}</b> · code <b className="khost__code">{code}</b>
        </div>
      </header>

      <main className="khost__main">
        {!room ? (
          <div className="center-screen">
            <p className="muted">Connecting to kitchen {code}…</p>
          </div>
        ) : showKitchen ? (
          <KitchenArena buffer={buffer} />
        ) : phase === 'lobby' ? (
          <KitchenLobby room={room} joinUrl={joinUrl} />
        ) : (
          <KitchenResults results={match ?? resultsFrom(room, results)} room={room} code={code} />
        )}
      </main>
    </div>
  );
}
