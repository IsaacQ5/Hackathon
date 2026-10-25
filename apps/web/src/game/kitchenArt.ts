import {
  INGREDIENTS,
  KITCHEN,
  STATIONS,
  stationById,
  type ChefFace,
  type ChefSnap,
  type ChefWork,
  type StationId,
} from '@tilt-mayhem/shared';

export const INK = '#2b1a12';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function emoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}

function outlined(ctx: CanvasRenderingContext2D, fill: string, lw = 3.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// ====================================================================== floor + counters

export function drawKitchen(ctx: CanvasRenderingContext2D, t: number) {
  // walls
  ctx.fillStyle = '#ffb36b';
  roundRect(ctx, -30, -30, 1060, 660, 30);
  ctx.fill();
  // floor checkerboard
  const f = KITCHEN.floor;
  ctx.save();
  roundRect(ctx, f.x0 - 20, f.y0 - 20, f.x1 - f.x0 + 40, f.y1 - f.y0 + 40, 18);
  ctx.clip();
  const sz = 48;
  for (let y = f.y0 - 20; y < f.y1 + 20; y += sz) {
    for (let x = f.x0 - 20; x < f.x1 + 20; x += sz) {
      ctx.fillStyle = (Math.floor(x / sz) + Math.floor(y / sz)) % 2 ? '#e6fbff' : '#9fe3ec';
      ctx.fillRect(x, y, sz, sz);
    }
  }
  ctx.restore();
  // counters
  for (const [y, h] of [
    [14, 106],
    [480, 106],
  ] as const) {
    roundRect(ctx, 24, y, 952, h, 18);
    outlined(ctx, '#c9874a', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, 32, y + 8, 936, 14, 7);
    ctx.fill();
  }
  void t;
}

// ====================================================================== stations

/** Who is working at a station right now (for animation). */
export interface StationActivity {
  progress: number;
  sinceRep: number;
  ingredient: string | null;
  workers: number;
}

export function drawStation(ctx: CanvasRenderingContext2D, id: StationId, act: StationActivity, t: number, highlight: string | null) {
  const spot = KITCHEN.spots.find((s) => s.id === id)!;
  const def = stationById(id);
  const { x, y } = spot;
  const busy = act.workers > 0;
  const pulse = busy ? Math.max(0, 1 - act.sinceRep / 260) : 0;
  const top = y < 300;

  ctx.save();
  ctx.translate(x, y);

  // glowing ring when a chef can use it
  if (highlight) {
    ctx.beginPath();
    ctx.ellipse(0, top ? 70 : -70, 70, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = `${highlight}55`;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = highlight;
    ctx.stroke();
  }

  // station plate
  roundRect(ctx, -82, -40, 164, 80, 16);
  outlined(ctx, shade(def.color, 0.2), 4);

  switch (id) {
    case 'chop': {
      // board
      roundRect(ctx, -58, -24, 116, 48, 10);
      outlined(ctx, '#e8b77a', 3);
      // food pieces
      const ing = act.ingredient ? INGREDIENTS.get(act.ingredient)?.ingredient.icon : '🥬';
      emoji(ctx, ing ?? '🥬', -18, 2, 26);
      // knife: lifts and slams with each chop
      const lift = busy ? (pulse > 0 ? (1 - pulse) * 22 : 20 + Math.sin(t * 10) * 2) : 6;
      ctx.save();
      ctx.translate(22, -lift + 6);
      ctx.rotate(-0.25);
      roundRect(ctx, -6, -6, 46, 14, 4);
      outlined(ctx, '#dfe6ef', 2.5);
      roundRect(ctx, 36, -5, 22, 12, 4);
      outlined(ctx, '#6b3e1f', 2.5);
      ctx.restore();
      break;
    }
    case 'fry': {
      // stove ring
      ctx.beginPath();
      ctx.arc(-8, 2, 34, 0, Math.PI * 2);
      outlined(ctx, '#3b3b46', 3);
      if (busy) {
        ctx.beginPath();
        ctx.arc(-8, 2, 28, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,120,40,${0.5 + Math.sin(t * 20) * 0.3})`;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      // pan + handle
      ctx.beginPath();
      ctx.arc(-8, 0, 26, 0, Math.PI * 2);
      outlined(ctx, '#55555f', 3);
      roundRect(ctx, 16, -5, 44, 10, 5);
      outlined(ctx, '#2a2a30', 2.5);
      // food flips up in an arc on each good flip
      const hop = pulse > 0 ? Math.sin((1 - pulse) * Math.PI) * 34 : 0;
      const spin = pulse > 0 ? (1 - pulse) * Math.PI * 2 : 0;
      ctx.save();
      ctx.translate(-8, -hop);
      ctx.rotate(spin);
      const ing = act.ingredient ? INGREDIENTS.get(act.ingredient)?.ingredient.icon : '🍳';
      emoji(ctx, ing ?? '🍳', 0, 0, 26);
      ctx.restore();
      // sizzle steam
      if (busy) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          const sx = -8 + i * 12;
          for (let k = 0; k < 8; k++) ctx.lineTo(sx + Math.sin(t * 8 + k + i) * 4, -26 - k * 4);
          ctx.stroke();
        }
      }
      break;
    }
    case 'stir': {
      ctx.beginPath();
      ctx.ellipse(0, 4, 46, 30, 0, 0, Math.PI * 2);
      outlined(ctx, '#7b7f8c', 3.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 22, 0, 0, Math.PI * 2);
      outlined(ctx, '#e8553f', 2.5);
      // swirl
      const rot = t * (busy ? 6 : 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.25) {
        const r = 4 + a * 3.2;
        ctx.lineTo(Math.cos(a + rot) * r, Math.sin(a + rot) * r * 0.55);
      }
      ctx.stroke();
      // bubbles
      if (busy) {
        for (let i = 0; i < 4; i++) {
          const k = (t * 1.5 + i * 0.25) % 1;
          ctx.beginPath();
          ctx.arc(Math.sin(i * 2.3) * 24, -k * 18, 3 + k * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
          ctx.fill();
        }
      }
      // spoon
      const sa = rot * 0.7;
      ctx.save();
      ctx.translate(Math.cos(sa) * 18, Math.sin(sa) * 10);
      ctx.rotate(-0.6);
      roundRect(ctx, -3, -44, 6, 46, 3);
      outlined(ctx, '#a36b3d', 2);
      ctx.restore();
      break;
    }
    case 'knead': {
      roundRect(ctx, -62, -26, 124, 52, 10);
      outlined(ctx, '#f3e2c4', 3);
      // flour dust
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 9; i++) ctx.fillRect(-50 + ((i * 37) % 100), -18 + ((i * 23) % 36), 3, 3);
      // dough blob stretches each knead, then puffs up with progress
      const stretch = pulse > 0 ? 1 + Math.sin((1 - pulse) * Math.PI) * 0.45 : 1;
      const puff = 0.8 + act.progress * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 2, 26 * stretch * puff, (18 / stretch) * puff, 0, 0, Math.PI * 2);
      outlined(ctx, act.progress > 0.95 ? '#d99a4e' : '#fbe7c0', 3);
      break;
    }
    case 'mix': {
      const shake = busy ? Math.sin(t * 40) * 3 * (pulse + 0.3) : 0;
      ctx.translate(shake, 0);
      ctx.beginPath();
      ctx.ellipse(0, 4, 44, 26, 0, 0, Math.PI);
      ctx.lineTo(-44, 4);
      outlined(ctx, '#8ec5ff', 3.5);
      ctx.beginPath();
      ctx.ellipse(0, 4, 44, 12, 0, 0, Math.PI * 2);
      const batter = act.progress > 0.5 ? '#ffe3a6' : '#fff4d6';
      outlined(ctx, batter, 3);
      // whisk
      ctx.save();
      ctx.rotate(-0.4 + shake * 0.05);
      ctx.strokeStyle = '#c4ccd8';
      ctx.lineWidth = 2.5;
      for (const k of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.ellipse(k * 0.5, -18, 5 + Math.abs(k) * 0.6, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      roundRect(ctx, -3, -50, 6, 22, 3);
      outlined(ctx, '#ff8a3d', 2);
      ctx.restore();
      break;
    }
    case 'juice': {
      // press
      roundRect(ctx, -60, -30, 42, 60, 8);
      outlined(ctx, '#ffd23f', 3);
      const press = busy ? 6 + act.progress * 8 + Math.sin(t * 6) * 2 : 0;
      roundRect(ctx, -56, -36 + press, 34, 12, 4);
      outlined(ctx, '#8d6e4f', 2.5);
      const ing = act.ingredient ? INGREDIENTS.get(act.ingredient)?.ingredient.icon : '🍊';
      emoji(ctx, ing ?? '🍊', -39, 6, 22);
      // glass fills with progress
      ctx.save();
      roundRect(ctx, 6, -26, 40, 56, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(6, -26, 40, 56);
      const fill = act.progress;
      ctx.fillStyle = act.ingredient === 'water' ? '#7fd0ff' : act.ingredient === 'puree' ? '#ff5d7a' : '#ffb02e';
      ctx.fillRect(6, 30 - 56 * fill, 40, 56 * fill);
      ctx.restore();
      roundRect(ctx, 6, -26, 40, 56, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (busy && act.progress < 1) {
        ctx.strokeStyle = '#ffb02e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.quadraticCurveTo(0, -10, 20, -18 + Math.sin(t * 14) * 2);
        ctx.stroke();
      }
      break;
    }
  }

  // Big sign on the counter's outer edge (so chefs' name tags never cover it),
  // styled like the station tiles on the phones: same symbol, verb and colour.
  drawSign(ctx, def.icon, def.verb, def.color, top ? -64 : 64);
  ctx.restore();
}

const CREAM = '#fffaf2';

/** Mix a hex colour toward cream, like the phone's `color-mix(var(--c) 40%, cream)`. */
function tint(hex: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(CREAM.slice(1), 16);
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * amt + ((b >> sh) & 255) * (1 - amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Station/serve sign: symbol + comic verb on a tinted tile with a hard ink shadow. */
function drawSign(ctx: CanvasRenderingContext2D, icon: string, verb: string, color: string, y: number) {
  ctx.font = '32px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif';
  const tw = ctx.measureText(verb).width;
  const w = tw + 76;
  const h = 54;
  roundRect(ctx, -w / 2 + 4, y - h / 2 + 4, w, h, 16);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, -w / 2, y - h / 2, w, h, 16);
  outlined(ctx, tint(color, 0.55), 4);
  emoji(ctx, icon, -w / 2 + 30, y + 1, 30);
  ctx.font = '32px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(verb, -w / 2 + 54, y + 3);
}

/** `happy` (0..1) makes the customer bounce right after a dish is served. */
export function drawPass(ctx: CanvasRenderingContext2D, t: number, ready: boolean, happy = 0) {
  const { x, y, r } = KITCHEN.pass;
  ctx.save();
  ctx.translate(x, y);
  if (ready) {
    ctx.beginPath();
    ctx.arc(0, 0, KITCHEN.pass.serveR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(124,255,107,${0.18 + Math.sin(t * 6) * 0.08})`;
    ctx.fill();
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 30;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3fbf2f';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawCustomer(ctx, t, happy, -r + 2);
  ctx.beginPath();
  ctx.arc(0, 6, r, 0, Math.PI * 2);
  outlined(ctx, '#8a5a2f', 4);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  outlined(ctx, '#f6f1ea', 4);
  // bell
  ctx.beginPath();
  ctx.arc(0, 6, 18, Math.PI, 0);
  ctx.lineTo(18, 8);
  ctx.lineTo(-18, 8);
  outlined(ctx, '#ffd23f', 3);
  ctx.beginPath();
  ctx.arc(0, -14, 4, 0, Math.PI * 2);
  outlined(ctx, '#ffd23f', 2);
  drawSign(ctx, '🔔', 'SERVE', '#3fbf2f', r + 8);
  ctx.restore();
}

/** Cosmetic diner seated at the serve table, peeking over its far edge. */
function drawCustomer(ctx: CanvasRenderingContext2D, t: number, happy: number, baseY: number) {
  const hop = happy > 0 ? Math.abs(Math.sin(t * 14)) * 8 * happy : 0;
  const sway = Math.sin(t * 1.6) * 1.5;
  ctx.save();
  ctx.translate(sway, baseY - hop);
  // chair back
  roundRect(ctx, -28, -62, 56, 60, 14);
  outlined(ctx, '#a0522d', 3.5);
  // body + bib
  ctx.beginPath();
  ctx.ellipse(0, -14, 21, 22, 0, 0, Math.PI * 2);
  outlined(ctx, '#4f7cff', 3.5);
  ctx.beginPath();
  ctx.moveTo(-11, -30);
  ctx.lineTo(11, -30);
  ctx.lineTo(0, -10);
  ctx.closePath();
  outlined(ctx, '#ffffff', 2.5);
  // head
  ctx.beginPath();
  ctx.arc(0, -46, 15, 0, Math.PI * 2);
  outlined(ctx, '#ffd9b8', 3);
  ctx.beginPath();
  ctx.arc(0, -50, 15, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(10, -54);
  ctx.quadraticCurveTo(0, -58, -10, -54);
  ctx.closePath();
  outlined(ctx, '#6b3e1f', 2.5);
  // eyes (blink now and then) + mouth
  const blink = t % 3.7 < 0.12;
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    if (blink) ctx.fillRect(s * 6 - 3, -47, 6, 2);
    else {
      ctx.beginPath();
      ctx.arc(s * 6, -46, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.beginPath();
  if (happy > 0.05) ctx.arc(0, -40, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  else ctx.arc(0, -37, 2.5, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // fork and knife, waiting for food
  const wave = happy > 0 ? Math.sin(t * 16) * 6 * happy : Math.sin(t * 3) * 1.5;
  for (const s of [-1, 1]) {
    const hx = s * 25;
    const hy = -16 + (s > 0 ? wave : -wave);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 4);
    ctx.lineTo(hx, hy - 22);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6ef';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    outlined(ctx, '#ffd9b8', 2.5);
  }
  ctx.restore();
}

// ====================================================================== chefs

export interface ChefView extends ChefSnap {
  seed: number;
  bounce: number;
  /** In first place right now. */
  crown?: boolean;
}

/** Eyes, mouth and the chosen face cosmetic. (cx, cy) is the centre between the eyes. */
function drawFace(ctx: CanvasRenderingContext2D, face: ChefFace, cx: number, cy: number, fx: number, fy: number, busy: boolean) {
  if (face === 'beard') {
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 3);
    ctx.quadraticCurveTo(cx - 12, cy + 20, cx, cy + 21);
    ctx.quadraticCurveTo(cx + 12, cy + 20, cx + 13, cy + 3);
    ctx.quadraticCurveTo(cx, cy + 9, cx - 13, cy + 3);
    outlined(ctx, '#6b4428', 2);
  }
  if (face === 'blush') {
    ctx.fillStyle = 'rgba(255,110,140,0.65)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 12, cy + 6, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (face === 'shades') {
    for (const s of [-1, 1]) {
      roundRect(ctx, cx + s * 7 - 6.5, cy - 4.5, 13, 9, 4);
      outlined(ctx, '#1d1d24', 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(cx + s * 7 - 4, cy - 2.5, 3, 2);
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 1);
    ctx.lineTo(cx + 1, cy - 1);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 7, cy, 5, 0, Math.PI * 2);
      outlined(ctx, '#fff', 2);
      ctx.beginPath();
      ctx.arc(cx + s * 7 + fx * 2, cy + fy * 2, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }
  if (face === 'glasses') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 7, cy, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy - 1);
    ctx.lineTo(cx + 1, cy - 1);
    ctx.stroke();
  }
  // mouth: concentrating "o" while working, smile otherwise
  ctx.beginPath();
  if (busy) ctx.ellipse(cx, cy + 10, 4, 3.5, 0, 0, Math.PI * 2);
  else ctx.arc(cx, cy + 6, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = face === 'beard' ? '#fff' : INK;
  if (busy) {
    ctx.fillStyle = INK;
    ctx.fill();
  } else ctx.stroke();
  if (face === 'stache' || face === 'beard') {
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 4, 4, 2, 0.3, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy + 4, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3a26';
    ctx.fill();
  }
}

/** Small jug for the POUR animation. `tip` 0..1 shows a stream when tipped far enough. */
function drawJug(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, tip: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  roundRect(ctx, -8, -10, 16, 20, 4);
  outlined(ctx, '#ffd23f', 2.5);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(-6, -2, 12, 10);
  if (tip > 0.6) {
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const side = rot > 0 ? 1 : -1;
    ctx.moveTo(side * 8, -10);
    ctx.quadraticCurveTo(side * 14, -4, side * 12, 8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Gold crown; (x, y) is the middle of its bottom edge. */
function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-16, -16);
  ctx.lineTo(-8, -8);
  ctx.lineTo(0, -20);
  ctx.lineTo(8, -8);
  ctx.lineTo(16, -16);
  ctx.lineTo(15, 0);
  ctx.closePath();
  ctx.lineJoin = 'round';
  outlined(ctx, '#ffd23f', 2.5);
  for (const [jx, jy, col] of [
    [-16, -16, '#ff3d5a'],
    [0, -20, '#2de2e6'],
    [16, -16, '#7cd651'],
  ] as const) {
    ctx.beginPath();
    ctx.arc(jx, jy, 2.6, 0, Math.PI * 2);
    outlined(ctx, col, 1.5);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-11, -5, 22, 2);
  ctx.restore();
}

export function drawChef(ctx: CanvasRenderingContext2D, c: ChefView, t: number, showCard: boolean) {
  const speed = Math.hypot(c.vx, c.vy);
  const walking = speed > 30 && !c.working;
  const step = walking ? Math.sin(t * 14 + c.seed) : 0;
  const fx = Math.cos(c.facing);
  const fy = Math.sin(c.facing);
  const R = KITCHEN.chefR;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = c.connected ? 1 : 0.45;

  // shadow
  ctx.fillStyle = 'rgba(40,20,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, R * 1.05, R * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = walking ? Math.abs(step) * 3 : Math.sin(t * 3 + c.seed) * 1;
  const squash = 1 + c.bounce * 0.25 * Math.sin(t * 30);
  ctx.translate(0, -bob);
  ctx.scale(1 / squash, squash);

  // feet
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 9 + step * 4 * s, 2, 7, 4.5, 0, 0, Math.PI * 2);
    outlined(ctx, '#3a2a22', 2.5);
  }

  // body + apron
  const bodyY = -24;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, R, R * 1.1, 0, 0, Math.PI * 2);
  outlined(ctx, c.color, 4);
  ctx.beginPath();
  ctx.ellipse(fx * 3, bodyY + 6, R * 0.62, R * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const work = c.working;

  // face first, so hands held up in front of it (stirring, chopping) stay on top
  if (fy > -0.7) drawFace(ctx, c.face, fx * 7, bodyY - 8, fx, fy, !!work);

  // arms: animated by station gesture
  const since = work ? work.sinceRep : 9999;
  const hit = Math.max(0, 1 - since / 260);
  // POUR: both hands tip a little jug out to the side (never over the face)
  const tip = (Math.sin(t * 2.4) + 1) / 2;
  const jugX = Math.abs(fx) < 0.3 ? 17 : fx * 18;
  const jugY = bodyY + 4 - tip * 8;
  if (work?.station === 'juice') drawJug(ctx, jugX, jugY, Math.sign(jugX) * tip * 1.1, tip);
  for (const s of [-1, 1]) {
    const shX = s * R * 0.9;
    const shY = bodyY - 2;
    let hx = shX + s * 8 + (walking ? -step * 6 * s : 0);
    let hy = shY + 14;
    if (work) {
      switch (work.station) {
        case 'chop':
          hx = s * 10 + fx * 14;
          hy = shY - 8 + (s > 0 ? (1 - hit) * -12 + hit * 16 : 6);
          break;
        case 'fry':
          hx = shX + fx * 16;
          hy = shY + 6 - hit * 16;
          break;
        case 'stir':
          hx = fx * 14 + Math.cos(t * 7 + s) * 10;
          hy = shY + 6 + Math.sin(t * 7 + s) * 6;
          break;
        case 'knead':
          hx = s * 8 + fx * (10 + Math.sin(t * 8) * 10);
          // vertical pump too, so it still reads when the chef faces the camera
          hy = shY + 10 + fy * 6 + Math.sin(t * 8) * 5;
          break;
        case 'mix':
          hx = s * 6 + fx * 14 + Math.sin(t * 30) * 6 * (hit + 0.3);
          hy = shY + 8;
          break;
        case 'juice':
          hx = jugX + s * 8;
          hy = jugY + (s * Math.sign(jugX) > 0 ? -4 : 4);
          break;
      }
    }
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.quadraticCurveTo((shX + hx) / 2 + s * 6, (shY + hy) / 2 + 4, hx, hy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    outlined(ctx, '#ffe0c7', 2.5);
  }

  // chef hat (toque): outline every piece first, then fill them all, so the
  // puffs read as one clean shape instead of overlapping circles
  const hatY = bodyY - R * 1.1 + 2;
  const puffs: [number, number, number][] = [
    [-9, hatY - 14, 9],
    [9, hatY - 14, 9],
    [0, hatY - 20, 11],
  ];
  const hatPath = () => {
    roundRect(ctx, -13, hatY - 6, 26, 10, 3);
    for (const [px, py, pr] of puffs) {
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, Math.PI * 2);
    }
  };
  hatPath();
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  hatPath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11, hatY - 6);
  ctx.lineTo(11, hatY - 6);
  ctx.lineWidth = 2;
  ctx.stroke();

  // leader's crown sits on top of the hat
  if (c.crown) drawCrown(ctx, 0, hatY - 27 + Math.sin(t * 4) * 1.5, Math.sin(t * 2) * 0.08);
  ctx.restore();

  // carried ingredients bob above the head (higher when there's a crown in the way)
  const headTop = c.y - bob - (c.crown ? 104 : 80);
  c.have.forEach((ing, i) => {
    const icon = INGREDIENTS.get(ing)?.ingredient.icon ?? '?';
    const ox = (i - (c.have.length - 1) / 2) * 22;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x + ox, headTop + Math.sin(t * 4 + i) * 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    emoji(ctx, icon, c.x + ox, headTop + 1 + Math.sin(t * 4 + i) * 2, 15);
    ctx.restore();
  });

  // name tag
  if (!c.nickname) {
    if (work && showCard) drawWorkCard(ctx, c, work, t);
    return;
  }
  ctx.save();
  ctx.font = '600 13px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const nw = ctx.measureText(c.nickname).width + 14;
  const ny = c.y + 22;
  roundRect(ctx, c.x - nw / 2, ny - 2, nw, 18, 9);
  ctx.fillStyle = 'rgba(43,26,18,0.8)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.nickname, c.x, ny + 7);
  ctx.restore();

  if (work && showCard) drawWorkCard(ctx, c, work, t);
}

/** Progress card by the working chef's profile: who, which station, the meter. */
function drawWorkCard(ctx: CanvasRenderingContext2D, c: ChefView, w: ChefWork, t: number) {
  const def = stationById(w.station);
  const ing = INGREDIENTS.get(w.ingredient)?.ingredient;
  const top = c.y < 300;
  const cx = c.x;
  const cy = top ? c.y + 66 : c.y - 118;
  const W = 150;
  const H = 48;
  ctx.save();
  const pop = 1 + Math.max(0, 1 - w.sinceRep / 200) * 0.06;
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  roundRect(ctx, -W / 2, -H / 2, W, H, 12);
  ctx.fillStyle = '#fffaf2';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.color;
  ctx.stroke();
  emoji(ctx, def.icon, -W / 2 + 18, -6, 18);
  emoji(ctx, ing?.icon ?? '?', W / 2 - 18, -6, 18);
  ctx.font = '700 13px Fredoka, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(`${def.verb}!`, 0, -6);
  // meter
  roundRect(ctx, -W / 2 + 10, 8, W - 20, 10, 5);
  ctx.fillStyle = '#e6dccd';
  ctx.fill();
  roundRect(ctx, -W / 2 + 10, 8, Math.max(10, (W - 20) * w.progress), 10, 5);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  roundRect(ctx, -W / 2 + 10, 8, W - 20, 10, 5);
  ctx.stroke();
  ctx.restore();
  void t;
}

export function stationColor(id: StationId): string {
  return stationById(id).color;
}

export { STATIONS };
