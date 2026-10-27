import { INK, outlined, roundRect } from './draw';
import { icon } from './icons';

const CREAM = '#fffaf2';

/** Mix a hex colour toward cream, like the phone's `color-mix(var(--c) 40%, cream)`. */
function tint(hex: string, amt: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(CREAM.slice(1), 16);
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * amt + ((b >> sh) & 255) * (1 - amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Station/serve sign: symbol + comic verb on a tinted tile with a hard ink shadow, centred at (0, y). */
export function drawSign(ctx: CanvasRenderingContext2D, iconName: string, verb: string, color: string, y: number) {
  ctx.font = '32px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif';
  const tw = ctx.measureText(verb).width;
  const w = tw + 76;
  const h = 54;
  roundRect(ctx, -w / 2 + 4, y - h / 2 + 4, w, h, 16);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, -w / 2, y - h / 2, w, h, 16);
  outlined(ctx, tint(color, 0.55), 4);
  icon(ctx, iconName, -w / 2 + 30, y + 1, 30);
  ctx.font = '32px Bangers, "Luckiest Guy", "Arial Black", Impact, system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(verb, -w / 2 + 54, y + 3);
}
