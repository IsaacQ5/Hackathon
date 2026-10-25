import { useEffect, useRef } from 'react';
import { drawChef, type ChefView } from '../game/kitchenArt';
import { drawCheeseWheel } from '../game/hazardArt';

const COLORS = ['#ff3d7f', '#2de2e6', '#ffd23f', '#7cff6b', '#b26bff', '#ff8a3d'];

/**
 * Background gag on the home screen: a little chef sprinting across the page with a
 * runaway cheese wheel rolling after them. Small, faded and behind the cards; each run
 * starts from a random side and height. Skipped for people who prefer reduced motion.
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

    const SCALE = 0.75;
    const SPEED = 230; // px/s
    let run = { dir: 1, y: 0, x: 0, color: COLORS[0]!, waitUntil: 0 };
    const newRun = (now: number) => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      run = {
        dir,
        y: h * (0.25 + Math.random() * 0.6),
        x: dir > 0 ? -60 : w + 60,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        waitUntil: now + 1200 + Math.random() * 2000,
      };
    };
    newRun(performance.now());

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (now < run.waitUntil) return;
      run.x += run.dir * SPEED * dt;
      const t = now / 1000;
      // cheese wheel a little behind, rolling
      const cx = run.x - run.dir * 95;
      ctx.save();
      ctx.translate(cx, run.y);
      ctx.scale(SCALE, SCALE);
      drawCheeseWheel(ctx, 0, 0, 30, (cx / 30) * run.dir);
      ctx.restore();
      // the chef, legs going, arms flailing
      ctx.save();
      ctx.translate(run.x, run.y + 10);
      ctx.scale(SCALE, SCALE);
      const chef: ChefView = {
        id: 'runner',
        nickname: '',
        color: run.color,
        face: 'plain',
        x: 0,
        y: 0,
        vx: run.dir * 300,
        vy: 0,
        facing: run.dir > 0 ? 0 : Math.PI,
        connected: true,
        score: 0,
        served: 0,
        recipeId: '',
        have: [],
        working: null,
        near: null,
        stuck: null,
        seed: 1,
        bounce: 0,
      };
      drawChef(ctx, chef, t, false);
      ctx.restore();
      // off the far side: wait a moment, then go again from somewhere else
      if ((run.dir > 0 && cx > w + 80) || (run.dir < 0 && cx < -80)) newRun(now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="home__chase" aria-hidden />;
}
