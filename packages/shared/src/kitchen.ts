/**
 * Sizzle Scramble: data-driven kitchen.
 *
 * Exactly six permanent stations. Each station produces exactly five
 * ingredient variants and has its own phone gesture. Recipes are plain data:
 * four ingredients from four DIFFERENT stations. Add a recipe by adding a row
 * to RECIPES; no station logic needs to change.
 */

import type { StuckKind } from './types.js';

export type StationId = 'chop' | 'fry' | 'stir' | 'knead' | 'mix' | 'juice';

export interface IngredientDef {
  id: string;
  name: string;
  icon: string;
}

export interface StationDef {
  id: StationId;
  name: string;
  /** Short verb shown as the station's symbol label. */
  verb: string;
  /** Symbol for the action (shown on phones + above the station). */
  icon: string;
  color: string;
  /** What the player does with the phone. */
  howTo: string;
  /** On-screen button taps needed to fill the meter (phones without motion). */
  reps: number;
  /**
   * With motion, the meter fills smoothly at a speed set by how accurate the motion is:
   * at 100% accuracy it takes this many ms; at 50% twice as long; below EFFORT.minAccuracy, never.
   */
  fillMs: number;
  /** Server-side minimum ms between counted gestures (anti-mash). */
  minRepMs: number;
  /** Progress lost on a messed-up gesture, in reps. */
  badPenalty: number;
  ingredients: readonly IngredientDef[];
}

export const STATIONS: readonly StationDef[] = [
  {
    id: 'chop',
    name: 'Chopping Board',
    verb: 'CHOP',
    icon: 'knife',
    color: '#7cd651',
    howTo: 'Hold your phone sideways like a knife and chop straight down.',
    reps: 8,
    fillMs: 2500,
    minRepMs: 140,
    badPenalty: 0,
    ingredients: [
      { id: 'lettuce', name: 'Chopped lettuce', icon: 'lettuce' },
      { id: 'tomato', name: 'Sliced tomato', icon: 'tomato' },
      { id: 'onion', name: 'Diced onion', icon: 'onion' },
      { id: 'mushroom', name: 'Sliced mushroom', icon: 'mushroom' },
      { id: 'carrot', name: 'Chopped carrot', icon: 'carrot' },
    ],
  },
  {
    id: 'fry',
    name: 'Frying Pan',
    verb: 'FLIP',
    icon: 'pan',
    color: '#ff8a3d',
    howTo: 'Hold your phone flat like a pan, then lift the top edge up to flip. Back to flat, and again!',
    reps: 5,
    fillMs: 3500,
    minRepMs: 250,
    badPenalty: 1,
    ingredients: [
      { id: 'patty', name: 'Burger patty', icon: 'patty' },
      { id: 'egg', name: 'Fried egg', icon: 'egg' },
      { id: 'bacon', name: 'Cooked bacon', icon: 'bacon' },
      { id: 'chicken', name: 'Grilled chicken', icon: 'chicken' },
      { id: 'fish', name: 'Cooked fish', icon: 'fish' },
    ],
  },
  {
    id: 'stir',
    name: 'Stirring Pot',
    verb: 'STIR',
    icon: 'pot',
    color: '#ff3d5a',
    howTo: 'Hold your phone flat and move it in big, full circles.',
    reps: 4,
    fillMs: 4500,
    minRepMs: 300,
    badPenalty: 0,
    ingredients: [
      { id: 'tomatosauce', name: 'Tomato sauce', icon: 'tomatosauce' },
      { id: 'cheesesauce', name: 'Cheese sauce', icon: 'cheesesauce' },
      { id: 'chocosauce', name: 'Chocolate sauce', icon: 'chocosauce' },
      { id: 'soupbase', name: 'Soup base', icon: 'soupbase' },
      { id: 'curry', name: 'Curry sauce', icon: 'curry' },
    ],
  },
  {
    id: 'knead',
    name: 'Dough Bench',
    verb: 'KNEAD',
    icon: 'rollingpin',
    color: '#e0a458',
    howTo: 'Push your phone forward and pull it back, over and over.',
    reps: 12,
    fillMs: 4500,
    minRepMs: 200,
    badPenalty: 0,
    ingredients: [
      { id: 'bread', name: 'Bread', icon: 'bread' },
      { id: 'bun', name: 'Burger bun', icon: 'bun' },
      { id: 'pizzadough', name: 'Pizza dough', icon: 'pizzadough' },
      { id: 'tortilla', name: 'Tortilla', icon: 'tortilla' },
      { id: 'sandwichbread', name: 'Sub roll', icon: 'sandwichbread' },
    ],
  },
  {
    id: 'mix',
    name: 'Mixing Bowl',
    verb: 'MIX',
    icon: 'whisk',
    color: '#b26bff',
    howTo: 'Shake your phone gently side to side, left-right-left-right.',
    reps: 12,
    fillMs: 3000,
    minRepMs: 90,
    badPenalty: 0,
    ingredients: [
      { id: 'pancake', name: 'Pancake batter', icon: 'pancake' },
      { id: 'omelette', name: 'Omelette mix', icon: 'omelette' },
      { id: 'cake', name: 'Cake batter', icon: 'cake' },
      { id: 'cookie', name: 'Cookie mixture', icon: 'cookie' },
      { id: 'cream', name: 'Cream filling', icon: 'cream' },
    ],
  },
  {
    id: 'juice',
    name: 'Juicer & Crusher',
    verb: 'POUR',
    icon: 'juicebox',
    color: '#ffd23f',
    howTo: 'Tilt your phone sideways and HOLD it there to pour. Keep pouring until the glass is full!',
    reps: 4,
    // One steady pour: held fully sideways it reads 80% (no "clean motion" bonus), so ~4 s to fill.
    fillMs: 3200,
    minRepMs: 350,
    badPenalty: 0,
    ingredients: [
      { id: 'orange', name: 'Orange juice', icon: 'orange' },
      { id: 'lemon', name: 'Lemon juice', icon: 'lemon' },
      { id: 'puree', name: 'Fruit purée', icon: 'puree' },
      { id: 'apple', name: 'Apple juice', icon: 'apple' },
      { id: 'water', name: 'Water', icon: 'water' },
    ],
  },
];

export const STATION_IDS: readonly StationId[] = STATIONS.map((s) => s.id);

export function stationById(id: StationId): StationDef {
  return STATIONS.find((s) => s.id === id)!;
}

/** ingredient id -> { station, ingredient } */
export const INGREDIENTS: ReadonlyMap<string, { station: StationId; ingredient: IngredientDef }> = new Map(
  STATIONS.flatMap((s) => s.ingredients.map((i) => [i.id, { station: s.id, ingredient: i }] as const)),
);

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  /** Exactly four ingredient ids, each from a different station. */
  ingredients: readonly [string, string, string, string];
}

export const RECIPES: readonly RecipeDef[] = [
  { id: 'burger', name: 'Cheeseburger', icon: 'dish-burger', ingredients: ['lettuce', 'patty', 'bun', 'cheesesauce'] },
  { id: 'breakfast', name: 'Big Breakfast', icon: 'dish-breakfast', ingredients: ['egg', 'bread', 'orange', 'pancake'] },
  { id: 'blt', name: 'BLT Melt', icon: 'dish-blt', ingredients: ['tomato', 'bacon', 'sandwichbread', 'cheesesauce'] },
  { id: 'chickenpizza', name: 'Chicken Pizza', icon: 'dish-chickenpizza', ingredients: ['pizzadough', 'tomatosauce', 'mushroom', 'chicken'] },
  { id: 'fishtacos', name: 'Fish Tacos', icon: 'dish-fishtacos', ingredients: ['tortilla', 'fish', 'onion', 'lemon'] },
  { id: 'curry', name: 'Chicken Curry', icon: 'dish-curry', ingredients: ['curry', 'chicken', 'onion', 'bread'] },
  { id: 'pasta', name: 'Meatball Pasta', icon: 'dish-pasta', ingredients: ['tomatosauce', 'mushroom', 'patty', 'water'] },
  { id: 'veggiesoup', name: 'Veggie Soup', icon: 'dish-veggiesoup', ingredients: ['soupbase', 'carrot', 'bread', 'water'] },
  { id: 'pancakes', name: 'Pancakes', icon: 'dish-pancakes', ingredients: ['pancake', 'puree', 'bacon', 'bread'] },
  { id: 'omelette', name: 'Omelette', icon: 'dish-omelette', ingredients: ['omelette', 'mushroom', 'cheesesauce', 'orange'] },
  { id: 'carrotcake', name: 'Carrot Cake', icon: 'dish-carrotcake', ingredients: ['cake', 'carrot', 'chocosauce', 'apple'] },
  { id: 'cookiepizza', name: 'Cookie Pizza', icon: 'dish-cookiepizza', ingredients: ['pizzadough', 'cookie', 'chocosauce', 'puree'] },
  { id: 'creambuns', name: 'Cream Buns', icon: 'dish-creambuns', ingredients: ['bun', 'cream', 'chocosauce', 'puree'] },
  { id: 'burrito', name: 'Burrito', icon: 'dish-burrito', ingredients: ['tortilla', 'egg', 'onion', 'cheesesauce'] },
  { id: 'chickensandwich', name: 'Chicken Sub', icon: 'dish-chickensandwich', ingredients: ['sandwichbread', 'chicken', 'lettuce', 'lemon'] },
  { id: 'chowder', name: 'Chowder', icon: 'dish-chowder', ingredients: ['fish', 'soupbase', 'onion', 'bread'] },
  { id: 'caesar', name: 'Caesar Salad', icon: 'dish-caesar', ingredients: ['lettuce', 'chicken', 'lemon', 'bread'] },
  { id: 'tomatosoup', name: 'Tomato Soup', icon: 'dish-tomatosoup', ingredients: ['tomatosauce', 'tomato', 'sandwichbread', 'water'] },
  { id: 'burgerpizza', name: 'Burger Pizza', icon: 'dish-burgerpizza', ingredients: ['pizzadough', 'cheesesauce', 'patty', 'onion'] },
  { id: 'currywrap', name: 'Curry Wrap', icon: 'dish-currywrap', ingredients: ['tortilla', 'curry', 'carrot', 'puree'] },
];

export function recipeById(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** The station each ingredient of a recipe comes from, in recipe order. */
export function recipeSteps(r: RecipeDef): { station: StationId; ingredient: IngredientDef }[] {
  return r.ingredients.map((id) => INGREDIENTS.get(id)!);
}

/** Returns a list of problems; empty = all recipes are valid. */
export function validateRecipes(recipes: readonly RecipeDef[] = RECIPES): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const r of recipes) {
    if (ids.has(r.id)) problems.push(`${r.id}: duplicate id`);
    ids.add(r.id);
    if (r.ingredients.length !== 4) problems.push(`${r.id}: needs exactly 4 ingredients`);
    const stations = new Set<StationId>();
    for (const ing of r.ingredients) {
      const found = INGREDIENTS.get(ing);
      if (!found) problems.push(`${r.id}: unknown ingredient ${ing}`);
      else stations.add(found.station);
    }
    if (stations.size !== r.ingredients.length) problems.push(`${r.id}: two ingredients from the same station`);
  }
  return problems;
}

// ------------------------------------------------------------------ chef looks

/** Face cosmetics a chef can pick in the lobby. 'plain' (no extras) is the default. The hat always stays on. */
export const CHEF_FACES = ['plain', 'handlebar', 'beard', 'goatee', 'shades', 'glasses', 'eyepatch', 'blush'] as const;
export type ChefFace = (typeof CHEF_FACES)[number];

export const FACE_NAMES: Record<ChefFace, string> = {
  plain: 'Plain',
  handlebar: 'Handlebar',
  beard: 'Big Beard',
  goatee: 'Goatee',
  shades: 'Shades',
  glasses: 'Specs',
  eyepatch: 'Pirate',
  blush: 'Rosy',
};

export function isChefFace(v: unknown): v is ChefFace {
  return typeof v === 'string' && (CHEF_FACES as readonly string[]).includes(v);
}

// ------------------------------------------------------------------ map layout (world 1000 x 600)

export interface StationSpot {
  id: StationId;
  /** Where the station is drawn (on the counter). */
  x: number;
  y: number;
  /** Where a chef stands to use it. */
  fx: number;
  fy: number;
}

export const KITCHEN = {
  floor: { x0: 60, x1: 940, y0: 132, y1: 468 },
  pass: { x: 500, y: 300, r: 58, serveR: 125 },
  /** The diner seated at the far side of the serve table: solid, like the table. */
  customer: { x: 500, y: 222, r: 30 },
  interactR: 85,
  chefR: 22,
  spots: [
    { id: 'chop', x: 200, y: 78, fx: 200, fy: 162 },
    { id: 'fry', x: 500, y: 78, fx: 500, fy: 162 },
    { id: 'stir', x: 800, y: 78, fx: 800, fy: 162 },
    { id: 'knead', x: 200, y: 522, fx: 200, fy: 438 },
    { id: 'mix', x: 500, y: 522, fx: 500, fy: 438 },
    { id: 'juice', x: 800, y: 522, fx: 800, fy: 438 },
  ] as readonly StationSpot[],
} as const;

// ------------------------------------------------------------------ kitchen chaos

/**
 * Environmental hazards. They start tame and ramp up as the shift goes on:
 * `unlockAt` is the fraction of the shift that must have passed before a kind can appear.
 */
export const HAZARDS = {
  /** Time between hazards at the start / end of the shift (ms), before the chaos level (CHAOS) scales it. */
  intervalStartMs: 20_000,
  intervalEndMs: 9_000,
  warnMs: 2_500,
  spill: { r: 34, unlockAt: 0, weight: 3 },
  chicken: { r: 20, unlockAt: 0.3, weight: 2, speed: 170, lifeMs: 12_000 },
  fire: { unlockAt: 0.35, weight: 2 },
  meteor: { r: 58, unlockAt: 0.5, weight: 4, landedMs: 1_500 },
  cheese: { r: 30, unlockAt: 0.6, weight: 2, speed: 480 },
  /** Themed maps only (see MAPS): everyone walking slides sideways at `speed` for `activeMs`. */
  gust: { unlockAt: 0.22, weight: 2, speed: 150, activeMs: 3_000 },
} as const;

export interface StuckDef {
  title: string;
  /** What happened + what to do, shown full-screen on the phone. */
  howTo: string;
  /** The station gesture used to recover (reuses that station's motion detector). */
  gesture: StationId;
  /** On-screen button taps needed to recover (phones without motion). */
  reps: number;
  /** With motion, recovery fills by accuracy like a station: this many ms at 100% accuracy. */
  fillMs: number;
  icon: string;
}

export const STUCK: Record<StuckKind, StuckDef> = {
  slip: {
    title: 'You slipped in a spill!',
    howTo: 'WIPE IT UP: hold your phone flat and scrub in big circles. Your chef rubs the puddle away with a cloth.',
    gesture: 'stir',
    reps: 3,
    fillMs: 4500,
    icon: 'splash',
  },
  bonk: {
    title: 'BONK! You got knocked down!',
    howTo: 'GET UP: lift your phone up and down, like pushing yourself off the floor.',
    gesture: 'chop',
    reps: 5,
    fillMs: 3500,
    icon: 'dizzy',
  },
  feathers: {
    title: 'The chicken got you! Feathers everywhere!',
    howTo: 'SHAKE THEM OFF: push your phone forward and pull it back, fast.',
    gesture: 'knead',
    reps: 6,
    fillMs: 3500,
    icon: 'feather',
  },
  fire: {
    title: 'This station is on fire!',
    howTo: 'PUT IT OUT: sweep your phone side to side to spray the fire extinguisher back and forth.',
    gesture: 'mix',
    reps: 10,
    fillMs: 5000,
    icon: 'extinguisher',
  },
};

/** Shoving: shake your phone hard next to another chef. */
export const PUSH = {
  /** Max distance between chef centres ("right next to" each other). */
  range: 78,
  cooldownMs: 5_000,
  /** Starting speed of the shove; it bleeds off quickly so they slide ~2 chef widths and stop. */
  speed: 640,
  /** How long the shoved chef can't steer. */
  knockMs: 260,
} as const;

/**
 * Accuracy-based cooking: while working with motion, the phone sends how accurate the motion is
 * (0..1) about `sendHz` times a second; the server fills the meter by accuracy x time / fillMs.
 * The server measures the time itself (capped at `maxGapMs` per message), so sending faster
 * can't fill it faster.
 */
export const EFFORT = {
  /** Below this accuracy the meter doesn't move (no progress for holding still / wrong motions). */
  minAccuracy: 0.2,
  maxGapMs: 250,
  sendHz: 10,
} as const;

export const SCORING = {
  recipe: 100,
  /** Bonus when a dish is served within these ms of getting the ticket. */
  fastMs: 35_000,
  fastBonus: 50,
  quickMs: 60_000,
  quickBonus: 25,
  /** The last stretch of the round doubles points. */
  rushMs: 30_000,
} as const;
