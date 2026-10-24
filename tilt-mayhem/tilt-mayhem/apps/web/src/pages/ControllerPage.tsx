import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INPUT_SEND_HZ,
  type GameEndedPayload,
  type GamePhase,
  type PlayerSession,
  type RoomState,
  type ServerError,
} from '@tilt-mayhem/shared';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { JoinForm } from '../components/JoinForm';
import { TiltIndicator } from '../components/TiltIndicator';
import { TouchPad } from '../components/TouchPad';
import { useConnection } from '../hooks/useConnection';
import { useTilt, type TiltStatus, type Vec2 } from '../hooks/useTilt';
import { storage, type AxisSettings } from '../network/session';
import { api, socket } from '../network/socket';
import { navigate } from '../utils/router';
import { colorVar } from '../utils/style';
import '../styles/controller.css';

type JoinState = 'form' | 'joining' | 'joined';

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const vibrate = (pattern: number | number[]) => {
  try {
    // Browsers block vibration until the user has tapped the page.
    const activation = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (activation && !activation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

const TILT_HELP: Record<TiltStatus, string> = {
  idle: 'Tap below to turn on motion controls.',
  requesting: 'Allow motion access in the popup…',
  waiting: 'Listening for your phone’s motion sensor…',
  active: '',
  denied:
    'Motion access was blocked. Reload and tap Allow (on iPhone, close the tab and reopen the link first). Or use touch controls.',
  'no-data': 'No motion data from this device. Use touch controls instead.',
  unsupported: 'This browser has no motion sensor support. Use touch controls instead.',
  insecure: 'Motion sensors need a secure (https://) link. Use touch controls, or ask the host for the https link.',
};

export function ControllerPage({ code }: { code: string }) {
  const connected = useConnection();
  const saved = storage.player(code);
  const [joinState, setJoinState] = useState<JoinState>(saved ? 'joining' : 'form');
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [error, setError] = useState<ServerError | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [result, setResult] = useState<GameEndedPayload | null>(null);
  const [axis, setAxis] = useState<AxisSettings>(storage.axis);
  const [preferTouch, setPreferTouch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const tilt = useTilt({ invertX: axis.invertX, invertY: axis.invertY });
  const touchRef = useRef<Vec2>({ x: 0, y: 0 });
  const seqRef = useRef(0);
  const joiningRef = useRef(false);

  const phase: GamePhase = room?.phase ?? session?.phase ?? 'lobby';
  const me = room?.players.find((p) => p.id === session?.playerId) ?? null;
  const color = session?.color ?? '#ffffff';
  const tiltReady = tilt.status === 'active';
  const tiltBroken = ['denied', 'no-data', 'unsupported', 'insecure'].includes(tilt.status);
  const source: 'tilt' | 'touch' = tiltReady && !preferTouch ? 'tilt' : 'touch';
  const showTouch = preferTouch || tiltBroken;

  // ------------------------------------------------------------ joining

  const doJoin = useCallback(
    async (nickname: string, token?: string) => {
      if (joiningRef.current) return;
      joiningRef.current = true;
      setJoinState('joining');
      const res = await api.joinRoom({ code, nickname, token });
      joiningRef.current = false;
      if (res.ok) {
        storage.setPlayer(code, { token: res.token, nickname: res.nickname });
        storage.setNickname(nickname);
        setSession(res);
        setError(null);
        setJoinState('joined');
        return;
      }
      if (res.error.code === 'TIMEOUT' && token) {
        // Keep trying on the next reconnect.
        setJoinState('joining');
        return;
      }
      storage.setPlayer(code, null);
      setSession(null);
      setError(res.error);
      setJoinState('form');
    },
    [code],
  );

  // Resume automatically on load and after every reconnect.
  useEffect(() => {
    const resume = () => {
      const s = storage.player(code);
      if (s) void doJoin(s.nickname, s.token);
    };
    socket.on('connect', resume);
    if (socket.connected) resume();
    return () => {
      socket.off('connect', resume);
    };
  }, [code, doJoin]);

  // Room events.
  useEffect(() => {
    const onState = (s: RoomState) => {
      if (s.code === code) setRoom(s);
    };
    const onStarted = () => {
      setResult(null);
      // Players are told to hold still during the countdown: use that as neutral.
      tilt.recenter();
      vibrate(30);
    };
    const onEnded = (p: GameEndedPayload) => {
      setResult(p);
      vibrate([60, 40, 60]);
    };
    const onError = (e: ServerError) => {
      if (e.code === 'INVALID_SESSION') {
        setSession(null);
        setJoinState('form');
        setError(e);
      }
    };
    socket.on('room:state', onState);
    socket.on('game:started', onStarted);
    socket.on('game:ended', onEnded);
    socket.on('server:error', onError);
    return () => {
      socket.off('room:state', onState);
      socket.off('game:started', onStarted);
      socket.off('game:ended', onEnded);
      socket.off('server:error', onError);
    };
    // tilt.recenter is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ------------------------------------------------------------ input loop

  useEffect(() => {
    if (joinState !== 'joined' || phase !== 'playing' || !connected) return;
    const id = window.setInterval(() => {
      const v = source === 'tilt' ? tilt.inputRef.current : touchRef.current;
      seqRef.current += 1;
      socket.volatile.emit('player:input', { seq: seqRef.current, x: round3(v.x), y: round3(v.y) });
    }, 1000 / INPUT_SEND_HZ);
    return () => window.clearInterval(id);
  }, [joinState, phase, connected, source, tilt.inputRef]);

  // Buzz when my score goes up.
  const lastScore = useRef(0);
  useEffect(() => {
    const s = me?.score ?? 0;
    if (s > lastScore.current) vibrate(s - lastScore.current > 1 ? [25, 30, 25] : 20);
    lastScore.current = s;
  }, [me?.score]);

  // Keep the screen awake while joined.
  useEffect(() => {
    if (joinState !== 'joined') return;
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    const acquire = () => {
      if (document.visibilityState === 'visible' && nav.wakeLock) {
        nav.wakeLock
          .request('screen')
          .then((l) => (lock = l))
          .catch(() => undefined);
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [joinState]);

  // ------------------------------------------------------------ actions

  const onJoinSubmit = (nickname: string) => {
    // Ask for motion permission inside this tap (required on iOS).
    if (tilt.status === 'idle') void tilt.enable();
    void doJoin(nickname, storage.player(code)?.token);
  };

  const recenter = () => {
    tilt.recenter();
    api.recenter();
    vibrate(15);
  };

  const updateAxis = (next: AxisSettings) => {
    setAxis(next);
    storage.setAxis(next);
  };

  const leave = () => {
    storage.setPlayer(code, null);
    socket.disconnect();
    socket.connect();
    navigate('/');
  };

  // ------------------------------------------------------------ render

  if (joinState !== 'joined' || !session) {
    return (
      <div className="ctrl ctrl--join">
        <h1 className="logo logo--sm">
          TILT <span>MAYHEM</span>
        </h1>
        {joinState === 'joining' ? (
          <div className="card narrow">
            <p>Joining room {code}…</p>
            {!connected && <p className="muted small">Waiting for connection…</p>}
          </div>
        ) : (
          <JoinForm
            code={code}
            defaultNickname={storage.nickname()}
            busy={false}
            error={error}
            onSubmit={onJoinSubmit}
          />
        )}
        {error?.code === 'ROOM_NOT_FOUND' && (
          <button className="btn btn--ghost" onClick={() => navigate('/')}>
            Enter a different code
          </button>
        )}
        <ConnectionBadge connected={connected} />
      </div>
    );
  }

  // After a reload during results we missed game:ended; rank from room state instead.
  const myRank =
    result?.leaderboard.find((e) => e.id === session.playerId) ??
    (phase === 'results' && me && room
      ? { rank: 1 + room.players.filter((p) => p.score > me.score).length, score: me.score }
      : undefined);
  const banner =
    phase === 'lobby'
      ? { title: 'You’re in!', text: 'Waiting for the host to start…' }
      : phase === 'countdown'
        ? { title: 'Get ready!', text: 'Hold your phone still — calibrating' }
        : phase === 'playing'
          ? { title: 'GO!', text: source === 'tilt' ? 'Tilt to roll around' : 'Drag to move' }
          : {
              title: myRank ? `#${myRank.rank} place` : 'Round over',
              text: myRank ? `You scored ${myRank.score} point${myRank.score === 1 ? '' : 's'}` : 'Look at the big screen',
            };

  return (
    <div className="ctrl" style={colorVar(color)}>
      <header className="ctrl__bar">
        <span className="ctrl__me">
          <span className="avatar avatar--sm">{Array.from(session.nickname)[0]?.toUpperCase()}</span>
          {session.nickname}
        </span>
        <span className="ctrl__score" aria-label="Your score">
          {me?.score ?? 0}
        </span>
        <ConnectionBadge connected={connected} label={connected ? 'Live' : 'Reconnecting…'} />
      </header>

      <section className={`ctrl__banner ctrl__banner--${phase}`}>
        <h2>{banner.title}</h2>
        <p>{banner.text}</p>
      </section>

      <main className="ctrl__main">
        {showTouch ? (
          <>
            {tiltBroken && <p className="note">{TILT_HELP[tilt.status]}</p>}
            <TouchPad outputRef={touchRef} color={color} />
            {!tiltBroken && (
              <button className="btn btn--ghost" onClick={() => setPreferTouch(false)}>
                Use motion controls
              </button>
            )}
          </>
        ) : tiltReady ? (
          <>
            <TiltIndicator
              read={() => tilt.inputRef.current}
              readDebug={showSettings ? () => tilt.debugRef.current : undefined}
              color={color}
            />
            <button className="btn btn--big" onClick={recenter}>
              🎯 Recenter
            </button>
            <p className="muted small center">Hold the phone flat in front of you, then tap Recenter.</p>
          </>
        ) : (
          <div className="card setup">
            <div className="setup__phone" aria-hidden>
              📱
            </div>
            <h3>Motion controls</h3>
            <p className="muted">Hold your phone flat in front of you, screen up, like a tray.</p>
            <p className="note">{TILT_HELP[tilt.status]}</p>
            <button
              className="btn btn--big btn--go"
              onClick={() => void tilt.enable()}
              disabled={tilt.status === 'requesting'}
            >
              Enable motion controls
            </button>
            <button className="btn btn--ghost" onClick={() => setPreferTouch(true)}>
              Use touch controls instead
            </button>
          </div>
        )}
      </main>

      <footer className="ctrl__foot">
        {tiltReady && (
          <button className="btn btn--ghost btn--sm" onClick={() => setPreferTouch(!preferTouch)}>
            {preferTouch ? 'Use tilt' : 'Use touch'}
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? 'Hide settings' : 'Controls feel backwards?'}
        </button>
        {showSettings && (
          <div className="settings card">
            <label>
              <input
                type="checkbox"
                checked={axis.invertX}
                onChange={(e) => updateAxis({ ...axis, invertX: e.target.checked })}
              />
              Flip left / right
            </label>
            <label>
              <input
                type="checkbox"
                checked={axis.invertY}
                onChange={(e) => updateAxis({ ...axis, invertY: e.target.checked })}
              />
              Flip forward / back
            </label>
            <p className="muted small">
              Room {code} · tilt: {tilt.status}
            </p>
            <button className="btn btn--ghost btn--sm" onClick={leave}>
              Leave game
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
