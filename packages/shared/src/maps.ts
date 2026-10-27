/**
 * Maps and chaos levels (both picked between shifts by the head chef or the host screen).
 *
 * Every map has the same layout and the same six stations; only the look and the story change.
 * Hazards keep their rules on every map but get a themed skin (on the pirate ship the meteor is
 * a cannonball, the loose chicken is a pirate...). The themed maps also have one extra event,
 * `gust`, that slides every walking chef sideways for a few seconds.
 */

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

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  icon: string;
  /** Page colour around the kitchen on the big screen. */
  backdrop: string;
  /** Themed maps have the sideways `gust` event; the classic kitchen doesn't. */
  gust: boolean;
  hazards: Record<HazardKind, HazardSkin>;
  stuck: Record<StuckKind, StuckText>;
  /** Comic words for a meteor landing / the rolling thing starting. */
  impact: { meteor: string; cheese: string };
}

const FIRE_STUCK: StuckText = {
  title: 'This station is on fire!',
  howTo: 'PUT IT OUT: sweep your phone side to side to spray the fire extinguisher back and forth.',
  word: 'SPRAY IT!',
};

export const MAPS: Record<MapId, MapDef> = {
  kitchen: {
    id: 'kitchen',
    name: 'Classic Kitchen',
    blurb: 'The original diner kitchen. Spills, chickens and meatball meteors.',
    icon: 'chefhat',
    backdrop: '#ff9f45',
    gust: false,
    hazards: {
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
    name: 'Pirate Galley',
    blurb: 'Cook on deck! Cannonballs, a rogue pirate, rolling barrels and big waves.',
    icon: 'anchor',
    backdrop: '#1f6fa8',
    gust: true,
    hazards: {
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
      bonk: { title: 'KABOOM! A cannonball knocked you flat!', howTo: 'GET UP: lift your phone up and down, like pushing yourself off the deck.', word: 'KABOOM!' },
      feathers: { title: 'The pirate grabbed you!', howTo: 'SHAKE HIM OFF: push your phone forward and pull it back, fast.', word: 'ARRR!' },
      fire: FIRE_STUCK,
    },
    impact: { meteor: 'KABOOM!', cheese: 'ROLLING!' },
  },
  space: {
    id: 'space',
    name: 'Space Station',
    blurb: 'Zero-g cooking. Asteroids, a sneaky alien, robot vacuums and airlock breaches.',
    icon: 'rocket',
    backdrop: '#141a3a',
    gust: true,
    hazards: {
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
    name: 'Jungle Temple',
    blurb: 'A kitchen in the ruins. Falling coconuts, a cheeky monkey, rolling boulders and monsoons.',
    icon: 'palm',
    backdrop: '#2f7d3a',
    gust: true,
    hazards: {
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
    name: 'Arctic Lodge',
    blurb: 'Ice floors and snow. Giant snowballs, a waddling penguin, rolling snowmen and blizzards.',
    icon: 'snowflake',
    backdrop: '#7fb6d9',
    gust: true,
    hazards: {
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
