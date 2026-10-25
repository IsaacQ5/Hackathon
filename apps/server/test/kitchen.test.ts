import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HAZARDS,
  KITCHEN,
  RECIPES,
  STUCK,
  SCORING,
  STATIONS,
  createDetector,
  recipeById,
  stationById,
  validateRecipes,
  type MotionSample,
  type StationId,
} from '@tilt-mayhem/shared';
import { GameEngine } from '../src/game/GameEngine.js';

// ====================================================================== data

describe('Sizzle Scramble data', () => {
  it('has exactly six stations with five ingredients each', () => {
    assert.equal(STATIONS.length, 6);
    for (const s of STATIONS) assert.equal(s.ingredients.length, 5, s.id);
    const allIngredients = STATIONS.flatMap((s) => s.ingredients.map((i) => i.id));
    assert.equal(new Set(allIngredients).size, 30, 'ingredient ids are unique');
  });

  it('has 20 valid recipes, each 4 ingredients from 4 different stations', () => {
    assert.equal(RECIPES.length, 20);
    assert.deepEqual(validateRecipes(), []);
  });

  it('catches a bad recipe', () => {
    const bad = validateRecipes([{ id: 'x', name: 'X', icon: '?', ingredients: ['lettuce', 'tomato', 'patty', 'water'] }]);
    assert.ok(bad.some((p) => p.includes('same station')));
  });
});

// ====================================================================== gestures

const G = 9.81;
type Gen = (t: number) => Partial<MotionSample>;

/** Feed a synthetic motion (60 Hz) to a station's detector and count results. */
function run(station: StationId, ms: number, gen: Gen) {
  const d = createDetector(station);
  let good = 0;
  let bad = 0;
  for (let t = 0; t <= ms; t += 1000 / 60) {
    const s: MotionSample = { t, ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: G, ra: 0, rb: 0, rg: 0, ...gen(t) };
    const r = d.push(s);
    if (r === 'good') good++;
    if (r === 'bad') bad++;
  }
  return { good, bad };
}

const wave = (t: number, periodMs: number, amp: number) => amp * Math.sin((2 * Math.PI * t) / periodMs);

describe('Gesture detectors', () => {
  it('CHOP counts sharp vertical strokes, ignores side shaking and gentle motion', () => {
    const chop = run('chop', 3000, (t) => ({ az: t % 300 < 30 ? -15 : t % 300 < 60 ? 13 : 0 }));
    assert.ok(chop.good >= 9 && chop.good <= 11, `chops ${chop.good}`);
    assert.equal(run('chop', 3000, (t) => ({ ax: wave(t, 250, 15) })).good, 0, 'side shake');
    assert.equal(run('chop', 3000, (t) => ({ az: wave(t, 600, 3) })).good, 0, 'walking jiggle');
  });

  it('FLIP: phone flat, lift the top edge up = one flip; back to flat for the next', () => {
    // Lift the top edge 40 degrees and lower it again, once every 800 ms.
    const lift = (deg: number) => ({ gy: G * Math.sin((deg * Math.PI) / 180), gz: G * Math.cos((deg * Math.PI) / 180) });
    const lifts = run('fry', 4000, (t) => {
      const p = t % 800;
      return lift(p < 150 ? (p / 150) * 40 : p < 400 ? 40 - ((p - 150) / 250) * 40 : 0);
    });
    assert.equal(lifts.good, 5, `flips ${lifts.good}`);
    // Holding it tipped up is still one flip until it comes back to flat.
    assert.equal(run('fry', 3000, (t) => lift(t > 200 ? 40 : 0)).good, 1, 'must come back to flat');
    // A small wobble isn't a flip.
    assert.equal(run('fry', 3000, (t) => lift(t % 800 < 400 ? 12 : 0)).good, 0, 'small wobble');
    // Not flat to begin with (held upright): nothing until it's laid flat.
    assert.equal(run('fry', 2000, (t) => ({ gx: 0, gy: G, gz: 0, rb: t % 600 < 80 ? 380 : 0 })).good, 0, 'must start flat');
  });

  it('FLIP gyro shortcut: a quick top-edge-up rotation counts once (the return swing is ignored)', () => {
    const flips = run('fry', 4000, (t) => {
      const p = t % 800;
      return { rb: p < 90 ? 380 : p < 180 ? -260 : 0 };
    });
    assert.equal(flips.good, 5, `flips ${flips.good}`);
    assert.equal(flips.bad, 0);
    const single = run('fry', 2500, (t) => ({ rb: t < 90 ? 380 : 0 }));
    assert.deepEqual(single, { good: 1, bad: 0 }, 'a flick without a return still counts');
    const wild = run('fry', 1000, (t) => ({ rb: t < 50 ? 3000 : 0 }));
    assert.deepEqual(wild, { good: 0, bad: 1 }, 'way too wild spills');
    // No gyro readings at all (or odd units): the phone tipping up quickly still counts.
    const tip = (deg: number) => ({ gy: G * Math.sin((deg * Math.PI) / 180), gz: G * Math.cos((deg * Math.PI) / 180) });
    const noGyro = run('fry', 4000, (t) => {
      const p = t % 800;
      return tip(p < 120 ? (p / 120) * 40 : p < 300 ? 40 - ((p - 120) / 180) * 40 : 0);
    });
    assert.ok(noGyro.good >= 4, `flicks seen from the tilt alone: ${noGyro.good}`);
    const slow = run('fry', 3000, (t) => ({ rb: wave(t, 2000, 60) }));
    assert.deepEqual(slow, { good: 0, bad: 0 });
    // It's the top edge that lifts: tipping a side up (rotation about y) is not a flip.
    const side = run('fry', 4000, (t) => ({ rg: t % 800 < 90 ? 380 : 0 }));
    assert.equal(side.good, 0, `side flicks ${side.good}`);
    const corner = run('fry', 4000, (t) => ({ rb: t % 800 < 90 ? 200 : 0, rg: t % 800 < 90 ? 200 : 0 }));
    assert.equal(corner.good, 5, `top corner lifts ${corner.good}`);
    // Spinning the phone flat like a steering wheel (rotation about z) is not a flip.
    const twist = run('fry', 2000, (t) => ({ ra: t % 600 < 80 ? 600 : 0, rb: t % 600 < 80 ? 100 : 0 }));
    assert.equal(twist.good, 0, 'twisting the phone is not a pan flip');
  });

  it('STIR counts full circles, not back-and-forth shaking', () => {
    const circles = run('stir', 4000, (t) => ({ ax: 4 * Math.cos((2 * Math.PI * t) / 1000), ay: 4 * Math.sin((2 * Math.PI * t) / 1000) }));
    assert.ok(circles.good >= 3 && circles.good <= 5, `circles ${circles.good}`);
    assert.equal(run('stir', 4000, (t) => ({ ax: wave(t, 300, 6) })).good, 0, 'side shake');
    assert.equal(run('stir', 4000, (t) => ({ ay: wave(t, 700, 6) })).good, 0, 'push-pull');
  });

  it('KNEAD counts every forward/back stroke, not frantic shaking or circles', () => {
    const knead = run('knead', 6000, (t) => ({ ay: wave(t, 800, 5) }));
    assert.ok(knead.good >= 12, `kneads ${knead.good}`);
    const gentle = run('knead', 4000, (t) => ({ ay: wave(t, 700, 3.5) }));
    assert.equal(run('knead', 4000, (t) => ({ ay: wave(t, 700, 2.5) })).good, 0, 'too gentle to count');
    assert.ok(gentle.good >= 8, `gentle kneads ${gentle.good}`);
    assert.equal(run('knead', 4000, (t) => ({ ay: wave(t, 120, 8) })).good, 0, 'frantic');
    const circle = run('knead', 4000, (t) => ({ ax: 5 * Math.cos((2 * Math.PI * t) / 900), ay: 5 * Math.sin((2 * Math.PI * t) / 900) }));
    assert.equal(circle.good, 0, 'circles');
  });

  it('MIX counts gentle side-to-side shakes, not circles or wild flailing', () => {
    const mix = run('mix', 3000, (t) => ({ ax: wave(t, 400, 6) }));
    assert.ok(mix.good >= 12, `mixes ${mix.good}`);
    const circle = run('mix', 3000, (t) => ({ ax: 6 * Math.cos((2 * Math.PI * t) / 600), ay: 6 * Math.sin((2 * Math.PI * t) / 600) }));
    assert.equal(circle.good, 0, 'circles are stirring, not mixing');
    assert.equal(run('mix', 3000, (t) => ({ ax: wave(t, 400, 35) })).good, 0, 'too violent');
  });

  it('POUR: tilt sideways then back upright = one pour; small wobbles or staying sideways do nothing', () => {
    // Rolled from upright (gravity down the long y axis) towards sideways (onto the short x axis).
    const roll = (deg: number) => ({ gx: G * Math.sin((deg * Math.PI) / 180), gy: G * Math.cos((deg * Math.PI) / 180), gz: 0 });
    const pours = run('juice', 4000, (t) => roll(t % 1000 < 500 ? 85 : 0));
    assert.equal(pours.good, 4, `pours ${pours.good}`);
    assert.equal(pours.bad, 0);
    assert.equal(run('juice', 3000, (t) => roll(t % 1000 < 500 ? 30 : 0)).good, 0, 'a small wobble is not a pour');
    assert.equal(run('juice', 3000, (t) => roll(t > 300 ? 85 : 0)).good, 0, 'must come back upright');
  });
});

// ====================================================================== engine

const TICK = 1000 / 30;

function kitchen(ids = ['a', 'b'], cfg: { roundDurationMs?: number; hazards?: number } = {}) {
  const e = new GameEngine({ countdownMs: 100, roundDurationMs: cfg.roundDurationMs ?? 180_000, hazards: cfg.hazards ?? 0 }, () => 0.3);
  ids.forEach((id, i) => e.addPlayer(id, id.toUpperCase(), ['#ff3d7f', '#2de2e6', '#ffd23f'][i]!));
  let now = 1000;
  e.startCountdown(now);
  now += 100;
  e.update(now);
  assert.equal(e.phase, 'playing');
  const run = (ms: number) => {
    const end = now + ms;
    while (now < end) {
      now += TICK;
      e.update(now);
    }
  };
  return { e, run, at: () => now };
}

const at = (e: GameEngine, id: string, station: StationId) => {
  const s = KITCHEN.spots.find((x) => x.id === station)!;
  e.setPlayerPosition(id, s.fx, s.fy);
};

/** Do every gesture for a station (respecting its rate limit). */
function work(e: GameEngine, run: (ms: number) => void, id: string, station: StationId) {
  const def = stationById(station);
  assert.equal(e.interact(id), 'ok', `interact at ${station}`);
  for (let i = 0; i < def.reps; i++) {
    run(def.minRepMs + 10);
    assert.equal(e.rep(id, true), true);
  }
}

describe('Kitchen engine', () => {
  it('runs a 3 minute round, then results', () => {
    const { e, run } = kitchen();
    assert.equal(e.config.roundDurationMs, 180_000);
    run(150_500);
    assert.equal(e.snapshot(0).rush, true, 'rush hour in the last 30 s');
    run(30_000);
    assert.equal(e.phase, 'results');
  });

  it('every chef starts with a random recipe', () => {
    const { e } = kitchen(['a', 'b', 'c']);
    for (const c of e.snapshot(0).chefs) assert.ok(recipeById(c.recipeId));
  });

  it('knows which station you are standing at', () => {
    const { e } = kitchen();
    at(e, 'a', 'stir');
    assert.equal(e.peek('a')!.near, 'stir');
    e.setPlayerPosition('a', KITCHEN.pass.x, KITCHEN.pass.y + 100);
    assert.equal(e.peek('a')!.near, 'pass');
  });

  it('only lets you work a station your recipe needs', () => {
    const { e } = kitchen();
    e.setRecipe('a', 'burger'); // lettuce(chop) patty(fry) bun(knead) cheesesauce(stir)
    at(e, 'a', 'juice');
    assert.equal(e.interact('a'), 'not-needed');
    assert.equal(e.status('a', 0)!.canInteract, false);
    at(e, 'a', 'chop');
    assert.equal(e.status('a', 0)!.canInteract, true);
    assert.equal(e.interact('a'), 'ok');
    assert.equal(e.peek('a')!.working!.ingredient, 'lettuce');
  });

  it('gestures fill the meter (rate-limited) and make the ingredient', () => {
    const { e, run } = kitchen();
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    e.interact('a');
    run(200);
    assert.equal(e.rep('a', true), true);
    assert.equal(e.rep('a', true), false, 'too fast: ignored');
    for (let i = 1; i < stationById('chop').reps; i++) {
      run(200);
      e.rep('a', true);
    }
    assert.equal(e.peek('a')!.working, null);
    assert.ok(e.peek('a')!.have.has('lettuce'));
    at(e, 'a', 'chop');
    assert.equal(e.interact('a'), 'already-have');
  });

  it('messed-up flips cost progress', () => {
    const { e, run } = kitchen();
    e.setRecipe('a', 'burger');
    at(e, 'a', 'fry');
    e.interact('a');
    run(320);
    e.rep('a', true);
    run(320);
    e.rep('a', true);
    run(320);
    e.rep('a', false);
    assert.equal(e.peek('a')!.working!.reps, 1);
  });

  it('stepping away keeps partial progress', () => {
    const { e, run } = kitchen();
    e.setRecipe('a', 'burger');
    at(e, 'a', 'knead');
    e.interact('a');
    for (let i = 0; i < 3; i++) {
      run(220);
      e.rep('a', true);
    }
    e.cancel('a');
    assert.equal(e.peek('a')!.working, null);
    e.interact('a');
    assert.equal(e.peek('a')!.working!.reps, 3);
  });

  it('serving all four at the pass scores points and deals a new ticket', () => {
    const { e, run } = kitchen();
    e.setRecipe('a', 'burger');
    for (const st of ['chop', 'fry', 'knead', 'stir'] as const) {
      at(e, 'a', st);
      work(e, run, 'a', st);
    }
    at(e, 'a', 'chop');
    assert.equal(e.serve('a'), 0, 'must be at the pass');
    e.setPlayerPosition('a', KITCHEN.pass.x, KITCHEN.pass.y + 100);
    assert.equal(e.status('a', 0)!.canServe, true);
    const pts = e.serve('a');
    assert.equal(pts, SCORING.recipe + SCORING.fastBonus);
    assert.equal(e.peek('a')!.served, 1);
    assert.notEqual(e.peek('a')!.recipeId, 'burger', 'new ticket');
    assert.equal(e.peek('a')!.have.size, 0);
  });

  it('cannot serve an incomplete dish', () => {
    const { e, run } = kitchen();
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    work(e, run, 'a', 'chop');
    e.setPlayerPosition('a', KITCHEN.pass.x, KITCHEN.pass.y + 100);
    assert.equal(e.serve('a'), 0);
  });

  it('rush hour doubles points; highest score wins', () => {
    const { e, run } = kitchen(['a', 'b'], { roundDurationMs: 40_000 });
    run(12_000); // into the last 30 s
    e.setRecipe('a', 'burger');
    for (const st of ['chop', 'fry', 'knead', 'stir'] as const) {
      at(e, 'a', st);
      work(e, run, 'a', st);
    }
    e.setPlayerPosition('a', KITCHEN.pass.x, KITCHEN.pass.y + 100);
    assert.equal(e.serve('a'), (SCORING.recipe + SCORING.fastBonus) * 2);
    run(40_000);
    assert.equal(e.phase, 'results');
    const r = e.results()!;
    assert.deepEqual(r.winnerIds, ['a']);
    assert.equal(r.results[0]!.served, 1);
    assert.equal(e.standings()[0]!.id, 'a');
  });

  it('chefs stay out of walls and the pass table, and freeze while working', () => {
    const { e, run } = kitchen();
    e.applyInput('a', { seq: 1, x: -1, y: -1 });
    run(3000);
    const a = e.peek('a')!;
    assert.ok(a.x >= KITCHEN.floor.x0 + 22 - 0.01 && a.y >= KITCHEN.floor.y0 + 22 - 0.01);
    e.setPlayerPosition('b', KITCHEN.pass.x, KITCHEN.pass.y);
    run(TICK);
    const b = e.peek('b')!;
    assert.ok(Math.hypot(b.x - KITCHEN.pass.x, b.y - KITCHEN.pass.y) >= KITCHEN.pass.r + 21.9);
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    e.interact('a');
    e.applyInput('a', { seq: 2, x: 1, y: 0 });
    const x0 = e.peek('a')!.x;
    run(500);
    assert.ok(Math.abs(e.peek('a')!.x - x0) < 1, 'working chefs stay put');
  });

  it('rejects invalid, stale and out-of-phase input', () => {
    const lobby = new GameEngine();
    lobby.addPlayer('a', 'A', '#fff');
    assert.equal(lobby.applyInput('a', { seq: 1, x: 0, y: 0 }), 'phase');
    const { e } = kitchen();
    assert.equal(e.applyInput('a', { seq: 1, x: Number.NaN, y: 0 }), 'invalid');
    assert.equal(e.applyInput('a', { seq: 1, x: 2, y: 0 }), 'invalid');
    assert.equal(e.applyInput('a', { seq: 3, x: 0.5, y: 0 }), 'ok');
    assert.equal(e.applyInput('a', { seq: 3, x: 0.5, y: 0 }), 'stale');
  });
});

describe('Kitchen engine: accuracy-based cooking', () => {
  it('fills by accuracy x time: sloppy does nothing, half accuracy fills at half speed, perfect finishes it', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    assert.equal(e.interact('a'), 'ok');
    const def = stationById('chop');
    for (let t = 0; t < 2000; t += 100) {
      run(100);
      e.effort('a', 0.1);
    }
    assert.equal(e.peek('a')!.working!.reps, 0, 'too inaccurate: no free progress');
    for (let t = 0; t < def.fillMs / 2; t += 100) {
      run(100);
      e.effort('a', 0.5);
    }
    const quarter = e.peek('a')!.working!.reps / def.reps;
    assert.ok(Math.abs(quarter - 0.25) < 0.05, `half accuracy for half the time = a quarter: ${quarter}`);
    for (let t = 0; t < def.fillMs && e.peek('a')!.working; t += 100) {
      run(100);
      e.effort('a', 1);
    }
    assert.equal(e.peek('a')!.working, null, 'done');
    assert.ok(e.peek('a')!.have.has('lettuce'));
  });

  it('sending accuracy faster does not fill it faster (the server keeps the time)', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    e.interact('a');
    run(100);
    for (let i = 0; i < 50; i++) e.effort('a', 1);
    const filled = e.peek('a')!.working!.reps / stationById('chop').reps;
    assert.ok(filled <= 120 / stationById('chop').fillMs, `only ~100 ms worth: ${filled}`);
  });
});

describe('Kitchen engine: sharing', () => {
  it('two chefs at one station stand side by side', () => {
    const { e } = kitchen(['a', 'b']);
    e.setRecipe('a', 'burger');
    e.setRecipe('b', 'blt');
    at(e, 'a', 'chop');
    at(e, 'b', 'chop');
    assert.equal(e.interact('a'), 'ok');
    assert.equal(e.interact('b'), 'ok');
    const ax = e.peek('a')!.x;
    const bx = e.peek('b')!.x;
    assert.ok(Math.abs(ax - bx) >= 50, `${ax} vs ${bx}`);
  });
});

describe('Kitchen engine: pushing', () => {
  it('shoves the chef right next to you away from you, a controlled distance, with a 5 s cooldown', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setPlayerPosition('a', 300, 300);
    e.setPlayerPosition('b', 350, 300);
    assert.equal(e.push('a'), true);
    run(1000);
    const b = e.peek('b')!;
    assert.ok(b.x > 380, `pushed away from the pusher: ${b.x}`);
    assert.ok(b.x < 480, `but not flung across the kitchen: ${b.x}`);
    assert.ok(Math.abs(b.y - 300) < 2, 'straight away from the pusher');
    assert.equal(Math.round(b.vx), 0, 'and then stops');
    // cooldown
    e.setPlayerPosition('b', 350, 300);
    assert.equal(e.push('a'), false, 'cooling down');
    assert.ok(e.status('a', 0)!.pushReadyInMs > 3000);
    run(4100);
    assert.equal(e.push('a'), true, 'ready again after 5 s');
  });

  it('needs someone right next to you (and a miss does not use the cooldown)', () => {
    const { e } = kitchen(['a', 'b']);
    e.setPlayerPosition('a', 300, 300);
    e.setPlayerPosition('b', 600, 300);
    assert.equal(e.push('a'), false);
    assert.equal(e.status('a', 0)!.pushReadyInMs, 0);
  });

  it('knocks a cooking chef off their station; they have to start it again', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setRecipe('b', 'burger');
    at(e, 'b', 'chop');
    assert.equal(e.interact('b'), 'ok');
    const bx = e.peek('b')!.x;
    // pusher just to the left, so the shove is sideways along the counter
    e.setPlayerPosition('a', bx - 40, e.peek('b')!.y);
    assert.equal(e.push('a'), true);
    assert.equal(e.peek('b')!.working, null, 'pushed off the station');
    assert.deepEqual(e.status('b', 0)!.pushedBy, { name: 'A', offStation: true }, 'their phone says who did it');
    run(500);
    assert.ok(e.peek('b')!.x > bx + 30, 'slid away from the pusher');
    assert.equal(e.status('b', 0)!.working, null, 'has to start the station again');
  });
});

describe('Kitchen engine: chaos', () => {
  it('a spill makes you slip; mopping (stir circles) cleans it and frees you', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setPlayerPosition('a', 300, 300);
    e.spawnHazard('spill', { x: 300, y: 300 });
    run(100);
    assert.equal(e.peek('a')!.stuck?.kind, 'slip');
    assert.equal(e.interact('a'), 'busy', 'no cooking while stuck');
    for (let i = 0; i < STUCK.slip.reps; i++) {
      run(stationById(STUCK.slip.gesture).minRepMs + 10);
      assert.equal(e.recover('a', true), true);
    }
    assert.equal(e.peek('a')!.stuck, null);
    assert.equal(e.snapshot(0).hazards.length, 0, 'spill cleaned up');
  });

  it('a meatball meteor warns first, then knocks down whoever is under it', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setPlayerPosition('a', 300, 300);
    e.setPlayerPosition('b', 800, 300);
    e.spawnHazard('meteor', { x: 300, y: 300 });
    assert.ok(e.snapshot(0).hazards[0]!.warnMs > 0, 'warning first');
    run(1000);
    assert.equal(e.peek('a')!.stuck, null, 'not yet');
    run(HAZARDS.warnMs);
    assert.equal(e.peek('a')!.stuck?.kind, 'bonk');
    assert.equal(e.peek('b')!.stuck, null, 'far away chefs are fine');
  });

  it('a station fire blocks cooking until someone fans it out', () => {
    const { e, run } = kitchen(['a', 'b']);
    e.setRecipe('a', 'burger');
    at(e, 'a', 'chop');
    e.spawnHazard('fire', undefined, 'chop');
    assert.equal(e.status('a', 0)!.fireHere, true);
    assert.equal(e.interact('a'), 'ok');
    assert.equal(e.peek('a')!.stuck?.kind, 'fire');
    for (let i = 0; i < STUCK.fire.reps; i++) {
      run(stationById(STUCK.fire.gesture).minRepMs + 10);
      e.recover('a', true);
    }
    assert.equal(e.peek('a')!.stuck, null);
    assert.equal(e.status('a', 0)!.fireHere, false);
    assert.equal(e.interact('a'), 'ok', 'can cook again');
    assert.equal(e.peek('a')!.working?.station, 'chop');
  });

  it('nobody can walk through the diner at the serve table', () => {
    const { e, run } = kitchen(['a']);
    const cu = KITCHEN.customer;
    e.setPlayerPosition('a', cu.x, cu.y - 80);
    let seq = 0;
    for (let i = 0; i < 60; i++) {
      e.applyInput('a', { seq: ++seq, x: 0, y: 1 });
      run(TICK);
    }
    const c = e.peek('a')!;
    assert.ok(Math.hypot(c.x - cu.x, c.y - cu.y) >= cu.r + KITCHEN.chefR - 1, 'pushed out of the diner');
  });

  it('random hazards start tame and only appear once the shift is underway', () => {
    const { e, run } = kitchen(['a', 'b'], { hazards: 1, roundDurationMs: 100_000 });
    run(10_000);
    assert.equal(e.snapshot(0).hazards.length, 0, 'calm start');
    run(10_000);
    const first = e.snapshot(0).hazards;
    assert.ok(first.length >= 1, 'something happened');
    assert.ok(first.every((h) => h.kind === 'spill'), 'early hazards are tame');
  });

  it('every kind of hazard shows up at least once in a shift', () => {
    const { e, run } = kitchen(['a', 'b'], { hazards: 1, roundDurationMs: 100_000 });
    const seen = new Set<string>();
    for (let ms = 0; ms < 100_000; ms += 500) {
      run(500);
      for (const ev of e.snapshot(0).events) if (ev.type === 'hazard') seen.add(ev.kind);
    }
    assert.deepEqual([...seen].sort(), ['cheese', 'chicken', 'fire', 'meteor', 'spill']);
  });
});
