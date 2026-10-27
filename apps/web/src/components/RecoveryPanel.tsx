import { useCallback, useEffect, useRef, useState } from 'react';
import { EFFORT, MAPS, STUCK, stationById, type ChefStuck, type MapId } from '@tilt-mayhem/shared';
import { useMotionGesture } from '../hooks/useMotionGesture';
import { kitchenApi } from '../network/socket';
import { TouchStation } from './TouchStation';
import { GestureDemo } from './GestureDemo';
import { Icon } from './Icon';

interface Props {
  stuck: ChefStuck;
  motionAllowed: boolean;
  /** The map sets the story ("the pirate grabbed you!"); the motion is the same everywhere. */
  map?: MapId;
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
 * Takes over the whole phone when a hazard gets you (slipped, knocked down, feathered, or
 * fighting a fire). You can't do anything else until the recovery bar is full.
 *
 * Like the stations, with motion the bar fills smoothly by how accurate the recovery motion
 * is (accuracy streamed to the server ~10x/s); with the on-screen buttons, each tap is a step.
 */
export function RecoveryPanel({ stuck, motionAllowed, map = 'kitchen' }: Props) {
  const def = STUCK[stuck.kind];
  const text = MAPS[map].stuck[stuck.kind];
  const gesture = stationById(def.gesture);
  const lastSent = useRef(0);
  const lastBuzz = useRef(0);
  const buttonsRef = useRef(false);
  /** Our own running estimate (0..1) so the bar moves instantly; the server's value wins if ahead. */
  const [localProgress, setLocalProgress] = useState(stuck.progress);

  // Big buzz when it first hits.
  useEffect(() => {
    buzz([120, 60, 120]);
  }, [stuck.kind]);

  const onRep = useCallback(
    (good: boolean) => {
      if (!good) return;
      const now = performance.now();
      if (!buttonsRef.current) {
        // Motion: a clean motion only boosts accuracy (handled in the hook); a little buzz as feedback.
        if (now - lastBuzz.current > 350) {
          lastBuzz.current = now;
          buzz(20);
        }
        return;
      }
      if (now - lastSent.current < gesture.minRepMs) return;
      lastSent.current = now;
      kitchenApi.recover(true);
      setLocalProgress((p) => Math.min(1, p + 1 / def.reps));
      buzz(20);
    },
    [gesture.minRepMs, def.reps],
  );

  const { sensorOk, liveRef } = useMotionGesture(def.gesture, motionAllowed, onRep);
  const showButtons = !motionAllowed || sensorOk === false;
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

  const progress = Math.min(1, Math.max(stuck.progress, localProgress));

  return (
    <div className={`krecover krecover--${stuck.kind}`}>
      <div className="krecover__icon" aria-hidden>
        <Icon name={stuck.kind === 'feathers' ? MAPS[map].hazards.chicken.icon : def.icon} />
      </div>
      <h2>{text.title}</h2>
      <p className="krecover__how">{text.howTo}</p>
      <GestureDemo scene={stuck.kind} />
      <div className="kprog" role="progressbar" aria-label="Recovery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <div className="kprog__fill" style={{ width: `${progress * 100}%` }} />
      </div>
      {showButtons ? (
        <TouchStation station={def.gesture} onRep={onRep} />
      ) : (
        <div className="kmotion">
          <p className="kpanel__prompt">Keep going!</p>
        </div>
      )}
    </div>
  );
}
