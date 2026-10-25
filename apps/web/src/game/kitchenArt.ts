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
import { drawStuckBadge } from './hazardArt';

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

export function outlined(ctx: CanvasRenderingContext2D, fill: string, lw = 3.5) {
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

/** Colour of each ingredient once it's chopped / in the pot / in the glass. */
const FOOD_TINT: Record<string, string> = {
  lettuce: '#7cd651',
  tomato: '#ff4d4d',
  onion: '#e8c8f0',
  mushroom: '#d9b48f',
  carrot: '#ff9a2e',
  tomatosauce: '#e8432f',
  cheesesauce: '#ffcf3d',
  chocosauce: '#7a4a2a',
  soupbase: '#e9b872',
  curry: '#f0a020',
  pancake: '#ffe3a6',
  omelette: '#ffe066',
  cake: '#f7d9a8',
  cookie: '#d9a066',
  cream: '#fff6e0',
  orange: '#ffb02e',
  lemon: '#fff06a',
  puree: '#ff5d7a',
  apple: '#d8e86a',
  water: '#7fd0ff',
};
const DEFAULT_TINT: Record<StationId, string> = {
  chop: '#ff9a2e',
  fry: '#ffe066',
  stir: '#e8432f',
  knead: '#fbe7c0',
  mix: '#fff4d6',
  juice: '#ffb02e',
};

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

  // station plate: counter-top tile in the station colour with a soft highlight
  roundRect(ctx, -84, -42, 168, 84, 18);
  outlined(ctx, shade(def.color, 0.2), 4);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -76, -36, 152, 12, 6);
  ctx.fill();

  // Everything below only moves while somebody is cooking here.
  const ing = act.ingredient ? INGREDIENTS.get(act.ingredient)?.ingredient : undefined;
  const food = FOOD_TINT[act.ingredient ?? ''] ?? DEFAULT_TINT[id];

  switch (id) {
    case 'chop': {
      // wooden board with grain + a juice groove
      roundRect(ctx, -64, -28, 128, 56, 12);
      outlined(ctx, '#e3a96b', 3);
      roundRect(ctx, -56, -21, 112, 42, 9);
      ctx.strokeStyle = 'rgba(120,70,30,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,70,30,0.25)';
      for (const gy of [-10, 2, 12]) {
        ctx.beginPath();
        ctx.moveTo(-48, gy);
        ctx.bezierCurveTo(-20, gy - 4, 10, gy + 4, 44, gy - 1);
        ctx.stroke();
      }
      // the whole vegetable on the left, chopped slices piling up on the right
      const knifeY = busy ? -Math.abs(Math.sin(t * 9)) * 22 : -16;
      const slices = busy ? 2 + Math.floor(act.progress * 6) : 3;
      for (let i = 0; i < slices; i++) {
        const sx = 4 + (i % 3) * 13 + (i > 2 ? 6 : 0);
        const sy = -6 + Math.floor(i / 3) * 12 + (i % 2) * 3;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 4.5, 0.4 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
        outlined(ctx, food, 2);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3, 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
      }
      emoji(ctx, ing?.icon ?? '🥕', -30, 2, 26);
      // chef's knife: steel blade with shine, wooden handle with rivets
      ctx.save();
      ctx.translate(-8, knifeY + 2);
      ctx.rotate(busy ? -0.15 - Math.abs(Math.sin(t * 9)) * 0.25 : -0.3);
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(34, -8);
      ctx.lineTo(34, 6);
      ctx.quadraticCurveTo(10, 10, -10, 4);
      ctx.closePath();
      outlined(ctx, '#e6edf5', 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, -5, 28, 2.5);
      roundRect(ctx, 33, -7, 26, 12, 4);
      outlined(ctx, '#6b3e1f', 2.5);
      ctx.fillStyle = '#e0c08a';
      for (const rx of [40, 51]) {
        ctx.beginPath();
        ctx.arc(rx, -1, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'fry': {
      // stove top + burner
      roundRect(ctx, -66, -32, 132, 64, 12);
      outlined(ctx, '#3b3b46', 3);
      ctx.beginPath();
      ctx.arc(-10, 2, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e1e26';
      ctx.lineWidth = 4;
      ctx.stroke();
      // flames dance under the pan only while cooking
      if (busy) {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const fl = 8 + Math.sin(t * 18 + i * 1.7) * 4;
          const bx = -10 + Math.cos(a) * 30;
          const by = 2 + Math.sin(a) * 30;
          ctx.beginPath();
          ctx.moveTo(bx - Math.sin(a) * 4, by + Math.cos(a) * 4);
          ctx.lineTo(bx + Math.cos(a) * fl, by + Math.sin(a) * fl);
          ctx.lineTo(bx + Math.sin(a) * 4, by - Math.cos(a) * 4);
          ctx.closePath();
          ctx.fillStyle = i % 2 ? '#ffb02e' : '#ff5a2a';
          ctx.fill();
        }
      }
      // pan jiggles while cooking; food hops in a loop and flips higher on each good rep
      const jig = busy ? Math.sin(t * 14) * 2 : 0;
      ctx.save();
      ctx.translate(jig, 0);
      roundRect(ctx, 14, -5, 52, 10, 5);
      outlined(ctx, '#2a2a30', 2.5);
      ctx.beginPath();
      ctx.arc(-10, 0, 27, 0, Math.PI * 2);
      outlined(ctx, '#4a4a55', 3);
      ctx.beginPath();
      ctx.arc(-10, 0, 21, 0, Math.PI * 2);
      ctx.fillStyle = '#2f2f37';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-17, -7, 7, Math.PI, Math.PI * 1.6);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
      const loopHop = busy ? Math.abs(Math.sin(t * 5)) * 10 : 0;
      const hop = pulse > 0 ? Math.sin((1 - pulse) * Math.PI) * 34 : loopHop;
      const spin = pulse > 0 ? (1 - pulse) * Math.PI * 2 : busy ? Math.sin(t * 5) * 0.3 : 0;
      ctx.save();
      ctx.translate(-10, -hop);
      ctx.rotate(spin);
      emoji(ctx, ing?.icon ?? '🥚', 0, 0, 26);
      ctx.restore();
      ctx.restore();
      if (busy) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          const sx = -10 + i * 12;
          for (let k = 0; k < 8; k++) ctx.lineTo(sx + Math.sin(t * 8 + k + i) * 4, -28 - k * 4);
          ctx.stroke();
        }
      }
      break;
    }
    case 'stir': {
      // pot with side handles, rim and coloured soup
      for (const s of [-1, 1]) {
        roundRect(ctx, s * 50 - 9, -6, 18, 10, 5);
        outlined(ctx, '#5c606c', 2.5);
      }
      ctx.beginPath();
      ctx.ellipse(0, 6, 46, 30, 0, 0, Math.PI * 2);
      outlined(ctx, '#7b7f8c', 3.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 23, 0, 0, Math.PI * 2);
      outlined(ctx, '#a3a8b5', 2.5);
      ctx.beginPath();
      ctx.ellipse(0, 1, 34, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = food;
      ctx.fill();
      // swirl + bubbles + spoon only turn while somebody stirs
      const rot = busy ? t * 6 : 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.25) {
        const r = 3 + a * 2.9;
        ctx.lineTo(Math.cos(a + rot) * r, 1 + Math.sin(a + rot) * r * 0.5);
      }
      ctx.stroke();
      if (busy) {
        for (let i = 0; i < 5; i++) {
          const k = (t * 1.5 + i * 0.2) % 1;
          ctx.beginPath();
          ctx.arc(Math.sin(i * 2.3) * 22, 2 - k * 20, 3 + k * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
          ctx.fill();
        }
      }
      const sa = busy ? rot * 0.7 : 0.8;
      ctx.save();
      ctx.translate(Math.cos(sa) * 18, Math.sin(sa) * 9);
      ctx.rotate(-0.6);
      roundRect(ctx, -3.5, -48, 7, 48, 3.5);
      outlined(ctx, '#a36b3d', 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
      outlined(ctx, '#a36b3d', 2);
      ctx.restore();
      break;
    }
    case 'knead': {
      // floured marble slab
      roundRect(ctx, -64, -28, 128, 56, 12);
      outlined(ctx, '#f3e2c4', 3);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 14; i++) ctx.fillRect(-54 + ((i * 37) % 108), -20 + ((i * 23) % 40), 3, 3);
      // dough squashes in rhythm (and stretches more on each counted knead)
      const beat = busy ? Math.sin(t * 8) : 0;
      const stretch = 1 + (pulse > 0 ? Math.sin((1 - pulse) * Math.PI) * 0.35 : 0) + beat * 0.12;
      const puff = 0.8 + act.progress * 0.5;
      ctx.beginPath();
      ctx.ellipse(-6, 4, 24 * stretch * puff, (16 / stretch) * puff, 0, 0, Math.PI * 2);
      outlined(ctx, act.progress > 0.95 ? '#d99a4e' : '#fbe7c0', 3);
      ctx.beginPath();
      ctx.arc(-12, -1, 5 * puff, Math.PI * 1.1, Math.PI * 1.7);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // rolling pin rolls back and forth over the dough
      const px = busy ? Math.sin(t * 8) * 16 : 34;
      ctx.save();
      ctx.translate(px, busy ? -4 : -14);
      ctx.rotate(Math.PI / 2 - 0.15);
      roundRect(ctx, -22, -7, 44, 14, 7);
      outlined(ctx, '#d9a066', 2.5);
      for (const s of [-1, 1]) {
        roundRect(ctx, s * 22 - (s > 0 ? 0 : 10), -4, 10, 8, 4);
        outlined(ctx, '#8d5a2b', 2);
      }
      ctx.restore();
      break;
    }
    case 'mix': {
      const shake = busy ? Math.sin(t * 30) * 3 : 0;
      ctx.save();
      ctx.translate(shake, 0);
      // bowl with a shine and batter that ripples while whisking
      ctx.beginPath();
      ctx.ellipse(0, 4, 46, 28, 0, 0, Math.PI);
      ctx.lineTo(-46, 4);
      outlined(ctx, '#8ec5ff', 3.5);
      ctx.beginPath();
      ctx.ellipse(-24, 16, 8, 4, 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 4, 46, 13, 0, 0, Math.PI * 2);
      outlined(ctx, '#cfe6ff', 3);
      ctx.beginPath();
      ctx.ellipse(0, 4, 39, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = act.progress > 0.5 ? '#ffe3a6' : food;
      ctx.fill();
      if (busy) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, 4, 10 + i * 9 + Math.sin(t * 12 + i) * 2, 2 + i * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // whisk: spins while mixing, rests against the rim otherwise
      ctx.save();
      ctx.translate(busy ? Math.sin(t * 20) * 8 : 22, busy ? -2 : -4);
      ctx.rotate(busy ? -0.2 + Math.sin(t * 20) * 0.25 : 0.6);
      ctx.strokeStyle = '#c4ccd8';
      ctx.lineWidth = 2.5;
      for (const k of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.ellipse(k * 0.5, -16, 5 + Math.abs(k) * 0.6, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      roundRect(ctx, -3.5, -52, 7, 24, 3.5);
      outlined(ctx, '#ff8a3d', 2);
      ctx.restore();
      ctx.restore();
      break;
    }
    case 'juice': {
      // citrus press on the left, glass on the right
      roundRect(ctx, -64, -28, 50, 58, 10);
      outlined(ctx, '#fff1b8', 3);
      ctx.beginPath();
      ctx.ellipse(-39, -4, 18, 9, 0, 0, Math.PI * 2);
      outlined(ctx, '#ffd23f', 2.5);
      // ridged reamer
      ctx.beginPath();
      ctx.moveTo(-49, -4);
      ctx.quadraticCurveTo(-39, -26, -29, -4);
      outlined(ctx, '#ffe78a', 2);
      const press = busy ? Math.abs(Math.sin(t * 6)) * 8 : 0;
      emoji(ctx, ing?.icon ?? '🍊', -39, -14 + press, 22);
      // spout + glass that fills with progress
      roundRect(ctx, -16, 6, 14, 6, 3);
      outlined(ctx, '#e0b52a', 2);
      ctx.save();
      roundRect(ctx, 8, -26, 42, 56, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(8, -26, 42, 56);
      const fill = act.progress;
      const wave = busy ? Math.sin(t * 10) * 2 : 0;
      ctx.fillStyle = food;
      ctx.beginPath();
      ctx.moveTo(8, 30);
      ctx.lineTo(8, 30 - 56 * fill + wave);
      ctx.lineTo(50, 30 - 56 * fill - wave);
      ctx.lineTo(50, 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(14, -20, 5, 44);
      ctx.restore();
      roundRect(ctx, 8, -26, 42, 56, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (busy && act.progress < 1) {
        ctx.strokeStyle = food;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, 10);
        ctx.quadraticCurveTo(14, 4 + Math.sin(t * 14) * 2, 26, 26 - 56 * act.progress);
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
/** How long the diner takes to eat a served dish before only the empty plate is left (ms). */
export const EAT_MS = 1800;

/**
 * The serve table. `happy` (0..1) makes the diner bounce right after a serve; `dish` is the last
 * dish served and how long ago: it's eaten over EAT_MS, then the empty plate stays on the table.
 */
export function drawPass(
  ctx: CanvasRenderingContext2D,
  t: number,
  ready: boolean,
  happy = 0,
  dish: { icon: string; age: number } | null = null,
) {
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
  const eating = !!dish && dish.age < EAT_MS;
  drawCustomer(ctx, t, happy, -r + 2, eating);
  ctx.beginPath();
  ctx.arc(0, 6, r, 0, Math.PI * 2);
  outlined(ctx, '#8a5a2f', 4);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  outlined(ctx, '#f6f1ea', 4);
  if (dish) drawPlate(ctx, dish.icon, dish.age, t);
  drawSign(ctx, '🔔', 'SERVE', '#3fbf2f', r + 8);
  ctx.restore();
}

/** Plate in front of the diner: food slides in, gets eaten bite by bite, then the empty plate stays. */
function drawPlate(ctx: CanvasRenderingContext2D, icon: string, age: number, t: number) {
  const slide = Math.min(1, age / 250);
  const px = 0;
  const py = -20 + (1 - slide) * 30;
  // plate
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 24, 11, 0, 0, Math.PI * 2);
  outlined(ctx, '#ffffff', 3);
  ctx.beginPath();
  ctx.ellipse(px, py + 4, 16, 7, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(43,26,18,0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (age < EAT_MS) {
    // the dish shrinks in bites while the diner chomps
    const eaten = Math.max(0, (age - 300) / (EAT_MS - 300));
    const bites = Math.floor(eaten * 4);
    const size = 30 * (1 - bites * 0.2) * (1 + Math.max(0, Math.sin(t * 16)) * 0.04);
    emoji(ctx, icon, px, py - 4, size);
    // crumbs fly on each bite
    ctx.fillStyle = '#d9a066';
    for (let i = 0; i < bites; i++) {
      ctx.beginPath();
      ctx.arc(px - 18 + i * 12, py + 8 + Math.sin(t * 9 + i) * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // empty plate: a little sauce smear left behind
    ctx.beginPath();
    ctx.ellipse(px + 4, py + 4, 7, 3, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,67,47,0.35)';
    ctx.fill();
  }
}

/** Cosmetic diner seated at the serve table, peeking over its far edge. */
function drawCustomer(ctx: CanvasRenderingContext2D, t: number, happy: number, baseY: number, eating: boolean) {
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
  if (eating) {
    // chomp chomp
    ctx.ellipse(0, -38, 4, 1 + Math.abs(Math.sin(t * 16)) * 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  } else {
    if (happy > 0.05) ctx.arc(0, -40, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    else ctx.arc(0, -37, 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
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
  /** End of the game: the winner dances, the rest look sad. */
  mood?: 'dance' | 'sad';
}

/**
 * Eyes, mouth and the chosen face cosmetic. (cx, cy) is the centre between the eyes.
 * Rows, top to bottom: eyes (cy), moustache (cy+7), mouth (just under the moustache), beard (wraps the chin).
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  face: ChefFace,
  cx: number,
  cy: number,
  fx: number,
  fy: number,
  busy: boolean,
  sad = false,
) {
  const HAIR = '#5a3a26';
  const stache = face === 'beard' || face === 'handlebar';
  const mouthY = stache ? cy + 10 : cy + 6;

  if (face === 'goatee') {
    // pointy little chin tuft under the mouth
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 15, cx + 6, cy + 12);
    ctx.quadraticCurveTo(cx + 3, cy + 20, cx, cy + 23);
    ctx.quadraticCurveTo(cx - 3, cy + 20, cx - 6, cy + 12);
    outlined(ctx, HAIR, 1.5);
  }

  if (face === 'beard') {
    // big bushy beard around the chin, leaving the mouth uncovered
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 2);
    ctx.quadraticCurveTo(cx - 15, cy + 24, cx, cy + 25);
    ctx.quadraticCurveTo(cx + 15, cy + 24, cx + 14, cy + 2);
    ctx.quadraticCurveTo(cx + 9, cy + 16, cx, cy + 16);
    ctx.quadraticCurveTo(cx - 9, cy + 16, cx - 14, cy + 2);
    outlined(ctx, '#6b4428', 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    for (const s of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 6, cy + 18);
      ctx.lineTo(cx + s * 7, cy + 22);
      ctx.stroke();
    }
  }
  if (face === 'blush') {
    ctx.fillStyle = 'rgba(255,110,140,0.65)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 12, cy + 6, 4.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // eyes
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
      if (face === 'eyepatch' && s > 0) {
        // pirate patch over one eye, strap running up to the hat
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 8);
        ctx.lineTo(cx + 14, cy + 3);
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 7, cy + 0.5, 6, 5.5, 0.2, 0, Math.PI * 2);
        outlined(ctx, '#1d1d24', 2);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx + s * 7, cy, 5, 0, Math.PI * 2);
      outlined(ctx, '#fff', 2);
      ctx.beginPath();
      ctx.arc(cx + s * 7 + fx * 2, cy + fy * 2, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      if (face === 'blush') {
        // lashes
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        for (const k of [-1, 0, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * 7 + k * 3, cy - 4.5);
          ctx.lineTo(cx + s * 7 + k * 4.5, cy - 7.5);
          ctx.stroke();
        }
      }
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

  // mouth: concentrating "o" while working, frown when sad, smile otherwise
  ctx.beginPath();
  if (busy) ctx.ellipse(cx, mouthY + 2, 3.5, 3, 0, 0, Math.PI * 2);
  else if (sad) ctx.arc(cx, mouthY + 5, 4.5, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(cx, mouthY - 1, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  if (busy) {
    ctx.fillStyle = INK;
    ctx.fill();
  } else ctx.stroke();

  // moustache sits between the eyes and the mouth
  if (face === 'beard') {
    ctx.fillStyle = HAIR;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 4.5, cy + 7, 5, 2.6, s * -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (face === 'handlebar') {
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + 6);
      ctx.quadraticCurveTo(cx + s * 7, cy + 10, cx + s * 12, cy + 6);
      ctx.stroke();
      // curled tip
      ctx.beginPath();
      ctx.arc(cx + s * 11.5, cy + 3.5, 2.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6.5, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = HAIR;
    ctx.fill();
  }
}

/**
 * Small jug for the POUR animation. `dir` is the side it pours toward (handle on the other side);
 * `tip` 0..1 shows a stream when tipped far enough.
 */
function drawJug(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, tip: number, dir: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // handle
  ctx.beginPath();
  ctx.arc(-dir * 9, 0, 5, Math.PI / 2, -Math.PI / 2, dir > 0);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffd23f';
  ctx.stroke();
  // body + juice + spout
  roundRect(ctx, -8, -10, 16, 20, 4);
  outlined(ctx, '#ffd23f', 2.5);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(-6, -2, 12, 10);
  ctx.beginPath();
  ctx.moveTo(dir * 6, -10);
  ctx.lineTo(dir * 12, -12);
  ctx.lineTo(dir * 7, -5);
  ctx.closePath();
  outlined(ctx, '#ffd23f', 2);
  if (tip > 0.6) {
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dir * 12, -12);
    ctx.quadraticCurveTo(dir * 18, -4, dir * 15, 8);
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

  // Taken out by a hazard: slipped / knocked down chefs lie on the floor, feathered ones shake.
  const stuck = c.stuck;
  const lying = stuck?.kind === 'slip' || stuck?.kind === 'bonk';
  if (lying) ctx.rotate((c.seed % 2 > 1 ? 1 : -1) * 1.25);
  if (stuck?.kind === 'feathers') ctx.translate(Math.sin(t * 40) * 2.5, 0);
  // End-of-game moods: the winner dances, everyone else droops.
  if (c.mood === 'dance') {
    ctx.translate(0, -Math.abs(Math.sin(t * 7)) * 8);
    ctx.rotate(Math.sin(t * 7) * 0.18);
  } else if (c.mood === 'sad') ctx.translate(0, 2);

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
  const sad = c.mood === 'sad';
  if (fy > -0.7) drawFace(ctx, c.face, fx * 7, bodyY - 8, fx, sad ? 1.2 : fy, !!work || !!stuck, sad);

  // arms: animated by station gesture
  const since = work ? work.sinceRep : 9999;
  const hit = Math.max(0, 1 - since / 260);
  // POUR: a jug held out to the side (never over the face), tipping outward.
  // One hand holds the handle (body side), the other supports the base; the jug is drawn on top.
  const tip = (Math.sin(t * 2.4) + 1) / 2;
  const jugX = Math.abs(fx) < 0.3 ? 19 : fx * 20;
  const jugY = bodyY + 6 - tip * 8;
  const jugDir = Math.sign(jugX) || 1;
  const jugRot = jugDir * tip * 1.1;
  const onJug = (lx: number, ly: number): [number, number] => [
    jugX + lx * Math.cos(jugRot) - ly * Math.sin(jugRot),
    jugY + lx * Math.sin(jugRot) + ly * Math.cos(jugRot),
  ];
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
          // body-side hand on the handle, outer hand under the base
          [hx, hy] = s === jugDir ? onJug(jugDir * 3, 12) : onJug(-jugDir * 14, 0);
          break;
      }
    }
    if (stuck?.kind === 'fire') {
      // fanning the flames
      hx = s * 12 + fx * 10 + Math.sin(t * 14) * 10;
      hy = shY - 6;
    } else if (lying) {
      // flailing on the floor
      hx = shX + s * 10;
      hy = shY - 8 + Math.sin(t * 10 + s) * 8;
    } else if (stuck?.kind === 'feathers') {
      hx = shX + s * 6;
      hy = shY - 12 + Math.sin(t * 20 + s * 2) * 6;
    } else if (c.mood === 'dance') {
      // arms up, waving in turn
      hx = shX + s * 10;
      hy = shY - 18 + Math.sin(t * 7 + (s > 0 ? Math.PI : 0)) * 8;
    } else if (sad) {
      hx = shX + s * 2;
      hy = shY + 18;
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
  if (work?.station === 'juice') drawJug(ctx, jugX, jugY, jugRot, tip, jugDir);

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

  if (stuck) drawStuckBadge(ctx, c.x, c.y - bob - (c.crown ? 132 : 110), stuck, t);

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
