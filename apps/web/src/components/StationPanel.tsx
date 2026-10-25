import { useCallback, useEffect, useRef, useState } from 'react';
import { INGREDIENTS, stationById, type ChefWork } from '@tilt-mayhem/shared';
import { useMotionGesture } from '../hooks/useMotionGesture';
import { kitchenApi } from '../network/socket';
import { colorVar } from '../utils/style';
import { TouchStation } from './TouchStation';
import { Emoji } from './Emoji';

interface Props {
  work: ChefWork;
  /** Motion permission granted and sensors available. */
  motionAllowed: boolean;
}

const buzz = (ms: number | number[]) => {
  try {
    const ua = (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
};

/**
 * Full-screen station mode on the phone: what to do, a live motion meter, the
 * progress bar, and an on-screen fallback when motion isn't available.
 */
export function StationPanel({ work, motionAllowed }: Props) {
  const def = stationById(work.station);
  const ing = INGREDIENTS.get(work.ingredient)?.ingredient;
  const [flash, setFlash] = useState<{ good: boolean; at: number } | null>(null);
  const [localReps, setLocalReps] = useState(0);
  const meterRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const lastSent = useRef(0);

  const onRep = useCallback(
    (good: boolean) => {
      const now = performance.now();
      // Don't spam the server faster than the station allows.
      if (now - lastSent.current < def.minRepMs) return;
      lastSent.current = now;
      kitchenApi.rep(good);
      setFlash({ good, at: now });
      setLocalReps((n) => (good ? n + 1 : Math.max(0, n - def.badPenalty)));
      buzz(good ? 15 : [40, 30, 40]);
    },
    [def.minRepMs, def.badPenalty],
  );

  // On-screen buttons are only a fallback for phones that can't do motion.
  const useMotion = motionAllowed;
  const { sensorOk, liveRef } = useMotionGesture(work.station, useMotion, onRep);
  const showButtons = !useMotion || sensorOk === false;

  // Live meter + coaching text without re-rendering at 60 Hz.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const live = liveRef.current;
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.max(0.02, live.energy)})`;
      if (promptRef.current && !showButtons && live.prompt) promptRef.current.textContent = live.prompt;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [liveRef, showButtons]);

  // Progress: the server's number, nudged forward by gestures it hasn't confirmed yet.
  const serverReps = Math.round(work.progress * def.reps);
  useEffect(() => setLocalReps(serverReps), [serverReps]);
  const progress = Math.min(1, Math.max(work.progress, localReps / def.reps));
  const recent = flash && performance.now() - flash.at < 350;

  return (
    <div className={`kpanel kpanel--${work.station}`} style={colorVar(def.color)}>
      <header className="kpanel__head">
        <Emoji ch={def.icon} className="kpanel__icon" />
        <div>
          <h2>{def.name}</h2>
          <p>
            Making <b>{ing && <Emoji ch={ing.icon} />} {ing?.name}</b>
          </p>
        </div>
      </header>

      {work.station === 'juice' ? (
        // A real 3D phone: facing you, turn sideways, tip the top forward, juice pours.
        <div className="kpour3d" aria-hidden>
          <div className="kpour3d__shadow" />
          <div className="kpour3d__phone">
            <div className="kpour3d__back" />
            <div className="kpour3d__front">
              <div className="kpour3d__screen" />
            </div>
          </div>
          <div className="kpour3d__stream" />
          <Emoji ch="🥛" className="kpour3d__glass" />
        </div>
      ) : (
        <div className={`kgesture kgesture--${work.station}`} aria-hidden>
          <Emoji ch="📱" />
        </div>
      )}
      <p className="kpanel__how">{def.howTo}</p>

      <div className="kprog">
        <div className="kprog__fill" style={{ width: `${progress * 100}%` }} />
        <span className="kprog__label">
          {def.verb} {Math.min(def.reps, Math.round(progress * def.reps))} / {def.reps}
        </span>
      </div>

      {recent && <div className={`kflash ${flash!.good ? 'is-good' : 'is-bad'}`}>{flash!.good ? `${def.verb}!` : 'OOPS!'}</div>}

      {showButtons ? (
        <>
          {useMotion && sensorOk === false && <p className="note small">No motion data from this phone, so use the buttons.</p>}
          <TouchStation station={work.station} onRep={onRep} />
        </>
      ) : (
        <div className="kmotion">
          <div className="kmeter">
            <div className="kmeter__fill" ref={meterRef} />
          </div>
          <p className="kpanel__prompt" ref={promptRef}>
            {def.verb}!
          </p>
        </div>
      )}

      <footer className="kpanel__foot">
        <button className="kbtn kbtn--ghost kbtn--sm" onClick={() => kitchenApi.cancel()}>
          ↩ Step away
        </button>
      </footer>
    </div>
  );
}
