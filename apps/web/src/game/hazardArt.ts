import { HAZARDS, KITCHEN, type ChefStuck, type HazardSnap } from '@tilt-mayhem/shared';
import { emoji, INK, outlined, roundRect } from './kitchenArt';

/**
 * Drawing for the kitchen chaos events. Three layers so things stack right:
 * floor stuff (spills, warning targets) under the stations, fires on top of
 * the stations, and flying/rolling/running things on top of the chefs.
 */

const flashOn = (t: number, hz = 6) => Math.floor(t * hz) % 2 === 0;

// ====================================================================== floor layer

export function drawHazardsBack(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number) {
  for (const h of hazards) {
    if (h.kind === 'spill') drawSpill(ctx, h, t);
    else if (h.kind === 'meteor') drawMeteorGround(ctx, h, t);
    else if (h.kind === 'cheese' && h.warnMs > 0) drawCheeseLane(ctx, h, t);
  }
}

function drawSpill(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number) {
  const k = 1 - h.progress * 0.8;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.scale(k, k * 0.62);
  // wobbly puddle outline
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = h.r * (1 + Math.sin(a * 3 + h.id) * 0.12 + Math.sin(a * 5 + h.id * 2) * 0.06);
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(110,190,255,0.8)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2f86d6';
  ctx.stroke();
  // shine that drifts a little
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-h.r * 0.35 + Math.sin(t * 2) * 2, -h.r * 0.3, h.r * 0.28, h.r * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // little wet-floor warning
  emoji(ctx, '⚠️', h.x + h.r * 0.8, h.y - h.r * 0.55, 18);
}

function drawMeteorGround(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number) {
  if (h.warnMs > 0) {
    // Flashing target where it will land, with a shadow that grows as it falls.
    const k = 1 - h.warnMs / HAZARDS.warnMs;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.beginPath();
    ctx.ellipse(0, 0, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = flashOn(t, 4 + k * 8) ? 'rgba(255,40,60,0.45)' : 'rgba(255,210,63,0.3)';
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff3d5a';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(0, 0, h.r * 0.75 * k, h.r * 0.45 * k, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(43,26,18,0.35)';
    ctx.fill();
    warnText(ctx, '!', 0, -4, 34, t);
    ctx.restore();
    return;
  }
  // Landed: sauce splat + the meatball, fading out.
  const fade = Math.min(1, h.ttl / 500);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(h.x, h.y);
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = h.r * (0.8 + (i % 2) * 0.25);
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.55);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.55);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(232,67,47,0.75)';
  ctx.fill();
  drawMeatball(ctx, 0, -8, 24, 0);
  ctx.restore();
}

function drawCheeseLane(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number) {
  const f = KITCHEN.floor;
  const on = flashOn(t, 5);
  ctx.save();
  ctx.fillStyle = on ? 'rgba(255,40,60,0.35)' : 'rgba(255,210,63,0.3)';
  roundRect(ctx, f.x0 - 10, h.y - h.r - 6, f.x1 - f.x0 + 20, h.r * 2 + 12, 14);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ff3d5a';
  ctx.setLineDash([14, 10]);
  ctx.stroke();
  ctx.setLineDash([]);
  // chevrons pointing the way it will roll
  ctx.fillStyle = on ? '#ffffff' : '#ff3d5a';
  const shift = ((t * 120) % 80) * h.dir;
  for (let x = f.x0 + 20; x < f.x1; x += 80) {
    const cx = x + shift;
    if (cx < f.x0 || cx > f.x1) continue;
    ctx.beginPath();
    ctx.moveTo(cx - 10 * h.dir, h.y - 14);
    ctx.lineTo(cx + 10 * h.dir, h.y);
    ctx.lineTo(cx - 10 * h.dir, h.y + 14);
    ctx.lineTo(cx - 4 * h.dir, h.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  warnText(ctx, 'CHEESE WHEEL!', (f.x0 + f.x1) / 2, h.y - h.r - 18, 24, t);
}

// ====================================================================== on top of the stations

export function drawFires(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number) {
  for (const h of hazards) {
    if (h.kind !== 'fire') continue;
    const k = 1 - h.progress * 0.85;
    ctx.save();
    ctx.translate(h.x, h.y);
    // red glow
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    g.addColorStop(0, `rgba(255,120,30,${0.5 * k})`);
    g.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-110, -110, 220, 220);
    // dancing flames
    for (let i = 0; i < 7; i++) {
      const fx = -60 + i * 20;
      const fh = (30 + Math.sin(t * 9 + i * 1.9) * 10 + (i % 3) * 8) * k;
      ctx.beginPath();
      ctx.moveTo(fx - 12, 20);
      ctx.quadraticCurveTo(fx - 10, 20 - fh * 0.6, fx + Math.sin(t * 7 + i) * 4, 20 - fh);
      ctx.quadraticCurveTo(fx + 10, 20 - fh * 0.6, fx + 12, 20);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#ff5a2a' : '#ffb02e';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(43,26,18,0.5)';
      ctx.stroke();
    }
    emoji(ctx, '🔥', Math.sin(t * 5) * 6, -18, 44 * k);
    // extinguisher foam piles up as it's being put out
    const foam = Math.ceil(h.progress * 14);
    for (let i = 0; i < foam; i++) {
      const fx = -56 + ((i * 37) % 112);
      const fy = 14 - ((i * 23) % 34) + Math.sin(t * 3 + i) * 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 7 + (i % 3) * 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(150,180,200,0.8)';
      ctx.stroke();
    }
    // smoke puffs
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.7 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(Math.sin(i * 2 + t) * 16, -40 - p * 60, 8 + p * 12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(90,90,100,${0.45 * (1 - p) * k})`;
      ctx.fill();
    }
    ctx.restore();
    warnText(ctx, 'FIRE!', h.x, h.y + (h.y < 300 ? 58 : -58), 26, t);
  }
}

// ====================================================================== on top of the chefs

export function drawHazardsFront(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number) {
  for (const h of hazards) {
    if (h.kind === 'meteor' && h.warnMs > 0 && h.warnMs < 800) {
      // The meatball drops out of the sky for the last moment of the warning.
      const fall = h.warnMs / 800;
      const y = h.y - 8 - fall * 520;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const dx of [-14, 0, 14]) {
        ctx.beginPath();
        ctx.moveTo(h.x + dx, y - 34);
        ctx.lineTo(h.x + dx, y - 34 - 40 * (1 - fall * 0.3));
        ctx.stroke();
      }
      ctx.restore();
      drawMeatball(ctx, h.x, y, 30, t * 6);
    } else if (h.kind === 'cheese' && h.warnMs <= 0) {
      drawCheeseWheel(ctx, h.x, h.y, h.r, (h.x / h.r) * h.dir);
    } else if (h.kind === 'chicken') {
      drawChicken(ctx, h, t);
    }
  }
}

function drawMeatball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  outlined(ctx, '#8a4a2a', 3);
  ctx.fillStyle = '#6b3820';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 1.7) * r * 0.55, Math.sin(i * 2.3) * r * 0.55, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // sauce on top + a basil leaf
  ctx.beginPath();
  ctx.arc(0, -r * 0.2, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineWidth = r * 0.25;
  ctx.strokeStyle = '#e8432f';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.75, r * 0.25, r * 0.12, -0.5, 0, Math.PI * 2);
  outlined(ctx, '#3fbf2f', 1.5);
  ctx.restore();
}

export function drawCheeseWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y - r * 0.3);
  ctx.fillStyle = 'rgba(40,20,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.05, r * 1.05, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  outlined(ctx, '#ffcf3d', 3.5);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#e0a020';
  ctx.stroke();
  ctx.fillStyle = '#f0b52a';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(Math.cos(i * 1.26) * r * 0.5, Math.sin(i * 1.26) * r * 0.5, r * (0.1 + (i % 2) * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  // one wedge cut out, so you can see it spin
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, -0.35, 0.35);
  ctx.closePath();
  outlined(ctx, '#fff1b8', 2.5);
  ctx.restore();
}

function drawChicken(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number) {
  drawChickenAt(ctx, h.x, h.y, h.dir, t, h.id);
}

/** A running chicken at (x, y) facing `dir` (-1 left, 1 right). */
export function drawChickenAt(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number, seed = 0) {
  const hop = Math.abs(Math.sin(t * 14 + seed)) * 6;
  ctx.save();
  ctx.translate(x, y);
  // bright danger ring on the floor so it's easy to spot on the light tiles
  ctx.beginPath();
  ctx.ellipse(0, 4, 26, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,138,61,0.45)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ff5a2a';
  ctx.stroke();
  ctx.translate(0, -22 - hop);
  // The emoji faces left; mirror it when running right.
  ctx.scale(dir > 0 ? -1 : 1, 1);
  // dark outline around the model (ignored on browsers without canvas filters)
  ctx.filter = 'drop-shadow(0 0 1.5px #2b1a12) drop-shadow(0 0 1.5px #2b1a12) drop-shadow(0 3px 2px rgba(0,0,0,0.35))';
  emoji(ctx, '🐔', 0, 0, 50);
  ctx.filter = 'none';
  ctx.restore();
  // loose feathers trailing behind
  for (let i = 0; i < 2; i++) {
    const p = (t * 1.3 + i * 0.5) % 1;
    emoji(ctx, '🪶', x - dir * (20 + p * 30), y - 30 + p * 24, 12);
  }
}

// ====================================================================== helpers

/** Over a chef who's been knocked down: just the dizzy stars circling their head. */
export function drawStuckBadge(ctx: CanvasRenderingContext2D, x: number, y: number, stuck: ChefStuck, t: number) {
  // dizzy stars for a knock-down
  if (stuck.kind === 'bonk') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      emoji(ctx, '⭐', x + Math.cos(a) * 22, y + 26 + Math.sin(a) * 7, 12);
    }
  }
}

function warnText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, t: number) {
  ctx.save();
  ctx.font = `${size}px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 6);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = flashOn(t, 5) ? '#ffe14d' : '#ff3d5a';
  ctx.fillText(text, x, y);
  ctx.restore();
}
