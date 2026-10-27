import { layoutOf, type MapId } from '@tilt-mayhem/shared';
import { circle, ellipse, INK, outlined, roundRect, shine } from './draw';
import { icon } from './icons';
import { drawSign } from './sign';

/**
 * The serve table in the middle of the kitchen and the diner sitting at it, themed per map:
 * a hungry regular at a gingham table, a pirate captain at a barrel, an alien at a glowing
 * console, a gorilla at a tree stump, a polar bear at an ice block.
 *
 * Coordinates: the table is centred at (0, 0) with radius r; the diner sits behind it (north),
 * drawn first so the table covers their lap. The dish lands at (0, -20).
 */

/** How long the diner takes to eat a served dish before only the empty plate is left (ms). */
export const EAT_MS = 1800;

type G = CanvasRenderingContext2D;
type Look = 'kitchen' | 'pirate' | 'space' | 'jungle' | 'arctic';
const lookOf = (map: MapId): Look => (map === 'pirate2' ? 'pirate' : map);

/**
 * The serve table. `happy` (0..1) makes the diner bounce right after a serve; `dish` is the last
 * dish served and how long ago: it's eaten over EAT_MS, then the empty plate stays on the table.
 */
export function drawPass(
  ctx: G,
  t: number,
  ready: boolean,
  happy = 0,
  dish: { icon: string; age: number } | null = null,
  map: MapId = 'kitchen',
) {
  const { x, y, r, serveR } = layoutOf(map).pass;
  const look = lookOf(map);
  ctx.save();
  ctx.translate(x, y);
  if (ready) {
    ctx.beginPath();
    ctx.arc(0, 0, serveR, 0, Math.PI * 2);
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
  drawDiner(ctx, look, t, happy, -r + 2, eating);
  TABLES[look](ctx, r, t);
  if (dish) drawPlate(ctx, dish.icon, dish.age, t);
  drawSign(ctx, 'bell', 'SERVE', '#3fbf2f', r + 8);
  ctx.restore();
}

/** Plate in front of the diner: food slides in, gets eaten bite by bite, then the empty plate stays. */
function drawPlate(ctx: G, dishIcon: string, age: number, t: number) {
  const slide = Math.min(1, age / 250);
  const py = -20 + (1 - slide) * 30;
  ellipse(ctx, 0, py + 4, 24, 11);
  outlined(ctx, '#ffffff', 3);
  ellipse(ctx, 0, py + 4, 16, 7);
  ctx.strokeStyle = 'rgba(43,26,18,0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (age < EAT_MS) {
    // the dish shrinks in bites while the diner chomps
    const eaten = Math.max(0, (age - 300) / (EAT_MS - 300));
    const bites = Math.floor(eaten * 4);
    const size = 30 * (1 - bites * 0.2) * (1 + Math.max(0, Math.sin(t * 16)) * 0.04);
    icon(ctx, dishIcon, 0, py - 4, size);
    ctx.fillStyle = '#d9a066';
    for (let i = 0; i < bites; i++) {
      circle(ctx, -18 + i * 12, py + 8 + Math.sin(t * 9 + i) * 1.5, 2);
      ctx.fill();
    }
  } else {
    // empty plate: a little sauce smear left behind
    ellipse(ctx, 4, py + 4, 7, 3, 0.3);
    ctx.fillStyle = 'rgba(232,67,47,0.35)';
    ctx.fill();
  }
}

// ====================================================================== tables

/** The table's drop shadow and side (thickness), shared by every style. */
function tableBase(ctx: G, r: number, side: string) {
  ellipse(ctx, 4, 16, r + 4, r * 0.5);
  ctx.fillStyle = 'rgba(30,15,5,0.25)';
  ctx.fill();
  circle(ctx, 0, 7, r);
  outlined(ctx, side, 4);
}

const TABLES: Record<Look, (ctx: G, r: number, t: number) => void> = {
  kitchen: (ctx, r) => {
    tableBase(ctx, r, '#8a5a2f');
    // red gingham tablecloth with a scalloped hem
    circle(ctx, 0, 0, r);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(232,48,63,0.45)';
    for (let i = -r; i < r; i += 12) {
      ctx.fillRect(i, -r, 6, r * 2);
      ctx.fillRect(-r, i, r * 2, 6);
    }
    ctx.restore();
    circle(ctx, 0, 0, r);
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // napkin + cutlery on the left, little vase with a flower and salt & pepper on the right
    ctx.save();
    ctx.translate(-36, 8);
    ctx.rotate(-0.3);
    roundRect(ctx, -8, -10, 16, 20, 3);
    outlined(ctx, '#ffd23f', 2);
    ctx.restore();
    roundRect(ctx, 28, -2, 12, 16, 4);
    outlined(ctx, '#8ec5ff', 2);
    ctx.beginPath();
    ctx.moveTo(34, -2);
    ctx.lineTo(34, -14);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3fae2f';
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      circle(ctx, 34 + Math.cos(i * 1.26) * 4, -16 + Math.sin(i * 1.26) * 4, 3);
      outlined(ctx, '#ff3d7f', 1.2);
    }
    circle(ctx, 34, -16, 2.5);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    for (const [dx, col] of [
      [16, '#ffffff'],
      [22, '#3b3b46'],
    ] as const) {
      roundRect(ctx, dx - 3, 18, 6, 10, 2);
      outlined(ctx, col, 1.5);
    }
  },
  pirate: (ctx, r, t) => {
    tableBase(ctx, r, '#5c3a1e');
    // barrel head: planks + an iron hoop
    circle(ctx, 0, 0, r);
    outlined(ctx, '#b5743a', 4);
    ctx.save();
    circle(ctx, 0, 0, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(43,26,18,0.35)';
    ctx.lineWidth = 2;
    for (let x = -r + 14; x < r; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, -r);
      ctx.lineTo(x, r);
      ctx.stroke();
    }
    ctx.restore();
    circle(ctx, 0, 0, r - 6);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4a4a55';
    ctx.stroke();
    // candle in a bottle, dripping wax, flame flickering
    roundRect(ctx, 26, -6, 14, 22, 5);
    outlined(ctx, '#5a7a3a', 2);
    roundRect(ctx, 30, -16, 6, 12, 2);
    outlined(ctx, '#fff6e0', 1.5);
    const fl = 1 + Math.sin(t * 13) * 0.15;
    circle(ctx, 33, -22, 10);
    ctx.fillStyle = 'rgba(255,200,90,0.25)';
    ctx.fill();
    ellipse(ctx, 33, -21, 3, 5 * fl);
    outlined(ctx, '#ffb02e', 1.5);
    // gold coins + a rolled-up map
    for (const [cx, cy] of [
      [-30, 14],
      [-24, 18],
      [-34, 20],
    ] as const) {
      ellipse(ctx, cx, cy, 5, 3);
      outlined(ctx, '#ffd23f', 1.5);
    }
    ctx.save();
    ctx.translate(-34, -6);
    ctx.rotate(0.5);
    roundRect(ctx, -12, -4, 24, 8, 4);
    outlined(ctx, '#f3e2c4', 1.5);
    ctx.restore();
  },
  space: (ctx, r, t) => {
    tableBase(ctx, r, '#2b3046');
    circle(ctx, 0, 0, r);
    outlined(ctx, '#c4ccd8', 4);
    circle(ctx, 0, 0, r - 8);
    outlined(ctx, '#e8edf5', 2);
    // glowing ring that pulses
    const pulse = 0.5 + Math.sin(t * 3) * 0.3;
    circle(ctx, 0, 0, r - 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(45,226,230,${pulse})`;
    ctx.stroke();
    // blinking lights around the rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const on = Math.sin(t * 4 + i) > 0;
      circle(ctx, Math.cos(a) * (r - 4), Math.sin(a) * (r - 4), 2.5);
      ctx.fillStyle = on ? '#7cff6b' : '#3b4252';
      ctx.fill();
    }
    // a fizzing green drink and a tiny hologram menu
    roundRect(ctx, 28, -6, 12, 18, 3);
    outlined(ctx, 'rgba(124,255,107,0.8)', 2);
    for (let i = 0; i < 3; i++) {
      const p = (t * 1.5 + i / 3) % 1;
      circle(ctx, 32 + i * 2, 8 - p * 14, 1.5);
      ctx.fillStyle = `rgba(255,255,255,${1 - p})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-34, 14);
    ctx.lineTo(-44, -14);
    ctx.lineTo(-24, -14);
    ctx.closePath();
    ctx.fillStyle = `rgba(45,226,230,${0.25 + pulse * 0.2})`;
    ctx.fill();
    ctx.fillStyle = 'rgba(200,255,255,0.8)';
    for (let i = 0; i < 3; i++) ctx.fillRect(-40, -12 + i * 4, 12, 1.5);
  },
  jungle: (ctx, r) => {
    // tree stump: bark sides, growth rings on top, a bit of moss
    ellipse(ctx, 4, 16, r + 4, r * 0.5);
    ctx.fillStyle = 'rgba(30,15,5,0.25)';
    ctx.fill();
    circle(ctx, 0, 8, r);
    outlined(ctx, '#6b4022', 4);
    ctx.strokeStyle = 'rgba(30,15,5,0.4)';
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 15, r * 0.5);
      ctx.lineTo(i * 16, r + 6);
      ctx.stroke();
    }
    circle(ctx, 0, 0, r);
    outlined(ctx, '#d9a066', 4);
    ctx.strokeStyle = 'rgba(120,70,30,0.4)';
    for (let rr = 10; rr < r - 4; rr += 9) {
      circle(ctx, 3, 2, rr);
      ctx.stroke();
    }
    ellipse(ctx, -40, 10, 14, 9, 0.4);
    ctx.fillStyle = 'rgba(80,160,50,0.8)';
    ctx.fill();
    // banana-leaf placemat under the plate
    ellipse(ctx, 0, -16, 34, 13);
    outlined(ctx, '#5bbf3a', 2);
    // coconut cup with a straw and a paper umbrella
    circle(ctx, 34, 10, 9);
    outlined(ctx, '#7a4a2a', 2);
    ellipse(ctx, 34, 6, 6, 3);
    ctx.fillStyle = '#fff6e0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(34, 6);
    ctx.lineTo(40, -14);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, -12);
    ctx.quadraticCurveTo(40, -24, 50, -12);
    ctx.closePath();
    outlined(ctx, '#ff3d7f', 1.5);
  },
  arctic: (ctx, r, t) => {
    tableBase(ctx, r, '#6fa8cc');
    circle(ctx, 0, 0, r);
    outlined(ctx, '#d8f2ff', 4);
    shine(ctx, -20, -22, 18, 6, -0.5, 0.7);
    ctx.strokeStyle = 'rgba(120,180,220,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(20, 18);
    ctx.lineTo(34, 20);
    ctx.moveTo(20, 18);
    ctx.lineTo(22, 6);
    ctx.stroke();
    // snow piled on the edge
    ctx.fillStyle = '#ffffff';
    for (const [sx, sy, sr] of [
      [-44, 20, 12],
      [-34, 30, 10],
      [-50, 8, 8],
    ] as const) {
      circle(ctx, sx, sy, sr);
      ctx.fill();
    }
    // cocoa with marshmallows, steaming
    roundRect(ctx, 26, -4, 16, 18, 4);
    outlined(ctx, '#ff3d5a', 2);
    ellipse(ctx, 34, -4, 8, 3);
    ctx.fillStyle = '#7a4a2a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, -6, 4, 3);
    ctx.fillRect(35, -5, 4, 3);
    const p = (t * 0.8) % 1;
    circle(ctx, 34 + Math.sin(t * 2) * 3, -10 - p * 16, 3 + p * 4);
    ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
    ctx.fill();
  },
};

// ====================================================================== diners

interface DinerStyle {
  chair: (ctx: G, t: number) => void;
  body: (ctx: G) => void;
  head: (ctx: G, t: number, happy: number, eating: boolean) => void;
  /** Paw / hand colour and what each hand holds. */
  hand: string;
  hook?: boolean;
}

function blinkEyes(ctx: G, t: number, y: number, gap: number, r: number, color = INK) {
  const blink = t % 3.7 < 0.12;
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    if (blink) ctx.fillRect(s * gap - r, y - 1, r * 2, 2);
    else {
      circle(ctx, s * gap, y, r);
      ctx.fill();
      circle(ctx, s * gap - r * 0.35, y - r * 0.35, r * 0.35);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.fillStyle = color;
    }
  }
}

function mouth(ctx: G, t: number, y: number, happy: number, eating: boolean) {
  ctx.beginPath();
  if (eating) {
    ellipse(ctx, 0, y, 4, 1 + Math.abs(Math.sin(t * 16)) * 3.5);
    ctx.fillStyle = INK;
    ctx.fill();
    return;
  }
  if (happy > 0.05) ctx.arc(0, y - 2, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  else ctx.arc(0, y + 1, 2.5, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

const DINERS: Record<Look, DinerStyle> = {
  kitchen: {
    hand: '#ffd9b8',
    chair: (ctx) => {
      roundRect(ctx, -28, -64, 56, 62, 14);
      outlined(ctx, '#a0522d', 3.5);
      ctx.strokeStyle = 'rgba(43,26,18,0.3)';
      ctx.lineWidth = 3;
      for (const x of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.moveTo(x, -56);
        ctx.lineTo(x, -10);
        ctx.stroke();
      }
    },
    body: (ctx) => {
      ellipse(ctx, 0, -14, 21, 22);
      outlined(ctx, '#4f7cff', 3.5);
      // napkin tucked in like a bib, with a check pattern
      ctx.beginPath();
      ctx.moveTo(-12, -30);
      ctx.lineTo(12, -30);
      ctx.lineTo(0, -8);
      ctx.closePath();
      outlined(ctx, '#ffffff', 2.5);
      ctx.fillStyle = 'rgba(232,48,63,0.5)';
      ctx.fillRect(-6, -27, 4, 4);
      ctx.fillRect(2, -27, 4, 4);
      ctx.fillRect(-2, -21, 4, 4);
    },
    head: (ctx, t, happy, eating) => {
      for (const s of [-1, 1]) {
        circle(ctx, s * 15, -46, 4);
        outlined(ctx, '#ffd9b8', 2);
      }
      circle(ctx, 0, -46, 15);
      outlined(ctx, '#ffd9b8', 3);
      // swoopy hair
      ctx.beginPath();
      ctx.arc(0, -50, 15, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(4, -52, 2, -62);
      ctx.quadraticCurveTo(-4, -54, -12, -54);
      ctx.closePath();
      outlined(ctx, '#6b3e1f', 2.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 9, -53);
        ctx.lineTo(s * 3, -52);
        ctx.stroke();
      }
      blinkEyes(ctx, t, -47, 6, 2.4);
      ctx.fillStyle = 'rgba(255,110,140,0.5)';
      for (const s of [-1, 1]) {
        ellipse(ctx, s * 10, -41, 3, 2);
        ctx.fill();
      }
      mouth(ctx, t, -38, happy, eating);
    },
  },
  pirate: {
    hand: '#ffd9b8',
    hook: true,
    chair: (ctx) => {
      // tall captain's chair with gold studs
      roundRect(ctx, -32, -76, 64, 74, 16);
      outlined(ctx, '#5c2a1a', 3.5);
      roundRect(ctx, -24, -68, 48, 58, 10);
      outlined(ctx, '#b3263a', 2.5);
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 6; i++) {
        circle(ctx, -28 + (i % 2) * 56, -66 + Math.floor(i / 2) * 24, 2.5);
        ctx.fill();
      }
    },
    body: (ctx) => {
      ellipse(ctx, 0, -14, 22, 23);
      outlined(ctx, '#b3263a', 3.5);
      // lapels + gold buttons
      ctx.beginPath();
      ctx.moveTo(-10, -34);
      ctx.lineTo(0, -16);
      ctx.lineTo(10, -34);
      ctx.lineTo(4, -34);
      ctx.lineTo(0, -26);
      ctx.lineTo(-4, -34);
      ctx.closePath();
      outlined(ctx, '#ffffff', 2);
      ctx.fillStyle = '#ffd23f';
      for (const by of [-12, -4]) {
        for (const s of [-1, 1]) {
          circle(ctx, s * 7, by, 2.2);
          ctx.fill();
        }
      }
    },
    head: (ctx, t, happy, eating) => {
      circle(ctx, 0, -46, 15);
      outlined(ctx, '#ffd9b8', 3);
      // big black beard
      ctx.beginPath();
      ctx.moveTo(-14, -46);
      ctx.quadraticCurveTo(-16, -24, 0, -22);
      ctx.quadraticCurveTo(16, -24, 14, -46);
      ctx.quadraticCurveTo(8, -36, 0, -36);
      ctx.quadraticCurveTo(-8, -36, -14, -46);
      outlined(ctx, '#2b2b33', 2);
      blinkEyes(ctx, t, -48, 6, 2.3);
      // eyepatch over the right eye
      ctx.beginPath();
      ctx.moveTo(-15, -55);
      ctx.lineTo(15, -42);
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ellipse(ctx, 6, -48, 5.5, 5, 0.2);
      outlined(ctx, '#1d1d24', 2);
      mouth(ctx, t, -38, happy, eating);
      // tricorne hat with gold trim and a skull
      ctx.beginPath();
      ctx.moveTo(-26, -56);
      ctx.quadraticCurveTo(-14, -60, 0, -58);
      ctx.quadraticCurveTo(14, -60, 26, -56);
      ctx.quadraticCurveTo(18, -80, 0, -78);
      ctx.quadraticCurveTo(-18, -80, -26, -56);
      outlined(ctx, '#1d1d24', 3);
      ctx.beginPath();
      ctx.moveTo(-24, -57);
      ctx.quadraticCurveTo(0, -62, 24, -57);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
      circle(ctx, 0, -68, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    },
  },
  space: {
    hand: '#7cff6b',
    chair: (ctx, t) => {
      // hovering pod with a glow underneath
      const glow = 0.3 + Math.sin(t * 5) * 0.15;
      ellipse(ctx, 0, -2, 30, 8);
      ctx.fillStyle = `rgba(45,226,230,${glow})`;
      ctx.fill();
      roundRect(ctx, -30, -70, 60, 66, 26);
      outlined(ctx, '#c4ccd8', 3.5);
      roundRect(ctx, -22, -62, 44, 50, 18);
      outlined(ctx, '#3a4466', 2);
    },
    body: (ctx) => {
      ellipse(ctx, 0, -14, 20, 21);
      outlined(ctx, '#e8edf5', 3.5);
      roundRect(ctx, -7, -22, 14, 10, 3);
      outlined(ctx, '#3b3b46', 2);
      circle(ctx, 0, -17, 2.5);
      ctx.fillStyle = '#ff3d5a';
      ctx.fill();
    },
    head: (ctx, t, happy, eating) => {
      // antennae with bobbing balls
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        const bob = Math.sin(t * 4 + s) * 2;
        ctx.beginPath();
        ctx.moveTo(s * 7, -60);
        ctx.quadraticCurveTo(s * 14, -70, s * 16, -76 + bob);
        ctx.stroke();
        circle(ctx, s * 16, -77 + bob, 4);
        outlined(ctx, '#ffd23f', 2);
      }
      ellipse(ctx, 0, -46, 19, 16);
      outlined(ctx, '#7cff6b', 3);
      // three big eyes
      const blink = t % 4.3 < 0.14;
      for (const [ex, ey, er] of [
        [-9, -48, 5],
        [9, -48, 5],
        [0, -56, 4],
      ] as const) {
        if (blink) {
          ctx.fillStyle = INK;
          ctx.fillRect(ex - er, ey - 1, er * 2, 2);
          continue;
        }
        circle(ctx, ex, ey, er);
        outlined(ctx, '#ffffff', 1.8);
        circle(ctx, ex, ey + 0.5, er * 0.5);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      mouth(ctx, t, -37, happy, eating);
    },
  },
  jungle: {
    hand: '#4a4a55',
    chair: (ctx) => {
      // carved stone throne
      roundRect(ctx, -32, -72, 64, 70, 8);
      outlined(ctx, '#8f8a78', 3.5);
      ctx.fillStyle = 'rgba(43,26,18,0.35)';
      ctx.fillRect(-6, -66, 12, 6);
      ctx.fillRect(-18, -58, 6, 6);
      ctx.fillRect(12, -58, 6, 6);
      ellipse(ctx, 20, -70, 10, 4);
      ctx.fillStyle = 'rgba(80,160,50,0.8)';
      ctx.fill();
    },
    body: (ctx) => {
      ellipse(ctx, 0, -14, 24, 23);
      outlined(ctx, '#4a4a55', 3.5);
      ellipse(ctx, 0, -10, 13, 14);
      ctx.fillStyle = '#7a7a86';
      ctx.fill();
    },
    head: (ctx, t, happy, eating) => {
      circle(ctx, 0, -46, 17);
      outlined(ctx, '#4a4a55', 3);
      // lighter face + heavy brow
      ellipse(ctx, 0, -42, 12, 10);
      outlined(ctx, '#8a8a96', 2);
      ctx.beginPath();
      ctx.moveTo(-13, -52);
      ctx.quadraticCurveTo(0, -58, 13, -52);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2b2b33';
      ctx.stroke();
      blinkEyes(ctx, t, -48, 6, 2.3);
      for (const s of [-1, 1]) {
        circle(ctx, s * 3, -42, 1.5);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      mouth(ctx, t, -36, happy, eating);
      // crown of leaves and flowers
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.1 + i * 0.13);
        const lx = Math.cos(a) * 17;
        const ly = -50 + Math.sin(a) * 17;
        ellipse(ctx, lx, ly, 6, 3.5, a + Math.PI / 2);
        outlined(ctx, '#3fae2f', 1.5);
      }
      for (const [fx, col] of [
        [-10, '#ff3d7f'],
        [0, '#ffd23f'],
        [10, '#ff8a3d'],
      ] as const) {
        circle(ctx, fx, -64 + Math.abs(fx) * 0.25, 4);
        outlined(ctx, col, 1.5);
      }
    },
  },
  arctic: {
    hand: '#ffffff',
    chair: (ctx) => {
      // a block of ice
      roundRect(ctx, -30, -70, 60, 68, 8);
      outlined(ctx, '#c9efff', 3.5);
      shine(ctx, -14, -54, 6, 14, 0.2, 0.7);
    },
    body: (ctx) => {
      ellipse(ctx, 0, -14, 24, 23);
      outlined(ctx, '#ffffff', 3.5);
      // red scarf with a tail
      roundRect(ctx, -16, -34, 32, 8, 4);
      outlined(ctx, '#ff3d5a', 2);
      roundRect(ctx, 6, -30, 8, 18, 3);
      outlined(ctx, '#ff3d5a', 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, -18, 6, 2);
    },
    head: (ctx, t, happy, eating) => {
      for (const s of [-1, 1]) {
        circle(ctx, s * 13, -58, 6);
        outlined(ctx, '#ffffff', 2.5);
      }
      circle(ctx, 0, -46, 17);
      outlined(ctx, '#ffffff', 3);
      ellipse(ctx, 0, -40, 9, 7);
      outlined(ctx, '#f3f6fa', 2);
      ellipse(ctx, 0, -43, 3.5, 2.5);
      ctx.fillStyle = INK;
      ctx.fill();
      blinkEyes(ctx, t, -49, 7, 2.3);
      mouth(ctx, t, -35, happy, eating);
      // bobble hat
      ctx.beginPath();
      ctx.arc(0, -54, 15, Math.PI, Math.PI * 2);
      ctx.closePath();
      outlined(ctx, '#3d8bff', 2.5);
      roundRect(ctx, -16, -58, 32, 7, 3);
      outlined(ctx, '#ffffff', 2);
      circle(ctx, 0, -71, 5);
      outlined(ctx, '#ffffff', 2);
    },
  },
};

/** The diner, peeking over the far edge of the table. */
function drawDiner(ctx: G, look: Look, t: number, happy: number, baseY: number, eating: boolean) {
  const d = DINERS[look];
  const hop = happy > 0 ? Math.abs(Math.sin(t * 14)) * 8 * happy : 0;
  const sway = Math.sin(t * 1.6) * 1.5;
  ctx.save();
  // the alien's pod bobs up and down on its own
  ctx.translate(sway, baseY - hop - (look === 'space' ? 2 + Math.sin(t * 2) * 2 : 0));
  d.chair(ctx, t);
  d.body(ctx);
  d.head(ctx, t, happy, eating);
  // fork and knife (or a hook), waiting for food
  const wave = happy > 0 ? Math.sin(t * 16) * 6 * happy : Math.sin(t * 3) * 1.5;
  for (const s of [-1, 1]) {
    const hx = s * 25;
    const hy = -16 + (s > 0 ? wave : -wave);
    ctx.lineCap = 'round';
    if (d.hook && s > 0) {
      ctx.beginPath();
      ctx.arc(hx, hy - 10, 6, Math.PI * 0.9, Math.PI * 2.3);
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#dfe6ef';
      ctx.stroke();
      circle(ctx, hx, hy, 5);
      outlined(ctx, '#3b3b46', 2.5);
      continue;
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 4);
    ctx.lineTo(hx, hy - 22);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6ef';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (s < 0) {
      // fork tines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      for (const k of [-2, 0, 2]) {
        ctx.beginPath();
        ctx.moveTo(hx + k, hy - 22);
        ctx.lineTo(hx + k, hy - 27);
        ctx.stroke();
      }
    }
    circle(ctx, hx, hy, 5);
    outlined(ctx, d.hand, 2.5);
  }
  ctx.restore();
}
