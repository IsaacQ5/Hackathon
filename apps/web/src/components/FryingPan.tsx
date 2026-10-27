/**
 * The movement pad on the phone is a frying pan, and the knob is a fried egg sliding around in
 * it. (Used by both the tilt indicator and the on-screen joystick.)
 */

/** Pan handle sticking out of the bottom-right of the pan (inside a `.kpan`). */
export function PanHandle() {
  return <span className="kpan__handle" aria-hidden />;
}

/** A few oil specks so the pan doesn't look empty. */
export function PanOil() {
  return (
    <span className="kpan__oil" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** The fried egg; `color` tints the glow around it so you can tell whose phone it is. */
export function Egg({ color }: { color: string }) {
  return (
    <svg className="kegg" viewBox="0 0 100 100" style={{ filter: `drop-shadow(0 0 7px ${color}) drop-shadow(0 3px 2px rgba(0,0,0,0.35))` }} aria-hidden>
      <path
        d="M50 6 C66 4 78 14 84 26 C94 34 96 50 90 62 C92 78 78 92 62 92 C52 98 36 96 28 88 C14 86 4 72 8 58 C2 46 8 30 20 24 C26 12 38 6 50 6 Z"
        fill="#ffffff"
        stroke="#2b1a12"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M26 30 C30 22 38 18 44 18" fill="none" stroke="rgba(43,26,18,0.12)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="52" cy="50" r="19" fill="#ffc21a" stroke="#2b1a12" strokeWidth="4.5" />
      <ellipse cx="46" cy="43" rx="6" ry="4" fill="rgba(255,255,255,0.75)" transform="rotate(-30 46 43)" />
    </svg>
  );
}
