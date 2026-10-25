import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createDetector, PourDetector, stationById, type MotionSample, type PourStage, type StationId } from '@tilt-mayhem/shared';

/**
 * How closely the motion has to match the station's (the detector's live 0..1 meter) for effort to
 * count toward an assisted rep. Holding still or doing a different motion stays below this.
 */
const ASSIST_MIN_ENERGY = 0.3;

export interface GestureLive {
  energy: number;
  prompt: string;
  stage?: PourStage;
  tilt?: number;
}

/**
 * Feeds DeviceMotion samples into the station's gesture detector and calls
 * onRep for each recognised gesture. Live meter values sit in a ref (no
 * re-renders at 60 Hz). `sensorOk` becomes false if no motion data arrives,
 * so the UI can switch to on-screen buttons.
 */
export function useMotionGesture(
  station: StationId | null,
  enabled: boolean,
  onRep: (good: boolean) => void,
): { sensorOk: boolean | null; liveRef: MutableRefObject<GestureLive> } {
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);
  const liveRef = useRef<GestureLive>({ energy: 0, prompt: '' });
  const onRepRef = useRef(onRep);
  onRepRef.current = onRep;

  useEffect(() => {
    if (!station || !enabled) return;
    setSensorOk(null);
    const det = createDetector(station);
    liveRef.current = { energy: 0, prompt: det.prompt() };
    let gravity: [number, number, number] | null = null;
    let got = false;
    // Assist: time spent doing roughly the right motion without it registering. Every
    // `assistMs` of honest effort counts one rep (slower than doing it properly).
    const assistMs = stationById(station).assistMs;
    let effortMs = 0;
    let lastT = 0;

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
      liveRef.current = {
        energy: det.energy(),
        prompt: det.prompt(),
        stage: det instanceof PourDetector ? det.getStage() : undefined,
        tilt: det instanceof PourDetector ? det.tilt : undefined,
      };
      if (r) onRepRef.current(r === 'good');

      const dt = lastT ? Math.min(100, s.t - lastT) : 0;
      lastT = s.t;
      if (r) effortMs = 0;
      else if (det.energy() >= ASSIST_MIN_ENERGY) {
        // Moving the right way, just not cleanly enough to count: build up toward a free rep.
        effortMs += dt;
        if (effortMs >= assistMs) {
          effortMs = 0;
          onRepRef.current(true);
        }
      }
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
