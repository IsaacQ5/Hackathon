import { HAZARDS, KITCHEN, MAPS, type ChefStuck, type HazardSnap, type MapId } from '@tilt-mayhem/shared';
import { comicText, outlined, roundRect } from './draw';
import { icon, iconSprite } from './icons';

/**
 * Drawing for the kitchen chaos events. Three layers so things stack right:
 * floor stuff (spills, warning targets, gust streaks) under the stations, fires on top of
 * the stations, and flying/rolling/running things on top of the chefs.
 *
 * Every map reskins the same events (see MAPS in packages/shared): the meteor is a meatball,
 * a cannonball, an asteroid, a coconut or a snowball; the loose chicken a hen, a pirate, an
 * alien, a monkey or a penguin; and so on.
 */

const flashOn = (t: number, hz = 6) => Math.floor(t * hz) % 2 === 0;

/** Puddle colours per map: fill, outline. */
const PUDDLE: Record<MapId, [string, string]> = {
  kitchen: ['rgba(110,190,255,0.8)', '#2f86d6'],
  pirate: ['rgba(90,170,230,0.8)', '#1f6fa8'],
  space: ['rgba(124,255,107,0.75)', '#2bb02b'],
  jungle: ['rgba(138,90,50,0.85)', '#5a3a1e'],
  arctic: ['rgba(220,245,255,0.9)', '#6fb4dc'],
};

/** Splat left where the falling thing lands. */
const SPLAT: Record<MapId, string> = {
  kitchen: 'rgba(232,67,47,0.75)',
  pirate: 'rgba(60,40,30,0.55)',
  space: 'rgba(90,80,110,0.6)',
  jungle: 'rgba(240,240,220,0.7)',
  arctic: 'rgba(255,255,255,0.9)',
};

// ====================================================================== floor layer

export function drawHazardsBack(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number, map: MapId = 'kitchen') {
  for (const h of hazards) {
    if (h.kind === 'spill') drawSpill(ctx, h, t, map);
    else if (h.kind === 'meteor') drawMeteorGround(ctx, h, t, map);
    else if (h.kind === 'cheese' && h.warnMs > 0) drawLane(ctx, h, t, map);
    else if (h.kind === 'gust') drawGust(ctx, h, t, map);
  }
}

function drawSpill(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number, map: MapId) {
  const k = 1 - h.progress * 0.8;
  const [fill, edge] = PUDDLE[map];
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
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = edge;
  ctx.stroke();
  // shine that drifts a little (mud bubbles instead)
  if (map === 'jungle') {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(-h.r * 0.4 + i * h.r * 0.4, 0, 3 + p * 5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(90,60,30,${1 - p})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-h.r * 0.35 + Math.sin(t * 2) * 2, -h.r * 0.3, h.r * 0.28, h.r * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // little warning sign
  icon(ctx, 'warning', h.x + h.r * 0.8, h.y - h.r * 0.55, 18);
}

function drawMeteorGround(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number, map: MapId) {
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
  // Landed: a splat + the thing itself, fading out.
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
  ctx.fillStyle = SPLAT[map];
  ctx.fill();
  icon(ctx, MAPS[map].hazards.meteor.icon, 0, -8, 46);
  ctx.restore();
}

function drawLane(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number, map: MapId) {
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
  chevrons(ctx, f.x0, f.x1, h.y, h.dir, t, on ? '#ffffff' : '#ff3d5a', 14);
  ctx.restore();
  warnText(ctx, MAPS[map].hazards.cheese.warn, (f.x0 + f.x1) / 2, h.y - h.r - 18, 24, t);
}

function chevrons(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, dir: number, t: number, fill: string, s: number) {
  ctx.fillStyle = fill;
  const shift = ((t * 120) % 80) * dir;
  for (let x = x0 + 20; x < x1; x += 80) {
    const cx = x + shift;
    if (cx < x0 || cx > x1) continue;
    ctx.beginPath();
    ctx.moveTo(cx - (10 * dir * s) / 14, y - s);
    ctx.lineTo(cx + (10 * dir * s) / 14, y);
    ctx.lineTo(cx - (10 * dir * s) / 14, y + s);
    ctx.lineTo(cx - (4 * dir * s) / 14, y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Gust: warning arrows across the floor, then streaks blowing past while it's active. */
function drawGust(ctx: CanvasRenderingContext2D, h: HazardSnap, t: number, map: MapId) {
  const f = KITCHEN.floor;
  ctx.save();
  if (h.warnMs > 0) {
    const on = flashOn(t, 4);
    for (const y of [f.y0 + 60, (f.y0 + f.y1) / 2, f.y1 - 60]) chevrons(ctx, f.x0, f.x1, y, h.dir, t, on ? 'rgba(255,255,255,0.75)' : 'rgba(255,61,90,0.6)', 18);
    ctx.restore();
    warnText(ctx, MAPS[map].hazards.gust.warn, (f.x0 + f.x1) / 2, f.y0 + 26, 30, t);
    return;
  }
  // water sweeping over the deck / goo-green suction lines / rain / snow streaks
  const color: Record<MapId, string> = {
    kitchen: 'rgba(255,255,255,0.6)',
    pirate: 'rgba(140,210,255,0.55)',
    space: 'rgba(170,220,255,0.55)',
    jungle: 'rgba(200,230,255,0.6)',
    arctic: 'rgba(255,255,255,0.85)',
  };
  if (map === 'pirate') {
    ctx.fillStyle = 'rgba(90,170,230,0.18)';
    ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
  }
  ctx.strokeStyle = color[map];
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const y = f.y0 + 10 + ((i * 53) % (f.y1 - f.y0 - 20));
    const len = 40 + (i % 4) * 20;
    const span = f.x1 - f.x0 + len;
    const p = ((t * (500 + (i % 5) * 80) + i * 137) % span) / span;
    const x = h.dir > 0 ? f.x0 - len + p * span : f.x1 + len - p * span;
    ctx.lineWidth = map === 'arctic' ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - h.dir * len, y + (map === 'jungle' ? 10 : 0));
    ctx.stroke();
  }
  ctx.restore();
}

// ====================================================================== on top of the stations

export function drawFires(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number, map: MapId = 'kitchen') {
  for (const h of hazards) {
    if (h.kind !== 'fire') continue;
    const k = 1 - h.progress * 0.85;
    const electric = map === 'space';
    ctx.save();
    ctx.translate(h.x, h.y);
    // glow
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    g.addColorStop(0, electric ? `rgba(120,200,255,${0.5 * k})` : `rgba(255,120,30,${0.5 * k})`);
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
    icon(ctx, 'fire', Math.sin(t * 5) * 6, -18, 44 * k);
    if (electric) {
      // sparks zapping out of the console
      ctx.strokeStyle = '#bfe6ff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(Math.cos(a) * 30, -10 + Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a + 0.4) * 50, -10 + Math.sin(a + 0.6) * 34);
        ctx.stroke();
      }
    }
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
    warnText(ctx, MAPS[map].hazards.fire.warn, h.x, h.y + (h.y < 300 ? 58 : -58), 26, t);
  }
}

// ====================================================================== on top of the chefs

export function drawHazardsFront(ctx: CanvasRenderingContext2D, hazards: HazardSnap[], t: number, map: MapId = 'kitchen') {
  const skin = MAPS[map].hazards;
  for (const h of hazards) {
    if (h.kind === 'meteor' && h.warnMs > 0 && h.warnMs < 800) {
      // It drops out of the sky for the last moment of the warning.
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
      ctx.translate(h.x, y);
      ctx.rotate(t * 6);
      icon(ctx, skin.meteor.icon, 0, 0, 56);
      ctx.restore();
    } else if (h.kind === 'cheese' && h.warnMs <= 0) {
      if (map === 'kitchen') drawCheeseWheel(ctx, h.x, h.y, h.r, (h.x / h.r) * h.dir);
      else drawRoller(ctx, skin.cheese.icon, h.x, h.y, h.r, h.dir, map !== 'space');
    } else if (h.kind === 'chicken') {
      drawRunnerAt(ctx, skin.chicken.icon, h.x, h.y, h.dir, t, h.id);
    }
  }
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

/** The rolling thing on the themed maps (barrel, boulder, snowman...). Robots glide instead of spinning. */
function drawRoller(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, r: number, dir: number, spin: boolean) {
  ctx.save();
  ctx.translate(x, y - r * 0.3);
  ctx.fillStyle = 'rgba(40,20,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, r * 1.05, r * 1.05, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (spin) ctx.rotate((x / r) * dir);
  icon(ctx, name, 0, 0, r * 2.1);
  ctx.restore();
}

/** A running creature at (x, y) facing `dir` (-1 left, 1 right). The icons all face left. */
export function drawRunnerAt(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, dir: number, t: number, seed = 0) {
  const hop = Math.abs(Math.sin(t * 14 + seed)) * 6;
  ctx.save();
  ctx.translate(x, y);
  // bright danger ring on the floor so it's easy to spot
  ctx.beginPath();
  ctx.ellipse(0, 4, 26, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,138,61,0.45)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ff5a2a';
  ctx.stroke();
  ctx.translate(0, -24 - hop);
  ctx.scale(dir > 0 ? -1 : 1, 1);
  const s = iconSprite(name);
  if (s) ctx.drawImage(s, -30, -30, 60, 60);
  ctx.restore();
  // a trail behind it: feathers for the hen, dust puffs for everyone else
  for (let i = 0; i < 2; i++) {
    const p = (t * 1.3 + i * 0.5) % 1;
    const tx = x - dir * (20 + p * 30);
    if (name === 'hen') icon(ctx, 'feather', tx, y - 30 + p * 24, 12);
    else {
      ctx.beginPath();
      ctx.arc(tx, y + 2 - p * 6, 4 + p * 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
      ctx.fill();
    }
  }
}

/** The classic loose chicken (also used by the home-screen gags). */
export function drawChickenAt(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number, seed = 0) {
  drawRunnerAt(ctx, 'hen', x, y, dir, t, seed);
}

// ====================================================================== helpers

/** Over a chef who's been knocked down: just the dizzy stars circling their head. */
export function drawStuckBadge(ctx: CanvasRenderingContext2D, x: number, y: number, stuck: ChefStuck, t: number) {
  if (stuck.kind === 'bonk') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      icon(ctx, 'star', x + Math.cos(a) * 22, y + 26 + Math.sin(a) * 7, 12);
    }
  }
}

function warnText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, t: number) {
  comicText(ctx, text, x, y, size, flashOn(t, 5) ? '#ffe14d' : '#ff3d5a');
}


