import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { POUR, type StationId } from '@tilt-mayhem/shared';
import { Emoji, EmojiText } from './Emoji';

interface Props {
  station: StationId;
  onRep: (good: boolean) => void;
}

/**
 * On-screen fallbacks for every station, used when motion sensors are
 * unavailable or the player prefers buttons. Each one still asks for the
 * station's kind of skill (rhythm, timing, circles, holding), not just mashing.
 */
export function TouchStation({ station, onRep }: Props) {
  switch (station) {
    case 'chop':
      return (
        <button className="ktouch ktouch--big" onPointerDown={() => onRep(true)}>
          <EmojiText text="🔪 CHOP!" />
        </button>
      );
    case 'fry':
      return <FlipTiming onRep={onRep} />;
    case 'stir':
      return <StirPad onRep={onRep} />;
    case 'knead':
      return <Alternate onRep={onRep} a="⬆️ PUSH" b="⬇️ PULL" vertical />;
    case 'mix':
      return <Alternate onRep={onRep} a="⬅️ LEFT" b="RIGHT ➡️" />;
    case 'juice':
      return <HoldPour onRep={onRep} />;
  }
}

/** Two buttons that must be pressed alternately (knead / mix). */
function Alternate({ onRep, a, b, vertical = false }: { onRep: (g: boolean) => void; a: string; b: string; vertical?: boolean }) {
  const last = useRef<'a' | 'b' | null>(null);
  const press = (k: 'a' | 'b') => () => {
    if (last.current !== k) onRep(true);
    last.current = k;
  };
  return (
    <div className={`kalt ${vertical ? 'kalt--v' : ''}`}>
      <button className="ktouch" onPointerDown={press('a')}>
        {a}
      </button>
      <button className="ktouch" onPointerDown={press('b')}>
        {b}
      </button>
      <p className="khint">Alternate the two buttons in a steady rhythm</p>
    </div>
  );
}

/** Tap FLIP while the marker is in the green zone. */
function FlipTiming({ onRep }: { onRep: (g: boolean) => void }) {
  const markRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const p = (now % 1400) / 1400;
      pos.current = p < 0.5 ? p * 2 : 2 - p * 2;
      if (markRef.current) markRef.current.style.left = `${pos.current * 100}%`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const tap = () => {
    const good = pos.current > 0.38 && pos.current < 0.62;
    onRep(good);
    setFlash(good ? 'good' : 'bad');
    window.setTimeout(() => setFlash(null), 250);
  };
  return (
    <div className="kflip">
      <div className={`kflip__track ${flash ? `is-${flash}` : ''}`}>
        <div className="kflip__zone" />
        <div className="kflip__mark" ref={markRef} />
      </div>
      <button className="ktouch ktouch--big" onPointerDown={tap}>
        <EmojiText text="🍳 FLIP!" />
      </button>
      <p className="khint">Tap when the marker is in the green zone. Bad timing spills!</p>
    </div>
  );
}

/** Drag a finger round the pot: one full lap = one stir. */
function StirPad({ onRep }: { onRep: (g: boolean) => void }) {
  const padRef = useRef<HTMLDivElement>(null);
  const spoonRef = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);
  const acc = useRef(0);
  const angleAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = padRef.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (prev.current === null) return;
    const a = angleAt(e);
    let d = a - prev.current;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    acc.current += d;
    prev.current = a;
    if (spoonRef.current) spoonRef.current.style.transform = `rotate(${a}rad)`;
    if (Math.abs(acc.current) >= Math.PI * 2 * 0.9) {
      acc.current = 0;
      onRep(true);
    }
  };
  return (
    <div className="kstir">
      <div
        className="kstir__pad"
        ref={padRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          prev.current = angleAt(e);
        }}
        onPointerMove={move}
        onPointerUp={() => (prev.current = null)}
        onPointerCancel={() => (prev.current = null)}
      >
        <div className="kstir__spoon" ref={spoonRef}>
          <Emoji ch="🥄" />
        </div>
      </div>
      <p className="khint">Drag your finger round and round the pot</p>
    </div>
  );
}

/** Press and hold to pour; let go when it says RELEASE. Holding too long spills. */
function HoldPour({ onRep }: { onRep: (g: boolean) => void }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<'ready' | 'pouring' | 'release' | 'spilled'>('ready');
  const downAt = useRef<number | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const held = downAt.current === null ? 0 : now - downAt.current;
      if (fillRef.current) fillRef.current.style.height = `${Math.min(100, (held / POUR.holdMs) * 100)}%`;
      if (downAt.current !== null) {
        if (held >= POUR.holdMs + POUR.releaseWindowMs && stageRef.current !== 'spilled') {
          setStage('spilled');
          onRep(false);
        } else if (held >= POUR.holdMs && stageRef.current === 'pouring') {
          setStage('release');
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onRep]);

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    downAt.current = performance.now();
    setStage('pouring');
  };
  const up = () => {
    if (downAt.current === null) return;
    const held = performance.now() - downAt.current;
    downAt.current = null;
    if (stageRef.current === 'release' && held >= POUR.holdMs) onRep(true);
    setStage('ready');
  };

  const label =
    stage === 'ready' ? 'HOLD TO POUR' : stage === 'pouring' ? 'Keep holding…' : stage === 'release' ? 'RELEASE!' : 'Spilled! Let go';
  return (
    <div className="kpour">
      <button
        className={`ktouch ktouch--big kpour__btn is-${stage}`}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
      >
        <span className="kpour__fill" ref={fillRef} />
        <span className="kpour__label">
          <Emoji ch="🧃" /> {label}
        </span>
      </button>
      <p className="khint">Hold until it says RELEASE, then let go. Hold too long and it spills.</p>
    </div>
  );
}
