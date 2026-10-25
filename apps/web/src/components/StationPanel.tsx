import { useCallback, useEffect, useRef, useState } from 'react';
import { EFFORT, INGREDIENTS, stationById, type ChefWork } from '@tilt-mayhem/shared';
import { useMotionGesture } from '../hooks/useMotionGesture';
import { kitchenApi } from '../network/socket';
import { colorVar } from '../utils/style';
import { TouchStation } from './TouchStation';
import { GestureDemo } from './GestureDemo';
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
 * Full-screen station mode on the phone: what to do, a live accuracy meter, the progress bar,
 * and an on-screen fallback when motion isn't available.
 *
 * With motion, the bar fills smoothly at a speed set by how accurate the motion is (the phone
 * streams its accuracy to the server ~10x/s; the server keeps the real progress). With the
 * on-screen buttons, each correct tap is one step.
 */
export function StationPanel({ work, motionAllowed }: Props) {
  const def = stationById(work.station);
  const ing = INGREDIENTS.get(work.ingredient)?.ingredient;
  const [flash, setFlash] = useState<{ good: boolean; at: number } | null>(null);
  /** Our own running estimate (0..1), so the bar moves instantly; the server's value wins if ahead. */
  const [localProgress, setLocalProgress] = useState(work.progress);
  const meterRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const lastSent = useRef(0);
  const lastFlash = useRef(0);
  const buttonsRef = useRef(false);
  // The server says how many taps this station needs (falls back to our copy of the station data).
  const reps = work.need || def.reps;

  const onRep = useCallback(
    (good: boolean) => {
      const now = performance.now();
      if (good && !buttonsRef.current) {
        // Motion: a clean motion only boosts accuracy (handled in the hook); just give feedback.
        if (now - lastFlash.current > 350) {
          lastFlash.current = now;
          setFlash({ good: true, at: now });
          buzz(15);
        }
        return;
      }
      // Buttons (or a messed-up motion, which costs progress): one step per gesture.
      if (now - lastSent.current < def.minRepMs) return;
      lastSent.current = now;
      kitchenApi.rep(good);
      setFlash({ good, at: now });
      setLocalProgress((p) => Math.max(0, Math.min(1, p + (good ? 1 : -def.badPenalty) / reps)));
      buzz(good ? 15 : [40, 30, 40]);
    },
    [def.minRepMs, def.badPenalty, reps],
  );

  // On-screen buttons are only a fallback for phones that can't do motion.
  const useMotion = motionAllowed;
  const { sensorOk, liveRef } = useMotionGesture(work.station, useMotion, onRep);
  const showButtons = !useMotion || sensorOk === false;
  buttonsRef.current = showButtons;

  // Stream accuracy to the server and fill our own bar the same way (accuracy x time / fillMs).
  useEffect(() => {
    if (showButtons) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(EFFORT.maxGapMs, now - last);
      last = now;
      const a = liveRef.current.accuracy;
      kitchenApi.effort(Math.round(a * 1000) / 1000);
      if (a >= EFFORT.minAccuracy) setLocalProgress((p) => Math.min(1, p + (a * dt) / def.fillMs));
    }, 1000 / EFFORT.sendHz);
    return () => window.clearInterval(id);
  }, [showButtons, liveRef, def.fillMs]);

  // Live accuracy meter + coaching text without re-rendering at 60 Hz.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const live = liveRef.current;
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.max(0.02, live.accuracy)})`;
      if (promptRef.current && !showButtons && live.prompt) promptRef.current.textContent = live.prompt;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [liveRef, showButtons]);

  const progress = Math.min(1, Math.max(work.progress, localProgress));
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

      <GestureDemo scene={work.station} />
      <p className="kpanel__how">{def.howTo}</p>

      {/* just the meter filling up: no "3 / 8" counter */}
      <div className="kprog" role="progressbar" aria-label={def.verb} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <div className="kprog__fill" style={{ width: `${progress * 100}%` }} />
      </div>

      {recent && <div className={`kflash ${flash!.good ? 'is-good' : 'is-bad'}`}>{flash!.good ? `${def.verb}!` : 'OOPS!'}</div>}

      {showButtons ? (
        <>
          {useMotion && sensorOk === false && <p className="note small">No motion data from this phone, so use the buttons.</p>}
          <TouchStation station={work.station} onRep={onRep} />
        </>
      ) : (
        <div className="kmotion">
          {/* how accurate your motion is right now: the fuller this is, the faster the bar fills */}
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
