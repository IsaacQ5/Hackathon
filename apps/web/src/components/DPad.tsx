import { useRef, type MutableRefObject, type PointerEvent } from 'react';
import type { Vec2 } from '../hooks/useTilt';

type Dir = 'up' | 'down' | 'left' | 'right';
const VEC: Record<Dir, Vec2> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** Big arrow buttons. Hold two at once for diagonals. Writes the vector to outputRef. */
export function DPad({ outputRef }: { outputRef: MutableRefObject<Vec2> }) {
  const active = useRef(new Map<number, Dir>());

  const sync = () => {
    let x = 0;
    let y = 0;
    for (const d of active.current.values()) {
      x += VEC[d].x;
      y += VEC[d].y;
    }
    const len = Math.hypot(x, y) || 1;
    outputRef.current = { x: x / len, y: y / len };
  };

  const down = (d: Dir) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current.set(e.pointerId, d);
    e.currentTarget.classList.add('is-on');
    sync();
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    active.current.delete(e.pointerId);
    e.currentTarget.classList.remove('is-on');
    sync();
  };

  const btn = (d: Dir, label: string) => (
    <button
      className={`dpad__btn dpad__${d}`}
      onPointerDown={down(d)}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      aria-label={d}
    >
      {label}
    </button>
  );

  return (
    <div className="dpad">
      {btn('up', '▲')}
      {btn('left', '◀')}
      {btn('right', '▶')}
      {btn('down', '▼')}
    </div>
  );
}
