import { CLASSIC_LAYOUT, LOBBY, LOBBY_LAYOUT, MAPS, type Layout, type MapId, type StationSpot } from '@tilt-mayhem/shared';
import { icon } from './icons';
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

/** The floor area being painted (with a 20 unit lip) and its stations; set per map by useLayout(). */
let F = { x: 0, y: 0, w: 0, h: 0 };
let SPOTS: readonly StationSpot[] = [];
function useLayout(L: Layout) {
  F = { x: L.floor.x0 - 20, y: L.floor.y0 - 20, w: L.floor.x1 - L.floor.x0 + 40, h: L.floor.y1 - L.floor.y0 + 40 };
  SPOTS = L.spots;
}
useLayout(CLASSIC_LAYOUT);

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
  for (const s of SPOTS) {
    // mats run along the counter: across for the top/bottom counters, up-down for the side ones
    const side = s.face === 'left' || s.face === 'right';
    const mx = s.fx + (side ? (s.face === 'right' ? -4 : 4) : 0);
    const my = s.fy + (side ? 0 : s.face === 'down' ? -2 : 2);
    const w = side ? 32 : 124;
    const h = side ? 124 : 32;
    roundRect(g, mx - w / 2, my - h / 2, w, h, 10);
    g.fillStyle = color;
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 10; i++) {
      circle(g, side ? mx : mx - 50 + i * 11, side ? my - 50 + i * 11 : my, 2.2);
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

function pirateHull(g: G) {
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
}

/** Deck planks across the whole floor. */
function pirateDeck(g: G) {
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
  g.restore();
}

function paintPirate(g: G) {
  pirateHull(g);
  pirateDeck(g);
  g.save();
  floorClip(g);
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

/**
 * Pirate Galley: the ship with an open cargo hold splitting the deck in two. Two narrow
 * gangplanks cross it at the ends and a bridge in the middle holds the captain's table; two
 * masts stand in the way and two trapdoors (opposite corners) drop you to the other deck.
 * Walls, masts and trapdoors come from PIRATE_LAYOUT, so the art always matches the collisions.
 */
function paintPirateCove(g: G) {
  paintPirate(g);
  const L = MAPS.pirate.layout;
  for (const w of L.walls ?? []) cargoHold(g, w);
  // gangplanks over the hold: the gaps between the hold sections at the far ends
  const walls = [...(L.walls ?? [])].sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i < walls.length - 1; i++) {
    const a = walls[i]!;
    const b = walls[i + 1]!;
    const w = b.x0 - a.x1;
    if (w < 120) gangplank(g, a.x1, a.y0, w, a.y1 - a.y0);
    else bridgeRails(g, a.x1, a.y0, w, a.y1 - a.y0);
  }
  for (const p of L.posts ?? []) mastBase(g, p.x, p.y, p.r);
  for (const h of L.hatches ?? []) trapdoor(g, h.x, h.y, h.r);
}

/** An open hold seen from above: the far inner wall, crates and barrels down in the dark, a beam frame. */
function cargoHold(g: G, w: { x0: number; y0: number; x1: number; y1: number }) {
  const W = w.x1 - w.x0;
  const H = w.y1 - w.y0;
  g.fillStyle = '#24140a';
  g.fillRect(w.x0, w.y0, W, H);
  // the far (north) inner wall, lit a little
  g.fillStyle = '#5c3a1e';
  g.fillRect(w.x0, w.y0, W, 16);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let x = w.x0 + 14; x < w.x1; x += 14) {
    g.beginPath();
    g.moveTo(x, w.y0);
    g.lineTo(x, w.y0 + 16);
    g.stroke();
  }
  // cargo down below (darker, so it reads as deeper)
  g.save();
  g.beginPath();
  g.rect(w.x0, w.y0 + 16, W, H - 16);
  g.clip();
  for (let i = 0; i < Math.floor(W / 46); i++) {
    const cx = w.x0 + 22 + i * 46 + hash(w.x0 + i) * 8;
    const cy = w.y0 + 30 + hash(w.y0 + i * 3) * (H - 44);
    if (i % 3 === 1) {
      circle(g, cx, cy, 13);
      outlined(g, '#5a3a20', 2);
      circle(g, cx, cy, 8);
      g.lineWidth = 2;
      g.strokeStyle = '#2b2b33';
      g.stroke();
    } else {
      roundRect(g, cx - 15, cy - 13, 30, 26, 3);
      outlined(g, '#6b4a2a', 2);
      g.beginPath();
      g.moveTo(cx - 15, cy - 13);
      g.lineTo(cx + 15, cy + 13);
      g.moveTo(cx + 15, cy - 13);
      g.lineTo(cx - 15, cy + 13);
      g.strokeStyle = 'rgba(30,15,5,0.6)';
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(10,5,0,0.35)';
  g.fillRect(w.x0, w.y0 + 16, W, H - 16);
  g.restore();
  // heavy beam frame round the opening
  roundRect(g, w.x0, w.y0, W, H, 4);
  g.lineWidth = 9;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = '#8a5a32';
  g.stroke();
}

/** A narrow plank bridge with rope rails along both sides. */
function gangplank(g: G, x: number, y: number, w: number, h: number) {
  g.fillStyle = '#c8955a';
  g.fillRect(x, y - 4, w, h + 8);
  g.strokeStyle = 'rgba(70,40,15,0.6)';
  g.lineWidth = 2;
  for (let py = y + 10; py < y + h; py += 13) {
    g.beginPath();
    g.moveTo(x, py);
    g.lineTo(x + w, py);
    g.stroke();
  }
  bridgeRails(g, x, y, w, h);
}

/** Rope rails (with posts) down both sides of a crossing. */
function bridgeRails(g: G, x: number, y: number, w: number, h: number) {
  for (const rx of [x + 3, x + w - 3]) {
    g.beginPath();
    g.moveTo(rx, y - 4);
    g.quadraticCurveTo(rx + (rx < x + w / 2 ? -3 : 3), y + h / 2, rx, y + h + 4);
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = '#d9b77a';
    g.stroke();
    for (const py of [y - 4, y + h + 4]) {
      circle(g, rx, py, 5);
      outlined(g, '#6b3e1f', 2);
    }
  }
}

/** The foot of a mast: a thick round trunk with iron bands and ropes tied off round it. */
function mastBase(g: G, x: number, y: number, r: number) {
  contact(g, x + 4, y + r * 0.6, r + 8, r * 0.6);
  circle(g, x, y, r + 7);
  outlined(g, '#6b3e1f', 3);
  circle(g, x, y, r);
  outlined(g, '#a36b3d', 3);
  circle(g, x, y, r - 5);
  g.lineWidth = 3;
  g.strokeStyle = '#4a4a55';
  g.stroke();
  shine(g, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.18, -0.6, 0.35);
  // rope coiled at the base
  g.beginPath();
  g.arc(x, y, r + 11, 0.2 * Math.PI, 0.8 * Math.PI);
  g.lineWidth = 5;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = '#d9b77a';
  g.stroke();
}

/** A trapdoor in the deck: iron-framed planks with a ring pull. */
function trapdoor(g: G, x: number, y: number, r: number) {
  roundRect(g, x - r - 4, y - r - 4, (r + 4) * 2, (r + 4) * 2, 5);
  outlined(g, '#3b3b46', 3);
  roundRect(g, x - r, y - r, r * 2, r * 2, 3);
  outlined(g, '#8a5a32', 2);
  g.strokeStyle = 'rgba(30,15,5,0.55)';
  g.lineWidth = 2;
  for (const dx of [-r / 2, 0, r / 2]) {
    g.beginPath();
    g.moveTo(x + dx, y - r);
    g.lineTo(x + dx, y + r);
    g.stroke();
  }
  circle(g, x, y + r * 0.35, 6);
  g.lineWidth = 3;
  g.strokeStyle = '#c4ccd8';
  g.stroke();
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

/** Pirate ship: swinging lanterns, plus the trapdoors glowing so people notice the shortcut. */
function liveCove(ctx: G, t: number) {
  livePirate(ctx, t);
  for (const h of MAPS.pirate.layout.hatches ?? []) {
    const p = (t * 1.2) % 1;
    roundRect(ctx, h.x - h.r - 6 - p * 8, h.y - h.r - 6 - p * 8, (h.r + 6 + p * 8) * 2, (h.r + 6 + p * 8) * 2, 8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,210,63,${0.9 * (1 - p)})`;
    ctx.stroke();
  }
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

// ====================================================================== layout features (Overcooked-style twists)

/** Space: moving walkways (rubber belt, hazard-striped rails, rollers) and teleporter pads. */
function spaceFeatures(g: G) {
  const L = MAPS.space.layout;
  for (const z of L.zones ?? []) {
    if (z.kind !== 'belt') continue;
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    roundRect(g, z.x0 - 6, z.y0 - 6, w + 12, h + 12, 10);
    outlined(g, '#3a4466', 3);
    roundRect(g, z.x0, z.y0, w, h, 6);
    outlined(g, '#2b2b33', 2);
    // yellow/black rails along both edges
    for (const ry of [z.y0 - 6, z.y1 + 1]) {
      g.save();
      g.beginPath();
      g.rect(z.x0 - 6, ry, w + 12, 5);
      g.clip();
      g.fillStyle = '#ffd23f';
      g.fillRect(z.x0 - 6, ry, w + 12, 5);
      g.fillStyle = '#2b2b33';
      for (let x = z.x0 - 6; x < z.x1 + 6; x += 14) {
        g.beginPath();
        g.moveTo(x, ry + 5);
        g.lineTo(x + 7, ry);
        g.lineTo(x + 12, ry);
        g.lineTo(x + 5, ry + 5);
        g.fill();
      }
      g.restore();
    }
    // rollers at both ends
    for (const rx of [z.x0 + 6, z.x1 - 6]) {
      roundRect(g, rx - 5, z.y0 + 2, 10, h - 4, 5);
      outlined(g, '#8a8f9c', 2);
    }
  }
  for (const p of L.hatches ?? []) {
    circle(g, p.x, p.y, p.r + 10);
    outlined(g, '#59658c', 3);
    circle(g, p.x, p.y, p.r + 2);
    outlined(g, '#c4ccd8', 2.5);
    circle(g, p.x, p.y, p.r - 4);
    g.fillStyle = '#0d2a3a';
    g.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      circle(g, p.x + Math.cos(a) * (p.r + 6), p.y + Math.sin(a) * (p.r + 6), 2);
      g.fillStyle = '#2de2e6';
      g.fill();
    }
  }
}

function liveSpaceFeatures(ctx: G, t: number) {
  const L = MAPS.space.layout;
  // chevrons sliding along each walkway in its direction
  for (const z of L.zones ?? []) {
    if (z.kind !== 'belt') continue;
    const dir = Math.sign(z.vx ?? 1) || 1;
    const cy = (z.y0 + z.y1) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(z.x0 + 12, z.y0, z.x1 - z.x0 - 24, z.y1 - z.y0);
    ctx.clip();
    ctx.fillStyle = 'rgba(45,226,230,0.55)';
    const shift = ((t * Math.abs(z.vx ?? 100)) % 48) * dir;
    for (let x = z.x0 - 48; x < z.x1 + 48; x += 48) {
      const cx = x + shift;
      ctx.beginPath();
      ctx.moveTo(cx - 8 * dir, cy - 11);
      ctx.lineTo(cx + 8 * dir, cy);
      ctx.lineTo(cx - 8 * dir, cy + 11);
      ctx.lineTo(cx - 2 * dir, cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // teleporters: rings rising off the pads
  for (const p of L.hatches ?? []) {
    for (let k = 0; k < 2; k++) {
      const q = (t * 0.9 + k / 2) % 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - q * 26, p.r * (1 - q * 0.3), p.r * 0.45 * (1 - q * 0.3), 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(45,226,230,${0.8 * (1 - q)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

/** Jungle: carved stone pillars with moss and vines, and two mud bogs. */
function jungleFeatures(g: G) {
  const L = MAPS.jungle.layout;
  for (const z of L.zones ?? []) {
    if (z.kind !== 'mud') continue;
    const cx = (z.x0 + z.x1) / 2;
    const cy = (z.y0 + z.y1) / 2;
    const rx = (z.x1 - z.x0) / 2;
    const ry = (z.y1 - z.y0) / 2;
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const k = 1 + Math.sin(a * 4 + cx) * 0.06;
      g.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
    }
    g.closePath();
    outlined(g, '#7a4f2a', 3.5);
    ellipse(g, cx - rx * 0.2, cy - ry * 0.2, rx * 0.5, ry * 0.3);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    // reeds poking out of the edge
    g.strokeStyle = '#3f7a2a';
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.18);
      const bx = cx + Math.cos(a) * rx * 0.95;
      const by = cy + Math.sin(a) * ry * 0.95;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + (i - 2) * 2, by - 16);
      g.stroke();
    }
  }
  for (const p of L.posts ?? []) {
    contact(g, p.x + 6, p.y + p.r * 0.5, p.r + 10, p.r * 0.6);
    circle(g, p.x, p.y, p.r + 6);
    outlined(g, '#7a725f', 3);
    circle(g, p.x, p.y, p.r);
    outlined(g, '#a39a84', 2.5);
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.moveTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5);
      g.lineTo(p.x + Math.cos(a) * (p.r - 2), p.y + Math.sin(a) * (p.r - 2));
      g.stroke();
    }
    ellipse(g, p.x - p.r * 0.3, p.y - p.r * 0.5, p.r * 0.5, p.r * 0.25);
    g.fillStyle = 'rgba(80,160,50,0.8)';
    g.fill();
    // a vine hanging off the side
    g.beginPath();
    g.moveTo(p.x + p.r, p.y - 4);
    g.quadraticCurveTo(p.x + p.r + 8, p.y + 10, p.x + p.r + 2, p.y + 22);
    g.strokeStyle = '#3fae2f';
    g.lineWidth = 3;
    g.stroke();
    for (const k of [0.4, 0.8]) {
      ellipse(g, p.x + p.r + 5, p.y - 4 + k * 26, 5, 3, 0.6);
      outlined(g, '#5bbf3a', 1.2);
    }
  }
}

function liveJungleFeatures(ctx: G, t: number) {
  // mud bubbles plopping
  for (const z of MAPS.jungle.layout.zones ?? []) {
    if (z.kind !== 'mud') continue;
    for (let i = 0; i < 3; i++) {
      const q = (t * 0.7 + i * 0.37 + z.x0 * 0.01) % 1;
      const x = z.x0 + 30 + ((i * 43) % (z.x1 - z.x0 - 60));
      const y = z.y0 + 30 + ((i * 29) % (z.y1 - z.y0 - 50));
      circle(ctx, x, y, 2 + q * 6);
      ctx.strokeStyle = `rgba(60,35,15,${0.8 * (1 - q)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Arctic: two frozen ponds (shiny, cracked, snowy rims) and snowmen standing in the way. */
function arcticFeatures(g: G) {
  const L = MAPS.arctic.layout;
  for (const z of L.zones ?? []) {
    if (z.kind !== 'ice') continue;
    const w = z.x1 - z.x0;
    const h = z.y1 - z.y0;
    roundRect(g, z.x0 - 8, z.y0 - 8, w + 16, h + 16, 40);
    g.fillStyle = '#ffffff';
    g.fill();
    roundRect(g, z.x0, z.y0, w, h, 34);
    outlined(g, '#9fdcf5', 3);
    g.save();
    roundRect(g, z.x0, z.y0, w, h, 34);
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(z.x0 + 20 + i * 50, z.y1 - 10);
      g.lineTo(z.x0 + 70 + i * 50, z.y0 + 10);
      g.stroke();
    }
    g.strokeStyle = 'rgba(70,140,190,0.5)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(z.x0 + w * 0.3, z.y0 + h * 0.4);
    g.lineTo(z.x0 + w * 0.45, z.y0 + h * 0.55);
    g.lineTo(z.x0 + w * 0.62, z.y0 + h * 0.5);
    g.moveTo(z.x0 + w * 0.45, z.y0 + h * 0.55);
    g.lineTo(z.x0 + w * 0.42, z.y0 + h * 0.75);
    g.stroke();
    g.restore();
  }
  for (const p of L.posts ?? []) {
    contact(g, p.x + 4, p.y + p.r * 0.7, p.r + 10, p.r * 0.5);
    icon(g, 'snowman', p.x, p.y - 12, p.r * 3);
  }
}

function liveArcticFeatures(ctx: G, t: number) {
  // glints skating across the ponds
  for (const z of MAPS.arctic.layout.zones ?? []) {
    if (z.kind !== 'ice') continue;
    for (let i = 0; i < 3; i++) {
      const glint = Math.max(0, Math.sin(t * 2.2 + i * 2.1 + z.x0));
      const x = z.x0 + 40 + i * 60;
      const y = z.y0 + 40 + (i % 2) * 60;
      ctx.fillStyle = `rgba(255,255,255,${glint})`;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 2, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 6, y - 1, 12, 2);
    }
  }
}

/** Classic kitchen extras on the side strips: a produce crate, a bin and a wet-floor sign. */
function kitchenExtras(g: G) {
  // crate of tomatoes and lettuce
  contact(g, 4, 420, 26);
  roundRect(g, -20, 380, 48, 38, 4);
  outlined(g, '#c9874a', 3);
  for (const [dx, dy, name] of [
    [-8, 392, 'tomato'],
    [8, 390, 'lettuce'],
    [0, 404, 'tomato'],
    [14, 404, 'carrot'],
  ] as const) icon(g, name, 4 + dx, dy, 18);
  g.strokeStyle = 'rgba(43,26,18,0.4)';
  g.lineWidth = 2;
  g.strokeRect(-20, 408, 48, 10);
  // pedal bin
  contact(g, 996, 222, 20);
  roundRect(g, 980, 186, 32, 36, 6);
  outlined(g, '#a3a8b5', 3);
  roundRect(g, 978, 180, 36, 9, 4);
  outlined(g, '#8a8f9c', 2.5);
  // little wet-floor sign by the drain
  g.save();
  g.translate(F.x + F.w - 76, F.y + F.h - 50);
  g.beginPath();
  g.moveTo(-12, 14);
  g.lineTo(0, -16);
  g.lineTo(12, 14);
  g.closePath();
  outlined(g, '#ffd23f', 2.5);
  g.fillStyle = INK;
  g.fillRect(-1.5, -6, 3, 10);
  g.fillRect(-1.5, 7, 3, 3);
  g.restore();
}

// ====================================================================== lobby apartment

/**
 * The lobby apartment (PlateUp style): a kitchenette on the left with all six stations to
 * practise on, a living room on the right with the wardrobe rug, a couch, a TV, a coffee table
 * and the READY? elevator in the corner. The couch, table and elevator wall are solid (LOBBY_LAYOUT).
 */
function paintLobby(g: G) {
  const L = LOBBY_LAYOUT;
  const split = 620;
  const d = L.dressing!;
  const el = L.elevator!;
  // the apartment's outline (a soft border, not detailed walls)
  roundRect(g, -30, -30, 1060, 660, 30);
  g.fillStyle = '#c98f62';
  g.fill();
  g.save();
  floorClip(g);
  // kitchenette: small terracotta and cream tiles
  for (let y = F.y; y < F.y + F.h; y += 32) {
    for (let x = F.x; x < split; x += 32) {
      g.fillStyle = (Math.floor(x / 32) + Math.floor(y / 32)) % 2 ? '#f6e3c8' : '#e6a57a';
      g.fillRect(x, y, 32, 32);
    }
  }
  // living room: long wooden floorboards with staggered joints
  for (let y = F.y, r = 0; y < F.y + F.h; y += 24, r++) {
    g.fillStyle = r % 2 ? '#b77a4a' : '#ad7143';
    g.fillRect(split, y, F.x + F.w - split, 24);
    g.strokeStyle = 'rgba(60,30,10,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(split, y);
    g.lineTo(F.x + F.w, y);
    for (let x = split + ((r * 97) % 160); x < F.x + F.w; x += 160) {
      g.moveTo(x, y);
      g.lineTo(x, y + 24);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(60,30,10,0.4)';
  g.fillRect(split - 3, F.y, 6, F.h);
  // a striped runner in the kitchenette and a welcome mat by the door
  roundRect(g, 120, 268, 420, 64, 10);
  outlined(g, '#5f8fd9', 2.5);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  for (let x = 130; x < 530; x += 26) g.fillRect(x, 272, 10, 56);
  roundRect(g, L.spawn!.x - 34, L.spawn!.y - 20, 68, 40, 6);
  outlined(g, '#c9a96b', 2.5);
  g.font = '13px Bangers, "Arial Black", Impact, sans-serif';
  g.fillStyle = '#6b4022';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('WELCOME', L.spawn!.x, L.spawn!.y + 1);
  // round rug under the coffee table
  const p = L.posts![0]!;
  ellipse(g, p.x, p.y + 6, 104, 54);
  outlined(g, '#7cc4a0', 3);
  ellipse(g, p.x, p.y + 6, 86, 40);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 4;
  g.stroke();
  // the wardrobe rug
  circle(g, d.x, d.y, d.r);
  outlined(g, '#ff8fb0', 3);
  circle(g, d.x, d.y, d.r - 10);
  g.setLineDash([8, 6]);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 3;
  g.stroke();
  g.setLineDash([]);
  // slippers by the rug
  for (const s of [-1, 1]) {
    ellipse(g, d.x - 54 + s * 7, d.y + 36, 5, 10, s * 0.2);
    outlined(g, '#b26bff', 1.8);
  }
  // the elevator car: diamond-plate floor, a handrail
  g.fillStyle = '#9aa3b2';
  g.fillRect(el.x0, el.y0, el.x1 - el.x0, el.y1 - el.y0);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let y = el.y0 + 10; y < el.y1; y += 16) {
    for (let x = el.x0 + 10 + ((y / 16) % 2) * 8; x < el.x1; x += 16) {
      g.beginPath();
      g.moveTo(x - 4, y + 3);
      g.lineTo(x + 4, y - 3);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(255,210,63,0.9)';
  g.fillRect(el.x0, el.y1 - 8, el.x1 - el.x0, 8);
  g.fillStyle = INK;
  for (let x = el.x0; x < el.x1; x += 18) {
    g.beginPath();
    g.moveTo(x, el.y1);
    g.lineTo(x + 9, el.y1 - 8);
    g.lineTo(x + 14, el.y1 - 8);
    g.lineTo(x + 5, el.y1);
    g.fill();
  }
  g.restore();
  floorDepth(g, 'rgba(60,30,10,0.2)');

  // kitchenette counters (top and bottom, left part only), with a sink and a fridge
  for (const [y, h] of COUNTERS) {
    roundRect(g, 24, y, split - 20, h, 18);
    outlined(g, '#7a5a44', 4);
    roundRect(g, 24, y, split - 20, h - 12, 18);
    outlined(g, '#e8dccb', 3);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(g, 32, y + 6, split - 36, 10, 5);
    g.fill();
  }
  roundRect(g, 568, 40, 44, 34, 8);
  outlined(g, '#c4ccd8', 2.5);
  roundRect(g, 574, 46, 32, 22, 6);
  g.fillStyle = '#8ec5ff';
  g.fill();
  roundRect(g, 586, 30, 8, 14, 3);
  outlined(g, '#a3a8b5', 2);
  // tall fridge on the left strip, covered in magnets
  contact(g, 6, 268, 30);
  roundRect(g, -24, 150, 58, 116, 10);
  outlined(g, '#e8edf5', 3.5);
  g.beginPath();
  g.moveTo(-24, 196);
  g.lineTo(34, 196);
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  roundRect(g, 22, 162, 6, 24, 3);
  outlined(g, '#a3a8b5', 1.5);
  roundRect(g, 22, 206, 6, 40, 3);
  outlined(g, '#a3a8b5', 1.5);
  for (const [mx, my, c] of [
    [-10, 214, '#ff3d5a'],
    [4, 230, '#ffd23f'],
    [-6, 246, '#3d8bff'],
    [8, 170, '#7cd651'],
  ] as const) {
    circle(g, mx, my, 4);
    outlined(g, c, 1.2);
  }
  stationMats(g, 'rgba(120,70,40,0.25)');

  // wardrobe on the top wall above its rug, with a mirror
  roundRect(g, d.x - 66, 18, 132, 92, 10);
  outlined(g, '#8a5a32', 4);
  for (const s of [-1, 1]) {
    roundRect(g, d.x + (s < 0 ? -60 : 2), 24, 58, 80, 6);
    outlined(g, '#a36b3d', 2.5);
    circle(g, d.x + s * 8, 64, 3);
    outlined(g, '#ffd23f', 1.5);
  }
  roundRect(g, d.x - 46, 30, 32, 60, 14);
  outlined(g, '#cfe6ff', 2);
  shine(g, d.x - 34, 46, 4, 12, 0.3, 0.7);
  icon(g, 'chefhat', d.x + 31, 62, 28);
  // laundry basket
  roundRect(g, d.x + 50, 150, 30, 26, 6);
  outlined(g, '#e0c08a', 2.5);
  circle(g, d.x + 60, 150, 6);
  outlined(g, '#ff8fb0', 1.5);

  // the elevator: open doors and a frame over the top wall, side wall, call buttons
  const ew = el.x1 - el.x0;
  roundRect(g, el.x0 - 10, 14, ew + 20, 124, 12);
  outlined(g, '#59658c', 4);
  for (const s of [0, 1]) {
    roundRect(g, el.x0 + 4 + s * (ew / 2), 32, ew / 2 - 8, 100, 4);
    outlined(g, '#c4ccd8', 2.5);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(el.x0 + 10 + s * (ew / 2), 38, 5, 88);
  }
  const wall = L.walls![1]!;
  roundRect(g, wall.x0 - 2, wall.y0 - 4, wall.x1 - wall.x0 + 4, wall.y1 - wall.y0 + 6, 3);
  outlined(g, '#59658c', 3);
  circle(g, wall.x0 - 12, wall.y1 - 12, 6);
  outlined(g, '#c4ccd8', 2);
  circle(g, wall.x0 - 12, wall.y1 - 12, 3);
  g.fillStyle = '#ffd23f';
  g.fill();

  // couch (solid) against the bottom wall, with cushions and a throw blanket
  const couch = L.walls![0]!;
  roundRect(g, couch.x0 - 8, couch.y0 - 6, couch.x1 - couch.x0 + 16, couch.y1 - couch.y0 + 40, 16);
  outlined(g, '#d9534f', 4);
  for (let i = 0; i < 3; i++) {
    const cw = (couch.x1 - couch.x0) / 3;
    roundRect(g, couch.x0 + i * cw + 3, couch.y0, cw - 6, couch.y1 - couch.y0 - 6, 10);
    outlined(g, '#ff6b6b', 2.5);
  }
  for (const s of [-1, 1]) {
    roundRect(g, s < 0 ? couch.x0 - 22 : couch.x1 + 4, couch.y0 - 2, 18, couch.y1 - couch.y0 + 32, 8);
    outlined(g, '#b33b38', 3);
  }
  g.save();
  g.translate(couch.x1 - 40, couch.y0 + 14);
  g.rotate(0.2);
  roundRect(g, -20, -12, 40, 24, 4);
  outlined(g, '#ffd23f', 2);
  g.fillStyle = '#ff8a3d';
  for (const k of [-12, 0, 12]) g.fillRect(k - 2, -12, 4, 24);
  g.restore();
  // little TV on a stand, facing the couch
  roundRect(g, 616, 500, 70, 54, 6);
  outlined(g, '#3b3b46', 3.5);
  roundRect(g, 622, 506, 58, 38, 3);
  g.fillStyle = '#1d2b4a';
  g.fill();
  // coffee table (solid) with a games console, two controllers and a mug
  contact(g, p.x + 4, p.y + p.r * 0.7, p.r + 8, p.r * 0.5);
  circle(g, p.x, p.y, p.r);
  outlined(g, '#c9874a', 4);
  circle(g, p.x, p.y, p.r - 6);
  g.strokeStyle = 'rgba(120,70,30,0.35)';
  g.lineWidth = 2;
  g.stroke();
  roundRect(g, p.x - 12, p.y - 8, 20, 12, 3);
  outlined(g, '#3b3b46', 1.8);
  for (const [cx2, cy2, c] of [
    [p.x - 14, p.y + 10, '#ff3d5a'],
    [p.x + 4, p.y + 12, '#3d8bff'],
  ] as const) {
    roundRect(g, cx2 - 6, cy2 - 3.5, 12, 7, 3.5);
    outlined(g, c, 1.4);
  }
  roundRect(g, p.x + 10, p.y - 14, 9, 11, 3);
  outlined(g, '#ffffff', 1.6);
  // floor cushions round the table
  for (const [fx2, fy2, c] of [
    [p.x - 62, p.y - 6, '#b26bff'],
    [p.x + 64, p.y + 4, '#ffd23f'],
  ] as const) {
    roundRect(g, fx2 - 14, fy2 - 12, 28, 24, 9);
    outlined(g, c, 2.5);
  }

  // plants, a floor lamp and a bookshelf
  plantPot(g, 996, 330);
  plantPot(g, 600, 560);
  roundRect(g, 912, 494, 62, 80, 6);
  outlined(g, '#8a5a32', 3);
  ['#ff3d5a', '#3d8bff', '#ffd23f', '#7cd651'].forEach((c, i) => {
    roundRect(g, 918 + i * 12, 504, 9, 28, 1.5);
    outlined(g, c, 1.2);
    roundRect(g, 918 + i * 12, 540, 9, 26, 1.5);
    outlined(g, ['#7cd651', '#ff8a3d', '#3d8bff', '#ff3d5a'][i]!, 1.2);
  });
  circle(g, 4, 470, 14);
  outlined(g, '#3b3b46', 2.5);
  circle(g, 4, 470, 22);
  g.strokeStyle = 'rgba(43,26,18,0.35)';
  g.lineWidth = 2;
  g.stroke();
}

function liveLobby(ctx: G, t: number) {
  const L = LOBBY_LAYOUT;
  const d = L.dressing!;
  const el = L.elevator!;
  // fairy lights strung along the top edge, twinkling
  ctx.strokeStyle = 'rgba(43,26,18,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -20; x <= 1020; x += 10) ctx.lineTo(x, -18 + Math.sin(x / 40) * 6);
  ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const x = -10 + i * 40;
    const on = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
    circle(ctx, x, -16 + Math.sin(x / 40) * 6, 4);
    ctx.fillStyle = ['#ff3d5a', '#ffd23f', '#2de2e6', '#7cff6b', '#ff8fb0'][i % 5]!;
    ctx.globalAlpha = 0.45 + on * 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // the wardrobe rug pulses so people find it
  const q = (t * 0.8) % 1;
  circle(ctx, d.x, d.y, d.r + q * 12);
  ctx.strokeStyle = `rgba(255,143,176,${0.9 * (1 - q)})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  comicLabel(ctx, 'CHANGE YOUR LOOK', d.x, d.y + d.r + 14, 18, '#ff8fb0');
  comicLabel(ctx, 'PRACTICE KITCHEN', 330, 236, 22, '#fff6e0');
  // elevator: blinking "READY?" sign over the doors
  const blink = Math.floor(t * 2) % 2 === 0;
  roundRect(ctx, (el.x0 + el.x1) / 2 - 52, 2, 104, 26, 8);
  ctx.fillStyle = INK;
  ctx.fill();
  comicLabel(ctx, 'READY?', (el.x0 + el.x1) / 2, 16, 20, blink ? '#7cff6b' : '#2bb02b');
  // the TV plays a cooking show
  const hue = Math.floor(t * 1.5) % 3;
  ctx.fillStyle = ['#ff8a3d', '#2de2e6', '#7cd651'][hue]!;
  ctx.globalAlpha = 0.4 + Math.sin(t * 9) * 0.08;
  ctx.fillRect(622, 506, 58, 38);
  ctx.globalAlpha = 1;
  icon(ctx, 'chefhat', 651, 524, 20);
  // a cat asleep on the couch, tail swishing, z's floating up
  const couch = L.walls![0]!;
  const cx = couch.x0 + 40;
  const cy = couch.y0 + 12;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx + 14, cy + 2);
  ctx.quadraticCurveTo(cx + 26, cy + 4 + Math.sin(t * 2) * 6, cx + 22, cy - 8 + Math.sin(t * 2) * 6);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#ff9a2e';
  ctx.stroke();
  ellipse(ctx, cx, cy, 16, 11);
  outlined(ctx, '#ff9a2e', 2.5);
  circle(ctx, cx - 13, cy - 3, 8);
  outlined(ctx, '#ff9a2e', 2.5);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx - 13 + s * 6, cy - 8);
    ctx.lineTo(cx - 13 + s * 4, cy - 15);
    ctx.lineTo(cx - 13 + s * 1, cy - 9);
    ctx.closePath();
    outlined(ctx, '#ff9a2e', 1.8);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx - 13 + s * 3, cy - 3, 2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  const z = (t * 0.5) % 1;
  ctx.globalAlpha = 1 - z;
  comicLabel(ctx, 'z', cx - 20 - z * 6, cy - 22 - z * 26, 14 + z * 8, '#ffffff');
  ctx.globalAlpha = 1;
  // the floor lamp's warm glow
  circle(ctx, 4, 470, 60);
  ctx.fillStyle = `rgba(255,220,140,${0.12 + Math.sin(t * 2) * 0.02})`;
  ctx.fill();
}

function comicLabel(ctx: G, text: string, x: number, y: number, size: number, fill: string) {
  ctx.save();
  ctx.font = `${size}px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 4.5);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Lobby: who's in the READY? elevator, over the car (world space). When the head chef is waiting
 * in it, a ring fills over LOBBY.holdMs to show the auto-start coming.
 */
export function drawElevatorStatus(ctx: G, info: { inside: number; total: number; need: number; holdMs: number }, t: number) {
  const el = LOBBY_LAYOUT.elevator!;
  const cx = (el.x0 + el.x1) / 2;
  const enough = info.total >= info.need;
  const text = !enough ? `NEED ${info.need} CHEFS` : `${info.inside} / ${info.total} READY`;
  roundRect(ctx, cx - 64, el.y1 + 6, 128, 26, 10);
  ctx.fillStyle = 'rgba(43,26,18,0.85)';
  ctx.fill();
  comicLabel(ctx, text, cx, el.y1 + 20, 18, info.inside > 0 && enough ? '#7cff6b' : '#ffffff');
  if (info.holdMs > 0 && enough) {
    const k = Math.min(1, info.holdMs / LOBBY.holdMs);
    const secs = Math.max(0, Math.ceil((LOBBY.holdMs - info.holdMs) / 1000));
    const ry = el.y0 + 30;
    circle(ctx, cx, ry, 22);
    ctx.fillStyle = 'rgba(43,26,18,0.75)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, ry, 18, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffd23f';
    ctx.stroke();
    comicLabel(ctx, String(secs), cx, ry + 1, 20 + Math.sin(t * 8) * 1.5, '#ffffff');
  }
}

// ====================================================================== cache + layers

/** A map, or the lobby apartment. */
export type BoardId = MapId | 'lobby';
const layoutFor = (id: BoardId): Layout => (id === 'lobby' ? LOBBY_LAYOUT : MAPS[id].layout);

const PAINT: Record<BoardId, (g: G) => void> = {
  kitchen: (g) => {
    paintKitchen(g);
    kitchenExtras(g);
  },
  pirate: paintPirateCove,
  space: (g) => {
    paintSpace(g);
    spaceFeatures(g);
  },
  jungle: (g) => {
    paintJungle(g);
    jungleFeatures(g);
  },
  arctic: (g) => {
    paintArctic(g);
    arcticFeatures(g);
  },
  lobby: paintLobby,
};
const LIVE: Record<BoardId, (ctx: G, t: number) => void> = {
  kitchen: liveKitchen,
  pirate: liveCove,
  space: (ctx, t) => {
    liveSpace(ctx, t);
    liveSpaceFeatures(ctx, t);
  },
  jungle: (ctx, t) => {
    liveJungle(ctx, t);
    liveJungleFeatures(ctx, t);
  },
  arctic: (ctx, t) => {
    liveArctic(ctx, t);
    liveArcticFeatures(ctx, t);
  },
  lobby: liveLobby,
};

/** Resolution of the cached board (pixels per world unit). */
const RES = 2;
const boards = new Map<BoardId, HTMLCanvasElement>();

function board(map: BoardId): HTMLCanvasElement | null {
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
  useLayout(layoutFor(map));
  PAINT[map](g);
  boards.set(map, c);
  return c;
}

/** Floor, counters and props (world space). */
export function drawMapBoard(ctx: G, map: BoardId, t: number) {
  const b = board(map);
  useLayout(layoutFor(map));
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

const MAP_BACKDROP: Record<BoardId, string> = {
  lobby: '#e9b98a',
  kitchen: '#ff9f45',
  pirate: '#1f6fa8',
  space: '#141a3a',
  jungle: '#2f7d3a',
  arctic: '#7fb6d9',
};

/** Whole-screen backdrop behind the kitchen (screen space, w x h pixels). */
export function drawMapBackdrop(ctx: G, map: BoardId, t: number, w: number, h: number) {
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
  // pirate ship: the masts' yard beams (with the sails furled) pass over the chefs' heads
  if (map === 'pirate') {
    for (const p of MAPS.pirate.layout.posts ?? []) {
      roundRect(ctx, p.x - 70, p.y - 50, 140, 12, 6);
      outlined(ctx, '#8a5a32', 3);
      roundRect(ctx, p.x - 62, p.y - 46, 124, 9, 4);
      ctx.fillStyle = '#f3e2c4';
      ctx.fill();
      circle(ctx, p.x, p.y - 44, 8);
      outlined(ctx, '#6b3e1f', 2.5);
    }
  }
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

