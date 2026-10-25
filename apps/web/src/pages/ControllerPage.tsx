import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INGREDIENTS,
  INPUT_SEND_HZ,
  recipeById,
  stationById,
  type ChefFace,
  type GameEndedPayload,
  type GamePhase,
  type KitchenStatus,
  type MatchResults,
  type PlayerSession,
  type RoomState,
  type ServerError,
} from '@tilt-mayhem/shared';
import { ChefPortrait } from '../components/ChefPortrait';
import { CustomizeCard } from '../components/CustomizeCard';
import { Emoji, EmojiText } from '../components/Emoji';
import { HeadChefCard } from '../components/HeadChefCard';
import { JoinForm } from '../components/JoinForm';
import { PushBar } from '../components/PushBar';
import { RecipeBar } from '../components/RecipeBar';
import { RecoveryPanel } from '../components/RecoveryPanel';
import { StationPanel } from '../components/StationPanel';
import { TiltIndicator } from '../components/TiltIndicator';
import { TouchPad } from '../components/TouchPad';
import { awardsFor, fmtSecs, ordinal } from '../game/kawards';
import { useConnection } from '../hooks/useConnection';
import { useShake } from '../hooks/useShake';
import { useTilt, type TiltStatus, type Vec2 } from '../hooks/useTilt';
import { storage, type AxisSettings } from '../network/session';
import { api, kitchenApi, socket } from '../network/socket';
import { prefs, type ControllerPrefs } from '../utils/prefs';
import { captainIdOf } from '../utils/room';
import { navigate } from '../utils/router';
import { colorVar } from '../utils/style';
import '../styles/controller.css';
import '../styles/sizzle.css';

type JoinState = 'form' | 'joining' | 'joined';

/** How many times we've reloaded to get the phone's motion popup back (per tab). */
const MOTION_RELOADS_KEY = 'ss:motionReloads';
const MAX_MOTION_RELOADS = 2;
function readMotionReloads(): number {
  try {
    return Number(sessionStorage.getItem(MOTION_RELOADS_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeMotionReloads(n: number) {
  try {
    if (n > 0) sessionStorage.setItem(MOTION_RELOADS_KEY, String(n));
    else sessionStorage.removeItem(MOTION_RELOADS_KEY);
  } catch {
    /* storage blocked: we just won't remember */
  }
}

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
  idle: 'Tap below to walk by tilting your phone.',
  requesting: 'Allow motion access in the popup…',
  waiting: 'Listening for your phone’s motion sensor…',
  active: '',
  denied:
    'Motion access was blocked. Reload and tap Allow (on iPhone, close the tab and reopen the link first). The on-screen joystick works too!',
  'no-data': 'No motion sensor here, so you get an on-screen joystick and buttons at stations.',
  unsupported: 'This browser has no motion sensors, so you get an on-screen joystick and buttons at stations.',
  insecure: 'Motion needs a secure (https://) link. Use the on-screen joystick, or ask the host for the https link.',
};

export function ControllerPage({ code }: { code: string }) {
  const connected = useConnection();
  const saved = storage.player(code);
  const [joinState, setJoinState] = useState<JoinState>(saved ? 'joining' : 'form');
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [error, setError] = useState<ServerError | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [result, setResult] = useState<GameEndedPayload | null>(null);
  const [match, setMatch] = useState<MatchResults | null>(null);
  const [status, setStatus] = useState<KitchenStatus | null>(null);
  const [axis, setAxis] = useState<AxisSettings>(storage.axis);
  const [ctrl, setCtrl] = useState<ControllerPrefs>(prefs.controller);
  const [showSettings, setShowSettings] = useState(false);

  const tilt = useTilt({ invertX: axis.invertX, invertY: axis.invertY, fullTiltDeg: ctrl.tiltDeg });
  const touchRef = useRef<Vec2>({ x: 0, y: 0 });
  const seqRef = useRef(0);
  const joiningRef = useRef(false);

  const phase: GamePhase = room?.phase ?? session?.phase ?? 'lobby';
  const me = room?.players.find((p) => p.id === session?.playerId) ?? null;
  const color = me?.color ?? session?.color ?? '#ffffff';
  const face: ChefFace = me?.face ?? 'plain';
  const captainId = room ? captainIdOf(room) : null;
  const isCaptain = !!session && captainId === session.playerId;
  const captainName = room?.players.find((p) => p.id === captainId)?.nickname ?? null;
  const tiltReady = tilt.status === 'active';
  const tiltBroken = ['denied', 'no-data', 'unsupported', 'insecure'].includes(tilt.status);
  // Tilt to walk; the joystick only appears when this phone can't do motion.
  const mode: 'tilt' | 'joystick' = tiltBroken ? 'joystick' : 'tilt';
  const source: 'tilt' | 'touch' = mode === 'tilt' && tiltReady ? 'tilt' : 'touch';
  // The same permission covers the station gestures.
  const motionAllowed = tiltReady;

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

  // Room + game events.
  useEffect(() => {
    const onState = (s: RoomState) => {
      if (s.code === code) setRoom(s);
    };
    const onStarted = () => {
      setResult(null);
      setMatch(null);
      // Players are told to hold still during the countdown: use that as neutral.
      tilt.recenter();
      vibrate(30);
    };
    const onEnded = (p: GameEndedPayload) => {
      setResult(p);
      vibrate([60, 40, 60]);
    };
    const onMatch = (m: MatchResults) => setMatch(m);
    const onStatus = (s: KitchenStatus) => setStatus(s);
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
    socket.on('game:results', onMatch);
    socket.on('kitchen:status', onStatus);
    socket.on('server:error', onError);
    return () => {
      socket.off('room:state', onState);
      socket.off('game:started', onStarted);
      socket.off('game:ended', onEnded);
      socket.off('game:results', onMatch);
      socket.off('kitchen:status', onStatus);
      socket.off('server:error', onError);
    };
    // tilt.recenter is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ------------------------------------------------------------ input loop

  // Stand still while cooking or while a hazard has you.
  const working = !!status?.working || !!status?.stuck;
  useEffect(() => {
    if (joinState !== 'joined' || phase !== 'playing' || !connected || working) return;
    const id = window.setInterval(() => {
      const v = source === 'tilt' ? tilt.inputRef.current : touchRef.current;
      seqRef.current += 1;
      socket.volatile.emit('player:input', { seq: seqRef.current, x: round3(v.x), y: round3(v.y) });
    }, 1000 / INPUT_SEND_HZ);
    return () => {
      window.clearInterval(id);
      // Stand still while cooking.
      seqRef.current += 1;
      socket.volatile.emit('player:input', { seq: seqRef.current, x: 0, y: 0 });
    };
  }, [joinState, phase, connected, source, tilt.inputRef, working]);

  // Buzz when you arrive somewhere useful, and when you score.
  const canInteract = status?.canInteract ?? false;
  const canServe = status?.canServe ?? false;
  useEffect(() => {
    if (canInteract) vibrate([30, 40, 30]);
  }, [canInteract, status?.near]);
  useEffect(() => {
    if (canServe) vibrate([40, 40, 80]);
  }, [canServe]);
  // Buzz when someone shoves you.
  const pushedName = status?.pushedBy?.name ?? null;
  useEffect(() => {
    if (pushedName) vibrate([80, 40, 80]);
  }, [pushedName]);

  // Tapped Deny on the phone's motion popup: our popup asks them to allow it, and its button
  // re-opens the phone's own grey Allow/Deny box. iOS won't show that box again on the same page
  // after a Deny (it silently says "denied"), so in that case we reload (they stay in the game,
  // the session resumes) and the popup comes straight back: on that page the button opens the box.
  const [askAfterReload] = useState(() => readMotionReloads() > 0);
  const [motionStuck, setMotionStuck] = useState(false);
  const retryMotion = async () => {
    const result = await tilt.enable();
    if (result === 'blocked') {
      const reloads = readMotionReloads();
      if (reloads >= MAX_MOTION_RELOADS) {
        // This iPhone keeps the Deny even across reloads: tell them how to reset it.
        setMotionStuck(true);
        return;
      }
      writeMotionReloads(reloads + 1);
      window.location.reload();
    }
    // 'denied': they saw the box and pressed Deny again; the popup stays so they can try again.
  };
  useEffect(() => {
    if (tilt.status === 'waiting' || tilt.status === 'active') writeMotionReloads(0);
  }, [tilt.status]);
  const showMotionPopup = tilt.status === 'denied' || (askAfterReload && tilt.status === 'idle');

  const lastScore = useRef(0);
  useEffect(() => {
    const s = status?.score ?? 0;
    if (s > lastScore.current) vibrate([60, 30, 60, 30, 120]);
    lastScore.current = s;
  }, [status?.score]);

  // Shake the phone hard while walking to shove the chef next to you (the server checks range + cooldown).
  const canPush = joinState === 'joined' && phase === 'playing' && motionAllowed && !status?.working && !status?.stuck;
  useShake(canPush, () => {
    kitchenApi.push();
    vibrate(40);
  });

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

  const updateCtrl = (next: ControllerPrefs) => {
    setCtrl(next);
    prefs.setController(next);
  };

  const leave = () => {
    storage.setPlayer(code, null);
    socket.disconnect();
    socket.connect();
    navigate('/');
  };

  // ------------------------------------------------------------ render: join

  if (joinState !== 'joined' || !session) {
    return (
      <div className="kctrl kctrl--join">
        <h1 className="klogo klogo--sm">
          SIZZLE <span>SCRAMBLE</span>
        </h1>
        {joinState === 'joining' ? (
          <div className="kcard narrow">
            <p>Joining kitchen {code}…</p>
            {!connected && <p className="muted small">Waiting for connection…</p>}
          </div>
        ) : (
          <JoinForm code={code} defaultNickname={storage.nickname()} busy={false} error={error} onSubmit={onJoinSubmit} />
        )}
        {error?.code === 'ROOM_NOT_FOUND' && (
          <button className="kbtn kbtn--ghost" onClick={() => navigate('/')}>
            Enter a different code
          </button>
        )}
      </div>
    );
  }

  const secs = Math.max(0, Math.ceil((status?.timeLeftMs ?? 0) / 1000));
  const header = (
    <header className="kctrl__bar">
      <span className="kctrl__me">
        <ChefPortrait color={color} face={face} size={40} />
        <b>{session.nickname}</b>
      </span>
      {phase === 'playing' && (
        <span className={`kctrl__timer ${status?.rush ? 'is-rush' : ''}`}>
          {status?.rush ? <EmojiText text="🔥x2 " /> : ''}
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </span>
      )}
      <span className="kctrl__score">{status?.score ?? me?.score ?? 0}</span>
      {status?.pushedBy && (
        <div className="kpushed" role="status">
          <Emoji ch="😠" />{' '}
          <b>{status.pushedBy.name}</b>{' '}
          {status.pushedBy.offStation ? 'pushed you off the station! Tap the station again to keep cooking.' : 'pushed you!'}
        </div>
      )}
      {showMotionPopup && (
        <div className="kmodal" role="dialog" aria-modal="true" aria-labelledby="motion-title">
          <div className="kcard kmodal__card">
            <Emoji ch="📱" className="kmodal__icon" />
            <h2 id="motion-title">This game runs on phone motion</h2>
            <p>
              Please press <b>Allow</b> so you can tilt, chop, flip and pour with your phone.
            </p>
            {motionStuck ? (
              <p className="note small">
                Your phone is still blocking motion for this page. Close this browser tab, open the game link again,
                and press <b>Allow</b> when your phone asks. You&apos;ll rejoin as the same chef.
              </p>
            ) : (
              <button className="kbtn kbtn--go" onClick={() => void retryMotion()} disabled={tilt.status === 'requesting'}>
                Allow motion
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );

  const settingsPanel = (
    <>
      <button className="kbtn kbtn--ghost kbtn--sm" onClick={() => setShowSettings(!showSettings)}>
        <EmojiText text={showSettings ? 'Hide controls' : '⚙️ Controls'} />
      </button>
      {showSettings && (
        <div className="kcard ksettings">
          {tiltBroken && <p className="note small">{TILT_HELP[tilt.status]}</p>}
          <label className="kslider">
            Tilt sensitivity
            <input
              type="range"
              min={10}
              max={40}
              step={1}
              value={50 - ctrl.tiltDeg}
              onChange={(e) => updateCtrl({ ...ctrl, tiltDeg: 50 - Number(e.target.value) })}
            />
          </label>
          <label>
            <input type="checkbox" checked={axis.invertX} onChange={(e) => updateAxis({ ...axis, invertX: e.target.checked })} />
            Flip left / right
          </label>
          <label>
            <input type="checkbox" checked={axis.invertY} onChange={(e) => updateAxis({ ...axis, invertY: e.target.checked })} />
            Flip forward / back
          </label>
          <p className="muted small">
            Kitchen {code} · motion: {tilt.status}
          </p>
          <button className="kbtn kbtn--ghost kbtn--sm" onClick={leave}>
            Leave game
          </button>
        </div>
      )}
    </>
  );

  const motionSetup =
    !tiltReady && !tiltBroken ? (
      <div className="kcard ksetup">
        <p>{TILT_HELP[tilt.status]}</p>
        <button className="kbtn kbtn--go" onClick={() => void tilt.enable()} disabled={tilt.status === 'requesting'}>
          <EmojiText text="📱 Enable motion controls" />
        </button>
      </div>
    ) : null;

  // ------------------------------------------------------------ render: lobby / results

  if (phase === 'lobby' || phase === 'results') {
    const mine = match?.results.find((r) => r.id === session.playerId);
    const myAwards = mine && match ? awardsFor(match.results).get(mine.id) ?? [] : [];
    const fallbackRank = result?.leaderboard.find((e) => e.id === session.playerId)?.rank;
    const tiedFirst = !!match && match.winnerIds.length > 1 && match.winnerIds.includes(session.playerId);
    const title = mine
      ? tiedFirst
        ? "🤷 IT'S A TIE!"
        : mine.placement === 1 && mine.score > 0
        ? '👑 HEAD CHEF!'
        : `${ordinal(mine.placement)} place`
      : fallbackRank
        ? `${ordinal(fallbackRank)} place`
        : 'Kitchen closed';
    return (
      <div className="kctrl" style={colorVar(color)}>
        {header}
        {isCaptain && room && <HeadChefCard room={room} phase={phase} />}
        {phase === 'results' && (
          <section className={`kcard kplace ${mine?.placement === 1 && mine.score > 0 && !tiedFirst ? 'kplace--win' : ''}`}>
            <h2>
              <EmojiText text={title} />
            </h2>
            {mine && (
              <p className="kplace__stats">
                {mine.score} pts · {mine.served} dish{mine.served === 1 ? '' : 'es'}
                {mine.fastestMs !== null ? ` · fastest ${fmtSecs(mine.fastestMs)}` : ''}
              </p>
            )}
            {myAwards.map((a) => (
              <p key={a.title} className="kaward">
                <Emoji ch={a.emoji} /> {a.title} <small>({a.why})</small>
              </p>
            ))}
          </section>
        )}
        <section className="kbanner">
          <ChefPortrait color={color} face={face} size={110} />
          <h2>{phase === 'lobby' ? 'You’re on the line!' : 'Another shift?'}</h2>
          <p>
            {isCaptain
              ? 'You’re the head chef: you start the shift!'
              : `Waiting for ${captainName ?? 'the head chef'} to start…`}
          </p>
        </section>
        <CustomizeCard color={color} face={face} players={room?.players ?? []} myId={session.playerId} />
        {motionSetup}
        <section className="kcard khowto-card">
          <h3>How to cook</h3>
          <ol>
            <li>Your recipe shows 4 station symbols at the top of this screen.</li>
            <li>{mode === 'tilt' ? 'Tilt' : 'Use the stick'} to walk to a station. Your phone buzzes when you're there.</li>
            <li>Tap the button under the circle, then do the motion shown on screen.</li>
            <li>Got all 4? Walk to the SERVE table in the middle and hit SERVE!</li>
            <li>Kitchen chaos! If a spill, chicken, meteor or fire gets you, your phone takes over: do the move it shows to get back up.</li>
            <li>Standing right next to another chef? Shake your phone hard to PUSH them away (knocks them off their station). Recharges in 5 seconds.</li>
          </ol>
        </section>
        <footer className="kctrl__foot">{settingsPanel}</footer>
      </div>
    );
  }

  // ------------------------------------------------------------ render: countdown

  if (phase === 'countdown') {
    return (
      <div className="kctrl kctrl--ready" style={colorVar(color)}>
        {header}
        {status && <RecipeBar recipeId={status.recipeId} have={status.have} workingIngredient={null} />}
        <section className="kready">
          <ChefPortrait color={color} face={face} size={140} station="stir" />
          <h2>GET READY!</h2>
          <p>{mode === 'tilt' ? 'Hold your phone flat and still: calibrating…' : 'Thumbs on the controls!'}</p>
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------ render: hit by a hazard

  // Slipped / knocked down / feathered / fighting a fire: the whole phone is taken over until you recover.
  if (status?.stuck) {
    return (
      <div className="kctrl kctrl--work" style={colorVar(color)}>
        {header}
        <RecoveryPanel stuck={status.stuck} motionAllowed={motionAllowed} />
      </div>
    );
  }

  // ------------------------------------------------------------ render: at a station

  if (status?.working) {
    return (
      <div className="kctrl kctrl--work" style={colorVar(color)}>
        {header}
        <RecipeBar recipeId={status.recipeId} have={status.have} workingIngredient={status.working.ingredient} />
        <StationPanel work={status.working} motionAllowed={motionAllowed} />
      </div>
    );
  }

  // ------------------------------------------------------------ render: walking around

  const near = status?.near ?? null;
  const nearDef = near && near !== 'pass' ? stationById(near) : null;
  const recipe = status ? recipeById(status.recipeId) : undefined;
  const neededHere =
    nearDef && recipe && status
      ? recipe.ingredients.find((i) => INGREDIENTS.get(i)?.station === nearDef.id && !status.have.includes(i))
      : undefined;
  const neededIcon = neededHere ? INGREDIENTS.get(neededHere)?.ingredient.icon ?? '' : '';
  const allFour = status ? status.have.length === 4 : false;

  let action: { label: string; cls: string; onClick?: () => void } = { label: 'Walk to a station', cls: 'is-idle' };
  if (canServe) action = { label: '🔔 SERVE!', cls: 'is-serve', onClick: () => kitchenApi.serve() };
  else if (canInteract && nearDef && status?.fireHere) action = { label: `🔥 PUT OUT THE FIRE!`, cls: 'is-go is-fire', onClick: () => kitchenApi.interact() };
  else if (canInteract && nearDef) action = { label: `${nearDef.icon} ${nearDef.verb} ${neededIcon}`, cls: 'is-go', onClick: () => kitchenApi.interact() };
  else if (nearDef) action = { label: `${nearDef.icon} Nothing needed here`, cls: 'is-no' };
  else if (near === 'pass') action = { label: 'Make all 4 first!', cls: 'is-no' };
  else if (allFour) action = { label: '🔔 Take it to SERVE!', cls: 'is-hint' };

  return (
    <div className={`kctrl kctrl--play ${status?.rush ? 'is-rush' : ''}`} style={colorVar(color)}>
      {header}
      {status && <RecipeBar recipeId={status.recipeId} have={status.have} workingIngredient={null} />}
      {status && <PushBar readyInMs={status.pushReadyInMs} tapToPush={!motionAllowed} onPush={() => kitchenApi.push()} />}
      <div className="kctrl__move">
        {mode === 'tilt' && tiltReady ? (
          <TiltIndicator read={() => tilt.inputRef.current} color={color} />
        ) : mode === 'joystick' ? (
          <TouchPad outputRef={touchRef} color={color} />
        ) : (
          motionSetup
        )}
      </div>
      <button className={`kact ${action.cls}`} disabled={!action.onClick} onClick={action.onClick}>
        <EmojiText text={action.label} />
      </button>
      <footer className="kctrl__foot kctrl__foot--row">
        {mode === 'tilt' && tiltReady && (
          <button className="kbtn kbtn--ghost kbtn--sm" onClick={recenter}>
            <EmojiText text="🎯 Recenter" />
          </button>
        )}
        {status && (
          <span className="kctrl__rank">
            #{status.rank} · {status.served} served
          </span>
        )}
        {settingsPanel}
      </footer>
    </div>
  );
}
