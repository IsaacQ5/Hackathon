import type { MapId } from '@tilt-mayhem/shared';
import { circle, ellipse, INK, outlined, roundRect, shade, shine } from './draw';

/**
 * Map outfits: every chef gets dressed for the map they're on (the chef hat always stays).
 *  - pirate: striped shirt, red neckerchief, gold earring and a cutlass at the hip
 *  - space: clear bubble helmet round the face (chef hat on top), chest controls, white gloves
 *  - jungle: khaki explorer vest with pockets, a flower lei and a leaf in the hat band
 *  - arctic: puffy quilted coat with a fur-trimmed hood, a striped scarf and mittens
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
      drawCutlass(ctx, bodyY, R, fx);
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

/** After the hat: earring, leaf in the hat band. */
export function drawOutfitTop(ctx: G, look: Look, bodyY: number, R: number, fx: number, front: boolean) {
  switch (look) {
    case 'pirate': {
      if (!front) return;
      // gold hoop earring
      ctx.beginPath();
      ctx.arc(fx * 7 + (fx >= 0 ? -15 : 15), bodyY - 1, 3, 0, Math.PI * 2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
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
    default:
      break;
  }
}

/**
 * Space: a clear bubble helmet round the face only, drawn BEFORE the hat so the chef hat sits on
 * top of it. `fx` shifts it a little toward where the chef is looking, like the face.
 */
export function drawOutfitHelmet(ctx: G, look: Look, bodyY: number, fx: number) {
  if (look !== 'space') return;
  const cx = fx * 4;
  const cy = bodyY - 8;
  const r = 19;
  circle(ctx, cx, cy, r);
  ctx.fillStyle = 'rgba(190,230,255,0.25)';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, Math.PI * 1.1, Math.PI * 1.45);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  shine(ctx, cx + 10, cy + 7, 2.5, 4.5, 0.4, 0.55);
  // collar ring where the bubble meets the suit (just the rim, so the face stays visible)
  ctx.beginPath();
  ctx.ellipse(cx, cy + r - 3, 15, 4.5, 0, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#c4ccd8';
  ctx.stroke();
}

/** Pirate cutlass in its scabbard, hanging at the hip on the side away from where the chef faces. */
function drawCutlass(ctx: G, bodyY: number, R: number, fx: number) {
  const side = fx > 0.3 ? -1 : 1;
  ctx.save();
  ctx.translate(side * (R - 3), bodyY + 12);
  ctx.rotate(side * 0.45);
  // belt strap across the body
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(-side * R * 1.4, -16);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6b3e1f';
  ctx.stroke();
  // curved scabbard
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.quadraticCurveTo(side * 4, 10, side * 2, 19);
  ctx.lineTo(side * 7, 17);
  ctx.quadraticCurveTo(side * 9, 9, 3, 0);
  ctx.closePath();
  outlined(ctx, '#5c2a1a', 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-3, 2, 6, 2.5);
  // brass guard and grip sticking out the top
  ctx.beginPath();
  ctx.arc(0, -2, 5, Math.PI, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#ffd23f';
  ctx.stroke();
  roundRect(ctx, -2, -11, 4, 9, 2);
  outlined(ctx, '#3b3b46', 1.5);
  circle(ctx, 0, -12, 2.2);
  outlined(ctx, '#ffd23f', 1.2);
  ctx.restore();
}
