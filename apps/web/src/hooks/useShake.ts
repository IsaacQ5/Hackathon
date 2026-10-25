import { useEffect, useRef } from 'react';

/** A "shake" = this many hard jolts close together. */
const JOLTS = 3;
const JOLT_ACCEL = 12; // m/s^2, gravity removed
const WINDOW_MS = 800;
/** Jolts closer together than this are the same jolt. */
const MIN_GAP_MS = 70;
/** Don't report another shake for a moment (the server has the real 5 s cooldown). */
const REFRACTORY_MS = 800;

/**
 * Calls onShake when the phone is shaken hard and fast (several strong jolts in well under a
 * second). Normal tilting to walk never gets close to these forces, so it doesn't misfire.
 */
export function useShake(enabled: boolean, onShake: () => void) {
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!enabled) return;
    let jolts: number[] = [];
    let lastJolt = 0;
    let quietUntil = 0;
    let gravity: [number, number, number] | null = null;

    const onMotion = (e: DeviceMotionEvent) => {
      const now = performance.now();
      let ax: number;
      let ay: number;
      let az: number;
      const lin = e.acceleration;
      const inc = e.accelerationIncludingGravity;
      if (lin && lin.x != null && lin.y != null && lin.z != null) {
        ax = lin.x;
        ay = lin.y;
        az = lin.z;
      } else if (inc && inc.x != null && inc.y != null && inc.z != null) {
        // No separate linear acceleration: remove gravity with a low-pass filter.
        gravity = gravity
          ? [gravity[0] * 0.9 + inc.x * 0.1, gravity[1] * 0.9 + inc.y * 0.1, gravity[2] * 0.9 + inc.z * 0.1]
          : [inc.x, inc.y, inc.z];
        ax = inc.x - gravity[0];
        ay = inc.y - gravity[1];
        az = inc.z - gravity[2];
      } else return;

      if (now < quietUntil) return;
      if (Math.hypot(ax, ay, az) < JOLT_ACCEL || now - lastJolt < MIN_GAP_MS) return;
      lastJolt = now;
      jolts = [...jolts.filter((t) => now - t < WINDOW_MS), now];
      if (jolts.length >= JOLTS) {
        jolts = [];
        quietUntil = now + REFRACTORY_MS;
        onShakeRef.current();
      }
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [enabled]);
}
