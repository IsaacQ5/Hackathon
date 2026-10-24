import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

/**
 * Phone tilt -> normalized movement input.
 *
 * - `gamma` = left/right tilt, `beta` = front/back tilt (portrait).
 * - The neutral pose is captured on the first reading and on recenter().
 * - Output is dead-zoned, scaled so `fullTiltDeg` = 1, clamped to [-1, 1]
 *   and smoothed with an exponential moving average.
 * - Values live in refs so 60 Hz sensor events never re-render React.
 */

export type TiltStatus =
  | 'idle' // not requested yet
  | 'requesting' // permission prompt open
  | 'waiting' // listening, no valid reading yet
  | 'active' // readings arriving
  | 'denied' // user or browser refused permission
  | 'no-data' // listener attached but no sensor data (e.g. desktop)
  | 'unsupported' // no DeviceOrientationEvent at all
  | 'insecure'; // page is not HTTPS, sensors are blocked

export interface TiltOptions {
  /** Degrees of tilt that map to full speed. */
  fullTiltDeg?: number;
  /** Degrees around neutral that count as "still". */
  deadZoneDeg?: number;
  /** EMA factor in (0, 1]; higher = snappier, lower = smoother. */
  smoothing?: number;
  invertX?: boolean;
  invertY?: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TiltDebug {
  beta: number | null;
  gamma: number | null;
  /** Relative to neutral, after axis mapping, in degrees. */
  relX: number;
  relY: number;
  screenAngle: number;
}

export interface TiltController {
  status: TiltStatus;
  /** Latest smoothed input. Read it; don't render from it. */
  inputRef: MutableRefObject<Vec2>;
  debugRef: MutableRefObject<TiltDebug>;
  /** Must be called from a user gesture (tap) for iOS. */
  enable: () => Promise<void>;
  /** Use the current pose as neutral. */
  recenter: () => void;
}

const DEFAULTS = { fullTiltDeg: 25, deadZoneDeg: 3, smoothing: 0.25 };
const NO_DATA_TIMEOUT_MS = 2000;

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> };

function initialStatus(): TiltStatus {
  if (typeof window === 'undefined') return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (typeof window.DeviceOrientationEvent === 'undefined') return 'unsupported';
  return 'idle';
}

/** Current screen rotation in degrees: 0, 90, 180 or 270. */
function screenAngle(): number {
  const a =
    (typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : undefined) ??
    (window as unknown as { orientation?: number }).orientation ??
    0;
  return ((Math.round(a) % 360) + 360) % 360;
}

/**
 * Map device axes to screen axes. In portrait (0) x = gamma, y = beta.
 * Landscape mappings are best-effort; verify on real devices and use the
 * invert toggles if needed.
 */
function mapAxes(beta: number, gamma: number, angle: number): { lr: number; fb: number } {
  switch (angle) {
    case 90:
      return { lr: beta, fb: -gamma };
    case 180:
      return { lr: -gamma, fb: -beta };
    case 270:
      return { lr: -beta, fb: gamma };
    default:
      return { lr: gamma, fb: beta };
  }
}

/** Smallest signed difference between two angles, in (-180, 180]. */
function angleDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function shape(deltaDeg: number, dead: number, full: number): number {
  const m = Math.abs(deltaDeg);
  if (m <= dead) return 0;
  const v = (m - dead) / Math.max(1, full - dead);
  return Math.sign(deltaDeg) * Math.min(1, v);
}

export function useTilt(options: TiltOptions = {}): TiltController {
  const [status, setStatus] = useState<TiltStatus>(initialStatus);
  const statusRef = useRef(status);
  statusRef.current = status;

  const optsRef = useRef(options);
  optsRef.current = options;

  const inputRef = useRef<Vec2>({ x: 0, y: 0 });
  const debugRef = useRef<TiltDebug>({ beta: null, gamma: null, relX: 0, relY: 0, screenAngle: 0 });
  const baselineRef = useRef<{ lr: number; fb: number; angle: number } | null>(null);
  const lastRawRef = useRef<{ beta: number; gamma: number } | null>(null);
  const listeningRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const onOrientation = useCallback((e: DeviceOrientationEvent) => {
    const { beta, gamma } = e;
    if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    lastRawRef.current = { beta, gamma };

    const angle = screenAngle();
    const { lr, fb } = mapAxes(beta, gamma, angle);
    // (Re)capture neutral on first reading or if the screen rotated.
    if (!baselineRef.current || baselineRef.current.angle !== angle) {
      baselineRef.current = { lr, fb, angle };
      inputRef.current = { x: 0, y: 0 };
    }
    const o = { ...DEFAULTS, ...optsRef.current };
    const relX = angleDelta(lr, baselineRef.current.lr);
    const relY = angleDelta(fb, baselineRef.current.fb);
    let tx = shape(relX, o.deadZoneDeg, o.fullTiltDeg);
    // Tilting the top edge away from you lowers beta -> negative -> "up".
    let ty = shape(relY, o.deadZoneDeg, o.fullTiltDeg);
    if (o.invertX) tx = -tx;
    if (o.invertY) ty = -ty;

    const a = Math.min(1, Math.max(0.01, o.smoothing));
    const prev = inputRef.current;
    const x = prev.x + (tx - prev.x) * a;
    const y = prev.y + (ty - prev.y) * a;
    inputRef.current = { x: Math.abs(x) < 0.005 ? 0 : x, y: Math.abs(y) < 0.005 ? 0 : y };
    debugRef.current = { beta, gamma, relX, relY, screenAngle: angle };

    if (statusRef.current !== 'active') {
      statusRef.current = 'active';
      setStatus('active');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (listeningRef.current) {
      window.removeEventListener('deviceorientation', onOrientation);
      listeningRef.current = false;
    }
    window.clearTimeout(timerRef.current);
  }, [onOrientation]);

  const enable = useCallback(async () => {
    const s = statusRef.current;
    if (s === 'insecure' || s === 'unsupported' || s === 'active' || s === 'requesting') return;

    // iOS 13+: must be called directly inside the tap handler.
    const orientationApi = window.DeviceOrientationEvent as unknown as PermissionApi;
    const motionApi = window.DeviceMotionEvent as unknown as PermissionApi | undefined;
    const needsPermission =
      typeof orientationApi.requestPermission === 'function' || typeof motionApi?.requestPermission === 'function';
    if (needsPermission) {
      setStatus('requesting');
      statusRef.current = 'requesting';
      try {
        const [orientationResult, motionResult] = await Promise.all([
          orientationApi.requestPermission?.() ?? Promise.resolve('granted'),
          motionApi?.requestPermission?.() ?? Promise.resolve('granted'),
        ]);
        if (orientationResult !== 'granted' || motionResult === 'denied') {
          setStatus('denied');
          statusRef.current = 'denied';
          return;
        }
      } catch {
        // Thrown when not called from a gesture, or blocked by settings.
        setStatus('denied');
        statusRef.current = 'denied';
        return;
      }
    }

    if (!listeningRef.current) {
      window.addEventListener('deviceorientation', onOrientation);
      listeningRef.current = true;
    }
    if (statusRef.current !== 'active') {
      setStatus('waiting');
      statusRef.current = 'waiting';
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        // Keep listening (data may still come), but tell the UI to offer touch.
        if (statusRef.current === 'waiting') {
          setStatus('no-data');
          statusRef.current = 'no-data';
        }
      }, NO_DATA_TIMEOUT_MS);
    }
  }, [onOrientation]);

  const recenter = useCallback(() => {
    const raw = lastRawRef.current;
    if (!raw) return;
    const angle = screenAngle();
    const { lr, fb } = mapAxes(raw.beta, raw.gamma, angle);
    baselineRef.current = { lr, fb, angle };
    inputRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => stopListening, [stopListening]);

  return { status, inputRef, debugRef, enable, recenter };
}
