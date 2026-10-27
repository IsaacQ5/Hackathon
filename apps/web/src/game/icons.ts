import { circle, ellipse, INK, outlined, roundRect, shine } from './draw';

/**
 * Hand-drawn icon set (no emoji anywhere). Every icon is drawn in a 100 x 100 box centred on
 * (0, 0), rendered ONCE into a small offscreen sprite, and then copied wherever it's needed:
 * on the canvas with `icon()`, or in the DOM through `iconUrl()` (see components/Icon.tsx).
 *
 * To add your own: write a drawer below (keep it inside roughly -45..45) and use its name as an
 * `icon` anywhere (station / ingredient / recipe data in packages/shared, map skins in maps.ts).
 */

type G = CanvasRenderingContext2D;
type Draw = (g: G) => void;

const o = (g: G, fill: string, lw = 4) => outlined(g, fill, lw);

// ---------------------------------------------------------------- building blocks

function leaf(g: G, x: number, y: number, len: number, w: number, ang: number, fill: string) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len / 2, -w, len, 0);
  g.quadraticCurveTo(len / 2, w, 0, 0);
  o(g, fill, 3);
  g.beginPath();
  g.moveTo(2, 0);
  g.lineTo(len - 4, 0);
  g.strokeStyle = 'rgba(43,26,18,0.35)';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

/** Bowl seen from the side, filled with `fill`. `bits` sprinkles small chunks on top. */
function bowl(g: G, fill: string, bits: string[] = [], rim = '#ffffff') {
  g.beginPath();
  g.moveTo(-42, -4);
  g.quadraticCurveTo(-40, 38, 0, 38);
  g.quadraticCurveTo(40, 38, 42, -4);
  g.closePath();
  o(g, rim);
  ellipse(g, 0, -4, 42, 13);
  o(g, rim, 3.5);
  ellipse(g, 0, -4, 35, 9);
  g.fillStyle = fill;
  g.fill();
  bits.forEach((c, i) => {
    circle(g, -22 + i * 11, -5 + (i % 2) * 3, 4);
    o(g, c, 1.5);
  });
  shine(g, -24, 16, 6, 10, 0.4, 0.5);
}

function plate(g: G, y = 14) {
  ellipse(g, 0, y, 46, 18);
  o(g, '#ffffff');
  ellipse(g, 0, y - 1, 32, 11);
  g.strokeStyle = 'rgba(43,26,18,0.15)';
  g.lineWidth = 2.5;
  g.stroke();
}

function steam(g: G, x: number, y: number) {
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 4;
  for (const dx of [-12, 0, 12]) {
    g.beginPath();
    g.moveTo(x + dx, y);
    g.bezierCurveTo(x + dx - 6, y - 8, x + dx + 6, y - 14, x + dx, y - 22);
    g.stroke();
  }
}

function fruit(g: G, fill: string, r: number, leafy = true) {
  circle(g, 0, 4, r);
  o(g, fill);
  shine(g, -r * 0.4, -r * 0.25, r * 0.28, r * 0.16);
  if (leafy) {
    g.beginPath();
    g.moveTo(0, 4 - r);
    g.lineTo(2, 4 - r - 10);
    g.lineWidth = 4;
    g.strokeStyle = '#6b3e1f';
    g.stroke();
    leaf(g, 2, 4 - r - 6, 20, 8, -0.4, '#5bbf3a');
  }
}

function star(g: G, x: number, y: number, r: number, fill: string, lw = 3) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  o(g, fill, lw);
}

function bunTop(g: G, y: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(-w, y);
  g.quadraticCurveTo(-w, y - h, 0, y - h);
  g.quadraticCurveTo(w, y - h, w, y);
  g.closePath();
  o(g, '#e8a54b');
  g.fillStyle = '#fff6d8';
  for (let i = 0; i < 5; i++) {
    ellipse(g, -w * 0.6 + i * w * 0.3, y - h * 0.55 + (i % 2) * 6, 3, 1.6, 0.4);
    g.fill();
  }
  shine(g, -w * 0.45, y - h * 0.65, w * 0.2, h * 0.12, -0.3, 0.45);
}

function pizza(g: G, toppings: string[]) {
  circle(g, 0, 0, 42);
  o(g, '#e3a45a');
  circle(g, 0, 0, 34);
  g.fillStyle = '#e8432f';
  g.fill();
  circle(g, 0, 0, 31);
  g.fillStyle = '#ffd56b';
  g.fill();
  const spots = [
    [-15, -12],
    [12, -16],
    [18, 8],
    [-6, 14],
    [-20, 6],
    [4, -2],
  ];
  spots.forEach(([x, y], i) => {
    circle(g, x!, y!, 6);
    o(g, toppings[i % toppings.length]!, 1.8);
  });
  g.strokeStyle = 'rgba(43,26,18,0.4)';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(Math.cos(a) * -34, Math.sin(a) * -34);
    g.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
    g.stroke();
  }
}

function wrap(g: G, filling: string[]) {
  g.save();
  g.rotate(-0.5);
  roundRect(g, -20, -40, 40, 80, 20);
  o(g, '#f3dca0');
  g.fillStyle = 'rgba(180,130,60,0.35)';
  for (let i = 0; i < 6; i++) {
    circle(g, -10 + (i % 2) * 16, -20 + i * 8, 2.5);
    g.fill();
  }
  // foil on the bottom half
  roundRect(g, -22, 4, 44, 38, 14);
  o(g, '#cfd6df');
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 2;
  for (const dy of [12, 22, 32]) {
    g.beginPath();
    g.moveTo(-16, dy);
    g.lineTo(16, dy + 3);
    g.stroke();
  }
  // filling peeking out the top
  filling.forEach((c, i) => {
    circle(g, -10 + i * 10, -38, 6);
    o(g, c, 1.8);
  });
  g.restore();
}

function soup(g: G, fill: string, bits: string[]) {
  bowl(g, fill, bits, '#ffffff');
  steam(g, 0, -18);
}

function sandwich(g: G, layers: string[], long: boolean) {
  if (long) {
    roundRect(g, -44, 4, 88, 22, 11);
    o(g, '#e8a54b');
    layers.forEach((c, i) => {
      roundRect(g, -42, -2 - i * 7, 84, 9, 4);
      o(g, c, 2.5);
    });
    g.beginPath();
    g.moveTo(-44, -6 - layers.length * 7);
    g.quadraticCurveTo(0, -36 - layers.length * 4, 44, -6 - layers.length * 7);
    g.lineTo(44, -2 - layers.length * 7);
    g.lineTo(-44, -2 - layers.length * 7);
    g.closePath();
    o(g, '#e8a54b');
    g.strokeStyle = 'rgba(43,26,18,0.45)';
    g.lineWidth = 2.5;
    for (const sx of [-22, 0, 22]) {
      g.beginPath();
      g.moveTo(sx - 5, -20);
      g.lineTo(sx + 5, -14);
      g.stroke();
    }
    return;
  }
  // triangle sandwich half
  const tri = (dy: number, fill: string, lw = 4) => {
    g.beginPath();
    g.moveTo(-40, 30 + dy);
    g.lineTo(40, 30 + dy);
    g.lineTo(-30, -40 + dy);
    g.closePath();
    o(g, fill, lw);
  };
  tri(6, '#f7e2b0');
  layers.forEach((c, i) => {
    g.beginPath();
    g.moveTo(-44, 24 - i * 6);
    g.lineTo(44, 24 - i * 6);
    g.lineWidth = 7;
    g.strokeStyle = c;
    g.stroke();
  });
  tri(-16, '#f7e2b0');
  g.beginPath();
  g.moveTo(-34, 10);
  g.lineTo(30, 10);
  g.lineTo(-26, -48);
  g.closePath();
  g.strokeStyle = 'rgba(200,140,60,0.6)';
  g.lineWidth = 3;
  g.stroke();
}

function arrow(g: G, ang: number) {
  g.save();
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, -42);
  g.lineTo(34, -6);
  g.lineTo(14, -6);
  g.lineTo(14, 38);
  g.lineTo(-14, 38);
  g.lineTo(-14, -6);
  g.lineTo(-34, -6);
  g.closePath();
  o(g, '#ffd23f');
  g.restore();
}

function medal(g: G, fill: string, n: string) {
  for (const [s, c] of [
    [-1, '#ff3d5a'],
    [1, '#3d8bff'],
  ] as const) {
    g.beginPath();
    g.moveTo(s * 6, -10);
    g.lineTo(s * 26, -44);
    g.lineTo(s * 10, -44);
    g.lineTo(-s * 8, -10);
    g.closePath();
    o(g, c, 3);
  }
  circle(g, 0, 12, 30);
  o(g, fill);
  circle(g, 0, 12, 21);
  g.strokeStyle = 'rgba(43,26,18,0.3)';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = INK;
  g.font = '700 30px Fredoka, "Arial Black", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n, 0, 14);
  shine(g, -12, -2, 7, 4);
}

function eyes(g: G, x: number, y: number, gap: number, r: number, look = 0) {
  for (const s of [-1, 1]) {
    circle(g, x + s * gap, y, r);
    o(g, '#ffffff', 2.5);
    circle(g, x + s * gap + look, y, r * 0.45);
    g.fillStyle = INK;
    g.fill();
  }
}

/** Little legs for the running creatures (all face left). */
function legs(g: G, color: string, y: number) {
  g.strokeStyle = INK;
  g.lineWidth = 7;
  for (const dx of [-8, 8]) {
    g.beginPath();
    g.moveTo(dx, y);
    g.lineTo(dx - 3, y + 14);
    g.stroke();
  }
  g.strokeStyle = color;
  g.lineWidth = 4;
  for (const dx of [-8, 8]) {
    g.beginPath();
    g.moveTo(dx, y);
    g.lineTo(dx - 3, y + 14);
    g.stroke();
  }
}

// ---------------------------------------------------------------- the icons

const DRAW: Record<string, Draw> = {
  // ---- station tools
  knife: (g) => {
    g.rotate(-0.7);
    g.beginPath();
    g.moveTo(-44, -10);
    g.lineTo(14, -10);
    g.lineTo(14, 10);
    g.quadraticCurveTo(-20, 14, -44, -10);
    g.closePath();
    o(g, '#e6edf5');
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(-30, -6, 40, 3);
    roundRect(g, 12, -9, 34, 17, 6);
    o(g, '#6b3e1f');
    g.fillStyle = '#e0c08a';
    for (const rx of [22, 36]) {
      circle(g, rx, -0.5, 2.5);
      g.fill();
    }
  },
  pan: (g) => {
    g.save();
    g.rotate(0.6);
    roundRect(g, 26, -7, 26, 14, 7);
    o(g, '#2a2a30');
    g.restore();
    circle(g, -6, -4, 36);
    o(g, '#4a4a55');
    circle(g, -6, -4, 28);
    g.fillStyle = '#2f2f37';
    g.fill();
    // a fried egg in the pan
    ellipse(g, -6, -4, 18, 15, 0.3);
    o(g, '#ffffff', 2.5);
    circle(g, -4, -6, 7);
    o(g, '#ffc21a', 2.5);
    shine(g, -18, -18, 8, 4, -0.7, 0.35);
  },
  pot: (g) => {
    for (const s of [-1, 1]) {
      roundRect(g, s * 40 - 8, -6, 16, 10, 5);
      o(g, '#5c606c', 3);
    }
    g.beginPath();
    g.moveTo(-36, -8);
    g.lineTo(-32, 34);
    g.quadraticCurveTo(0, 42, 32, 34);
    g.lineTo(36, -8);
    g.closePath();
    o(g, '#9aa0ad');
    ellipse(g, 0, -8, 36, 10);
    o(g, '#c6cbd6', 3.5);
    ellipse(g, 0, -8, 29, 6);
    g.fillStyle = '#e8432f';
    g.fill();
    shine(g, -20, 14, 5, 12, 0.1, 0.45);
    steam(g, 0, -22);
  },
  rollingpin: (g) => {
    g.rotate(-0.5);
    roundRect(g, -30, -14, 60, 28, 12);
    o(g, '#e3a96b');
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(-24, -9, 48, 4);
    for (const s of [-1, 1]) {
      roundRect(g, s > 0 ? 30 : -46, -6, 16, 12, 6);
      o(g, '#8d5a2b', 3);
    }
  },
  whisk: (g) => {
    g.rotate(-0.5);
    g.strokeStyle = INK;
    g.lineWidth = 7;
    for (const k of [-10, 0, 10]) {
      ellipse(g, k * 0.6, -14, 10 + Math.abs(k) * 0.9, 28);
      g.stroke();
    }
    g.strokeStyle = '#c4ccd8';
    g.lineWidth = 3.5;
    for (const k of [-10, 0, 10]) {
      ellipse(g, k * 0.6, -14, 10 + Math.abs(k) * 0.9, 28);
      g.stroke();
    }
    roundRect(g, -6, 12, 12, 34, 6);
    o(g, '#ff8a3d', 3.5);
  },
  juicebox: (g) => {
    g.beginPath();
    g.moveTo(-28, -30);
    g.lineTo(28, -30);
    g.lineTo(22, 40);
    g.lineTo(-22, 40);
    g.closePath();
    o(g, 'rgba(230,248,255,0.95)');
    g.save();
    g.clip();
    g.fillStyle = '#ffb02e';
    g.fillRect(-30, -10, 60, 52);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(-18, -24, 6, 58);
    g.restore();
    g.beginPath();
    g.moveTo(-28, -30);
    g.lineTo(28, -30);
    g.lineTo(22, 40);
    g.lineTo(-22, 40);
    g.closePath();
    g.lineWidth = 4;
    g.strokeStyle = INK;
    g.stroke();
    // straw + orange slice
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(6, 10);
    g.lineTo(18, -46);
    g.lineTo(30, -46);
    g.stroke();
    g.lineWidth = 4.5;
    g.strokeStyle = '#ff3d7f';
    g.stroke();
    g.beginPath();
    g.arc(-24, -30, 14, Math.PI, Math.PI * 2);
    g.closePath();
    o(g, '#ffb02e', 3);
  },
  bell: (g) => {
    roundRect(g, -40, 26, 80, 12, 6);
    o(g, '#c9874a');
    g.beginPath();
    g.moveTo(-32, 26);
    g.quadraticCurveTo(-32, -24, 0, -24);
    g.quadraticCurveTo(32, -24, 32, 26);
    g.closePath();
    o(g, '#ffd23f');
    circle(g, 0, -30, 7);
    o(g, '#ffd23f', 3);
    shine(g, -14, -4, 6, 14, 0.4, 0.55);
  },

  // ---- chopping board
  lettuce: (g) => {
    const greens = ['#4fae32', '#7cd651', '#a6e86f'];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      g.save();
      g.rotate(a + Math.PI / 2);
      ellipse(g, 0, -16, 16, 26);
      o(g, greens[i % 3]!, 3);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 6);
      g.lineTo(0, -34);
      g.stroke();
      g.restore();
    }
    circle(g, 0, 10, 16);
    o(g, '#c8f08f', 3);
  },
  tomato: (g) => {
    ellipse(g, 0, 6, 38, 33);
    o(g, '#ff4d4d');
    shine(g, -14, -6, 10, 6);
    star(g, 0, -26, 16, '#3fbf2f', 2.5);
  },
  onion: (g) => {
    g.beginPath();
    g.moveTo(0, -42);
    g.bezierCurveTo(10, -26, 38, -12, 34, 16);
    g.quadraticCurveTo(28, 40, 0, 40);
    g.quadraticCurveTo(-28, 40, -34, 16);
    g.bezierCurveTo(-38, -12, -10, -26, 0, -42);
    o(g, '#c98ad9');
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2.5;
    for (const k of [-16, 0, 16]) {
      g.beginPath();
      g.moveTo(k * 0.3, -30);
      g.quadraticCurveTo(k * 1.4, 6, k * 0.6, 36);
      g.stroke();
    }
    g.strokeStyle = '#f5e7c8';
    g.lineWidth = 3;
    for (const dx of [-6, 0, 6]) {
      g.beginPath();
      g.moveTo(dx * 0.6, 40);
      g.lineTo(dx, 46);
      g.stroke();
    }
  },
  mushroom: (g) => {
    roundRect(g, -12, -2, 24, 40, 10);
    o(g, '#f3e2c4');
    g.beginPath();
    g.moveTo(-42, 4);
    g.quadraticCurveTo(-40, -40, 0, -40);
    g.quadraticCurveTo(40, -40, 42, 4);
    g.closePath();
    o(g, '#c98b5a');
    g.fillStyle = '#fff3dc';
    for (const [x, y, r] of [
      [-18, -18, 6],
      [10, -26, 5],
      [22, -8, 4],
      [-4, -8, 3],
    ] as const) {
      circle(g, x, y, r);
      g.fill();
    }
  },
  carrot: (g) => {
    g.save();
    g.rotate(0.6);
    g.beginPath();
    g.moveTo(-14, -24);
    g.quadraticCurveTo(0, -30, 14, -24);
    g.lineTo(2, 44);
    g.quadraticCurveTo(0, 46, -2, 44);
    g.closePath();
    o(g, '#ff9a2e');
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 2.5;
    for (const y of [-8, 8, 22]) {
      g.beginPath();
      g.moveTo(-8 + y * 0.12, y);
      g.lineTo(2, y + 2);
      g.stroke();
    }
    leaf(g, 0, -26, 22, 7, -2.0, '#5bbf3a');
    leaf(g, 0, -26, 24, 7, -1.57, '#3fae2f');
    leaf(g, 0, -26, 22, 7, -1.1, '#5bbf3a');
    g.restore();
  },

  // ---- frying pan
  patty: (g) => {
    ellipse(g, 0, 8, 42, 24);
    o(g, '#6b3a1f');
    ellipse(g, 0, 2, 42, 22);
    o(g, '#8a4a2a');
    g.strokeStyle = '#4a2410';
    g.lineWidth = 4;
    for (const dx of [-18, 0, 18]) {
      g.beginPath();
      g.moveTo(dx - 10, -10);
      g.lineTo(dx + 10, 14);
      g.stroke();
    }
    shine(g, -18, -8, 10, 4, -0.2, 0.3);
  },
  egg: (g) => {
    g.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 38 + Math.sin(a * 4) * 5 + Math.sin(a * 7) * 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.82);
    }
    g.closePath();
    o(g, '#ffffff');
    circle(g, 4, -2, 15);
    o(g, '#ffc21a');
    shine(g, -1, -8, 5, 3);
  },
  bacon: (g) => {
    for (const dy of [-14, 12]) {
      g.beginPath();
      for (let x = -42; x <= 42; x += 6) g.lineTo(x, dy - 9 + Math.sin(x / 9) * 6);
      for (let x = 42; x >= -42; x -= 6) g.lineTo(x, dy + 9 + Math.sin(x / 9) * 6);
      g.closePath();
      o(g, '#d9534f');
      g.beginPath();
      for (let x = -40; x <= 40; x += 6) g.lineTo(x, dy + Math.sin(x / 9) * 6);
      g.lineWidth = 4;
      g.strokeStyle = '#ffd9c7';
      g.stroke();
    }
  },
  chicken: (g) => {
    g.save();
    g.rotate(-0.6);
    roundRect(g, 8, -6, 34, 12, 6);
    o(g, '#fff6e0', 3.5);
    for (const dy of [-8, 8]) {
      circle(g, 42, dy, 7);
      o(g, '#fff6e0', 3);
    }
    ellipse(g, -12, 0, 30, 24);
    o(g, '#d98a3a');
    shine(g, -22, -10, 10, 5);
    g.restore();
  },
  fish: (g) => {
    g.beginPath();
    g.moveTo(26, 0);
    g.lineTo(46, -20);
    g.lineTo(44, 20);
    g.closePath();
    o(g, '#4f9de0');
    ellipse(g, -6, 0, 36, 22);
    o(g, '#7cc4ff');
    g.beginPath();
    g.moveTo(-6, -20);
    g.quadraticCurveTo(6, -36, 14, -18);
    o(g, '#4f9de0', 3);
    g.beginPath();
    g.arc(-24, 0, 12, -1.2, 1.2);
    g.strokeStyle = 'rgba(43,26,18,0.4)';
    g.lineWidth = 2.5;
    g.stroke();
    circle(g, -28, -5, 4.5);
    o(g, '#ffffff', 2);
    circle(g, -29, -5, 2);
    g.fillStyle = INK;
    g.fill();
    shine(g, -4, -9, 12, 4, 0, 0.4);
  },

  // ---- stirring pot (sauces)
  tomatosauce: (g) => {
    bowl(g, '#e8432f');
    leaf(g, -4, -6, 20, 7, -0.3, '#3fbf2f');
  },
  cheesesauce: (g) => {
    bowl(g, '#ffcf3d');
    g.beginPath();
    g.moveTo(24, -2);
    g.quadraticCurveTo(28, 14, 24, 20);
    g.quadraticCurveTo(20, 14, 24, -2);
    o(g, '#ffcf3d', 2.5);
  },
  chocosauce: (g) => {
    bowl(g, '#7a4a2a');
    shine(g, -8, -6, 12, 3, 0, 0.4);
  },
  soupbase: (g) => soup(g, '#e9b872', ['#ff9a2e', '#7cd651', '#ff9a2e', '#ffffff', '#7cd651']),
  curry: (g) => bowl(g, '#f0a020', ['#ffffff', '#7a4a2a', '#ff9a2e', '#ffffff']),

  // ---- dough bench
  bread: (g) => {
    g.beginPath();
    g.moveTo(-30, 40);
    g.lineTo(-32, -8);
    g.bezierCurveTo(-50, -14, -46, -42, -20, -40);
    g.quadraticCurveTo(0, -48, 20, -40);
    g.bezierCurveTo(46, -42, 50, -14, 32, -8);
    g.lineTo(30, 40);
    g.closePath();
    o(g, '#c9874a');
    g.beginPath();
    g.moveTo(-24, 34);
    g.lineTo(-26, -6);
    g.bezierCurveTo(-40, -12, -36, -34, -18, -33);
    g.quadraticCurveTo(0, -40, 18, -33);
    g.bezierCurveTo(36, -34, 40, -12, 26, -6);
    g.lineTo(24, 34);
    g.closePath();
    g.fillStyle = '#fbe7c0';
    g.fill();
    g.fillStyle = 'rgba(200,150,90,0.4)';
    for (let i = 0; i < 8; i++) {
      circle(g, -12 + ((i * 17) % 26), -16 + ((i * 23) % 44), 2);
      g.fill();
    }
  },
  bun: (g) => {
    roundRect(g, -40, 12, 80, 16, 8);
    o(g, '#d99a4e');
    bunTop(g, 14, 42, 50);
  },
  pizzadough: (g) => {
    ellipse(g, 0, 6, 44, 30);
    o(g, '#f6dfae');
    ellipse(g, 0, 4, 34, 22);
    g.strokeStyle = 'rgba(200,150,90,0.4)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) {
      circle(g, -26 + ((i * 19) % 52), -10 + ((i * 13) % 28), 2);
      g.fill();
    }
  },
  tortilla: (g) => {
    circle(g, 0, 0, 42);
    o(g, '#f3dca0');
    g.fillStyle = 'rgba(170,110,40,0.5)';
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = 8 + ((i * 7) % 28);
      ellipse(g, Math.cos(a) * r, Math.sin(a) * r, 4, 2.6, a);
      g.fill();
    }
  },
  sandwichbread: (g) => {
    g.rotate(-0.3);
    roundRect(g, -46, -18, 92, 36, 18);
    o(g, '#e8a54b');
    g.strokeStyle = 'rgba(43,26,18,0.5)';
    g.lineWidth = 3;
    for (const sx of [-24, 0, 24]) {
      g.beginPath();
      g.moveTo(sx - 7, -10);
      g.lineTo(sx + 7, 4);
      g.stroke();
    }
    shine(g, -18, -10, 16, 4, -0.1, 0.4);
  },

  // ---- mixing bowl
  pancake: (g) => {
    for (let i = 0; i < 3; i++) {
      ellipse(g, 0, 26 - i * 14, 40, 13);
      o(g, '#f2c36b');
      ellipse(g, 0, 22 - i * 14, 38, 10);
      g.fillStyle = '#ffe3a6';
      g.fill();
    }
    g.beginPath();
    g.moveTo(-26, -6);
    g.quadraticCurveTo(0, -12, 24, -6);
    g.quadraticCurveTo(28, 6, 22, 14);
    g.quadraticCurveTo(18, 4, 10, 2);
    g.quadraticCurveTo(-6, 10, -14, 2);
    g.quadraticCurveTo(-24, 8, -26, -6);
    o(g, '#b5651d', 2.5);
    roundRect(g, -8, -16, 16, 9, 2);
    o(g, '#fff07a', 2.5);
  },
  omelette: (g) => {
    g.beginPath();
    g.moveTo(-44, 10);
    g.quadraticCurveTo(0, -48, 44, 10);
    g.quadraticCurveTo(0, 30, -44, 10);
    o(g, '#ffe066');
    g.beginPath();
    g.moveTo(-36, 10);
    g.quadraticCurveTo(0, 24, 36, 10);
    g.strokeStyle = 'rgba(200,140,20,0.6)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#3fbf2f';
    for (const [x, y] of [
      [-14, -6],
      [6, -12],
      [18, -2],
    ] as const) {
      ellipse(g, x, y, 4, 2, 0.6);
      g.fill();
    }
  },
  cake: (g) => {
    g.beginPath();
    g.moveTo(-40, 20);
    g.lineTo(32, 36);
    g.lineTo(32, 0);
    g.lineTo(-40, -16);
    g.closePath();
    o(g, '#f7d9a8');
    g.fillStyle = '#ff8fb0';
    g.beginPath();
    g.moveTo(-40, 2);
    g.lineTo(32, 18);
    g.lineTo(32, 22);
    g.lineTo(-40, 6);
    g.fill();
    g.beginPath();
    g.moveTo(-40, -16);
    g.lineTo(32, 0);
    g.lineTo(42, -14);
    g.lineTo(-30, -32);
    g.closePath();
    o(g, '#fff6e0');
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(42, -14);
    g.lineTo(42, 20);
    g.lineTo(32, 36);
    g.closePath();
    o(g, '#e8c48c');
    circle(g, 6, -26, 7);
    o(g, '#ff3d5a', 2.5);
  },
  cookie: (g) => {
    circle(g, 0, 0, 40);
    o(g, '#d9a066');
    g.fillStyle = '#5a3420';
    for (const [x, y] of [
      [-16, -14],
      [12, -20],
      [20, 6],
      [-4, 4],
      [-20, 16],
      [6, 22],
    ] as const) {
      ellipse(g, x, y, 5, 4, x);
      g.fill();
    }
    shine(g, -16, -24, 10, 4, -0.4, 0.35);
  },
  cream: (g) => {
    for (let i = 0; i < 4; i++) {
      const w = 40 - i * 9;
      ellipse(g, 0, 26 - i * 16, w, 13);
      o(g, '#fff6e0', 3.5);
    }
    g.beginPath();
    g.moveTo(-6, -32);
    g.quadraticCurveTo(0, -48, 6, -34);
    o(g, '#fff6e0', 3);
    shine(g, -14, 22, 10, 3, 0, 0.8);
  },

  // ---- juicer
  orange: (g) => {
    fruit(g, '#ffa22e', 36);
    g.fillStyle = 'rgba(200,100,0,0.3)';
    for (let i = 0; i < 7; i++) {
      circle(g, -16 + ((i * 13) % 34), -6 + ((i * 17) % 30), 1.8);
      g.fill();
    }
  },
  lemon: (g) => {
    g.beginPath();
    g.ellipse(0, 2, 40, 28, -0.3, 0, Math.PI * 2);
    o(g, '#fff06a');
    ellipse(g, -36, 18, 6, 5, -0.3);
    o(g, '#fff06a', 3);
    ellipse(g, 36, -14, 6, 5, -0.3);
    o(g, '#fff06a', 3);
    shine(g, -10, -10, 14, 5, -0.3);
  },
  puree: (g) => {
    g.beginPath();
    g.moveTo(0, 42);
    g.bezierCurveTo(-40, 20, -40, -26, -16, -26);
    g.quadraticCurveTo(0, -30, 16, -26);
    g.bezierCurveTo(40, -26, 40, 20, 0, 42);
    o(g, '#ff3d5a');
    g.fillStyle = '#ffe78a';
    for (let i = 0; i < 9; i++) {
      ellipse(g, -16 + ((i * 11) % 32), -12 + ((i * 17) % 40), 1.8, 3);
      g.fill();
    }
    star(g, 0, -28, 18, '#3fbf2f', 2.5);
  },
  apple: (g) => {
    g.beginPath();
    g.moveTo(0, -24);
    g.bezierCurveTo(24, -40, 46, -18, 38, 10);
    g.bezierCurveTo(32, 40, 10, 44, 0, 36);
    g.bezierCurveTo(-10, 44, -32, 40, -38, 10);
    g.bezierCurveTo(-46, -18, -24, -40, 0, -24);
    o(g, '#9fd84a');
    shine(g, -18, -8, 7, 12, 0.3);
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(4, -42);
    g.lineWidth = 5;
    g.strokeStyle = INK;
    g.stroke();
    leaf(g, 4, -36, 22, 8, -0.5, '#3fae2f');
  },
  water: (g) => {
    g.beginPath();
    g.moveTo(0, -44);
    g.bezierCurveTo(14, -18, 34, 0, 34, 16);
    g.arc(0, 16, 34, 0, Math.PI);
    g.bezierCurveTo(-34, 0, -14, -18, 0, -44);
    o(g, '#7fd0ff');
    shine(g, -14, 12, 6, 12, 0.3, 0.75);
  },

  // ---- dishes
  'dish-burger': (g) => {
    roundRect(g, -40, 22, 80, 16, 8);
    o(g, '#e8a54b');
    roundRect(g, -42, 6, 84, 16, 8);
    o(g, '#8a4a2a');
    g.beginPath();
    g.moveTo(-40, 6);
    g.lineTo(40, 6);
    g.lineTo(30, 16);
    g.lineTo(20, 8);
    g.lineTo(6, 18);
    g.lineTo(-10, 8);
    g.lineTo(-24, 16);
    g.closePath();
    o(g, '#ffcf3d', 3);
    g.beginPath();
    for (let x = -44; x <= 44; x += 8) g.lineTo(x, -2 + (x % 16 === 0 ? 4 : 0));
    g.lineTo(44, 6);
    g.lineTo(-44, 6);
    g.closePath();
    o(g, '#7cd651', 3);
    bunTop(g, -2, 42, 40);
  },
  'dish-breakfast': (g) => {
    plate(g, 10);
    g.save();
    g.translate(-14, 4);
    g.scale(0.5, 0.5);
    DRAW.egg!(g);
    g.restore();
    g.save();
    g.translate(18, 6);
    g.scale(0.45, 0.45);
    g.rotate(0.5);
    DRAW.bacon!(g);
    g.restore();
    g.save();
    g.translate(0, -18);
    g.scale(0.42, 0.42);
    DRAW.bread!(g);
    g.restore();
  },
  'dish-blt': (g) => sandwich(g, ['#ff4d4d', '#7cd651', '#d9534f'], false),
  'dish-chickenpizza': (g) => pizza(g, ['#d98a3a', '#c98b5a', '#fff3dc']),
  'dish-fishtacos': (g) => {
    g.beginPath();
    g.arc(0, 10, 40, Math.PI, Math.PI * 2);
    g.closePath();
    o(g, '#f2c94c');
    ['#7cd651', '#7cc4ff', '#c98ad9', '#fff06a'].forEach((c, i) => {
      circle(g, -24 + i * 16, -6 - (i % 2) * 6, 9);
      o(g, c, 2.5);
    });
    g.beginPath();
    g.arc(0, 10, 40, Math.PI, Math.PI * 2);
    g.arc(0, 10, 30, Math.PI * 2, Math.PI, true);
    g.closePath();
    o(g, '#f2c94c');
  },
  'dish-curry': (g) => {
    bowl(g, '#f0a020', ['#ff9a2e', '#d98a3a'], '#ffffff');
    ellipse(g, -12, -12, 16, 9);
    o(g, '#ffffff', 2.5);
  },
  'dish-pasta': (g) => {
    plate(g, 14);
    g.strokeStyle = '#f5d76e';
    g.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      ellipse(g, 0, 4, 26 - i * 4, 12 - i * 2, i * 0.3);
      g.stroke();
    }
    ellipse(g, 0, -2, 18, 8);
    g.fillStyle = '#e8432f';
    g.fill();
    for (const [x, y] of [
      [-10, -4],
      [8, -6],
      [0, 4],
    ] as const) {
      circle(g, x, y, 7);
      o(g, '#8a4a2a', 2.5);
    }
  },
  'dish-veggiesoup': (g) => soup(g, '#e9b872', ['#ff9a2e', '#7cd651', '#ff9a2e', '#7cd651', '#ffffff']),
  'dish-pancakes': (g) => {
    plate(g, 30);
    g.save();
    g.translate(0, -4);
    g.scale(0.85, 0.85);
    DRAW.pancake!(g);
    g.restore();
  },
  'dish-omelette': (g) => {
    plate(g, 16);
    g.save();
    g.translate(0, 4);
    g.scale(0.75, 0.75);
    DRAW.omelette!(g);
    g.restore();
  },
  'dish-carrotcake': (g) => {
    DRAW.cake!(g);
    g.save();
    g.translate(6, -26);
    g.scale(0.25, 0.25);
    DRAW.carrot!(g);
    g.restore();
  },
  'dish-cookiepizza': (g) => pizza(g, ['#5a3420', '#ff3d5a', '#7a4a2a']),
  'dish-creambuns': (g) => {
    g.beginPath();
    g.moveTo(-30, 0);
    g.lineTo(30, 0);
    g.lineTo(22, 42);
    g.lineTo(-22, 42);
    g.closePath();
    o(g, '#ff8fb0');
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 2.5;
    for (const x of [-14, 0, 14]) {
      g.beginPath();
      g.moveTo(x * 1.3, 4);
      g.lineTo(x, 40);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      ellipse(g, 0, -4 - i * 13, 34 - i * 9, 11);
      o(g, '#fff6e0', 3.5);
    }
    g.beginPath();
    g.moveTo(-20, -6);
    g.quadraticCurveTo(-18, 8, -22, 12);
    g.moveTo(14, -10);
    g.quadraticCurveTo(18, 4, 14, 10);
    g.lineWidth = 5;
    g.strokeStyle = '#7a4a2a';
    g.stroke();
    circle(g, 0, -42, 6);
    o(g, '#ff3d5a', 2.5);
  },
  'dish-burrito': (g) => wrap(g, ['#ffe066', '#c98ad9', '#ffcf3d']),
  'dish-chickensandwich': (g) => sandwich(g, ['#7cd651', '#d98a3a', '#fff06a'], true),
  'dish-chowder': (g) => soup(g, '#f6ecd6', ['#7cc4ff', '#ffffff', '#c98ad9', '#e9b872']),
  'dish-caesar': (g) => {
    bowl(g, '#7cd651', [], '#cfe6ff');
    for (const [x, y, c] of [
      [-18, -12, '#7cd651'],
      [0, -18, '#4fae32'],
      [16, -12, '#a6e86f'],
      [-6, -8, '#d98a3a'],
      [12, -4, '#f2c36b'],
    ] as const) {
      ellipse(g, x, y, 11, 8, x * 0.05);
      o(g, c, 2.5);
    }
  },
  'dish-tomatosoup': (g) => soup(g, '#e8432f', ['#ffffff', '#3fbf2f', '#ffffff']),
  'dish-burgerpizza': (g) => pizza(g, ['#8a4a2a', '#c98ad9', '#ffcf3d']),
  'dish-currywrap': (g) => wrap(g, ['#f0a020', '#ff9a2e', '#ff3d5a']),

  // ---- hazards + recovery
  splash: (g) => {
    for (const [x, y, s] of [
      [-16, 6, 1],
      [20, -10, 0.75],
      [16, 26, 0.6],
    ] as const) {
      g.save();
      g.translate(x, y);
      g.scale(s * 0.6, s * 0.6);
      DRAW.water!(g);
      g.restore();
    }
  },
  dizzy: (g) => {
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) g.lineTo(Math.cos(a) * a * 2.6, Math.sin(a) * a * 2.6);
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#ffd23f';
    g.stroke();
    star(g, 30, -30, 11, '#ffd23f', 2.5);
    star(g, -32, 28, 8, '#ffd23f', 2.5);
  },
  feather: (g) => {
    g.rotate(0.6);
    g.beginPath();
    g.moveTo(0, -44);
    g.bezierCurveTo(26, -24, 22, 20, 0, 38);
    g.bezierCurveTo(-22, 20, -26, -24, 0, -44);
    o(g, '#fff6e0');
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 2;
    for (let y = -30; y < 28; y += 9) {
      g.beginPath();
      g.moveTo(0, y + 6);
      g.lineTo(-14, y);
      g.moveTo(0, y + 6);
      g.lineTo(14, y);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, -40);
    g.lineTo(0, 46);
    g.lineWidth = 4;
    g.strokeStyle = INK;
    g.stroke();
  },
  extinguisher: (g) => {
    roundRect(g, -18, -24, 36, 66, 14);
    o(g, '#e8303f');
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(-11, -16, 6, 48);
    roundRect(g, -10, 0, 20, 14, 3);
    o(g, '#ffffff', 2.5);
    roundRect(g, -8, -36, 16, 12, 4);
    o(g, '#2b2b33', 3);
    g.beginPath();
    g.moveTo(8, -30);
    g.lineTo(34, -40);
    g.lineTo(38, -30);
    g.lineWidth = 6;
    g.strokeStyle = INK;
    g.stroke();
  },
  fire: (g) => {
    const flame = (s: number, fill: string) => {
      g.beginPath();
      g.moveTo(0, 42 * s);
      g.bezierCurveTo(-40 * s, 40 * s, -40 * s, 0, -16 * s, -20 * s);
      g.quadraticCurveTo(-14 * s, -2 * s, -6 * s, 0);
      g.bezierCurveTo(-10 * s, -26 * s, 0, -40 * s, 8 * s, -46 * s);
      g.bezierCurveTo(10 * s, -24 * s, 40 * s, -10 * s, 34 * s, 16 * s);
      g.quadraticCurveTo(30 * s, 40 * s, 0, 42 * s);
      o(g, fill, s > 0.8 ? 4 : 0.01);
    };
    flame(1, '#ff5a2a');
    g.translate(0, 8);
    flame(0.66, '#ffb02e');
    g.translate(0, 8);
    flame(0.34, '#fff06a');
  },
  hen: (g) => {
    // faces left
    legs(g, '#ffb02e', 22);
    ellipse(g, 6, 4, 32, 26);
    o(g, '#ffffff');
    g.beginPath();
    g.moveTo(30, -6);
    g.lineTo(46, -22);
    g.lineTo(42, 4);
    g.closePath();
    o(g, '#ffffff', 3);
    circle(g, -20, -18, 16);
    o(g, '#ffffff');
    for (const [x, y] of [
      [-26, -34],
      [-18, -38],
      [-10, -34],
    ] as const) {
      circle(g, x, y, 5.5);
      o(g, '#ff3d5a', 2.5);
    }
    g.beginPath();
    g.moveTo(-34, -20);
    g.lineTo(-46, -15);
    g.lineTo(-34, -11);
    g.closePath();
    o(g, '#ffb02e', 2.5);
    ellipse(g, -32, -6, 4, 6);
    o(g, '#ff3d5a', 2);
    circle(g, -24, -20, 3);
    g.fillStyle = INK;
    g.fill();
    g.beginPath();
    g.ellipse(10, 4, 16, 10, 0.3, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 3;
    g.stroke();
  },
  meatball: (g) => {
    circle(g, 0, 0, 40);
    o(g, '#8a4a2a');
    g.fillStyle = '#6b3820';
    for (let i = 0; i < 7; i++) {
      circle(g, Math.cos(i * 1.7) * 22, Math.sin(i * 2.3) * 22, 5);
      g.fill();
    }
    g.beginPath();
    g.arc(0, -8, 30, Math.PI * 1.1, Math.PI * 1.9);
    g.lineWidth = 10;
    g.strokeStyle = '#e8432f';
    g.stroke();
    leaf(g, 2, -32, 20, 7, -0.4, '#3fbf2f');
  },
  cheese: (g) => {
    g.beginPath();
    g.moveTo(-42, 26);
    g.lineTo(42, 26);
    g.lineTo(42, -6);
    g.lineTo(-42, -10);
    g.closePath();
    o(g, '#ffcf3d');
    g.beginPath();
    g.moveTo(-42, -10);
    g.lineTo(42, -6);
    g.lineTo(10, -34);
    g.closePath();
    o(g, '#ffe27a');
    g.fillStyle = '#e0a020';
    for (const [x, y, r] of [
      [-24, 8, 7],
      [6, 14, 5],
      [26, 4, 6],
      [-4, -14, 4],
    ] as const) {
      circle(g, x, y, r);
      g.fill();
    }
  },
  sponge: (g) => {
    roundRect(g, -40, -6, 80, 34, 8);
    o(g, '#ffd23f');
    roundRect(g, -40, -24, 80, 20, 8);
    o(g, '#4fb34f');
    g.fillStyle = 'rgba(160,120,0,0.4)';
    for (let i = 0; i < 8; i++) {
      circle(g, -30 + i * 9, 6 + (i % 2) * 10, 3);
      g.fill();
    }
  },
  wind: (g) => {
    g.lineCap = 'round';
    for (const [y, len, curl] of [
      [-22, 70, 1],
      [0, 84, -1],
      [22, 56, 1],
    ] as const) {
      for (const [w, c] of [
        [11, INK],
        [6, '#e6f6ff'],
      ] as const) {
        g.beginPath();
        g.moveTo(-42, y);
        g.lineTo(-42 + len - 10, y);
        g.arc(-42 + len - 10, y - curl * 8, 8, Math.PI / 2 * curl, -Math.PI / 2 * curl, curl < 0);
        g.lineWidth = w;
        g.strokeStyle = c;
        g.stroke();
      }
    }
  },

  // ---- general UI
  medal1: (g) => medal(g, '#ffd23f', '1'),
  medal2: (g) => medal(g, '#d6dde6', '2'),
  medal3: (g) => medal(g, '#e0965a', '3'),
  check: (g) => {
    circle(g, 0, 0, 40);
    o(g, '#3fbf2f');
    g.beginPath();
    g.moveTo(-20, 0);
    g.lineTo(-6, 16);
    g.lineTo(22, -16);
    g.lineWidth = 11;
    g.strokeStyle = '#ffffff';
    g.stroke();
  },
  cross: (g) => {
    circle(g, 0, 0, 40);
    o(g, '#ff3d5a');
    g.beginPath();
    g.moveTo(-16, -16);
    g.lineTo(16, 16);
    g.moveTo(16, -16);
    g.lineTo(-16, 16);
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.stroke();
  },
  siren: (g) => {
    g.strokeStyle = INK;
    g.lineWidth = 6;
    for (const a of [-2.5, -1.57, -0.64]) {
      g.beginPath();
      g.moveTo(Math.cos(a) * 36, -8 + Math.sin(a) * 36);
      g.lineTo(Math.cos(a) * 46, -8 + Math.sin(a) * 46);
      g.stroke();
    }
    roundRect(g, -34, 22, 68, 18, 6);
    o(g, '#3b3b46');
    g.beginPath();
    g.moveTo(-26, 22);
    g.lineTo(-26, -2);
    g.arc(0, -2, 26, Math.PI, 0);
    g.lineTo(26, 22);
    g.closePath();
    o(g, '#ff3d5a');
    shine(g, -10, -6, 6, 12, 0.3, 0.7);
  },
  star: (g) => star(g, 0, 2, 42, '#ffd23f', 4),
  warning: (g) => {
    g.beginPath();
    g.moveTo(0, -42);
    g.lineTo(44, 36);
    g.lineTo(-44, 36);
    g.closePath();
    g.lineJoin = 'round';
    o(g, '#ffd23f', 5);
    roundRect(g, -5, -16, 10, 30, 5);
    g.fillStyle = INK;
    g.fill();
    circle(g, 0, 24, 5.5);
    g.fill();
  },
  plate: (g) => {
    plate(g, 6);
    g.lineWidth = 5;
    g.strokeStyle = '#c4ccd8';
    g.beginPath();
    g.moveTo(-40, -36);
    g.lineTo(-40, 0);
    g.moveTo(40, -36);
    g.lineTo(40, 0);
    g.stroke();
  },
  chefhat: (g) => {
    roundRect(g, -26, 10, 52, 26, 6);
    o(g, '#ffffff');
    g.beginPath();
    g.arc(-20, -6, 18, Math.PI * 0.6, Math.PI * 1.7);
    g.arc(0, -18, 22, Math.PI * 1.15, Math.PI * 1.85);
    g.arc(20, -6, 18, Math.PI * 1.3, Math.PI * 0.4);
    g.closePath();
    o(g, '#ffffff');
    g.strokeStyle = 'rgba(43,26,18,0.3)';
    g.lineWidth = 2.5;
    for (const x of [-12, 0, 12]) {
      g.beginPath();
      g.moveTo(x, 14);
      g.lineTo(x, 32);
      g.stroke();
    }
  },
  crown: (g) => {
    g.beginPath();
    g.moveTo(-38, 28);
    g.lineTo(-42, -22);
    g.lineTo(-18, 0);
    g.lineTo(0, -34);
    g.lineTo(18, 0);
    g.lineTo(42, -22);
    g.lineTo(38, 28);
    g.closePath();
    o(g, '#ffd23f');
    for (const [x, y, c] of [
      [-42, -22, '#ff3d5a'],
      [0, -34, '#2de2e6'],
      [42, -22, '#7cd651'],
    ] as const) {
      circle(g, x, y, 6);
      o(g, c, 2.5);
    }
  },
  phone: (g) => {
    roundRect(g, -24, -42, 48, 84, 10);
    o(g, '#3b3b46');
    roundRect(g, -18, -32, 36, 62, 4);
    g.fillStyle = '#7fd0ff';
    g.fill();
    shine(g, -6, -14, 6, 16, 0.3, 0.4);
    circle(g, 0, 36, 3);
    g.fillStyle = '#ffffff';
    g.fill();
  },
  gear: (g) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 30 : 42;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.lineTo(Math.cos(a + 0.38) * r, Math.sin(a + 0.38) * r);
    }
    g.closePath();
    o(g, '#c4ccd8');
    circle(g, 0, 0, 12);
    o(g, '#fffaf2', 3);
  },
  target: (g) => {
    for (const [r, c] of [
      [42, '#ff3d5a'],
      [30, '#ffffff'],
      [18, '#ff3d5a'],
      [7, '#ffffff'],
    ] as const) {
      circle(g, 0, 0, r);
      o(g, c, 3.5);
    }
  },
  angry: (g) => {
    circle(g, 0, 0, 42);
    o(g, '#ff7a59');
    g.lineWidth = 5;
    g.strokeStyle = INK;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 26, -22);
      g.lineTo(s * 6, -12);
      g.stroke();
      circle(g, s * 14, -2, 5);
      g.fillStyle = INK;
      g.fill();
    }
    g.beginPath();
    g.arc(0, 26, 14, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  },
  bolt: (g) => {
    g.beginPath();
    g.moveTo(8, -44);
    g.lineTo(-26, 6);
    g.lineTo(-2, 6);
    g.lineTo(-10, 44);
    g.lineTo(28, -8);
    g.lineTo(4, -8);
    g.closePath();
    g.lineJoin = 'round';
    o(g, '#ffd23f');
  },
  bee: (g) => {
    for (const s of [-1, 1]) {
      ellipse(g, s * 10, -24, 14, 20, s * 0.5);
      o(g, 'rgba(220,240,255,0.95)', 3);
    }
    ellipse(g, 0, 6, 36, 24);
    o(g, '#ffd23f');
    g.save();
    ellipse(g, 0, 6, 36, 24);
    g.clip();
    g.fillStyle = INK;
    for (const x of [-6, 12]) g.fillRect(x, -20, 8, 52);
    g.restore();
    circle(g, -26, 0, 4);
    g.fillStyle = INK;
    g.fill();
  },
  butter: (g) => {
    g.beginPath();
    g.moveTo(-40, 6);
    g.lineTo(20, 26);
    g.lineTo(42, 4);
    g.lineTo(-18, -16);
    g.closePath();
    o(g, '#fff07a');
    g.beginPath();
    g.moveTo(-40, 6);
    g.lineTo(-40, 20);
    g.lineTo(20, 40);
    g.lineTo(42, 18);
    g.lineTo(42, 4);
    g.lineTo(20, 26);
    g.closePath();
    o(g, '#f2d34a');
  },
  arrowup: (g) => arrow(g, 0),
  arrowright: (g) => arrow(g, Math.PI / 2),
  arrowdown: (g) => arrow(g, Math.PI),
  arrowleft: (g) => arrow(g, -Math.PI / 2),

  // ---- map badges
  anchor: (g) => {
    g.lineCap = 'round';
    for (const [w, c] of [
      [14, INK],
      [8, '#c4ccd8'],
    ] as const) {
      g.lineWidth = w;
      g.strokeStyle = c;
      g.beginPath();
      g.moveTo(0, -26);
      g.lineTo(0, 36);
      g.moveTo(-18, -14);
      g.lineTo(18, -14);
      g.moveTo(-34, 10);
      g.quadraticCurveTo(-30, 38, 0, 38);
      g.quadraticCurveTo(30, 38, 34, 10);
      g.stroke();
    }
    circle(g, 0, -34, 9);
    g.lineWidth = 9;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#c4ccd8';
    g.stroke();
  },
  rocket: (g) => {
    g.rotate(0.6);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 12, 10);
      g.lineTo(s * 28, 30);
      g.lineTo(s * 12, 28);
      g.closePath();
      o(g, '#ff3d5a', 3);
    }
    g.beginPath();
    g.moveTo(0, -46);
    g.bezierCurveTo(20, -30, 18, 10, 12, 30);
    g.lineTo(-12, 30);
    g.bezierCurveTo(-18, 10, -20, -30, 0, -46);
    o(g, '#f2f5fa');
    circle(g, 0, -8, 9);
    o(g, '#7fd0ff', 3);
    g.beginPath();
    g.moveTo(-8, 32);
    g.quadraticCurveTo(0, 54, 8, 32);
    o(g, '#ffb02e', 3);
  },
  palm: (g) => {
    g.beginPath();
    g.moveTo(-4, 44);
    g.quadraticCurveTo(-10, 10, 4, -20);
    g.lineTo(12, -18);
    g.quadraticCurveTo(0, 10, 8, 44);
    g.closePath();
    o(g, '#a36b3d');
    for (const a of [-2.8, -2.2, -1.5, -0.9, -0.3]) leaf(g, 8, -20, 40, 12, a, '#3fae2f');
    circle(g, 2, -14, 6);
    o(g, '#7a4a2a', 2.5);
    circle(g, 13, -12, 6);
    o(g, '#7a4a2a', 2.5);
  },
  snowflake: (g) => {
    g.lineCap = 'round';
    for (const [w, c] of [
      [11, INK],
      [6, '#e6f6ff'],
    ] as const) {
      g.lineWidth = w;
      g.strokeStyle = c;
      for (let i = 0; i < 6; i++) {
        g.save();
        g.rotate((i * Math.PI) / 3);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -42);
        g.moveTo(0, -26);
        g.lineTo(-10, -36);
        g.moveTo(0, -26);
        g.lineTo(10, -36);
        g.stroke();
        g.restore();
      }
    }
  },

  // ---- pirate galley
  wave: (g) => {
    g.beginPath();
    g.moveTo(-44, 36);
    g.bezierCurveTo(-44, -10, -10, -40, 20, -30);
    g.bezierCurveTo(38, -24, 40, -4, 26, 0);
    g.bezierCurveTo(14, 4, 6, -8, 14, -14);
    g.bezierCurveTo(-8, -10, -14, 16, 4, 36);
    g.closePath();
    o(g, '#3d9be0');
    g.beginPath();
    g.moveTo(-36, 20);
    g.bezierCurveTo(-32, -10, -4, -30, 18, -26);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.stroke();
    roundRect(g, -46, 30, 92, 12, 6);
    o(g, '#2a7fc4', 3);
  },
  pirate: (g) => {
    // faces left: striped shirt, bandana, eyepatch, beard
    legs(g, '#3b3b46', 22);
    ellipse(g, 4, 10, 22, 20);
    o(g, '#ffffff');
    g.save();
    ellipse(g, 4, 10, 22, 20);
    g.clip();
    g.fillStyle = '#ff3d5a';
    for (const y of [-4, 8, 20]) g.fillRect(-20, y, 50, 5);
    g.restore();
    circle(g, -4, -20, 18);
    o(g, '#ffd9b8');
    g.beginPath();
    g.moveTo(-22, -24);
    g.quadraticCurveTo(-4, -46, 14, -24);
    g.closePath();
    o(g, '#ff3d5a', 3.5);
    g.beginPath();
    g.moveTo(12, -26);
    g.lineTo(24, -32);
    g.lineTo(22, -18);
    g.closePath();
    o(g, '#ff3d5a', 3);
    // beard
    g.beginPath();
    g.moveTo(-20, -14);
    g.quadraticCurveTo(-16, 2, -2, 0);
    g.quadraticCurveTo(6, -4, 6, -12);
    g.quadraticCurveTo(-8, -6, -20, -14);
    o(g, '#5a3a26', 2.5);
    circle(g, -14, -21, 3);
    g.fillStyle = INK;
    g.fill();
    ellipse(g, -2, -21, 6, 5);
    o(g, '#1d1d24', 2);
    g.beginPath();
    g.moveTo(-20, -27);
    g.lineTo(12, -16);
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
    // cutlass
    g.beginPath();
    g.moveTo(-24, 6);
    g.quadraticCurveTo(-44, -4, -42, -24);
    g.lineWidth = 7;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#e6edf5';
    g.stroke();
  },
  cannonball: (g) => {
    circle(g, 0, 4, 38);
    o(g, '#2b2b33');
    shine(g, -14, -10, 12, 7, -0.6, 0.35);
    g.beginPath();
    g.moveTo(20, -26);
    g.quadraticCurveTo(30, -40, 24, -46);
    g.lineWidth = 4;
    g.strokeStyle = '#a36b3d';
    g.stroke();
    star(g, 24, -46, 8, '#ffb02e', 2);
  },
  barrel: (g) => {
    g.beginPath();
    g.moveTo(-28, -40);
    g.quadraticCurveTo(-40, 0, -28, 40);
    g.lineTo(28, 40);
    g.quadraticCurveTo(40, 0, 28, -40);
    g.closePath();
    o(g, '#b5743a');
    g.strokeStyle = 'rgba(43,26,18,0.4)';
    g.lineWidth = 2.5;
    for (const x of [-12, 0, 12]) {
      g.beginPath();
      g.moveTo(x, -38);
      g.quadraticCurveTo(x * 1.4, 0, x, 38);
      g.stroke();
    }
    for (const y of [-24, 24]) {
      g.beginPath();
      g.moveTo(-34, y);
      g.quadraticCurveTo(0, y + 4, 34, y);
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.stroke();
      g.lineWidth = 4;
      g.strokeStyle = '#8a8f9c';
      g.stroke();
    }
  },

  // ---- space station
  goo: (g) => {
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 36 + Math.sin(a * 3) * 6 + Math.sin(a * 5) * 3;
      g.lineTo(Math.cos(a) * r, 8 + Math.sin(a) * r * 0.6);
    }
    g.closePath();
    o(g, '#7cff6b');
    for (const [x, y, r] of [
      [-12, 2, 6],
      [10, 12, 4],
      [18, 0, 3],
    ] as const) {
      circle(g, x, y, r);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fill();
    }
  },
  alien: (g) => {
    legs(g, '#5fd94f', 22);
    ellipse(g, 0, 12, 18, 16);
    o(g, '#7cff6b');
    g.lineWidth = 3;
    g.strokeStyle = INK;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 8, -36);
      g.lineTo(s * 16, -50);
      g.stroke();
      circle(g, s * 16, -50, 4);
      o(g, '#ffd23f', 2);
    }
    ellipse(g, 0, -20, 26, 20);
    o(g, '#7cff6b');
    for (const s of [-1, 1]) {
      ellipse(g, s * 11, -20, 8, 10, s * -0.4);
      o(g, '#1d1d24', 2);
      circle(g, s * 11 - 2, -24, 2.5);
      g.fillStyle = '#ffffff';
      g.fill();
    }
    g.beginPath();
    g.arc(0, -8, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
  },
  asteroid: (g) => {
    g.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const r = 34 + Math.sin(i * 2.7) * 8;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    o(g, '#8b8597');
    for (const [x, y, r] of [
      [-12, -10, 8],
      [14, 6, 6],
      [-4, 18, 5],
    ] as const) {
      circle(g, x, y, r);
      o(g, '#6d6879', 2.5);
    }
    shine(g, -16, -20, 10, 4, -0.6, 0.3);
  },
  robot: (g) => {
    ellipse(g, 0, 16, 44, 16);
    o(g, '#3b3b46');
    ellipse(g, 0, 6, 44, 18);
    o(g, '#d6dde6');
    ellipse(g, 0, 2, 28, 10);
    o(g, '#a3a8b5', 2.5);
    circle(g, 0, 0, 6);
    o(g, '#ff3d5a', 2);
    shine(g, -22, -2, 10, 3, 0, 0.6);
    g.lineWidth = 3;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(26, -6);
    g.lineTo(30, -26);
    g.stroke();
    circle(g, 30, -28, 4);
    o(g, '#7cff6b', 2);
  },
  vent: (g) => {
    circle(g, 0, 0, 42);
    o(g, '#8a8f9c');
    circle(g, 0, 0, 32);
    o(g, '#3b3b46', 3);
    g.strokeStyle = '#c4ccd8';
    g.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      g.quadraticCurveTo(Math.cos(a + 0.6) * 22, Math.sin(a + 0.6) * 22, Math.cos(a + 0.9) * 30, Math.sin(a + 0.9) * 30);
      g.stroke();
    }
  },

  // ---- jungle temple
  mud: (g) => {
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 38 + Math.sin(a * 4) * 5;
      g.lineTo(Math.cos(a) * r, 8 + Math.sin(a) * r * 0.6);
    }
    g.closePath();
    o(g, '#8a5a32');
    for (const [x, y, r] of [
      [-14, 4, 6],
      [12, 14, 5],
    ] as const) {
      circle(g, x, y, r);
      o(g, '#6b4022', 2);
    }
  },
  monkey: (g) => {
    legs(g, '#8a5a32', 22);
    g.beginPath();
    g.moveTo(20, 18);
    g.bezierCurveTo(46, 20, 44, -10, 34, -12);
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#8a5a32';
    g.stroke();
    ellipse(g, 4, 10, 20, 18);
    o(g, '#8a5a32');
    for (const s of [-1, 1]) {
      circle(g, -4 + s * 20, -22, 9);
      o(g, '#d9a066', 3);
    }
    circle(g, -4, -20, 20);
    o(g, '#8a5a32');
    ellipse(g, -8, -14, 14, 11);
    o(g, '#e8c49a', 2.5);
    eyes(g, -6, -26, 7, 5, -1.5);
    g.beginPath();
    g.arc(-8, -12, 5, 0.1 * Math.PI, 0.9 * Math.PI);
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
    // banana
    g.beginPath();
    g.moveTo(-30, 0);
    g.quadraticCurveTo(-40, 14, -26, 22);
    g.quadraticCurveTo(-32, 12, -24, 2);
    g.closePath();
    o(g, '#ffe14d', 2.5);
  },
  coconut: (g) => {
    circle(g, 0, 4, 38);
    o(g, '#7a4a2a');
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-30 + i * 10, -24);
      g.quadraticCurveTo(-26 + i * 10, 4, -30 + i * 12, 34);
      g.stroke();
    }
    g.fillStyle = INK;
    for (const [x, y] of [
      [-8, -12],
      [8, -12],
      [0, 0],
    ] as const) {
      circle(g, x, y, 4);
      g.fill();
    }
  },
  boulder: (g) => {
    g.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 38 + Math.sin(i * 1.9) * 5;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    o(g, '#9a8f80');
    g.strokeStyle = 'rgba(43,26,18,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-20, -18);
    g.lineTo(-4, -2);
    g.lineTo(-10, 16);
    g.moveTo(10, -26);
    g.lineTo(18, -6);
    g.stroke();
    ellipse(g, 16, 18, 10, 6, 0.4);
    g.fillStyle = '#5fae3a';
    g.fill();
    shine(g, -16, -22, 10, 4, -0.5, 0.3);
  },

  // ---- arctic lodge
  ice: (g) => {
    g.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 38 + Math.sin(i * 2.3) * 6;
      g.lineTo(Math.cos(a) * r, 8 + Math.sin(a) * r * 0.6);
    }
    g.closePath();
    o(g, '#c9efff');
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-20, 4);
    g.lineTo(-6, 12);
    g.lineTo(10, 2);
    g.moveTo(-6, 12);
    g.lineTo(-2, 24);
    g.stroke();
  },
  penguin: (g) => {
    legs(g, '#ffb02e', 26);
    ellipse(g, 0, 4, 24, 32);
    o(g, '#2b2b40');
    ellipse(g, -6, 10, 15, 24);
    g.fillStyle = '#ffffff';
    g.fill();
    ellipse(g, 16, 8, 7, 18, -0.3);
    o(g, '#2b2b40', 3);
    eyes(g, -10, -14, 6, 4, -1.5);
    g.beginPath();
    g.moveTo(-20, -6);
    g.lineTo(-32, -2);
    g.lineTo(-20, 2);
    g.closePath();
    o(g, '#ffb02e', 2.5);
    // little scarf
    roundRect(g, -20, -2, 34, 7, 3);
    o(g, '#ff3d5a', 2);
  },
  snowball: (g) => {
    circle(g, 0, 4, 38);
    o(g, '#ffffff');
    g.fillStyle = 'rgba(160,200,230,0.45)';
    circle(g, 8, 14, 26);
    g.fill();
    for (const [x, y] of [
      [-14, -12],
      [10, -20],
      [-20, 12],
    ] as const) {
      circle(g, x, y, 3);
      g.fillStyle = 'rgba(160,200,230,0.8)';
      g.fill();
    }
  },
  snowman: (g) => {
    circle(g, 0, 20, 24);
    o(g, '#ffffff');
    circle(g, 0, -16, 17);
    o(g, '#ffffff');
    roundRect(g, -14, -42, 28, 12, 3);
    o(g, '#2b2b33', 3);
    roundRect(g, -10, -56, 20, 16, 3);
    o(g, '#2b2b33', 3);
    eyes(g, 0, -18, 6, 2.5);
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(-16, -9);
    g.lineTo(0, -8);
    g.closePath();
    o(g, '#ff9a2e', 2);
    roundRect(g, -16, -4, 32, 7, 3);
    o(g, '#ff3d5a', 2);
    g.fillStyle = INK;
    for (const y of [12, 22, 32]) {
      circle(g, 0, y, 2.5);
      g.fill();
    }
  },
};

// ---------------------------------------------------------------- sprites

const SPRITE = 160;
const cache = new Map<string, HTMLCanvasElement | null>();
const urls = new Map<string, string>();

export function hasIcon(name: string): boolean {
  return name in DRAW;
}

/** The icon rendered once into an offscreen canvas (null if there's no such icon). */
export function iconSprite(name: string): HTMLCanvasElement | null {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const draw = DRAW[name];
  if (!draw || typeof document === 'undefined') {
    cache.set(name, null);
    return null;
  }
  const c = document.createElement('canvas');
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext('2d');
  if (!g) {
    cache.set(name, null);
    return null;
  }
  g.translate(SPRITE / 2, SPRITE / 2);
  g.scale(SPRITE / 100, SPRITE / 100);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  cache.set(name, c);
  return c;
}

/** Draw an icon centred at (x, y), about `size` units across. */
export function icon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number) {
  const s = iconSprite(name);
  if (!s) return;
  const d = size * 1.15;
  ctx.drawImage(s, x - d / 2, y - d / 2, d, d);
}

/** A PNG data URL of the icon, for <img> tags. */
export function iconUrl(name: string): string | null {
  const hit = urls.get(name);
  if (hit) return hit;
  const s = iconSprite(name);
  if (!s) return null;
  const url = s.toDataURL('image/png');
  urls.set(name, url);
  return url;
}
