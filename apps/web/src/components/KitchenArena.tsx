import { useEffect, useRef } from 'react';
import {
  INGREDIENTS,
  KITCHEN,
  STATIONS,
  recipeById,
  stationById,
  type ChefSnap,
  type KitchenEvent,
  type StationId,
} from '@tilt-mayhem/shared';
import { Fx } from '../game/fx';
import type { Frame, KitchenBuffer } from '../game/kbuffer';
import { drawChef, drawKitchen, drawPass, drawStation, emoji, INK, roundRect, type ChefView, type StationActivity } from '../game/kitchenArt';
import { sfx } from '../utils/sound';

const W = 1000;
const H = 600;
const TOP = 70;
/** Order tickets live in a column on each side of the kitchen. */
const TICKET_H = 128;
const SIDE_GAP = 12;
/** Rush hour: flashing alarm in the middle, then it flies up next to the timer. */
const ALARM_MS = 2400;
const FLY_MS = 650;

const STATION_WORDS: Record<StationId, string[]> = {
  chop: ['CHOP!', 'SLICE!', 'DICE!'],
  fry: ['FLIP!', 'SIZZLE!', 'TOSS!'],
  stir: ['STIR!', 'SWIRL!', 'BLOOP!'],
  knead: ['KNEAD!', 'SQUISH!', 'PUSH!'],
  mix: ['MIX!', 'WHISK!', 'SHAKE!'],
  juice: ['POUR!', 'SQUEEZE!', 'GLUG!'],
};
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

/** Host-screen renderer for the kitchen. Own rAF loop; React never re-renders per frame. */
export function KitchenArena({ buffer }: { buffer: KitchenBuffer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cw = 1;
    let ch = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = Math.max(1, r.width);
      ch = Math.max(1, r.height);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const fx = new Fx();
    const seeds = new Map<string, { seed: number; bounce: number }>();
    const chefPos = new Map<string, { x: number; y: number; color: string; name: string }>();
    let banner: { text: string; color: string; at: number } | null = null;
    let rushAt = -1e9;
    let lastServeAt = -1e9;
    let lastCount = -1;
    let lastPhase = '';
    let goUntil = 0;
    let endShown = false;
    let last = performance.now();
    let raf = 0;

    const juice = (id: string) => {
      let j = seeds.get(id);
      if (!j) {
        j = { seed: Math.random() * 10, bounce: 0 };
        seeds.set(id, j);
      }
      return j;
    };

    const handle = (e: KitchenEvent, now: number) => {
      if (e.type === 'rush') {
        rushAt = now;
        sfx.warn();
        window.setTimeout(() => sfx.warn(), 450);
        window.setTimeout(() => sfx.warn(), 900);
        return;
      }
      const p = chefPos.get(e.chef);
      if (!p) return;
      if (e.type === 'rep') {
        const st = stationById(e.station);
        const spot = KITCHEN.spots.find((s) => s.id === e.station)!;
        if (e.good) {
          fx.sparks(spot.x, spot.y, st.color, 7);
          if (e.station === 'knead' || e.station === 'mix') fx.dust(spot.x, spot.y, 3);
          if (Math.random() < 0.45) fx.word(pick(STATION_WORDS[e.station]), spot.x + (Math.random() - 0.5) * 60, spot.y - 10, st.color, 26);
          if (e.station === 'chop') sfx.chop();
          else if (e.station === 'fry') sfx.sizzle();
          else sfx.bloop();
          juice(e.chef).bounce = 0.6;
        } else {
          fx.word('OOPS!', spot.x, spot.y - 20, '#ff3d5a', 32);
          sfx.splat();
          juice(e.chef).bounce = 1;
        }
      } else if (e.type === 'made') {
        const icon = INGREDIENTS.get(e.ingredient)?.ingredient.icon ?? '';
        fx.word(`+${icon}`, p.x, p.y - 100, '#2b1a12', 34);
        fx.stars(p.x, p.y - 60, 6);
        sfx.powerup();
      } else if (e.type === 'served') {
        const pass = KITCHEN.pass;
        lastServeAt = now;
        fx.word(`+${e.points}!`, pass.x, pass.y - 70, e.points > 150 ? '#ff3d5a' : '#2bb02b', 60);
        if (e.fast) fx.word('SPEEDY!', pass.x, pass.y - 20, '#ff8a3d', 32);
        fx.confetti(pass.x - 140, pass.x + 140, pass.y - 120, 50);
        fx.shake(6, now);
        sfx.ding();
        banner = { text: `${p.name} served ${recipeById(e.recipeId)?.name ?? 'a dish'}!`, color: p.color, at: now };
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const frame = buffer.frame(now);
      if (frame) for (const c of frame.chefs) chefPos.set(c.id, { x: c.x, y: c.y, color: c.color, name: c.nickname });
      for (const e of buffer.drainEvents()) handle(e, now);
      for (const j of seeds.values()) j.bounce *= Math.exp(-dt * 5);

      if (frame) {
        if (frame.snap.phase === 'countdown') {
          const s = Math.ceil(frame.countdownMs / 1000);
          if (s !== lastCount && s > 0) {
            lastCount = s;
            sfx.tick(false);
          }
          endShown = false;
        }
        if (frame.snap.phase === 'playing' && lastPhase === 'countdown') {
          goUntil = now + 900;
          sfx.tick(true);
        }
        if (frame.snap.phase === 'results' && !endShown) {
          endShown = true;
          fx.confetti(0, W, -20, 140);
          sfx.fanfare();
        }
        lastPhase = frame.snap.phase;
      }
      fx.update(dt);
      draw(frame, t, now);
    };

    /** Width of one ticket column, scaled a little with the screen. */
    const ticketW = () => Math.max(170, Math.min(230, cw * 0.13));

    const draw = (frame: Frame | null, t: number, now: number) => {
      ctx.fillStyle = '#ff9f45';
      ctx.fillRect(0, 0, cw, ch);
      if (!frame) {
        ctx.fillStyle = '#fff';
        ctx.font = '600 24px Fredoka, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Heating up the kitchen…', cw / 2, ch / 2);
        return;
      }
      const chefs = frame.chefs;
      const half = Math.ceil(chefs.length / 2);
      const left = chefs.slice(0, half);
      const right = chefs.slice(half);
      const tw = ticketW();
      const leftW = left.length ? tw + SIDE_GAP * 2 : 16;
      const rightW = right.length ? tw + SIDE_GAP * 2 : 16;
      const availW = Math.max(100, cw - leftW - rightW);
      const availH = Math.max(100, ch - TOP - 10);
      const scale = Math.min(availW / W, availH / H);
      const ox = leftW + (availW - W * scale) / 2;
      const oy = TOP + (availH - H * scale) / 2;
      const sh = fx.shakeOffset();

      ctx.save();
      ctx.translate(ox + sh.x, oy + sh.y);
      ctx.scale(scale, scale);
      drawKitchen(ctx, t);

      // Station activity + highlight (someone standing there who needs it).
      for (const st of STATIONS) {
        const workers = chefs.filter((c) => c.working?.station === st.id);
        const lead = workers[0]?.working;
        const act: StationActivity = {
          progress: lead?.progress ?? 0,
          sinceRep: lead?.sinceRep ?? 9999,
          ingredient: lead?.ingredient ?? null,
          workers: workers.length,
        };
        const waiting = chefs.find((c) => !c.working && c.near === st.id && needs(c, st.id));
        drawStation(ctx, st.id, act, t, waiting ? waiting.color : null);
      }
      drawPass(ctx, t, chefs.some((c) => complete(c)), Math.max(0, 1 - (now - lastServeAt) / 1500));
      fx.drawBack(ctx);
      const best = Math.max(0, ...chefs.map((c) => c.score));
      for (const c of [...chefs].sort((a, b) => a.y - b.y)) {
        const j = juice(c.id);
        const v: ChefView = { ...c, seed: j.seed, bounce: j.bounce, crown: best > 0 && c.score === best };
        drawChef(ctx, v, t, true);
      }
      fx.drawFront(ctx);
      ctx.restore();

      drawTicketColumn(ctx, left, SIDE_GAP, TOP, tw, ch - TOP - 10);
      drawTicketColumn(ctx, right, cw - SIDE_GAP - tw, TOP, tw, ch - TOP - 10);
      drawHud(frame, t, now);
    };

    const drawHud = (frame: Frame, t: number, now: number) => {
      const phase = frame.snap.phase;
      // timer
      const secs = Math.max(0, Math.ceil(frame.timeLeftMs / 1000));
      const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const urgent = secs <= 10 && phase === 'playing';
      const rush = frame.snap.rush && phase === 'playing';
      ctx.save();
      ctx.translate(cw / 2, 36);
      const pulse = urgent || rush ? 1 + Math.max(0, Math.sin(now / 150)) * 0.06 : 1;
      ctx.scale(pulse, pulse);
      ctx.font = '34px Bangers, "Arial Black", Impact, system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 50;
      roundRect(ctx, -tw / 2, -27, tw, 54, 27);
      ctx.fillStyle = rush ? '#ff3d5a' : '#fffaf2';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = rush ? '#fff' : INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 2);
      ctx.restore();

      // top 3, in a row along the top-left
      const top3 = [...frame.chefs].sort((a, b) => b.score - a.score).slice(0, 3);
      let lx = 16;
      top3.forEach((c, i) => {
        ctx.font = '600 15px Fredoka, system-ui, sans-serif';
        const txt = `${['🥇', '🥈', '🥉'][i]} ${c.nickname} ${c.score}`;
        const w = ctx.measureText(txt).width + 20;
        if (lx + w > cw / 2 - 90) return;
        roundRect(ctx, lx, 22, w, 28, 14);
        ctx.fillStyle = 'rgba(43,26,18,0.8)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, lx + 10, 37);
        lx += w + 8;
      });

      const sinceRush = now - rushAt;
      const alarming = rush && sinceRush < ALARM_MS + FLY_MS;
      if (rush && !alarming) comic(ctx, cw / 2 + 170, 38, 'x2 RUSH!', '#ffe14d', 28);

      if (banner && now - banner.at < 2600 && !alarming) comic(ctx, cw / 2, TOP + 28, banner.text, banner.color, 30);

      if (phase === 'countdown') {
        const s = Math.max(1, Math.ceil(frame.countdownMs / 1000));
        const frac = (frame.countdownMs % 1000) / 1000;
        comic(ctx, cw / 2, ch / 2, String(s), '#ffffff', Math.min(cw, ch) * 0.3 * (1 + frac * 0.3));
      } else if (now < goUntil) {
        comic(ctx, cw / 2, ch / 2, "LET'S COOK!", '#ffe14d', Math.min(cw, ch) * 0.13 * (1 + (goUntil - now) / 2000));
      }
      if (phase === 'results') {
        const best = [...frame.chefs].sort((a, b) => b.score - a.score);
        const winners = best.filter((c) => c.score === best[0]?.score && c.score > 0);
        const text = winners.length === 1 ? `${winners[0]!.nickname} IS HEAD CHEF!` : winners.length > 1 ? "IT'S A TIE!" : "TIME'S UP!";
        comic(ctx, cw / 2, ch * 0.42, text, winners[0]?.color ?? '#fff', Math.min(96, (cw / Math.max(10, text.length)) * 1.5) * (1 + Math.sin(t * 6) * 0.03));
      }

      if (alarming) drawRushAlarm(ctx, sinceRush, cw, ch);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [buffer]);

  return (
    <div className="karena" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function needs(c: ChefSnap, station: StationId): boolean {
  const r = recipeById(c.recipeId);
  return !!r?.ingredients.some((i) => INGREDIENTS.get(i)?.station === station && !c.have.includes(i));
}

function complete(c: ChefSnap): boolean {
  const r = recipeById(c.recipeId);
  return !!r && r.ingredients.every((i) => c.have.includes(i));
}

function comic(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size: number) {
  ctx.save();
  ctx.font = `${Math.round(size)}px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(5, size / 7);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Full-screen flashing alarm when rush hour starts, then the label flies up beside the timer. */
function drawRushAlarm(ctx: CanvasRenderingContext2D, since: number, cw: number, ch: number) {
  const big = Math.min(cw, ch) * 0.13;
  if (since < ALARM_MS) {
    const on = Math.floor(since / 220) % 2 === 0;
    ctx.save();
    ctx.fillStyle = on ? 'rgba(255,30,60,0.32)' : 'rgba(255,30,60,0.08)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.lineWidth = 26;
    ctx.strokeStyle = on ? '#ff3d5a' : '#ffe14d';
    ctx.strokeRect(13, 13, cw - 26, ch - 26);
    ctx.restore();
    const pop = Math.min(1, since / 250);
    const size = big * (0.6 + pop * 0.4) * (1 + Math.sin(since / 70) * 0.03);
    comic(ctx, cw / 2, ch / 2 - size * 0.45, 'RUSH HOUR!', on ? '#ffe14d' : '#ffffff', size);
    comic(ctx, cw / 2, ch / 2 + size * 0.55, 'DOUBLE POINTS!', '#ffffff', size * 0.55);
    ctx.save();
    ctx.font = `${Math.round(size * 0.8)}px Bangers, "Arial Black", Impact, sans-serif`;
    const half = ctx.measureText('RUSH HOUR!').width / 2;
    ctx.restore();
    const wob = Math.sin(since / 60) * 0.15;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(cw / 2 + s * (half + size * 0.55), ch / 2 - size * 0.45);
      ctx.rotate(s * wob);
      emoji(ctx, '🚨', 0, 0, size * 0.8);
      ctx.restore();
    }
    return;
  }
  const k = Math.min(1, (since - ALARM_MS) / FLY_MS);
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const x = cw / 2 + 170 * e;
  const y = ch / 2 + (38 - ch / 2) * e;
  comic(ctx, x, y, 'x2 RUSH!', '#ffe14d', big + (28 - big) * e);
}

/** A column of order tickets (one per chef), shrunk to fit the height if needed. */
function drawTicketColumn(ctx: CanvasRenderingContext2D, chefs: ChefSnap[], x: number, top: number, w: number, avail: number) {
  if (!chefs.length) return;
  const gap = 10;
  const k = Math.min(1, (avail - gap * (chefs.length - 1)) / (chefs.length * TICKET_H));
  const h = TICKET_H * k;
  const total = chefs.length * h + (chefs.length - 1) * gap;
  let y = top + Math.max(0, (avail - total) / 2);
  for (const c of chefs) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    drawTicket(ctx, c, w / k);
    ctx.restore();
    y += h + gap;
  }
}

/** One order ticket at (0, 0): name + score, dish, then 4 station symbols with what's done. */
function drawTicket(ctx: CanvasRenderingContext2D, c: ChefSnap, w: number) {
  const r = recipeById(c.recipeId);
  const h = TICKET_H;
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.fillStyle = '#fffaf2';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = c.color;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = c.color;
  ctx.fillRect(0, 0, w, 26);
  ctx.font = '700 14px Fredoka, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fit(ctx, c.nickname, w - 70), 10, 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${c.score} pts`, w - 10, 14);
  // dish
  emoji(ctx, r?.icon ?? '🍽️', 18, 44, 20);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = '600 13px Fredoka, system-ui, sans-serif';
  ctx.fillText(fit(ctx, r?.name ?? '', w - 44), 32, 45);
  // four slots: station symbol on top, ingredient below
  const slotW = (w - 16) / 4;
  r?.ingredients.forEach((ing, i) => {
    const info = INGREDIENTS.get(ing)!;
    const st = stationById(info.station);
    const sx = 8 + i * slotW;
    const sy = 60;
    const done = c.have.includes(ing);
    const active = c.working?.ingredient === ing;
    roundRect(ctx, sx + 2, sy, slotW - 4, 60, 10);
    ctx.fillStyle = done ? '#c9f7c1' : active ? `${st.color}66` : '#f1e7d8';
    ctx.fill();
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.strokeStyle = active ? st.color : 'rgba(43,26,18,0.35)';
    ctx.stroke();
    emoji(ctx, st.icon, sx + slotW / 2, sy + 17, 18);
    emoji(ctx, info.ingredient.icon, sx + slotW / 2, sy + 43, 15);
    if (active && c.working) {
      ctx.fillStyle = st.color;
      ctx.fillRect(sx + 6, sy + 54, (slotW - 12) * c.working.progress, 4);
    }
    if (done) {
      ctx.font = '700 14px Fredoka, system-ui, sans-serif';
      ctx.fillStyle = '#2bb02b';
      ctx.textAlign = 'right';
      ctx.fillText('✔', sx + slotW - 6, sy + 10);
    }
  });
  if (!c.connected) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK;
    ctx.font = '600 13px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('reconnecting…', w / 2, h / 2);
  }
  ctx.restore();
}

function fit(ctx: CanvasRenderingContext2D, s: string, max: number) {
  if (ctx.measureText(s).width <= max) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
  return out + '…';
}
