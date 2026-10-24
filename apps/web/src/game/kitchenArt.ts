import {
  INGREDIENTS,
  KITCHEN,
  STATIONS,
  stationById,
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

  // name tag + action symbol
  // Label on the counter's outer edge so chefs' name tags never cover it.
  const ty = top ? -52 : 52;
  ctx.font = '600 15px Fredoka, system-ui, sans-serif';
  const label = `${def.verb}`;
  const w = ctx.measureText(label).width + 44;
  roundRect(ctx, -w / 2, ty - 14, w, 28, 14);
  outlined(ctx, def.color, 3);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, -w / 2 + 34, ty + 1);
  emoji(ctx, def.icon, -w / 2 + 18, ty + 1, 17);
  ctx.restore();
}

export function drawPass(ctx: CanvasRenderingContext2D, t: number, ready: boolean) {
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
  ctx.font = '700 13px Fredoka, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText('PASS', 0, 30);
  ctx.restore();
}

// ====================================================================== chefs

export interface ChefView extends ChefSnap {
  seed: number;
  bounce: number;
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

  // arms: animated by station gesture
  const work = c.working;
  const since = work ? work.sinceRep : 9999;
  const hit = Math.max(0, 1 - since / 260);
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
          hy = shY + 10 + fy * 6;
          break;
        case 'mix':
          hx = s * 6 + fx * 14 + Math.sin(t * 30) * 6 * (hit + 0.3);
          hy = shY + 8;
          break;
        case 'juice':
          hx = s * 8 + fx * 16;
          hy = shY + 4 + work.progress * 6;
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

  // face (back of head when facing away)
  if (fy > -0.7) {
    const cx = fx * 7;
    const cy = bodyY - 8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 7, cy, 5, 0, Math.PI * 2);
      outlined(ctx, '#fff', 2);
      ctx.beginPath();
      ctx.arc(cx + s * 7 + fx * 2, cy + fy * 2, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    ctx.beginPath();
    if (work) ctx.ellipse(cx, cy + 10, 4, 3.5, 0, 0, Math.PI * 2);
    else ctx.arc(cx, cy + 6, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    if (work) {
      ctx.fillStyle = INK;
      ctx.fill();
    } else ctx.stroke();
    // moustache, because chefs
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 4, 4, 2, 0.3, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy + 4, 4, 2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3a26';
    ctx.fill();
  }

  // chef hat (toque)
  const hatY = bodyY - R * 1.1 + 2;
  roundRect(ctx, -13, hatY - 6, 26, 10, 3);
  outlined(ctx, '#ffffff', 2.5);
  ctx.beginPath();
  ctx.arc(-9, hatY - 14, 9, 0, Math.PI * 2);
  ctx.arc(9, hatY - 14, 9, 0, Math.PI * 2);
  ctx.arc(0, hatY - 20, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();

  // carried ingredients bob above the head
  const headTop = c.y - bob - 80;
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
