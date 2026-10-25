/**
 * 3D emoji art (Microsoft Fluent Emoji, MIT licensed) instead of the device's emoji font,
 * so every phone and TV shows the same glossy little models. Anything without a model,
 * or that fails to load (offline), falls back to the normal emoji character.
 */

/** emoji character -> Fluent asset folder name (all checked to exist). */
const NAMES: Record<string, string> = {
  '☄️': 'Comet',
  '⚙️': 'Gear',
  '⚠️': 'Warning',
  '⚡': 'High voltage',
  '⭐': 'Star',
  '🌮': 'Taco',
  '🌯': 'Burrito',
  '🍄': 'Mushroom',
  '🍅': 'Tomato',
  '🍊': 'Tangerine',
  '🍋': 'Lemon',
  '🍎': 'Red apple',
  '🍓': 'Strawberry',
  '🍔': 'Hamburger',
  '🍕': 'Pizza',
  '🍗': 'Poultry leg',
  '🍛': 'Curry rice',
  '🍝': 'Spaghetti',
  '🍞': 'Bread',
  '🍦': 'Soft ice cream',
  '🍪': 'Cookie',
  '🍫': 'Chocolate bar',
  '🍲': 'Pot of food',
  '🍳': 'Cooking',
  '🍽️': 'Fork and knife with plate',
  '🎂': 'Birthday cake',
  '🎯': 'Bullseye',
  '🐔': 'Chicken',
  '🐝': 'Honeybee',
  '🐟': 'Fish',
  '👑': 'Crown',
  '💦': 'Sweat droplets',
  '💧': 'Droplet',
  '💫': 'Dizzy',
  '📱': 'Mobile phone',
  '🔔': 'Bell',
  '🔥': 'Fire',
  '🔪': 'Kitchen knife',
  '🚨': 'Police car light',
  '🥄': 'Spoon',
  '🥇': '1st place medal',
  '🥈': '2nd place medal',
  '🥉': '3rd place medal',
  '🥓': 'Bacon',
  '🥕': 'Carrot',
  '🥗': 'Green salad',
  '🥚': 'Egg',
  '🥛': 'Glass of milk',
  '🥞': 'Pancakes',
  '🥣': 'Bowl with spoon',
  '🥩': 'Cut of meat',
  '🥪': 'Sandwich',
  '🥫': 'Canned food',
  '🥬': 'Leafy green',
  '🧀': 'Cheese wedge',
  '🧁': 'Cupcake',
  '🧃': 'Beverage box',
  '🧅': 'Onion',
  '🧈': 'Butter',
  '🪶': 'Feather',
  '🫓': 'Flatbread',
  '✔': 'Check mark',
  '🧯': 'Fire extinguisher',
  '🧽': 'Sponge',
};

const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';

/** URL of the 3D model for an emoji, or null if there isn't one. */
export function emojiUrl(ch: string): string | null {
  if (ch === '🧑‍🍳') return `${BASE}/Cook/Default/3D/cook_3d_default.png`;
  const name = NAMES[ch] ?? NAMES[ch.replace(/️/g, '')] ?? NAMES[`${ch}️`];
  if (!name) return null;
  return `${BASE}/${encodeURIComponent(name)}/3D/${name.toLowerCase().replace(/ /g, '_')}_3d.png`;
}

type Entry = { img: HTMLImageElement; ok: boolean; failed: boolean };
const cache = new Map<string, Entry>();

/**
 * The loaded image for an emoji, ready to draw on a canvas, or null if it isn't
 * loaded yet / has no model / failed (draw the character instead). First call starts loading.
 */
export function emojiImage(ch: string): HTMLImageElement | null {
  let e = cache.get(ch);
  if (!e) {
    const url = emojiUrl(ch);
    const img = new Image();
    e = { img, ok: false, failed: !url };
    cache.set(ch, e);
    if (url) {
      const entry = e;
      img.decoding = 'async';
      img.onload = () => (entry.ok = true);
      img.onerror = () => (entry.failed = true);
      img.src = url;
    }
  }
  return e.ok ? e.img : null;
}

/** Warm the cache so the first frame of a round already has the models. */
export function preloadEmoji(chars: Iterable<string>) {
  for (const ch of chars) emojiImage(ch);
}

/** Split text into plain runs and emoji (so DOM labels can swap emoji for models). */
const SPLIT_RE = /(\u{1F9D1}‍\u{1F373}|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]️?)/u;
export function splitEmoji(text: string): { text: string; emoji: boolean }[] {
  // With a capture group, split() puts the separators (the emoji) at the odd indexes.
  return text
    .split(SPLIT_RE)
    .map((s, i) => ({ text: s, emoji: i % 2 === 1 && emojiUrl(s) !== null }))
    .filter((p) => p.text.length > 0);
}
