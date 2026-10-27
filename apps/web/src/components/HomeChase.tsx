import { useEffect, useRef } from 'react';
import { drawChef, icon, type ChefView } from '../game/kitchenArt';
import { drawCheeseWheel, drawChickenAt } from '../game/hazardArt';

const COLORS = ['#ff3d7f', '#2de2e6', '#ffd23f', '#7cff6b', '#b26bff', '#ff8a3d', '#3d8bff'];

type SceneKind = 'cheese' | 'fire' | 'chicken';

interface Run {
  kind: SceneKind;
  /** Start point (off screen) and unit direction of travel. */
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  /** Distance travelled so far / total path length. */
  s: number;
  len: number;
  /** Undirected angle of the path and its sideways offset from the centre (for spacing runs apart). */
  lineAngle: number;
  offset: number;
  color: string;
  color2: string;
}

const SCALE = 1;
const SPEED = 260; // px/s
const GAP = 104; // px between the runner and whatever is chasing them
const MAX_ON_SCREEN = 2;

/**
 * Background gags on the home screen: a panicked chef fleeing a cheese wheel, a chef on fire
 * with a colleague chasing them with an extinguisher, and a chef running from a chicken.
 * Runs cross at any angle (diagonals too), never reuse a recent path or overlap another run,
 * and are staggered so only one or two are on screen. Faded and behind the cards; skipped for
 * people who prefer reduced motion.
 */
export function HomeChase() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let w = 1;
    let h = 1;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const active: Run[] = [];
    const recent: Run[] = [];
    let lastKind: SceneKind | null = null;
    let nextSpawnAt = performance.now() + 800;

    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

    /** Two paths "clash" if they're nearly parallel and close together, or start near each other. */
    const clashes = (a: Run, b: Run) => {
      let da = Math.abs(a.lineAngle - b.lineAngle) % Math.PI;
      da = Math.min(da, Math.PI - da);
      const sameLine = da < 0.55 && Math.abs(a.offset - b.offset) < 170;
      const sameStart = Math.hypot(a.x0 - b.x0, a.y0 - b.y0) < 260;
      return sameLine || sameStart;
    };

    const spawn = () => {
      const R = Math.hypot(w, h) / 2 + 120;
      const kinds = (['cheese', 'fire', 'chicken'] as const).filter((k) => k !== lastKind);
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const offset = (Math.random() - 0.5) * 0.6 * Math.min(w, h);
        // perpendicular to the direction of travel
        const px = -dy;
        const py = dx;
        const run: Run = {
          kind: pick(kinds),
          x0: w / 2 - dx * R + px * offset,
          y0: h / 2 - dy * R + py * offset,
          dx,
          dy,
          s: 0,
          len: R * 2 + GAP * 2,
          lineAngle: ((a % Math.PI) + Math.PI) % Math.PI,
          offset: dx >= 0 ? offset : -offset,
          color: pick(COLORS),
          color2: pick(COLORS),
        };
        if ([...active, ...recent].some((o) => clashes(run, o))) continue;
        active.push(run);
        recent.push(run);
        if (recent.length > 3) recent.shift();
        lastKind = run.kind;
        return;
      }
    };

    const chef = (color: string, dx: number, dy: number, mood: ChefView['mood'], stuck: ChefView['stuck']): ChefView => ({
      id: 'runner',
      nickname: '',
      color,
      face: 'plain',
      x: 0,
      y: 0,
      vx: dx * 300,
      vy: dy * 300,
      facing: Math.atan2(dy, dx),
      connected: true,
      score: 0,
      served: 0,
      recipeId: '',
      have: [],
      working: null,
      near: null,
      stuck,
      seed: 1,
      bounce: 0,
      mood,
    });

    /** Draw something at (x, y) in the chase's smaller scale. */
    const at = (x: number, y: number, draw: () => void) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(SCALE, SCALE);
      draw();
      ctx.restore();
    };

    const drawRun = (r: Run, t: number) => {
      const lx = r.x0 + r.dx * r.s;
      const ly = r.y0 + r.dy * r.s;
      const fx = lx - r.dx * GAP;
      const fy = ly - r.dy * GAP;
      // the chaser first, so the runner is drawn in front of it
      if (r.kind === 'cheese') at(fx, fy, () => drawCheeseWheel(ctx, 0, 0, 30, r.s / 30));
      else if (r.kind === 'chicken') at(fx, fy + 6, () => drawChickenAt(ctx, 0, 0, r.dx >= 0 ? 1 : -1, t, 3));
      else at(fx, fy, () => drawChef(ctx, chef(r.color2, r.dx, r.dy, undefined, { kind: 'fire', progress: 0 }), t, false));
      // the panicking runner
      at(lx, ly, () => {
        drawChef(ctx, chef(r.color, r.dx, r.dy, 'panic', null), t, false);
        if (r.kind === 'fire') {
          // their hat is on fire
          const flick = 1 + Math.sin(t * 18) * 0.08;
          icon(ctx, 'fire', Math.sin(t * 9) * 2, -86, 34 * flick);
          for (let i = 0; i < 2; i++) {
            const p = (t * 1.4 + i * 0.5) % 1;
            ctx.beginPath();
            ctx.arc(-r.dx * p * 30, -100 - p * 30, 5 + p * 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(90,90,100,${0.4 * (1 - p)})`;
            ctx.fill();
          }
        }
      });
    };

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      // staggered: a new run every few seconds, never more than two at a time
      if (now >= nextSpawnAt && active.length < MAX_ON_SCREEN) {
        spawn();
        nextSpawnAt = now + 3500 + Math.random() * 3500;
      }
      for (const r of active) {
        r.s += SPEED * dt;
        drawRun(r, t);
      }
      for (let i = active.length - 1; i >= 0; i--) if (active[i]!.s > active[i]!.len) active.splice(i, 1);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="home__chase" aria-hidden />;
}
