import type { MapId } from '@tilt-mayhem/shared';
import { circle, ellipse, INK, outlined, roundRect, shade, shine } from './draw';

/**
 * Map outfits: every chef gets dressed for the map they're on (the chef hat always stays).
 *  - pirate: striped shirt, red neckerchief, gold earring and a parrot on the shoulder
 *  - space: clear astronaut helmet over head and hat, collar ring, chest controls, white gloves
 *  - jungle: khaki explorer vest with pockets, a flower lei and a leaf in the hat band
 *  - arctic: puffy quilted coat with a fur-trimmed hood, a striped scarf, mittens and earmuffs
 *
 * The chef is one round blob (face on the top half, apron on the bottom). Coordinates match
 * drawChef: body centre (0, bodyY), radius R; the hat band sits at hatY.
 */

type G = CanvasRenderingContext2D;
type Look = 'kitchen' | 'pirate' | 'space' | 'jungle' | 'arctic';
export const outfitLook = (map: MapId | undefined): Look => (map === 'pirate2' ? 'pirate' : map ?? 'kitchen');

/** Colour of the hands (gloves, mittens...). */
export function handColor(look: Look, color: string): string {
  if (look === 'space') return '#f2f5fa';
  if (look === 'arctic') return shade(color, -0.12);
  return '#ffe0c7';
}

/** Before the apron: patterns on the shirt itself. */
export function drawOutfitUnder(ctx: G, look: Look, bodyY: number, R: number) {
  if (look !== 'pirate') return;
  ctx.save();
  ellipse(ctx, 0, bodyY, R - 1.5, R * 1.1 - 1.5);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let y = bodyY - 4; y < bodyY + R * 1.1; y += 7) ctx.fillRect(-R, y, R * 2, 3.2);
  ctx.restore();
}

/** After the apron: vests, coats, scarves, collars. `fx` leans things toward where the chef faces. */
export function drawOutfitOver(ctx: G, look: Look, color: string, bodyY: number, R: number, fx: number, front: boolean) {
  const nx = fx * 3;
  switch (look) {
    case 'pirate': {
      if (!front) return;
      // red neckerchief knotted at the front
      ctx.beginPath();
      ctx.moveTo(nx - 11, bodyY + 1);
      ctx.quadraticCurveTo(nx, bodyY + 5, nx + 11, bodyY + 1);
      ctx.lineTo(nx, bodyY + 12);
      ctx.closePath();
      outlined(ctx, '#e8303f', 2);
      circle(ctx, nx, bodyY + 3, 2.6);
      outlined(ctx, '#b3263a', 1.5);
      break;
    }
    case 'space': {
      // chest control box with a couple of lights
      if (front) {
        roundRect(ctx, nx - 7, bodyY + 6, 14, 9, 2);
        outlined(ctx, '#c4ccd8', 1.8);
        ctx.fillStyle = '#ff3d5a';
        ctx.fillRect(nx - 4, bodyY + 9, 3, 3);
        ctx.fillStyle = '#7cff6b';
        ctx.fillRect(nx + 1, bodyY + 9, 3, 3);
      }
      break;
    }
    case 'jungle': {
      // khaki vest panels on both sides of the apron, with pockets
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 8 + nx, bodyY - 2);
        ctx.quadraticCurveTo(s * (R + 1), bodyY - 4, s * (R - 2), bodyY + 14);
        ctx.quadraticCurveTo(s * 14, bodyY + 22, s * 9 + nx, bodyY + 18);
        ctx.closePath();
        outlined(ctx, '#c9a96b', 2);
        roundRect(ctx, s * 15 - 4 + nx * 0.3, bodyY + 6, 8, 6, 1.5);
        outlined(ctx, '#b8955a', 1.4);
      }
      if (front) {
        // flower lei round the neck
        const cols = ['#ff3d7f', '#ffd23f', '#ff8a3d', '#b26bff', '#ff3d7f', '#ffd23f'];
        cols.forEach((c, i) => {
          const a = Math.PI * (0.15 + (i / (cols.length - 1)) * 0.7);
          circle(ctx, nx + Math.cos(a) * 13, bodyY - 1 + Math.sin(a) * 5, 3.4);
          outlined(ctx, c, 1.3);
        });
      }
      break;
    }
    case 'arctic': {
      // puffy coat over the lower half, quilted, zipped up the middle
      const coat = shade(color, -0.04);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-R * 1.4, bodyY + 1, R * 2.8, R * 2);
      ctx.clip();
      ellipse(ctx, 0, bodyY + 1, R * 1.1, R * 1.16);
      outlined(ctx, coat, 3.5);
      ctx.strokeStyle = 'rgba(43,26,18,0.25)';
      ctx.lineWidth = 2;
      for (const dy of [9, 17]) {
        ctx.beginPath();
        ctx.ellipse(0, bodyY + dy - 14, R * 1.05, 14, 0, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
      if (front) {
        ctx.beginPath();
        ctx.moveTo(nx, bodyY + 4);
        ctx.lineTo(nx, bodyY + R * 1.05);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#c4ccd8';
        ctx.stroke();
      }
      // fur-trimmed hood framing the face
      ctx.beginPath();
      ctx.arc(0, bodyY, R + 1, Math.PI * 1.02, Math.PI * 1.98);
      ctx.lineWidth = 9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fff6e8';
      ctx.stroke();
      // striped scarf with a tail
      roundRect(ctx, -R * 0.85, bodyY - 1, R * 1.7, 7, 3.5);
      outlined(ctx, '#ff3d5a', 2);
      ctx.fillStyle = '#ffffff';
      for (const x of [-10, 0, 10]) ctx.fillRect(x - 1.5, bodyY, 3, 5);
      roundRect(ctx, nx + 5, bodyY + 3, 7, 14, 3);
      outlined(ctx, '#ff3d5a', 1.8);
      break;
    }
    default:
      break;
  }
}

/** After the hat: helmets, earmuffs, the parrot. */
export function drawOutfitTop(ctx: G, look: Look, t: number, bodyY: number, R: number, fx: number, seed: number, front: boolean) {
  switch (look) {
    case 'pirate': {
      if (front) {
        // gold hoop earring
        ctx.beginPath();
        ctx.arc(fx * 7 + (fx >= 0 ? -15 : 15), bodyY - 1, 3, 0, Math.PI * 2);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#ffd23f';
        ctx.stroke();
      }
      // parrot on the shoulder, bobbing its head
      const bob = Math.sin(t * 3 + seed) * 1.5;
      const px = -R * 0.85;
      const py = bodyY - R * 0.75;
      ctx.save();
      ctx.translate(px, py + bob);
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.lineTo(10, 16);
      ctx.lineTo(4, 16);
      ctx.closePath();
      outlined(ctx, '#3d8bff', 1.5);
      ellipse(ctx, 0, 2, 6, 8);
      outlined(ctx, '#3fbf2f', 2);
      circle(ctx, -1, -7, 5.5);
      outlined(ctx, '#e8303f', 2);
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.quadraticCurveTo(-11, -6, -7, -3);
      ctx.closePath();
      outlined(ctx, '#ffd23f', 1.4);
      circle(ctx, -2, -8, 1.3);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'space': {
      // clear dome over head and hat, with a metal collar ring and a blinking tip light
      const cy = bodyY - 22;
      const r = 34;
      circle(ctx, 0, cy, r);
      ctx.fillStyle = 'rgba(190,230,255,0.22)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      circle(ctx, 0, cy, r - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, cy, r - 7, Math.PI * 1.15, Math.PI * 1.45);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.stroke();
      shine(ctx, 16, cy + 10, 4, 7, 0.4, 0.5);
      // collar ring where the dome meets the suit (just the rim, so the face stays visible)
      ellipse(ctx, 0, cy + r - 2, 25, 6);
      ctx.lineWidth = 7;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#c4ccd8';
      ctx.stroke();
      const on = Math.sin(t * 4 + seed) > 0;
      circle(ctx, 0, cy - r - 2, 3);
      outlined(ctx, on ? '#ff3d5a' : '#7a2b33', 1.5);
      break;
    }
    case 'jungle': {
      // a big leaf tucked in the hat band
      const hatY = bodyY - R * 1.1 + 2;
      ctx.save();
      ctx.translate(11, hatY - 6);
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(8, -6, 18, 0);
      ctx.quadraticCurveTo(8, 6, 0, 0);
      outlined(ctx, '#3fae2f', 1.8);
      ctx.restore();
      break;
    }
    case 'arctic': {
      if (!front) return;
      // fuzzy earmuffs on the sides of the hood
      for (const s of [-1, 1]) {
        circle(ctx, s * (R - 1), bodyY - 10, 6);
        outlined(ctx, '#ff8fb0', 2);
        circle(ctx, s * (R - 1) - 1.5, bodyY - 11.5, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
}
