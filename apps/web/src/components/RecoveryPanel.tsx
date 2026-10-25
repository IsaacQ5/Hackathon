import { useCallback, useEffect, useRef } from 'react';
import { STUCK, stationById, type ChefStuck } from '@tilt-mayhem/shared';
import { useMotionGesture } from '../hooks/useMotionGesture';
import { kitchenApi } from '../network/socket';
import { TouchStation } from './TouchStation';
import { GestureDemo } from './GestureDemo';
import { Emoji } from './Emoji';

interface Props {
  stuck: ChefStuck;
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
 * Takes over the whole phone when a hazard gets you (slipped, knocked down,
 * feathered, or fanning a fire). You can't do anything else until you finish
 * the recovery motion, which reuses a station's motion detector.
 */
export function RecoveryPanel({ stuck, motionAllowed }: Props) {
  const def = STUCK[stuck.kind];
  const gesture = stationById(def.gesture);
  const lastSent = useRef(0);
  const meterRef = useRef<HTMLDivElement>(null);

  // Big buzz when it first hits.
  useEffect(() => {
    buzz([120, 60, 120]);
  }, [stuck.kind]);

  const onRep = useCallback(
    (good: boolean) => {
      if (!good) return;
      const now = performance.now();
      if (now - lastSent.current < gesture.minRepMs) return;
      lastSent.current = now;
      kitchenApi.recover(true);
      buzz(20);
    },
    [gesture.minRepMs],
  );

  const { sensorOk, liveRef } = useMotionGesture(def.gesture, motionAllowed, onRep);
  const showButtons = !motionAllowed || sensorOk === false;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const live = liveRef.current;
      if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.max(0.02, live.energy)})`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [liveRef]);

  return (
    <div className={`krecover krecover--${stuck.kind}`}>
      <div className="krecover__icon" aria-hidden>
        <Emoji ch={def.icon} />
      </div>
      <h2>{def.title}</h2>
      <p className="krecover__how">{def.howTo}</p>
      <GestureDemo scene={stuck.kind} />
      <div className="kprog">
        <div className="kprog__fill" style={{ width: `${stuck.progress * 100}%` }} />
        <span className="kprog__label">{Math.round(stuck.progress * 100)}%</span>
      </div>
      {showButtons ? (
        <TouchStation station={def.gesture} onRep={onRep} />
      ) : (
        <div className="kmotion">
          <div className="kmeter">
            <div className="kmeter__fill" ref={meterRef} />
          </div>
          <p className="kpanel__prompt">Keep going!</p>
        </div>
      )}
    </div>
  );
}
