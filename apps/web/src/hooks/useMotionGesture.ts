import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createDetector, PourDetector, type MotionSample, type PourStage, type StationId } from '@tilt-mayhem/shared';

/** How long a recognised (clean) motion keeps accuracy at the top, in ms. */
const CLEAN_PULSE_MS = 450;
/** The match meter alone tops out here; clean, recognised motions are what reach 100%. */
const MATCH_WEIGHT = 0.8;

export interface GestureLive {
  energy: number;
  /**
   * 0..1 how accurate the motion is right now (smoothed): the station's match meter (up to 80%)
   * plus a jump to 100% for each clean, recognised motion. Drives accuracy-based cooking.
   */
  accuracy: number;
  prompt: string;
  stage?: PourStage;
  tilt?: number;
}

/**
 * Feeds DeviceMotion samples into the station's gesture detector, calls onRep for each
 * recognised gesture, and keeps a live accuracy score. Live values sit in a ref (no
 * re-renders at 60 Hz). `sensorOk` becomes false if no motion data arrives, so the UI
 * can switch to on-screen buttons.
 */
export function useMotionGesture(
  station: StationId | null,
  enabled: boolean,
  onRep: (good: boolean) => void,
): { sensorOk: boolean | null; liveRef: MutableRefObject<GestureLive> } {
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);
  const liveRef = useRef<GestureLive>({ energy: 0, accuracy: 0, prompt: '' });
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    if (!station || !enabled) return;
    setSensorOk(null);
    const det = createDetector(station);
    liveRef.current = { energy: 0, accuracy: 0, prompt: det.prompt() };
    let gravity: [number, number, number] | null = null;
    let got = false;
    let cleanAt = -1e9;
    let accuracy = 0;

    const onMotion = (e: DeviceMotionEvent) => {
      const inc = e.accelerationIncludingGravity;
      const lin = e.acceleration;
      const rr = e.rotationRate;
      let ax: number;
      let ay: number;
      let az: number;
      let gx: number;
      let gy: number;
      let gz: number;
      if (inc && inc.x != null && inc.y != null && inc.z != null) {
        if (lin && lin.x != null && lin.y != null && lin.z != null) {
          ax = lin.x;
          ay = lin.y;
          az = lin.z;
          gx = inc.x - ax;
          gy = inc.y - ay;
          gz = inc.z - az;
        } else {
          // No separate linear acceleration: estimate gravity with a low-pass filter.
          gravity = gravity
            ? [gravity[0] * 0.9 + inc.x * 0.1, gravity[1] * 0.9 + inc.y * 0.1, gravity[2] * 0.9 + inc.z * 0.1]
            : [inc.x, inc.y, inc.z];
          [gx, gy, gz] = gravity;
          ax = inc.x - gx;
          ay = inc.y - gy;
          az = inc.z - gz;
        }
      } else if (lin && lin.x != null && lin.y != null && lin.z != null) {
        ax = lin.x;
        ay = lin.y;
        az = lin.z;
        gx = 0;
        gy = 0;
        gz = 9.81;
      } else {
        return;
      }
      got = true;
      const s: MotionSample = {
        t: performance.now(),
        ax,
        ay,
        az,
        gx,
        gy,
        gz,
        ra: rr?.alpha ?? 0,
        rb: rr?.beta ?? 0,
        rg: rr?.gamma ?? 0,
      };
      const r = det.push(s);
      if (r === 'good') cleanAt = s.t;
      // Accuracy: how well the motion matches (capped below 100%), topped up to 100% for a moment
      // by each clean, recognised motion; smoothed so the meter fills steadily, not in jumps.
      const pulse = Math.max(0, 1 - (s.t - cleanAt) / CLEAN_PULSE_MS);
      const target = Math.max(det.energy() * MATCH_WEIGHT, pulse);
      accuracy += (target - accuracy) * 0.2;
      liveRef.current = {
        energy: det.energy(),
        accuracy,
        prompt: det.prompt(),
        stage: det instanceof PourDetector ? det.getStage() : undefined,
        tilt: det instanceof PourDetector ? det.tilt : undefined,
      };
      if (r) onRepRef.current(r === 'good');
    };

    window.addEventListener('devicemotion', onMotion);
    const timer = window.setTimeout(() => setSensorOk(got), 1500);
    return () => {
      window.removeEventListener('devicemotion', onMotion);
      window.clearTimeout(timer);
    };
  }, [station, enabled]);

  return { sensorOk, liveRef };
}
