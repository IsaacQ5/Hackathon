import { useEffect, useRef } from 'react';
import { GAME_CONFIG, type ArenaId } from '@tilt-mayhem/shared';
import type { RenderFrame, SnapshotBuffer } from '../utils/interpolation';

interface Props {
  buffer: SnapshotBuffer;
}

const W = GAME_CONFIG.arenaWidth;
const H = GAME_CONFIG.arenaHeight;
const R = GAME_CONFIG.playerRadius;
const THEMES: Record<ArenaId, { name: string; floor: string; edge: string }> = {
  train: { name: 'Runaway train', floor: '#36415e', edge: '#ff9f43' },
  ice: { name: 'Icy rooftop', floor: '#9cecff', edge: '#e3fbff' },
  spinner: { name: 'Spin cycle', floor: '#4e347e', edge: '#d7a8ff' },
  island: { name: 'Crumbly island', floor: '#95653e', edge: '#ffcf75' },
};

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
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      draw(ctx, cssW, cssH, buffer.frame(now), now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [buffer]);

  return (
    <div className="arena-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, cw: number, ch: number, frame: RenderFrame | null, now: number) {
  ctx.clearRect(0, 0, cw, ch);
  const pad = 24;
  const scale = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
  const ox = (cw - W * scale) / 2;
  const oy = (ch - H * scale) / 2;
  ctx.fillStyle = '#17102f';
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const arena = frame?.arena ?? 'train';
  const theme = THEMES[arena];
  const platformScale = frame?.platformScale ?? 1;
  const platformW = W * platformScale;
  const platformH = H * platformScale;
  const left = (W - platformW) / 2;
  const top = (H - platformH) / 2;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#251b4c');
  bg.addColorStop(1, '#120d27');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  roundRect(ctx, left, top, platformW, platformH, Math.min(32, platformW * 0.06));
  ctx.clip();
  const floor = ctx.createLinearGradient(left, top, left + platformW, top + platformH);
  floor.addColorStop(0, lighten(theme.floor, 18));
  floor.addColorStop(1, theme.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(left, top, platformW, platformH);
  drawArenaDetails(ctx, arena, left, top, platformW, platformH, now / 1000);
  ctx.restore();

  ctx.save();
  roundRect(ctx, left, top, platformW, platformH, Math.min(32, platformW * 0.06));
  ctx.lineWidth = 8;
  ctx.strokeStyle = theme.edge;
  ctx.shadowColor = theme.edge;
  ctx.shadowBlur = 20;
  ctx.stroke();
  ctx.restore();

  if (frame) {
    for (const p of [...frame.players].sort((a, b) => a.y - b.y)) {
      drawPlayer(ctx, p.x, p.y, p.color, p.nickname, p.vx, p.vy, p.connected, p.alive, p.action);
    }
  }
  ctx.restore();

  if (frame) {
    const alive = frame.players.filter((p) => p.alive).length;
    ctx.fillStyle = 'rgba(10,6,30,0.86)';
    roundRect(ctx, 18, 16, 210, 58, 18);
    ctx.fill();
    ctx.fillStyle = theme.edge;
    ctx.font = '700 20px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(theme.name, 32, 40);
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px Fredoka, system-ui, sans-serif';
    ctx.fillText(`${alive} still standing`, 32, 60);
    if (frame.phase === 'playing' || frame.phase === 'countdown') drawTimer(ctx, cw, oy, frame.timeLeftMs);
    if (frame.phase === 'countdown') {
      const seconds = Math.max(1, Math.ceil(frame.countdownMs / 1000));
      bigText(ctx, cw, ch, String(seconds), '#fff');
    } else if (alive <= 1 && frame.phase === 'playing') {
      bigText(ctx, cw, ch, 'WINNER!', '#ffd23f');
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 22px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for the players…', cw / 2, ch / 2);
  }
}

function drawArenaDetails(ctx: CanvasRenderingContext2D, arena: ArenaId, x: number, y: number, w: number, h: number, t: number) {
  ctx.save();
  if (arena === 'train') {
    ctx.strokeStyle = 'rgba(15,20,35,0.8)';
    ctx.lineWidth = 22;
    for (const offset of [-34, 34]) {
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2 + offset);
      ctx.lineTo(x + w, y + h / 2 + offset);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 5;
    for (let px = x + ((t * 80) % 80); px < x + w; px += 80) {
      ctx.beginPath();
      ctx.moveTo(px, y + h / 2 - 55);
      ctx.lineTo(px, y + h / 2 + 55);
      ctx.stroke();
    }
  } else if (arena === 'ice') {
    ctx.strokeStyle = 'rgba(255,255,255,0.52)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const px = x + ((i * 173 + 60) % Math.max(1, w));
      const py = y + ((i * 89 + 36) % Math.max(1, h));
      ctx.beginPath();
      ctx.moveTo(px - 22, py - 12);
      ctx.lineTo(px, py);
      ctx.lineTo(px + 25, py - 8);
      ctx.moveTo(px, py);
      ctx.lineTo(px - 12, py + 25);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y, w, h);
  } else if (arena === 'spinner') {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(t * 0.45);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 24;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-w, i * 74);
      ctx.lineTo(w, i * 74);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 46, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(55,30,10,0.36)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const px = x + ((i * 191 + 70) % Math.max(1, w));
      const py = y + ((i * 113 + 40) % Math.max(1, h));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 12, py + 20);
      ctx.lineTo(px - 8, py + 39);
      ctx.stroke();
    }
  }
  ctx.restore();
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
  alive: boolean,
  action: string,
) {
  ctx.save();
  ctx.globalAlpha = connected ? (alive ? 1 : 0.3) : 0.35;
  const speed = Math.hypot(vx, vy);
  const facing = speed > 10 ? Math.atan2(vy, vx) : 0;
  const wobble = Math.sin(performance.now() / 90 + x) * Math.min(0.18, speed / 1400);
  ctx.translate(x, y);
  ctx.rotate(alive ? wobble : Math.PI / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, R * 1.1, R * 1.3, R * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(facing);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const armSpread = action === 'punch' ? 2.4 : action === 'grab' ? 1.4 : action === 'thrown' ? 3.1 : 1;
  ctx.strokeStyle = lighten(color, 38);
  ctx.lineWidth = 7;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 5, -4);
    ctx.quadraticCurveTo(side * 19, -8 - armSpread * 4, side * (25 + armSpread * 6), -12 + side * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 5, R * 0.55);
    ctx.lineTo(side * 11, R + 9);
    ctx.stroke();
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.92, R * 1.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  for (const eye of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eye * 5, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#17102f';
    ctx.beginPath();
    ctx.arc(eye * 5 + 1, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.font = '600 15px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = alive ? (connected ? name : `${name} (away)`) : `${name} · OUT`;
  const width = ctx.measureText(label).width + 14;
  roundRect(ctx, x - width / 2, y - R * 2.2 - 16, width, 22, 11);
  ctx.fillStyle = 'rgba(10,6,30,0.82)';
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, x, y - R * 2.2);
  ctx.restore();
}

function drawTimer(ctx: CanvasRenderingContext2D, cw: number, oy: number, ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  ctx.fillStyle = 'rgba(10,6,30,0.86)';
  roundRect(ctx, cw / 2 - 62, Math.max(16, oy + 16), 124, 48, 24);
  ctx.fill();
  ctx.fillStyle = seconds <= 10 ? '#ff6b8b' : '#fff';
  ctx.font = '700 29px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cw / 2, Math.max(49, oy + 49));
}

function bigText(ctx: CanvasRenderingContext2D, cw: number, ch: number, text: string, color: string) {
  ctx.font = `700 ${Math.round(Math.min(cw, ch) * 0.2)}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(10,6,30,0.85)';
  ctx.strokeText(text, cw / 2, ch / 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillText(text, cw / 2, ch / 2);
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';
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

function lighten(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((value >> 16) & 255) + amount);
  const g = Math.min(255, ((value >> 8) & 255) + amount);
  const b = Math.min(255, (value & 255) + amount);
  return `rgb(${r},${g},${b})`;
}
