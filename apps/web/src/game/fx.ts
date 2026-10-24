const OUTLINE = '#2b1a12';

/** Client-only juice: particles, comic words, flashes and screen shake. World units. */

interface Particle {
  kind: 'dust' | 'star' | 'confetti' | 'spark' | 'chunk' | 'snow';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  color: string;
  spin: number;
}

interface Word {
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  age: number;
  rot: number;
}

interface Flash {
  x: number;
  y: number;
  age: number;
  size: number;
}

const CONFETTI = ['#ff3d7f', '#ffd23f', '#2de2e6', '#7cff6b', '#b26bff', '#ff8a3d'];

export class Fx {
  private parts: Particle[] = [];
  private words: Word[] = [];
  private flashes: Flash[] = [];
  private shakeAmt = 0;
  private lastShake = 0;
  private rand = Math.random;

  dust(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      this.parts.push({ kind: 'dust', x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 25 - 10, life: 0.55, age: 0, size: 6 + this.rand() * 6, color: 'rgba(255,255,255,0.8)', spin: 0 });
    }
  }

  stars(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 120 + this.rand() * 160;
      this.parts.push({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.6, age: 0, size: 6 + this.rand() * 4, color: '#ffe14d', spin: this.rand() * 6 });
    }
  }

  sparks(x: number, y: number, color: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = 80 + this.rand() * 200;
      this.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45, age: 0, size: 4, color, spin: 0 });
    }
  }

  chunk(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      this.parts.push({ kind: 'chunk', x: x + (this.rand() - 0.5) * 50, y: y + (this.rand() - 0.5) * 50, vx: 0, vy: 40, life: 0.9, age: 0, size: 22 + this.rand() * 14, color: '#c8a064', spin: (this.rand() - 0.5) * 4 });
    }
  }

  confetti(x0: number, x1: number, y: number, n = 90) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        kind: 'confetti',
        x: x0 + this.rand() * (x1 - x0),
        y: y - this.rand() * 200,
        vx: (this.rand() - 0.5) * 120,
        vy: 60 + this.rand() * 120,
        life: 3 + this.rand() * 1.5,
        age: 0,
        size: 6 + this.rand() * 6,
        color: CONFETTI[i % CONFETTI.length]!,
        spin: this.rand() * 10,
      });
    }
  }

  snow(wind: number) {
    if (this.parts.filter((p) => p.kind === 'snow').length > 120) return;
    this.parts.push({ kind: 'snow', x: -100 + this.rand() * 1200, y: -20, vx: wind * 0.6, vy: 40 + this.rand() * 40, life: 14, age: 0, size: 2 + this.rand() * 3, color: '#fff', spin: 0 });
  }

  word(text: string, x: number, y: number, color: string, size = 40) {
    this.words.push({ text, x, y, color, size, age: 0, rot: (this.rand() - 0.5) * 0.5 });
    if (this.words.length > 14) this.words.shift();
  }

  flash(x: number, y: number, size = 40) {
    this.flashes.push({ x, y, age: 0, size });
  }

  /** Strong hits only; rate-limited so it stays special. */
  shake(amount: number, now: number) {
    if (now - this.lastShake < 350) return;
    this.lastShake = now;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  shakeOffset(): { x: number; y: number } {
    if (this.shakeAmt < 0.3) return { x: 0, y: 0 };
    return { x: (this.rand() - 0.5) * this.shakeAmt * 2, y: (this.rand() - 0.5) * this.shakeAmt * 2 };
  }

  update(dt: number, wind = 0) {
    this.shakeAmt *= Math.exp(-dt * 9);
    for (const p of this.parts) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'star' || p.kind === 'spark') p.vy += 500 * dt;
      if (p.kind === 'confetti') p.vx += Math.sin(p.age * 4 + p.spin) * 40 * dt;
      if (p.kind === 'snow') p.vx += (wind * 0.6 - p.vx) * dt;
      if (p.kind === 'dust') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
    this.parts = this.parts.filter((p) => p.age < p.life && p.y < 900);
    for (const w of this.words) w.age += dt;
    this.words = this.words.filter((w) => w.age < 1.1);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < 0.18);
  }

  /** Behind fighters: dust, falling chunks, snow. */
  drawBack(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const k = 1 - p.age / p.life;
      if (p.kind === 'dust') {
        ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - k * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'chunk') {
        ctx.globalAlpha = k;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        const s = p.size * k;
        ctx.fillStyle = p.color;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.kind === 'snow') {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** In front of fighters: stars, sparks, confetti, flashes, words. */
  drawFront(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const k = 1 - p.age / p.life;
      if (p.kind === 'star') {
        ctx.globalAlpha = k;
        drawStar(ctx, p.x, p.y, p.size, p.color, p.spin * p.age);
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (p.kind === 'confetti') {
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin * p.age);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    for (const f of this.flashes) {
      ctx.globalAlpha = 1 - f.age / 0.18;
      drawStar(ctx, f.x, f.y, f.size * (1 + f.age * 4), '#ffffff', f.age * 3, 12);
    }
    ctx.globalAlpha = 1;
    for (const w of this.words) {
      const pop = w.age < 0.12 ? 0.4 + (w.age / 0.12) * 0.8 : w.age < 0.2 ? 1.2 - ((w.age - 0.12) / 0.08) * 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = w.age > 0.8 ? 1 - (w.age - 0.8) / 0.3 : 1;
      ctx.translate(w.x, w.y - w.age * 40);
      ctx.rotate(w.rot);
      ctx.scale(pop, pop);
      ctx.font = `${w.size}px Bangers, "Luckiest Guy", Impact, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = w.size / 5;
      ctx.strokeStyle = OUTLINE;
      ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, rot = 0, points = 5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}
