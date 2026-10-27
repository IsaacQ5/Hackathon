import { useEffect, useRef } from 'react';
import type { ChefFace, MapId, StationId } from '@tilt-mayhem/shared';
import { drawChef, type ChefView } from '../game/kitchenArt';

interface Props {
  color: string;
  face?: ChefFace;
  size?: number;
  /** Show the chef busy at a station (animated arms). */
  station?: StationId | null;
  dim?: boolean;
  /** Winner's crown on top of the hat. */
  crown?: boolean;
  /** End-of-game mood: the winner dances, tied winners shrug, the rest look sad. */
  mood?: ChefView['mood'];
  /** Dress the chef for a map (astronaut helmet, puffy coat...). */
  outfit?: MapId;
}

/** Small animated chef for lobby slots, results and the phone header. */
export function ChefPortrait({ color, face = 'plain', size = 80, station = null, dim = false, crown = false, mood, outfit }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const seed = color.charCodeAt(1) % 7;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      // Leave headroom for a crown (and the dance bounce).
      const s = size / (crown || mood === 'dance' ? 136 : 110);
      ctx.translate(size / 2, size * (crown || mood === 'dance' ? 0.86 : 0.82));
      ctx.scale(s, s);
      const view: ChefView = {
        id: 'p',
        nickname: '',
        color,
        face,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        facing: Math.PI / 2,
        connected: true,
        score: 0,
        served: 0,
        recipeId: '',
        have: [],
        working: station ? { station, ingredient: '', progress: 0.5, need: 2, sinceRep: now % 500 } : null,
        near: null,
        stuck: null,
        seed,
        bounce: 0,
        crown,
        mood,
        outfit,
      };
      drawChef(ctx, view, now / 1000, false);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [color, face, size, station, crown, mood, outfit]);

  return <canvas ref={ref} style={{ width: size, height: size, opacity: dim ? 0.4 : 1 }} aria-hidden />;
}
