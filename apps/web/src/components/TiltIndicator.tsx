import { useEffect, useRef } from 'react';
import type { TiltDebug, Vec2 } from '../hooks/useTilt';
import { Egg, PanHandle, PanOil } from './FryingPan';

interface Props {
  /** Called every animation frame; return the current input in [-1, 1]. */
  read: () => Vec2;
  color: string;
  /** Optional raw sensor values to display (helps when tuning). */
  readDebug?: () => TiltDebug;
}

/** Shows the direction being sent to the game as an egg sliding round a frying pan, updated via rAF (no re-renders). */
export function TiltIndicator({ read, color, readDebug }: Props) {
  const knobRef = useRef<HTMLDivElement>(null);
  const debugRef = useRef<HTMLDivElement>(null);
  const readRef = useRef(read);
  readRef.current = read;
  const debugFnRef = useRef(readDebug);
  debugFnRef.current = readDebug;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = readRef.current();
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(calc(-50% + ${v.x * 70}px), calc(-50% + ${v.y * 70}px))`;
      }
      const d = debugFnRef.current?.();
      if (d && debugRef.current) {
        const f = (n: number | null) => (n == null ? '–' : n.toFixed(0));
        debugRef.current.textContent = `β ${f(d.beta)}°  γ ${f(d.gamma)}°  ·  x ${v.x.toFixed(2)}  y ${v.y.toFixed(2)}`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="tilt">
      <div className="tilt__ring kpan">
        <PanHandle />
        <PanOil />
        <span className="tilt__arrow tilt__arrow--up">▲</span>
        <span className="tilt__arrow tilt__arrow--down">▼</span>
        <span className="tilt__arrow tilt__arrow--left">◀</span>
        <span className="tilt__arrow tilt__arrow--right">▶</span>
        <div className="tilt__center" />
        <div className="tilt__knob kpan__egg" ref={knobRef}>
          <Egg color={color} />
        </div>
      </div>
      {readDebug && <div className="tilt__debug" ref={debugRef} />}
    </div>
  );
}
