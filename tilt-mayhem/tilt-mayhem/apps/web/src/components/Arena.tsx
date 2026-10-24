import { useEffect, useRef } from 'react';
import { GAME_CONFIG, type PickupEvent } from '@tilt-mayhem/shared';
import type { RenderFrame, SnapshotBuffer } from '../utils/interpolation';
import { sfx } from '../utils/sound';

interface Props {
  buffer: SnapshotBuffer;
}

interface Fx {
  x: number;
  y: number;
  color: string;
  value: number;
  born: number;
}

const W = GAME_CONFIG.arenaWidth;
const H = GAME_CONFIG.arenaHeight;
const R = GAME_CONFIG.playerRadius;
const CR = GAME_CONFIG.collectibleRadius;

/**
 * Canvas renderer for the host screen. Runs its own requestAnimationFrame
 * loop and reads from the snapshot buffer, so React never re-renders per frame.
 */
export function Arena({ buffer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const fx: Fx[] = [];
    const colorOf = new Map<string, string>();
    let lastCountdownSecond = -1;
    let goUntil = 0;
    let lastPhase = '';
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frame = buffer.frame(now);

      // Effects for pickups.
      const events: PickupEvent[] = buffer.drainEvents();
      for (const e of events) {
        fx.push({ x: e.x, y: e.y, value: e.value, color: colorOf.get(e.playerId) ?? '#fff', born: now });
        sfx.pickup(e.value);
      }

      if (frame) {
        for (const p of frame.players) colorOf.set(p.id, p.color);
        // Countdown beeps + GO flash.
        if (frame.phase === 'countdown') {
          const s = Math.ceil(frame.countdownMs / 1000);
          if (s !== lastCountdownSecond && s > 0) {
            lastCountdownSecond = s;
            sfx.tick(false);
          }
        }
        if (frame.phase === 'playing' && lastPhase === 'countdown') {
          goUntil = now + 700;
          sfx.tick(true);
        }
        if (frame.phase !== 'countdown') lastCountdownSecond = -1;
        lastPhase = frame.phase;
      }

      draw(ctx, cssW, cssH, frame, fx, now, goUntil);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [buffer]);

  return (
    <div className="arena-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ------------------------------------------------------------------ drawing

function draw(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  frame: RenderFrame | null,
  fx: Fx[],
  now: number,
  goUntil: number,
) {
  ctx.clearRect(0, 0, cw, ch);

  // Fit the 1000x600 world into the canvas.
  const pad = 16;
  const scale = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
  const ox = (cw - W * scale) / 2;
  const oy = (ch - H * scale) / 2;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // Floor.
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1f1550');
  g.addColorStop(1, '#2a1a63');
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = g;
  ctx.fill();

  // Grid.
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1.5;
  for (let x = 50; x < W; x += 50) line(ctx, x, 0, x, H);
  for (let y = 50; y < H; y += 50) line(ctx, 0, y, W, y);
  ctx.restore();

  // Neon border.
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2de2e6';
  ctx.shadowColor = '#2de2e6';
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.restore();

  if (frame) {
    const t = now / 1000;

    // Collectibles.
    for (const c of frame.collectibles) {
      const bob = Math.sin(t * 3 + c.id) * 3;
      if (c.value > 1) drawStar(ctx, c.x, c.y + bob, CR * 1.5, t * 1.5 + c.id);
      else drawGem(ctx, c.x, c.y + bob, CR);
    }

    // Leader gets a crown.
    const top = Math.max(0, ...frame.players.map((p) => p.score));
    const leaders = frame.players.filter((p) => p.score === top && top > 0);

    // Players (draw in y order so lower ones overlap upper ones).
    for (const p of [...frame.players].sort((a, b) => a.y - b.y)) {
      drawPlayer(ctx, p.x, p.y, p.color, p.nickname, p.vx, p.vy, p.connected, leaders.length === 1 && leaders[0]!.id === p.id);
    }
  }

  // Pickup effects.
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]!;
    const age = (now - f.born) / 1000;
    if (age > 0.9) {
      fx.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - age / 0.9;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10 + age * 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = f.value > 1 ? '#ffd23f' : '#fff';
    ctx.font = `700 ${f.value > 1 ? 34 : 26}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`+${f.value}`, f.x, f.y - 24 - age * 50);
    ctx.restore();
  }

  ctx.restore();

  // HUD in screen space.
  if (frame) {
    if (frame.phase === 'playing' || frame.phase === 'countdown') drawTimer(ctx, cw, oy, frame.timeLeftMs, now);
    if (frame.phase === 'countdown') {
      const s = Math.max(1, Math.ceil(frame.countdownMs / 1000));
      const frac = (frame.countdownMs % 1000) / 1000;
      bigText(ctx, cw, ch, String(s), 1 + frac * 0.4, '#fff');
    } else if (now < goUntil) {
      bigText(ctx, cw, ch, 'GO!', 1 + (goUntil - now) / 1400, '#7cff6b');
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '600 22px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for the server…', cw / 2, ch / 2);
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  name: string,
  vx: number,
  vy: number,
  connected: boolean,
  crowned: boolean,
) {
  ctx.save();
  ctx.globalAlpha = connected ? 1 : 0.35;

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + R * 0.9, R * 0.95, R * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body with glow.
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  const body = ctx.createRadialGradient(x - R * 0.4, y - R * 0.4, R * 0.2, x, y, R * 1.1);
  body.addColorStop(0, lighten(color));
  body.addColorStop(1, color);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, R * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  // Eyes look where the character is heading.
  const speed = Math.hypot(vx, vy);
  const lx = speed > 5 ? (vx / speed) * 3.5 : 0;
  const ly = speed > 5 ? (vy / speed) * 3.5 : 0;
  for (const side of [-1, 1]) {
    const ex = x + side * 5.5;
    const ey = y - 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120a2b';
    ctx.beginPath();
    ctx.arc(ex + lx * 0.6, ey + ly * 0.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name tag.
  ctx.font = '600 15px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = connected ? name : `${name} (zzz)`;
  const tw = ctx.measureText(label).width + 14;
  const ty = y - R * 1.15 - 22;
  ctx.fillStyle = 'rgba(10,6,30,0.75)';
  roundRect(ctx, x - tw / 2, ty - 12, tw, 22, 11);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, x, ty + 4);

  if (crowned) {
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('👑', x, ty - 16);
  }
  ctx.restore();
}

function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.shadowColor = '#2de2e6';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#7ff7ff';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.85, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.85, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.35, y - r * 0.2);
  ctx.lineTo(x - r * 0.35, y - r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot * 0.3);
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff6c7';
  ctx.stroke();
  ctx.restore();
}

function drawTimer(ctx: CanvasRenderingContext2D, cw: number, oy: number, ms: number, now: number) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const urgent = secs <= 10;
  const pulse = urgent ? 1 + Math.max(0, Math.sin(now / 160)) * 0.08 : 1;
  ctx.save();
  ctx.translate(cw / 2, Math.max(36, oy + 36));
  ctx.scale(pulse, pulse);
  ctx.fillStyle = urgent ? 'rgba(255,61,127,0.92)' : 'rgba(10,6,30,0.8)';
  roundRect(ctx, -70, -26, 140, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 32px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 2);
  ctx.restore();
}

function bigText(ctx: CanvasRenderingContext2D, cw: number, ch: number, text: string, scale: number, color: string) {
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(scale, scale);
  ctx.font = `700 ${Math.round(Math.min(cw, ch) * 0.28)}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(10,6,30,0.85)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 70);
  const g = Math.min(255, ((n >> 8) & 255) + 70);
  const b = Math.min(255, (n & 255) + 70);
  return `rgb(${r},${g},${b})`;
}
