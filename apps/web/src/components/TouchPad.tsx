import { useRef, type MutableRefObject, type PointerEvent } from 'react';
import type { Vec2 } from '../hooks/useTilt';
import { Egg, PanHandle, PanOil } from './FryingPan';

interface Props {
  /** Written with the current joystick vector in [-1, 1]. */
  outputRef: MutableRefObject<Vec2>;
  color: string;
}

/** Virtual joystick (drag the egg round the frying pan) used when motion sensors are unavailable or denied. */
export function TouchPad({ outputRef, color }: Props) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  const setKnob = (x: number, y: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
  };

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const radius = rect.width / 2 - 30;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    setKnob(dx, dy);
    outputRef.current = { x: dx / radius, y: dy / radius };
  };

  const release = () => {
    activeId.current = null;
    setKnob(0, 0);
    outputRef.current = { x: 0, y: 0 };
  };

  return (
    <div
      className="touchpad kpan"
      ref={padRef}
      onPointerDown={(e) => {
        activeId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (activeId.current === e.pointerId) update(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <PanHandle />
      <PanOil />
      <span className="tilt__arrow tilt__arrow--up">▲</span>
      <span className="tilt__arrow tilt__arrow--down">▼</span>
      <span className="tilt__arrow tilt__arrow--left">◀</span>
      <span className="tilt__arrow tilt__arrow--right">▶</span>
      <div className="touchpad__knob kpan__egg" ref={knobRef}>
        <Egg color={color} />
      </div>
      <span className="touchpad__hint">Drag the egg to move</span>
    </div>
  );
}
