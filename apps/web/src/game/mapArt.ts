import { KITCHEN, type MapId } from '@tilt-mayhem/shared';
import { circle, ellipse, hash, INK, outlined, roundRect, shine } from './draw';

/**
 * The five maps. Each one is drawn in three layers:
 *  - backdrop: fills the whole screen behind the kitchen (ocean, stars, jungle, snow...)
 *  - board: floor, counters and props. The still parts are painted ONCE into an offscreen
 *    canvas per map (so all this detail costs one drawImage per frame); a few animated bits
 *    (blinking lights, torches...) are drawn live on top.
 *  - overlay: things drifting over the chefs (seagulls, fireflies, snow), kept light.
 *
 * World space is the 1000 x 600 kitchen; the board art spills 30 units past it on every side.
 * The floor chefs walk on is KITCHEN.floor; stations sit on the two counters (top + bottom).
 *
 * Adding your own detail: put still things in the map's `paint*` function (they're free),
 * and only put moving things in `live*` / `overlay*` (those run every frame).
 */

const F = { x: KITCHEN.floor.x0 - 20, y: KITCHEN.floor.y0 - 20, w: KITCHEN.floor.x1 - KITCHEN.floor.x0 + 40, h: KITCHEN.floor.y1 - KITCHEN.floor.y0 + 40 };
const COUNTERS = [
  [14, 106],
  [480, 106],
] as const;
/** Gaps on the counters between the stations (x ranges), for props. */
const GAPS = [
  [30, 112],
  [290, 410],
  [590, 710],
  [888, 970],
] as const;

type G = CanvasRenderingContext2D;

const floorClip = (g: G) => {
  roundRect(g, F.x, F.y, F.w, F.h, 18);
  g.clip();
};

/** Darker band inside the floor's edge so it reads as sunk between the counters. */
function floorDepth(g: G, dark: string) {
  g.save();
  floorClip(g);
  g.lineWidth = 16;
  g.strokeStyle = dark;
  roundRect(g, F.x, F.y, F.w, F.h, 18);
  g.stroke();
  g.restore();
  roundRect(g, F.x, F.y, F.w, F.h, 18);
  g.lineWidth = 4;
  g.strokeStyle = INK;
  g.stroke();
}

/**
 * One counter seen from slightly above: its top, plus the front face along its lower edge
 * (the camera looks a little north, so you see the south side of things).
 */
function counter(g: G, y: number, h: number, top: string, face: string, detail: (y: number, h: number) => void) {
  roundRect(g, 24, y, 952, h, 18);
  outlined(g, face, 4);
  g.save();
  roundRect(g, 24, y, 952, h - 12, 18);
  g.clip();
  g.fillStyle = top;
  g.fillRect(24, y, 952, h - 12);
  detail(y, h - 12);
  g.restore();
  roundRect(g, 24, y, 952, h - 12, 18);
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(g, 32, y + 6, 936, 10, 5);
  g.fill();
}

/** Soft contact shadow under a prop. */
function contact(g: G, x: number, y: number, rx: number, ry = rx * 0.35) {
  ellipse(g, x, y, rx, ry);
  g.fillStyle = 'rgba(30,15,5,0.22)';
  g.fill();
}

// ====================================================================== classic kitchen

function paintKitchen(g: G) {
  g.fillStyle = '#ffb36b';
  roundRect(g, -30, -30, 1060, 660, 30);
  g.fill();
  // floor: checker tiles with grout, a glaze shine per tile and a few scuffs
  g.save();
  floorClip(g);
  const sz = 48;
  for (let y = F.y; y < F.y + F.h; y += sz) {
    for (let x = F.x; x < F.x + F.w; x += sz) {
      const dark = (Math.floor(x / sz) + Math.floor(y / sz)) % 2;
      g.fillStyle = dark ? '#e6fbff' : '#9fe3ec';
      g.fillRect(x, y, sz, sz);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 5, y + 5, sz * 0.35, 3);
    }
  }
  g.strokeStyle = 'rgba(60,120,130,0.35)';
  g.lineWidth = 1.5;
  for (let x = F.x; x < F.x + F.w; x += sz) {
    g.beginPath();
    g.moveTo(x, F.y);
    g.lineTo(x, F.y + F.h);
    g.stroke();
  }
  for (let y = F.y; y < F.y + F.h; y += sz) {
    g.beginPath();
    g.moveTo(F.x, y);
    g.lineTo(F.x + F.w, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(43,26,18,0.08)';
  g.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const x = F.x + 40 + hash(i) * (F.w - 80);
    const y = F.y + 30 + hash(i + 50) * (F.h - 60);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 10, y - 4, x + 18 + hash(i + 9) * 12, y + 2);
    g.stroke();
  }
  g.restore();
  floorDepth(g, 'rgba(40,90,100,0.18)');

  for (const [y, h] of COUNTERS) {
    counter(g, y, h, '#c9874a', '#9a6534', (cy, ch) => {
      g.strokeStyle = 'rgba(120,70,30,0.2)';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const gy = cy + 18 + i * ((ch - 24) / 4);
        g.beginPath();
        g.moveTo(30, gy);
        g.bezierCurveTo(300, gy - 6, 700, gy + 6, 970, gy - 2);
        g.stroke();
      }
      // butcher-block joints
      g.strokeStyle = 'rgba(90,50,20,0.25)';
      for (let x = 120; x < 970; x += 160) {
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x, cy + ch);
        g.stroke();
      }
    });
  }

  stationMats(g, 'rgba(46,92,70,0.3)');
  drain(g, F.x + F.w - 40, F.y + F.h - 34);

  // top counter props
  knifeBlock(g, 70, 64);
  herbPot(g, 330, 70);
  saltPepper(g, 650, 74);
  spiceRack(g, 690, 60);
  fruitBowl(g, 930, 66);
  // bottom counter props
  jars(g, 70, 520);
  utensilCrock(g, 350, 540);
  plateStack(g, 650, 548);
  towel(g, 690, 520);
  potStack(g, 930, 528);
  // floor-side props (on the strips beside the floor, not on walls)
  plantPot(g, 4, 200);
  mopBucket(g, 996, 400);
}

function stationMats(g: G, color: string) {
  for (const s of KITCHEN.spots) {
    const my = s.fy + (s.fy < 300 ? -2 : 2);
    roundRect(g, s.fx - 62, my - 16, 124, 32, 10);
    g.fillStyle = color;
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 10; i++) {
      circle(g, s.fx - 50 + i * 11, my, 2.2);
      g.fill();
    }
  }
}

function drain(g: G, x: number, y: number) {
  circle(g, x, y, 13);
  outlined(g, '#b8c4cc', 2.5);
  g.strokeStyle = 'rgba(43,26,18,0.5)';
  g.lineWidth = 2;
  for (const d of [-6, 0, 6]) {
    g.beginPath();
    g.moveTo(x - 8, y + d);
    g.lineTo(x + 8, y + d);
    g.stroke();
  }
}

function knifeBlock(g: G, x: number, y: number) {
  contact(g, x, y + 22, 24);
  g.strokeStyle = INK;
  g.lineWidth = 4;
  for (const [dx, col] of [
    [-10, '#2b2b33'],
    [0, '#6b3e1f'],
    [10, '#2b2b33'],
  ] as const) {
    roundRect(g, x + dx - 3, y - 26, 6, 18, 2);
    outlined(g, col, 2);
  }
  g.beginPath();
  g.moveTo(x - 20, y - 10);
  g.lineTo(x + 20, y - 14);
  g.lineTo(x + 22, y + 22);
  g.lineTo(x - 18, y + 22);
  g.closePath();
  outlined(g, '#8d5a2b', 3);
}

function herbPot(g: G, x: number, y: number) {
  contact(g, x, y + 22, 16);
  g.beginPath();
  g.moveTo(x - 12, y);
  g.lineTo(x + 12, y);
  g.lineTo(x + 8, y + 22);
  g.lineTo(x - 8, y + 22);
  g.closePath();
  outlined(g, '#d9744a', 2.5);
  for (const [lx, ly, a] of [
    [-7, -8, -0.5],
    [0, -14, 0],
    [7, -8, 0.5],
    [-3, -18, -0.2],
    [4, -20, 0.3],
  ] as const) {
    ellipse(g, x + lx, y + ly, 4.5, 9, a);
    outlined(g, '#3fbf2f', 1.5);
  }
}

function saltPepper(g: G, x: number, y: number) {
  for (const [dx, col] of [
    [-8, '#ffffff'],
    [8, '#3b3b46'],
  ] as const) {
    contact(g, x + dx, y + 12, 7);
    roundRect(g, x + dx - 5, y - 8, 10, 20, 4);
    outlined(g, col, 2);
    circle(g, x + dx, y - 9, 4);
    outlined(g, '#c4ccd8', 1.5);
  }
}

function spiceRack(g: G, x: number, y: number) {
  ['#e8432f', '#f0a020', '#7cd651', '#7a4a2a'].forEach((c, i) => {
    roundRect(g, x + i * 10, y - 6, 8, 16, 2);
    outlined(g, c, 1.5);
  });
}

function fruitBowl(g: G, x: number, y: number) {
  contact(g, x, y + 18, 28);
  ellipse(g, x, y + 6, 28, 14);
  outlined(g, '#8ec5ff', 2.5);
  for (const [dx, dy, c] of [
    [-12, -2, '#ff4d4d'],
    [2, -6, '#ffa22e'],
    [14, 0, '#9fd84a'],
    [-2, 4, '#fff06a'],
  ] as const) {
    circle(g, x + dx, y + dy, 8);
    outlined(g, c, 2);
  }
}

function jars(g: G, x: number, y: number) {
  ['#f6dfae', '#ff8fb0', '#e8432f'].forEach((c, i) => {
    const jx = x - 22 + i * 22;
    contact(g, jx, y + 22, 10);
    roundRect(g, jx - 9, y - 6, 18, 26, 5);
    outlined(g, 'rgba(230,248,255,0.95)', 2);
    roundRect(g, jx - 7, y + 4, 14, 14, 3);
    g.fillStyle = c;
    g.fill();
    roundRect(g, jx - 9, y - 12, 18, 7, 2);
    outlined(g, '#a36b3d', 2);
  });
}

function utensilCrock(g: G, x: number, y: number) {
  contact(g, x, y + 16, 14);
  g.strokeStyle = '#a36b3d';
  g.lineWidth = 3;
  for (const [ux, top] of [
    [-6, -26],
    [0, -30],
    [6, -24],
  ] as const) {
    g.beginPath();
    g.moveTo(x + ux * 0.6, y - 2);
    g.lineTo(x + ux, y + top);
    g.stroke();
  }
  roundRect(g, x - 11, y - 8, 22, 26, 5);
  outlined(g, '#8ec5ff', 2.5);
}

function plateStack(g: G, x: number, y: number) {
  contact(g, x, y + 6, 20);
  for (let i = 0; i < 4; i++) {
    ellipse(g, x, y - i * 5, 18, 6);
    outlined(g, '#ffffff', 2);
  }
}

function towel(g: G, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(0.15);
  roundRect(g, 0, 0, 34, 24, 3);
  outlined(g, '#ffffff', 2);
  g.fillStyle = '#ff3d5a';
  for (const k of [4, 14, 24]) g.fillRect(1, k, 32, 3);
  g.restore();
}

function potStack(g: G, x: number, y: number) {
  contact(g, x, y + 24, 26);
  for (const [dy, r] of [
    [12, 24],
    [0, 20],
  ] as const) {
    ellipse(g, x, y + dy, r, r * 0.4);
    outlined(g, '#a3a8b5', 2.5);
  }
  roundRect(g, x - 6, y - 14, 12, 8, 3);
  outlined(g, '#2b2b33', 2);
}

function plantPot(g: G, x: number, y: number) {
  contact(g, x, y + 26, 22);
  roundRect(g, x - 16, y, 32, 26, 6);
  outlined(g, '#d9744a', 3);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.45;
    ellipse(g, x + Math.cos(a) * 16, y + Math.sin(a) * 16 - 4, 7, 15, a + Math.PI / 2);
    outlined(g, i % 2 ? '#3fae2f' : '#5bbf3a', 2);
  }
}

function mopBucket(g: G, x: number, y: number) {
  contact(g, x, y + 22, 22);
  roundRect(g, x - 18, y - 10, 36, 32, 6);
  outlined(g, '#ffd23f', 3);
  ellipse(g, x, y - 10, 18, 7);
  outlined(g, '#7fd0ff', 2.5);
  g.beginPath();
  g.moveTo(x + 4, y - 10);
  g.lineTo(x - 10, y - 60);
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = '#a36b3d';
  g.stroke();
}

function liveKitchen(ctx: G, t: number) {
  // steam curling off the pots on the bottom counter
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    circle(ctx, 930 + Math.sin(t * 2 + i) * 6, 510 - p * 40, 4 + p * 6);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
    ctx.fill();
  }
}

// ====================================================================== pirate galley

function paintPirate(g: G) {
  // hull + gunwale rail around the deck
  roundRect(g, -30, -30, 1060, 660, 60);
  outlined(g, '#6b3e1f', 5);
  roundRect(g, -18, -18, 1036, 636, 50);
  g.lineWidth = 8;
  g.strokeStyle = '#a36b3d';
  g.stroke();
  g.fillStyle = '#e0c08a';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    circle(g, 500 + Math.cos(a) * 515, 300 + Math.sin(a) * 312, 3);
    g.fill();
  }
  // deck planks
  g.save();
  floorClip(g);
  const ph = 26;
  for (let row = 0, y = F.y; y < F.y + F.h; y += ph, row++) {
    g.fillStyle = row % 2 ? '#c8955a' : '#bd8a50';
    g.fillRect(F.x, y, F.w, ph);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(F.x, y + 2, F.w, 3);
    g.strokeStyle = 'rgba(70,40,15,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(F.x, y);
    g.lineTo(F.x + F.w, y);
    g.stroke();
    // staggered plank ends with nails
    for (let x = F.x + ((row * 137) % 220); x < F.x + F.w; x += 220) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + ph);
      g.stroke();
      g.fillStyle = '#5a3a26';
      for (const dx of [-5, 5]) {
        circle(g, x + dx, y + 7, 1.6);
        g.fill();
        circle(g, x + dx, y + ph - 7, 1.6);
        g.fill();
      }
    }
    // knots
    for (let k = 0; k < 2; k++) {
      const kx = F.x + hash(row * 7 + k) * F.w;
      ellipse(g, kx, y + ph / 2, 6, 3);
      g.strokeStyle = 'rgba(90,50,20,0.45)';
      g.stroke();
    }
  }
  // cargo hatch grate
  roundRect(g, 120, 360, 90, 60, 6);
  outlined(g, '#6b3e1f', 3);
  g.strokeStyle = '#3d2210';
  g.lineWidth = 4;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.moveTo(120 + i * 18, 362);
    g.lineTo(120 + i * 18, 418);
    g.moveTo(122, 360 + i * 12);
    g.lineTo(208, 360 + i * 12);
    g.stroke();
  }
  // a coil of rope on the deck
  for (let r = 18; r > 4; r -= 4) {
    circle(g, 860, 390, r);
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = '#d9b77a';
    g.stroke();
  }
  g.restore();
  floorDepth(g, 'rgba(60,30,10,0.25)');

  for (const [y, h] of COUNTERS) {
    counter(g, y, h, '#8a5a32', '#5c3a1e', (cy, ch) => {
      g.strokeStyle = 'rgba(30,15,5,0.45)';
      g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(24, cy + (ch * i) / 4);
        g.lineTo(976, cy + (ch * i) / 4);
        g.stroke();
      }
      // iron brackets
      for (let x = 60; x < 970; x += 150) {
        g.fillStyle = '#4a4a55';
        g.fillRect(x, cy, 10, ch);
        g.fillStyle = '#8a8f9c';
        circle(g, x + 5, cy + 10, 2.5);
        g.fill();
        circle(g, x + 5, cy + ch - 10, 2.5);
        g.fill();
      }
    });
  }
  stationMats(g, 'rgba(60,30,10,0.3)');

  // props on the counters
  barrelTop(g, 70, 66, 26);
  rum(g, 340, 66);
  treasure(g, 650, 62);
  compass(g, 930, 66);
  barrelTop(g, 70, 528, 26);
  ropeCoil(g, 350, 532);
  anchorProp(g, 650, 530);
  treasureMap(g, 920, 520);
  // cannons poking out over the sides
  for (const [x, y, dir] of [
    [-2, 210, -1],
    [-2, 390, -1],
    [1002, 210, 1],
    [1002, 390, 1],
  ] as const) cannon(g, x, y, dir);
}

function barrelTop(g: G, x: number, y: number, r: number) {
  contact(g, x, y + r * 0.9, r);
  circle(g, x, y, r);
  outlined(g, '#b5743a', 3);
  circle(g, x, y, r - 5);
  g.lineWidth = 4;
  g.strokeStyle = '#4a4a55';
  g.stroke();
  g.strokeStyle = 'rgba(43,26,18,0.35)';
  g.lineWidth = 2;
  for (const dx of [-8, 0, 8]) {
    g.beginPath();
    g.moveTo(x + dx, y - r + 7);
    g.lineTo(x + dx, y + r - 7);
    g.stroke();
  }
}

function rum(g: G, x: number, y: number) {
  for (const dx of [-14, 6]) {
    contact(g, x + dx, y + 20, 10);
    roundRect(g, x + dx - 8, y - 4, 16, 24, 6);
    outlined(g, '#5a7a3a', 2.5);
    roundRect(g, x + dx - 3, y - 16, 6, 12, 2);
    outlined(g, '#5a7a3a', 2);
    roundRect(g, x + dx - 6, y + 4, 12, 9, 2);
    outlined(g, '#f3e2c4', 1.5);
  }
}

function treasure(g: G, x: number, y: number) {
  contact(g, x, y + 24, 30);
  roundRect(g, x - 28, y - 4, 56, 28, 4);
  outlined(g, '#8a5a32', 3);
  g.beginPath();
  g.moveTo(x - 28, y - 4);
  g.quadraticCurveTo(x, y - 30, x + 28, y - 4);
  g.closePath();
  outlined(g, '#a36b3d', 3);
  g.fillStyle = '#ffd23f';
  for (let i = 0; i < 6; i++) {
    circle(g, x - 18 + i * 7, y - 8 + (i % 2) * 3, 4);
    outlined(g, '#ffd23f', 1.5);
  }
  roundRect(g, x - 5, y + 2, 10, 10, 2);
  outlined(g, '#ffd23f', 2);
}

function compass(g: G, x: number, y: number) {
  contact(g, x, y + 18, 18);
  circle(g, x, y, 18);
  outlined(g, '#c9a24a', 3);
  circle(g, x, y, 13);
  outlined(g, '#fff6e0', 2);
  g.beginPath();
  g.moveTo(x, y - 11);
  g.lineTo(x + 4, y);
  g.lineTo(x, y + 11);
  g.lineTo(x - 4, y);
  g.closePath();
  outlined(g, '#ff3d5a', 1.5);
}

function ropeCoil(g: G, x: number, y: number) {
  for (let r = 20; r > 4; r -= 4) {
    circle(g, x, y, r);
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = '#d9b77a';
    g.stroke();
  }
}

function anchorProp(g: G, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.4);
  g.lineCap = 'round';
  for (const [w, c] of [
    [9, INK],
    [5, '#8a8f9c'],
  ] as const) {
    g.lineWidth = w;
    g.strokeStyle = c;
    g.beginPath();
    g.moveTo(0, -22);
    g.lineTo(0, 22);
    g.moveTo(-12, -12);
    g.lineTo(12, -12);
    g.moveTo(-20, 10);
    g.quadraticCurveTo(-18, 26, 0, 26);
    g.quadraticCurveTo(18, 26, 20, 10);
    g.stroke();
  }
  g.restore();
}

function treasureMap(g: G, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.12);
  roundRect(g, -26, -18, 52, 36, 3);
  outlined(g, '#f3e2c4', 2.5);
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(-18, 10);
  g.quadraticCurveTo(-4, -14, 12, 0);
  g.lineWidth = 2;
  g.strokeStyle = '#a36b3d';
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = '#ff3d5a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(8, -4);
  g.lineTo(16, 4);
  g.moveTo(16, -4);
  g.lineTo(8, 4);
  g.stroke();
  g.restore();
}

function cannon(g: G, x: number, y: number, dir: number) {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  roundRect(g, -6, -18, 30, 36, 6);
  outlined(g, '#8a5a32', 3);
  roundRect(g, 4, -10, 34, 20, 9);
  outlined(g, '#2b2b33', 3);
  roundRect(g, 32, -12, 8, 24, 3);
  outlined(g, '#3b3b46', 2.5);
  shine(g, 16, -5, 10, 2.5, 0, 0.3);
  g.restore();
}

function livePirate(ctx: G, t: number) {
  // swinging lanterns at the corners of the floor
  for (const [x, y, ph] of [
    [F.x + 14, F.y + 14, 0],
    [F.x + F.w - 14, F.y + 14, 1.3],
  ] as const) {
    const sw = Math.sin(t * 1.4 + ph) * 6;
    circle(ctx, x + sw, y, 22);
    ctx.fillStyle = 'rgba(255,200,90,0.18)';
    ctx.fill();
    roundRect(ctx, x + sw - 7, y - 9, 14, 18, 4);
    outlined(ctx, '#ffcf6b', 2.5);
  }
}

// ====================================================================== space station

function paintSpace(g: G) {
  roundRect(g, -30, -30, 1060, 660, 36);
  outlined(g, '#3a4466', 5);
  roundRect(g, -18, -18, 1036, 636, 28);
  g.lineWidth = 6;
  g.strokeStyle = '#59658c';
  g.stroke();
  // floor: metal plates with seams, rivets and a few vent grilles
  g.save();
  floorClip(g);
  const pw = 92;
  const ph = 63;
  for (let y = F.y, r = 0; y < F.y + F.h; y += ph, r++) {
    for (let x = F.x, c = 0; x < F.x + F.w; x += pw, c++) {
      g.fillStyle = (r + c) % 2 ? '#a7b2c4' : '#9aa6b8';
      g.fillRect(x, y, pw, ph);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + 2, y + 2, pw - 4, 3);
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(x + 2, y + ph - 5, pw - 4, 3);
      g.fillStyle = '#6d788c';
      for (const [rx, ry] of [
        [6, 6],
        [pw - 6, 6],
        [6, ph - 6],
        [pw - 6, ph - 6],
      ] as const) {
        circle(g, x + rx, y + ry, 2);
        g.fill();
      }
      if (hash(r * 13 + c) > 0.85) {
        roundRect(g, x + 20, y + 16, pw - 40, ph - 32, 4);
        outlined(g, '#5c667a', 2);
        g.strokeStyle = '#3b4252';
        g.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.moveTo(x + 26, y + 22 + k * 6);
          g.lineTo(x + pw - 26, y + 22 + k * 6);
          g.stroke();
        }
      }
    }
  }
  // hazard stripes along the floor edge
  g.lineWidth = 14;
  roundRect(g, F.x, F.y, F.w, F.h, 18);
  g.strokeStyle = '#ffd23f';
  g.stroke();
  g.setLineDash([14, 14]);
  g.strokeStyle = '#2b2b33';
  g.stroke();
  g.setLineDash([]);
  g.restore();
  floorDepth(g, 'rgba(10,20,40,0.15)');

  for (const [y, h] of COUNTERS) {
    counter(g, y, h, '#6a7590', '#454e66', (cy, ch) => {
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      for (let x = 24; x < 976; x += 120) {
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x, cy + ch);
        g.stroke();
      }
    });
  }
  stationMats(g, 'rgba(20,30,60,0.3)');

  // consoles and gear in the counter gaps
  for (const [x0, x1] of GAPS) {
    for (const y of [40, 504]) screen(g, (x0 + x1) / 2, y);
  }
  oxygenTanks(g, 4, 210);
  oxygenTanks(g, 996, 390);
  porthole(g, 6, 360);
  porthole(g, 994, 220);
}

function screen(g: G, x: number, y: number) {
  roundRect(g, x - 34, y - 2, 68, 44, 6);
  outlined(g, '#2b3046', 3);
  roundRect(g, x - 28, y + 4, 56, 26, 3);
  g.fillStyle = '#0d2a2a';
  g.fill();
  g.strokeStyle = '#7cff6b';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 12; i++) g.lineTo(x - 26 + i * 4.3, y + 18 + Math.sin(i * 1.3 + x) * 6);
  g.stroke();
}

function oxygenTanks(g: G, x: number, y: number) {
  for (const dy of [0, 34]) {
    contact(g, x, y + dy + 14, 14);
    circle(g, x, y + dy, 14);
    outlined(g, dy ? '#e8f0fa' : '#ff8a3d', 3);
    circle(g, x, y + dy, 5);
    outlined(g, '#8a8f9c', 2);
  }
}

function porthole(g: G, x: number, y: number) {
  circle(g, x, y, 26);
  outlined(g, '#8a8f9c', 4);
  circle(g, x, y, 19);
  g.fillStyle = '#0b1030';
  g.fill();
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    circle(g, x - 12 + hash(i + x) * 24, y - 12 + hash(i + y) * 24, 1.3);
    g.fill();
  }
  circle(g, x + 6, y + 5, 7);
  g.fillStyle = '#ff8a3d';
  g.fill();
}

function liveSpace(ctx: G, t: number) {
  // blinking console lights
  for (const [x0, x1] of GAPS) {
    for (const y of [40, 504]) {
      const cx = (x0 + x1) / 2;
      for (let i = 0; i < 4; i++) {
        const on = Math.sin(t * (2 + i) + cx * 0.1 + i) > 0.2;
        circle(ctx, cx - 18 + i * 12, y + 37, 3);
        ctx.fillStyle = on ? ['#ff3d5a', '#7cff6b', '#ffd23f', '#2de2e6'][i]! : '#3b4252';
        ctx.fill();
      }
    }
  }
}

// ====================================================================== jungle temple

function paintJungle(g: G) {
  roundRect(g, -30, -30, 1060, 660, 30);
  outlined(g, '#6f6a5a', 5);
  // carved stone border blocks
  g.strokeStyle = 'rgba(43,26,18,0.3)';
  g.lineWidth = 2;
  for (let x = -30; x < 1030; x += 70) {
    g.beginPath();
    g.moveTo(x, -30);
    g.lineTo(x, -6);
    g.moveTo(x + 35, 606);
    g.lineTo(x + 35, 630);
    g.stroke();
  }
  // floor: irregular stone tiles with moss in the cracks
  g.save();
  floorClip(g);
  g.fillStyle = '#6b6a58';
  g.fillRect(F.x, F.y, F.w, F.h);
  const th = 54;
  for (let r = 0, y = F.y; y < F.y + F.h; y += th, r++) {
    let x = F.x - (r % 2) * 34;
    let c = 0;
    while (x < F.x + F.w) {
      const w = 60 + hash(r * 31 + c) * 40;
      const tone = 0.85 + hash(r * 17 + c * 3) * 0.2;
      g.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(168 * tone)},${Math.round(140 * tone)})`;
      roundRect(g, x + 2, y + 2, w - 4, th - 4, 6);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 6, y + 5, w - 14, 3);
      if (hash(r * 5 + c * 11) > 0.6) {
        ellipse(g, x + w * hash(c + r), y + th - 6, 14, 6);
        g.fillStyle = 'rgba(90,160,60,0.55)';
        g.fill();
      }
      if (hash(r * 9 + c * 7) > 0.75) {
        g.beginPath();
        g.moveTo(x + 10, y + 12);
        g.lineTo(x + 22, y + 26);
        g.lineTo(x + 18, y + 40);
        g.strokeStyle = 'rgba(43,26,18,0.35)';
        g.lineWidth = 2;
        g.stroke();
      }
      x += w;
      c++;
    }
  }
  // a carved sun disc in the floor, worn smooth
  circle(g, 250, 300, 44);
  g.strokeStyle = 'rgba(80,70,50,0.35)';
  g.lineWidth = 4;
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(250 + Math.cos(a) * 30, 300 + Math.sin(a) * 30);
    g.lineTo(250 + Math.cos(a) * 40, 300 + Math.sin(a) * 40);
    g.stroke();
  }
  g.restore();
  floorDepth(g, 'rgba(30,30,10,0.25)');

  for (const [y, h] of COUNTERS) {
    counter(g, y, h, '#a39a84', '#7a725f', (cy, ch) => {
      g.strokeStyle = 'rgba(43,26,18,0.3)';
      g.lineWidth = 2;
      for (let x = 24; x < 976; x += 110) {
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x, cy + ch);
        g.stroke();
      }
      // carved zigzag band
      g.beginPath();
      for (let x = 30; x < 970; x += 14) g.lineTo(x, cy + ch - 12 + ((x / 14) % 2 ? -6 : 0));
      g.strokeStyle = 'rgba(60,50,30,0.35)';
      g.stroke();
      // moss + hanging vine
      for (let i = 0; i < 6; i++) {
        ellipse(g, 60 + hash(i + cy) * 880, cy + 6 + hash(i * 3 + cy) * 10, 16, 6);
        g.fillStyle = 'rgba(80,150,50,0.6)';
        g.fill();
      }
    });
  }
  stationMats(g, 'rgba(60,90,30,0.3)');

  for (const [x0, x1] of GAPS) {
    const x = (x0 + x1) / 2;
    fern(g, x, 60);
    idol(g, x, 526);
  }
  // torch pillars on the side strips (flames are live)
  for (const [x, y] of TORCHES) {
    contact(g, x, y + 20, 18);
    roundRect(g, x - 14, y - 16, 28, 36, 5);
    outlined(g, '#8f8a78', 3);
    roundRect(g, x - 9, y - 22, 18, 10, 3);
    outlined(g, '#5a3a26', 2.5);
  }
}

const TORCHES = [
  [6, 190],
  [6, 410],
  [994, 190],
  [994, 410],
] as const;

function fern(g: G, x: number, y: number) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(14, -6, 28, 0);
    g.quadraticCurveTo(14, 6, 0, 0);
    outlined(g, i % 2 ? '#3fae2f' : '#5bbf3a', 2);
    g.restore();
  }
}

function idol(g: G, x: number, y: number) {
  contact(g, x, y + 22, 18);
  roundRect(g, x - 16, y - 24, 32, 44, 6);
  outlined(g, '#a36b3d', 3);
  g.fillStyle = INK;
  for (const s of [-1, 1]) g.fillRect(x + s * 7 - 3, y - 14, 6, 6);
  roundRect(g, x - 9, y, 18, 6, 2);
  g.fill();
  g.fillStyle = '#7cd651';
  circle(g, x, y - 24, 6);
  g.fill();
}

function liveJungle(ctx: G, t: number) {
  for (const [x, y] of TORCHES) {
    const fl = 1 + Math.sin(t * 13 + x) * 0.12;
    circle(ctx, x, y - 30, 28);
    ctx.fillStyle = 'rgba(255,170,60,0.16)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 24);
    ctx.quadraticCurveTo(x - 10, y - 38 * fl, x + Math.sin(t * 9 + x) * 3, y - 46 * fl);
    ctx.quadraticCurveTo(x + 10, y - 38 * fl, x + 9, y - 24);
    ctx.closePath();
    outlined(ctx, '#ff8a2a', 2);
    ellipse(ctx, x, y - 30, 4, 7 * fl);
    ctx.fillStyle = '#fff06a';
    ctx.fill();
  }
}

// ====================================================================== arctic lodge

function paintArctic(g: G) {
  // snowbank all round
  roundRect(g, -30, -30, 1060, 660, 40);
  outlined(g, '#f4fbff', 5);
  g.fillStyle = 'rgba(150,190,220,0.14)';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    ellipse(g, 500 + Math.cos(a) * 520, 300 + Math.sin(a) * 318, 30, 12, a);
    g.fill();
  }
  // floor: ice blocks with cracks and shine streaks
  g.save();
  floorClip(g);
  const sz = 74;
  for (let y = F.y, r = 0; y < F.y + F.h; y += sz * 0.7, r++) {
    for (let x = F.x - (r % 2) * 37, c = 0; x < F.x + F.w; x += sz, c++) {
      g.fillStyle = hash(r * 7 + c) > 0.5 ? '#cdeefc' : '#bfe6f8';
      g.fillRect(x, y, sz, sz * 0.7);
      g.strokeStyle = 'rgba(120,170,210,0.6)';
      g.lineWidth = 2;
      g.strokeRect(x, y, sz, sz * 0.7);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 10, y + sz * 0.5);
      g.lineTo(x + 28, y + 12);
      g.stroke();
      if (hash(r * 3 + c * 5) > 0.7) {
        g.strokeStyle = 'rgba(90,140,190,0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x + 40, y + 8);
        g.lineTo(x + 48, y + 24);
        g.lineTo(x + 60, y + 30);
        g.moveTo(x + 48, y + 24);
        g.lineTo(x + 44, y + 40);
        g.stroke();
      }
    }
  }
  // snow drifted against the floor edges
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 24; i++) {
    const x = F.x + (i / 24) * F.w;
    ellipse(g, x, F.y + 4, 26, 10);
    g.fill();
    ellipse(g, x + 18, F.y + F.h - 4, 26, 10);
    g.fill();
  }
  g.restore();
  floorDepth(g, 'rgba(60,110,160,0.2)');

  for (const [y, h] of COUNTERS) {
    counter(g, y, h, '#9a6534', '#6b4022', (cy, ch) => {
      // log ends and bark lines
      for (let i = 0; i < 4; i++) {
        const ly = cy + 10 + i * (ch / 4);
        g.strokeStyle = 'rgba(60,30,10,0.4)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(24, ly);
        g.lineTo(976, ly);
        g.stroke();
      }
      // snow on the top edge
      g.fillStyle = '#ffffff';
      for (let x = 30; x < 976; x += 34) {
        ellipse(g, x, cy + 4, 22, 8);
        g.fill();
      }
    });
  }
  stationMats(g, 'rgba(60,110,160,0.3)');

  for (const [x0, x1] of GAPS) {
    const x = (x0 + x1) / 2;
    mug(g, x, 62);
    pine(g, x, 528, 26);
  }
  pine(g, 2, 200, 30);
  pine(g, 998, 400, 30);
  igloo(g, 4, 400);
  skis(g, 996, 200);
}

function mug(g: G, x: number, y: number) {
  contact(g, x, y + 16, 14);
  roundRect(g, x - 11, y - 8, 22, 24, 5);
  outlined(g, '#ff3d5a', 2.5);
  g.beginPath();
  g.arc(x + 13, y + 3, 6, -Math.PI / 2, Math.PI / 2);
  g.lineWidth = 3.5;
  g.strokeStyle = INK;
  g.stroke();
  ellipse(g, x, y - 8, 11, 4);
  g.fillStyle = '#7a4a2a';
  g.fill();
}

function pine(g: G, x: number, y: number, r: number) {
  contact(g, x, y + r * 0.5, r);
  for (const [k, col] of [
    [1, '#2f7d3a'],
    [0.7, '#3f9a48'],
    [0.4, '#5bbf3a'],
  ] as const) {
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = r * k * (i % 2 ? 0.7 : 1);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    outlined(g, col, 2.5);
  }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    circle(g, x + Math.cos(i * 1.3) * r * 0.5, y + Math.sin(i * 1.3) * r * 0.5, 3);
    g.fill();
  }
}

function igloo(g: G, x: number, y: number) {
  g.beginPath();
  g.arc(x, y + 10, 26, Math.PI, 0);
  g.closePath();
  outlined(g, '#f4fbff', 3);
  g.strokeStyle = 'rgba(120,170,210,0.7)';
  g.lineWidth = 1.5;
  for (const dy of [-4, -12]) {
    g.beginPath();
    g.moveTo(x - 24, y + 10 + dy);
    g.lineTo(x + 24, y + 10 + dy);
    g.stroke();
  }
  g.beginPath();
  g.arc(x + 14, y + 10, 8, Math.PI, 0);
  g.fillStyle = '#4a6a8a';
  g.fill();
}

function skis(g: G, x: number, y: number) {
  for (const [dx, c] of [
    [-6, '#ff3d5a'],
    [6, '#3d8bff'],
  ] as const) {
    roundRect(g, x + dx - 4, y - 34, 8, 68, 4);
    outlined(g, c, 2.5);
  }
}

function liveArctic(ctx: G, t: number) {
  // steam from the cocoa mugs
  for (const [x0, x1] of GAPS) {
    const x = (x0 + x1) / 2;
    const p = (t * 0.6 + x * 0.01) % 1;
    circle(ctx, x + Math.sin(t * 2 + x) * 4, 50 - p * 26, 3 + p * 5);
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`;
    ctx.fill();
  }
}

// ====================================================================== cache + layers

const PAINT: Record<MapId, (g: G) => void> = {
  kitchen: paintKitchen,
  pirate: paintPirate,
  space: paintSpace,
  jungle: paintJungle,
  arctic: paintArctic,
};
const LIVE: Record<MapId, (ctx: G, t: number) => void> = {
  kitchen: liveKitchen,
  pirate: livePirate,
  space: liveSpace,
  jungle: liveJungle,
  arctic: liveArctic,
};

/** Resolution of the cached board (pixels per world unit). */
const RES = 2;
const boards = new Map<MapId, HTMLCanvasElement>();

function board(map: MapId): HTMLCanvasElement | null {
  const hit = boards.get(map);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1060 * RES;
  c.height = 660 * RES;
  const g = c.getContext('2d');
  if (!g) return null;
  g.scale(RES, RES);
  g.translate(30, 30);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  PAINT[map](g);
  boards.set(map, c);
  return c;
}

/** Floor, counters and props (world space). */
export function drawMapBoard(ctx: G, map: MapId, t: number) {
  const b = board(map);
  if (b) ctx.drawImage(b, -30, -30, 1060, 660);
  else PAINT[map](ctx);
  LIVE[map](ctx, t);
}

/** A small still picture of a map (lobby previews). */
export function drawMapPreview(ctx: G, map: MapId, w: number, h: number) {
  const b = board(map);
  ctx.fillStyle = MAP_BACKDROP[map];
  ctx.fillRect(0, 0, w, h);
  if (!b) return;
  const s = Math.min(w / 1060, h / 660);
  ctx.drawImage(b, (w - 1060 * s) / 2, (h - 660 * s) / 2, 1060 * s, 660 * s);
}

const MAP_BACKDROP: Record<MapId, string> = {
  kitchen: '#ff9f45',
  pirate: '#1f6fa8',
  space: '#141a3a',
  jungle: '#2f7d3a',
  arctic: '#7fb6d9',
};

/** Whole-screen backdrop behind the kitchen (screen space, w x h pixels). */
export function drawMapBackdrop(ctx: G, map: MapId, t: number, w: number, h: number) {
  ctx.fillStyle = MAP_BACKDROP[map];
  ctx.fillRect(0, 0, w, h);
  switch (map) {
    case 'pirate': {
      // rolling ocean swells with foam caps
      for (let row = 0; row * 46 < h + 46; row++) {
        const y = row * 46 + 20;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 20) ctx.lineTo(x, y + Math.sin(x / 60 + t * 1.6 + row) * 6);
        ctx.strokeStyle = row % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(10,60,110,0.35)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      break;
    }
    case 'space': {
      for (let i = 0; i < 120; i++) {
        const x = hash(i) * w;
        const y = hash(i + 500) * h;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(i + 9)) + i));
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.fillRect(x, y, i % 9 ? 1.5 : 2.5, i % 9 ? 1.5 : 2.5);
      }
      // a ringed planet drifting very slowly
      const px = w * 0.86 + Math.sin(t * 0.05) * 20;
      const py = h * 0.8;
      circle(ctx, px, py, 60);
      ctx.fillStyle = '#ff8a6b';
      ctx.fill();
      ellipse(ctx, px, py, 100, 18, -0.3);
      ctx.strokeStyle = 'rgba(255,210,160,0.8)';
      ctx.lineWidth = 6;
      ctx.stroke();
      break;
    }
    case 'jungle': {
      for (let i = 0; i < 18; i++) {
        const x = hash(i) * w;
        const y = hash(i + 40) * h;
        const sway = Math.sin(t * 0.8 + i) * 0.08;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(hash(i + 7) * Math.PI * 2 + sway);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(60, -40, 140, 0);
        ctx.quadraticCurveTo(60, 40, 0, 0);
        ctx.fillStyle = i % 2 ? 'rgba(20,90,30,0.55)' : 'rgba(60,140,50,0.45)';
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'arctic': {
      // aurora ribbons along the top
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 30) ctx.lineTo(x, 40 + k * 26 + Math.sin(x / 140 + t * 0.6 + k) * 18);
        ctx.strokeStyle = k ? 'rgba(178,107,255,0.35)' : 'rgba(124,255,160,0.4)';
        ctx.lineWidth = 18;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 90; i++) {
        const x = (hash(i) * w + Math.sin(t + i) * 20 + t * 15) % w;
        const y = (hash(i + 300) * h + t * (30 + hash(i + 2) * 40)) % h;
        circle(ctx, x, y, 1.5 + hash(i + 5) * 2);
        ctx.fill();
      }
      break;
    }
    default: {
      // warm diner: soft polka dots
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let y = 20; y < h; y += 60) {
        for (let x = (y / 60) % 2 ? 50 : 20; x < w; x += 60) {
          circle(ctx, x, y, 6);
          ctx.fill();
        }
      }
    }
  }
}

/** Light things drifting over everything (world space). */
export function drawMapOverlay(ctx: G, map: MapId, t: number) {
  switch (map) {
    case 'pirate':
      // seagulls gliding across
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.05 + i * 0.5) % 1;
        const x = -60 + p * 1120;
        const y = 120 + i * 300 + Math.sin(t + i) * 20;
        const flap = Math.sin(t * 6 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(x - 16, y - flap);
        ctx.quadraticCurveTo(x - 8, y - 8, x, y);
        ctx.quadraticCurveTo(x + 8, y - 8, x + 16, y - flap);
        ctx.lineWidth = 5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      break;
    case 'space':
      // a wrench floating by in zero-g
      {
        const p = (t * 0.03) % 1;
        ctx.save();
        ctx.translate(-40 + p * 1080, 160 + Math.sin(t * 0.7) * 30);
        ctx.rotate(t * 0.6);
        roundRect(ctx, -16, -3, 32, 6, 3);
        outlined(ctx, '#c4ccd8', 2);
        circle(ctx, 18, 0, 6);
        outlined(ctx, '#c4ccd8', 2);
        ctx.restore();
      }
      break;
    case 'jungle':
      for (let i = 0; i < 10; i++) {
        const x = 60 + hash(i) * 880 + Math.sin(t * 0.7 + i) * 30;
        const y = 140 + hash(i + 20) * 320 + Math.cos(t * 0.9 + i * 2) * 20;
        const glow = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.7));
        circle(ctx, x, y, 5);
        ctx.fillStyle = `rgba(255,240,120,${glow * 0.35})`;
        ctx.fill();
        circle(ctx, x, y, 2);
        ctx.fillStyle = `rgba(255,250,180,${glow})`;
        ctx.fill();
      }
      break;
    case 'arctic':
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 30; i++) {
        const x = (hash(i) * 1060 + Math.sin(t + i) * 15 + t * 10) % 1060 - 30;
        const y = (hash(i + 100) * 660 + t * (25 + hash(i + 3) * 20)) % 660 - 30;
        circle(ctx, x, y, 1.5 + hash(i + 8) * 1.5);
        ctx.fill();
      }
      break;
    default:
      break;
  }
}

/** The pirate ship rocks gently (harder while a rogue wave is hitting). Radians. */
export function mapRock(map: MapId, t: number, gust: number): number {
  if (map !== 'pirate') return 0;
  return Math.sin(t * 0.7) * 0.005 + gust * 0.02;
}

