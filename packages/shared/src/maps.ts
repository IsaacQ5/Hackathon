/**
 * Maps and chaos levels (both picked between shifts by the head chef or the host screen).
 *
 * Every map has the same six stations in the same places; each themed map adds its own layout
 * twist on top (Overcooked style): the pirate ship's cargo hold, gangplanks and trapdoors, the
 * space station's moving walkways and teleporters, the jungle's pillars and mud, the arctic's
 * frozen ponds. Hazards keep their rules on every map
 * but get a themed skin (on the pirate ship the meteor is a cannonball, the loose chicken is a
 * pirate...). The themed maps also have `gust`, that slides every walking chef sideways, and
 * every map has one `special` event of its own (sprinklers, the kraken, zero gravity...).
 */

import { KITCHEN, type StationSpot } from './kitchen.js';
import type { HazardKind, StuckKind } from './types.js';

export const MAP_IDS = ['kitchen', 'pirate', 'space', 'jungle', 'arctic'] as const;
export type MapId = (typeof MAP_IDS)[number];

export function isMapId(v: unknown): v is MapId {
  return typeof v === 'string' && (MAP_IDS as readonly string[]).includes(v);
}

export interface HazardSkin {
  /** Shown on the big screen when it appears. */
  banner: string;
  /** Short warning painted on the floor (lanes, targets). */
  warn: string;
  /** Icon key (drawn by the web app's icon set). */
  icon: string;
}

export interface StuckText {
  title: string;
  howTo: string;
  /** Word popped over the chef on the TV when it happens. */
  word: string;
}

/** Where everything is. World is 1000 x 600; chefs walk inside `floor`. */
export interface Layout {
  floor: { x0: number; x1: number; y0: number; y1: number };
  /** The serve table (solid) and the zone around it where SERVE works. */
  pass: { x: number; y: number; r: number; serveR: number };
  /** The diner sitting at the far side of the serve table (solid). */
  customer: { x: number; y: number; r: number };
  spots: readonly StationSpot[];
  /** Rows the rolling hazard (cheese wheel, barrel...) can come down. */
  lanes: readonly number[];
  /** Solid areas inside the floor nobody can walk into (holes, crates). */
  walls?: readonly { x0: number; y0: number; x1: number; y1: number }[];
  /** Solid round posts (masts, pillars). */
  posts?: readonly { x: number; y: number; r: number }[];
  /** Two trapdoors / teleporters: step on one and you pop out of the other. */
  hatches?: readonly [{ x: number; y: number; r: number }, { x: number; y: number; r: number }];
  /** Floor areas that change how you move (see Zone). */
  zones?: readonly Zone[];
  /** Where chefs appear (defaults to around the serve table). */
  spawn?: { x: number; y: number };
  /** Lobby only: stand here to change your look. */
  dressing?: { x: number; y: number; r: number };
}

/**
 * belt: a moving walkway / current, carries anyone walking on it at (vx, vy) per second.
 * mud: wade through it slowly. ice: skate across it (faster, but hard to steer or stop).
 */
export interface Zone {
  kind: 'belt' | 'mud' | 'ice';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  vx?: number;
  vy?: number;
}

/** How mud and ice change your feet (top-speed multiplier, grip). */
export const ZONE_FOOTING = {
  mud: { speed: 0.5 },
  ice: { speed: 1.15, grip: 1.5 },
} as const;

export const CLASSIC_LAYOUT: Layout = {
  floor: KITCHEN.floor,
  pass: KITCHEN.pass,
  customer: KITCHEN.customer,
  spots: KITCHEN.spots,
  lanes: [KITCHEN.floor.y0 + 32, KITCHEN.floor.y1 - 32],
};

/**
 * Pirate Galley: an open cargo hold splits the deck into a top half (chop, fry, stir) and a bottom
 * half (knead, mix, juice). Every recipe needs both halves, so you keep crossing: over one of the
 * two narrow gangplanks at the ends, or squeezing past the captain's table on the middle bridge.
 * Two masts get in the way, and two trapdoors in opposite corners are a shortcut between decks.
 */
export const PIRATE_LAYOUT: Layout = {
  ...CLASSIC_LAYOUT,
  walls: [
    { x0: 60, y0: 262, x1: 118, y1: 338 },
    { x0: 182, y0: 262, x1: 382, y1: 338 },
    { x0: 618, y0: 262, x1: 818, y1: 338 },
    { x0: 882, y0: 262, x1: 940, y1: 338 },
  ],
  posts: [
    { x: 300, y: 197, r: 16 },
    { x: 700, y: 403, r: 16 },
  ],
  hatches: [
    { x: 92, y: 172, r: 22 },
    { x: 908, y: 428, r: 22 },
  ],
};

/**
 * Space Station: two moving walkways run in opposite directions across the deck (ride them, or
 * fight them), and a pair of teleporter pads on the far left and right zap you across.
 */
export const SPACE_LAYOUT: Layout = {
  ...CLASSIC_LAYOUT,
  zones: [
    { kind: 'belt', x0: 240, y0: 200, x1: 760, y1: 244, vx: 120, vy: 0 },
    { kind: 'belt', x0: 240, y0: 356, x1: 760, y1: 400, vx: -120, vy: 0 },
  ],
  hatches: [
    { x: 100, y: 300, r: 24 },
    { x: 900, y: 300, r: 24 },
  ],
};

/** Jungle Temple: crumbling stone pillars to weave between, and two mud bogs that slow you to a wade. */
export const JUNGLE_LAYOUT: Layout = {
  ...CLASSIC_LAYOUT,
  posts: [
    { x: 330, y: 228, r: 18 },
    { x: 670, y: 228, r: 18 },
    { x: 330, y: 372, r: 18 },
    { x: 670, y: 372, r: 18 },
  ],
  zones: [
    { kind: 'mud', x0: 96, y0: 250, x1: 236, y1: 350 },
    { kind: 'mud', x0: 764, y0: 250, x1: 904, y1: 350 },
  ],
};

/** Arctic Lodge: two frozen ponds to skate across (fast, slippery) and a couple of snowmen in the way. */
export const ARCTIC_LAYOUT: Layout = {
  ...CLASSIC_LAYOUT,
  zones: [
    { kind: 'ice', x0: 150, y0: 214, x1: 360, y1: 386 },
    { kind: 'ice', x0: 640, y0: 214, x1: 850, y1: 386 },
  ],
  posts: [
    { x: 110, y: 196, r: 18 },
    { x: 890, y: 404, r: 18 },
  ],
};

/**
 * The lobby apartment (PlateUp style): chefs walk around before the first shift. A kitchenette
 * on the left has all six stations to practise on; the living room on the right has a wardrobe
 * (stand on its rug to change your look), a couch and a coffee table.
 */
export const LOBBY_LAYOUT: Layout = {
  floor: KITCHEN.floor,
  // the coffee table: solid, nothing to serve
  pass: { x: 790, y: 330, r: 0, serveR: 0 },
  customer: { x: 790, y: 330, r: 0 },
  spots: [
    { id: 'chop', x: 150, y: 78, fx: 150, fy: 162, face: 'down' },
    { id: 'fry', x: 330, y: 78, fx: 330, fy: 162, face: 'down' },
    { id: 'stir', x: 510, y: 78, fx: 510, fy: 162, face: 'down' },
    { id: 'knead', x: 150, y: 522, fx: 150, fy: 438, face: 'up' },
    { id: 'mix', x: 330, y: 522, fx: 330, fy: 438, face: 'up' },
    { id: 'juice', x: 510, y: 522, fx: 510, fy: 438, face: 'up' },
  ],
  lanes: [],
  walls: [{ x0: 700, y0: 418, x1: 880, y1: 468 }],
  posts: [{ x: 790, y: 330, r: 30 }],
  spawn: { x: 560, y: 300 },
  dressing: { x: 830, y: 186, r: 46 },
};

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  icon: string;
  /** Page colour around the kitchen on the big screen. */
  backdrop: string;
  /** Themed maps have the sideways `gust` event; the classic kitchen doesn't. */
  gust: boolean;
  /** This map's very own event. */
  special: HazardKind;
  layout: Layout;
  hazards: Record<HazardKind, HazardSkin>;
  stuck: Record<StuckKind, StuckText>;
  /** Comic words for a meteor landing / the rolling thing starting. */
  impact: { meteor: string; cheese: string };
}

/** Skins for the special events (each map only ever spawns its own). */
const SPECIAL_SKINS: Pick<Record<HazardKind, HazardSkin>, 'sprinkler' | 'kraken' | 'lowgrav' | 'quicksand' | 'freeze'> = {
  sprinkler: { banner: 'THE SPRINKLERS WENT OFF! EVERYTHING IS SOAKED!', warn: 'SPRINKLERS!', icon: 'sprinkler' },
  kraken: { banner: 'THE KRAKEN IS ATTACKING! DODGE THE TENTACLE!', warn: 'KRAKEN!', icon: 'tentacle' },
  lowgrav: { banner: 'GRAVITY FAILURE! EVERYONE IS FLOATING!', warn: 'ZERO-G!', icon: 'planet' },
  quicksand: { banner: 'QUICKSAND! DON’T WADE IN!', warn: 'QUICKSAND', icon: 'quicksand' },
  freeze: { banner: 'FLASH FREEZE! THE FLOOR IS AN ICE RINK!', warn: 'ICE RINK!', icon: 'snowflake' },
};

const FIRE_STUCK: StuckText = {
  title: 'This station is on fire!',
  howTo: 'PUT IT OUT: sweep your phone side to side to spray the fire extinguisher back and forth.',
  word: 'SPRAY IT!',
};

export const MAPS: Record<MapId, MapDef> = {
  kitchen: {
    id: 'kitchen',
    special: 'sprinkler',
    layout: CLASSIC_LAYOUT,
    name: 'Classic Kitchen',
    blurb: 'The original diner kitchen. Spills, chickens and meatball meteors.',
    icon: 'chefhat',
    backdrop: '#ff9f45',
    gust: false,
    hazards: {
      ...SPECIAL_SKINS,
      spill: { banner: 'SPILL ON THE FLOOR! DON’T SLIP!', warn: 'WET FLOOR', icon: 'splash' },
      chicken: { banner: 'A CHICKEN GOT LOOSE!', warn: 'BAWK!', icon: 'hen' },
      fire: { banner: 'FIRE AT THE', warn: 'FIRE!', icon: 'fire' },
      meteor: { banner: 'MEATBALL INCOMING! MOVE!', warn: '!', icon: 'meatball' },
      cheese: { banner: 'RUNAWAY CHEESE WHEEL! CLEAR THE LANE!', warn: 'CHEESE WHEEL!', icon: 'cheese' },
      gust: { banner: 'BIG DRAFT!', warn: 'WIND!', icon: 'wind' },
    },
    stuck: {
      slip: {
        title: 'You slipped in a spill!',
        howTo: 'WIPE IT UP: hold your phone flat and scrub in big circles. Your chef rubs the puddle away with a cloth.',
        word: 'WHOOPS!',
      },
      bonk: { title: 'BONK! You got knocked down!', howTo: 'GET UP: lift your phone up and down, like pushing yourself off the floor.', word: 'BONK!' },
      feathers: { title: 'The chicken got you! Feathers everywhere!', howTo: 'SHAKE THEM OFF: push your phone forward and pull it back, fast.', word: 'BAWK!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'SPLAT!', cheese: 'ROLLING!' },
  },
  pirate: {
    id: 'pirate',
    special: 'kraken',
    layout: PIRATE_LAYOUT,
    name: 'Pirate Galley',
    blurb: 'A cargo hold splits the deck: cross the gangplanks or drop through the trapdoors. Cannonballs, a rogue pirate and the kraken!',
    icon: 'anchor',
    backdrop: '#1f6fa8',
    gust: true,
    hazards: {
      ...SPECIAL_SKINS,
      spill: { banner: 'SEAWATER ON DECK! DON’T SLIP!', warn: 'SLIPPERY', icon: 'wave' },
      chicken: { banner: 'A PIRATE IS LOOSE IN THE GALLEY!', warn: 'ARRR!', icon: 'pirate' },
      fire: { banner: 'GALLEY FIRE AT THE', warn: 'FIRE!', icon: 'fire' },
      meteor: { banner: 'CANNONBALL INCOMING! MOVE!', warn: '!', icon: 'cannonball' },
      cheese: { banner: 'RUNAWAY BARREL! CLEAR THE LANE!', warn: 'BARREL!', icon: 'barrel' },
      gust: { banner: 'ROGUE WAVE! THE SHIP IS TIPPING!', warn: 'HOLD ON!', icon: 'wave' },
    },
    stuck: {
      slip: {
        title: 'You slipped on seawater!',
        howTo: 'MOP THE DECK: hold your phone flat and scrub in big circles to mop up the water.',
        word: 'WHOOPS!',
      },
      bonk: { title: 'KABOOM! You got knocked flat!', howTo: 'GET UP: lift your phone up and down, like pushing yourself off the deck.', word: 'KABOOM!' },
      feathers: { title: 'The pirate grabbed you!', howTo: 'SHAKE HIM OFF: push your phone forward and pull it back, fast.', word: 'ARRR!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'KABOOM!', cheese: 'ROLLING!' },
  },
  space: {
    id: 'space',
    special: 'lowgrav',
    layout: SPACE_LAYOUT,
    name: 'Space Station',
    blurb: 'Ride the moving walkways and zap across on the teleporters. Asteroids, a sneaky alien and zero gravity!',
    icon: 'rocket',
    backdrop: '#141a3a',
    gust: true,
    hazards: {
      ...SPECIAL_SKINS,
      spill: { banner: 'ALIEN GOO ON THE FLOOR! DON’T SLIP!', warn: 'GOO', icon: 'goo' },
      chicken: { banner: 'AN ALIEN GOT ON BOARD!', warn: 'BLEEP!', icon: 'alien' },
      fire: { banner: 'ELECTRICAL FIRE AT THE', warn: 'FIRE!', icon: 'fire' },
      meteor: { banner: 'ASTEROID INCOMING! MOVE!', warn: '!', icon: 'asteroid' },
      cheese: { banner: 'RUNAWAY ROBOT VACUUM! CLEAR THE LANE!', warn: 'ROBOT!', icon: 'robot' },
      gust: { banner: 'AIRLOCK BREACH! HOLD ON!', warn: 'SUCTION!', icon: 'vent' },
    },
    stuck: {
      slip: {
        title: 'You slipped in alien goo!',
        howTo: 'SCRUB IT OFF: hold your phone flat and scrub in big circles to clean up the goo.',
        word: 'SPLORCH!',
      },
      bonk: { title: 'CLONK! An asteroid knocked you over!', howTo: 'GET UP: lift your phone up and down, like pushing yourself off the floor.', word: 'CLONK!' },
      feathers: { title: 'The alien is hugging you!', howTo: 'SHAKE IT OFF: push your phone forward and pull it back, fast.', word: 'BLEEP!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'CRASH!', cheese: 'BEEP BEEP!' },
  },
  jungle: {
    id: 'jungle',
    special: 'quicksand',
    layout: JUNGLE_LAYOUT,
    name: 'Jungle Temple',
    blurb: 'Weave between the old pillars and wade through mud bogs. Coconuts, a cheeky monkey, boulders and quicksand!',
    icon: 'palm',
    backdrop: '#2f7d3a',
    gust: true,
    hazards: {
      ...SPECIAL_SKINS,
      spill: { banner: 'MUD PUDDLE! DON’T SLIP!', warn: 'MUD', icon: 'mud' },
      chicken: { banner: 'A MONKEY IS STEALING FOOD!', warn: 'OOK!', icon: 'monkey' },
      fire: { banner: 'TORCH FIRE AT THE', warn: 'FIRE!', icon: 'fire' },
      meteor: { banner: 'COCONUT INCOMING! MOVE!', warn: '!', icon: 'coconut' },
      cheese: { banner: 'ROLLING BOULDER! CLEAR THE LANE!', warn: 'BOULDER!', icon: 'boulder' },
      gust: { banner: 'MONSOON WIND! HOLD ON!', warn: 'WIND!', icon: 'wind' },
    },
    stuck: {
      slip: {
        title: 'You slipped in the mud!',
        howTo: 'SCRUB IT UP: hold your phone flat and scrub in big circles to clear the mud.',
        word: 'SQUELCH!',
      },
      bonk: { title: 'BONK! A coconut got you!', howTo: 'GET UP: lift your phone up and down, like pushing yourself off the floor.', word: 'BONK!' },
      feathers: { title: 'The monkey jumped on you!', howTo: 'SHAKE IT OFF: push your phone forward and pull it back, fast.', word: 'OOK OOK!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'BONK!', cheese: 'RUMBLE!' },
  },
  arctic: {
    id: 'arctic',
    special: 'freeze',
    layout: ARCTIC_LAYOUT,
    name: 'Arctic Lodge',
    blurb: 'Skate across the frozen ponds and dodge the snowmen. Giant snowballs, a waddling penguin and flash freezes!',
    icon: 'snowflake',
    backdrop: '#7fb6d9',
    gust: true,
    hazards: {
      ...SPECIAL_SKINS,
      spill: { banner: 'ICE PATCH! DON’T SLIP!', warn: 'ICY', icon: 'ice' },
      chicken: { banner: 'A PENGUIN WADDLED IN!', warn: 'SQUAWK!', icon: 'penguin' },
      fire: { banner: 'STOVE FIRE AT THE', warn: 'FIRE!', icon: 'fire' },
      meteor: { banner: 'GIANT SNOWBALL INCOMING! MOVE!', warn: '!', icon: 'snowball' },
      cheese: { banner: 'ROLLING SNOWMAN! CLEAR THE LANE!', warn: 'SNOWMAN!', icon: 'snowman' },
      gust: { banner: 'BLIZZARD! HOLD ON!', warn: 'BLIZZARD!', icon: 'wind' },
    },
    stuck: {
      slip: {
        title: 'You slipped on the ice!',
        howTo: 'SCRAPE IT UP: hold your phone flat and scrub in big circles to scrape the ice away.',
        word: 'WHOOPS!',
      },
      bonk: { title: 'FWUMP! A snowball buried you!', howTo: 'DIG OUT: lift your phone up and down, like pushing yourself out of the snow.', word: 'FWUMP!' },
      feathers: { title: 'The penguin slid into you!', howTo: 'SHAKE IT OFF: push your phone forward and pull it back, fast.', word: 'SQUAWK!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'FWUMP!', cheese: 'ROLLING!' },
  },
};

/** The layout for a map (the classic one if it's unknown). */
export function layoutOf(id: unknown): Layout {
  return mapOf(id).layout;
}

export function mapOf(id: unknown): MapDef {
  return isMapId(id) ? MAPS[id] : MAPS.kitchen;
}

// ------------------------------------------------------------------ chaos levels

export const CHAOS_LEVELS = ['light', 'medium', 'heavy', 'chaotic'] as const;
export type ChaosLevel = (typeof CHAOS_LEVELS)[number];

export function isChaosLevel(v: unknown): v is ChaosLevel {
  return typeof v === 'string' && (CHAOS_LEVELS as readonly string[]).includes(v);
}

export interface ChaosDef {
  name: string;
  blurb: string;
  /** Multiplies the time between events (bigger = calmer). */
  interval: number;
  /** Extra copies of each event allowed on the floor at once. */
  extra: number;
  /** Multiplies when each event unlocks during the shift (smaller = sooner). */
  unlock: number;
  /** Nothing happens before this fraction of the shift. */
  startAt: number;
}

/** `medium` is the original amount of chaos. */
export const CHAOS: Record<ChaosLevel, ChaosDef> = {
  light: { name: 'Light', blurb: 'A few surprises', interval: 1.6, extra: 0, unlock: 1.2, startAt: 0.18 },
  medium: { name: 'Medium', blurb: 'The classic amount', interval: 1, extra: 0, unlock: 1, startAt: 0.12 },
  heavy: { name: 'Heavy', blurb: 'Something every few seconds', interval: 0.6, extra: 1, unlock: 0.65, startAt: 0.07 },
  chaotic: { name: 'Chaotic', blurb: 'Total kitchen meltdown', interval: 0.35, extra: 2, unlock: 0.35, startAt: 0.03 },
};
