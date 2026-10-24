# Sizzle Scramble

An Overcooked-style party game played like Jackbox. One laptop or TV shows the kitchen; 2–8 chefs join from their phone browsers (no app install), **tilt their phones to walk**, and use **real cooking motions** to prep ingredients. Collect your recipe's four ingredients, take them to the PASS, hit SEND. Most points in 3 minutes wins.

```
packages/shared   Types, socket events, stations + 20 recipes (kitchen.ts), phone gesture detectors (gestures.ts)
apps/server       Node + Express + Socket.IO; RoomManager, GameEngine (server-authoritative kitchen, 30 Hz)
apps/web          React + Vite; /host/:code (big screen), /play/:code (phone controller)
```

> **Branch note:** Sizzle Scramble lives on the `sizzle-scramble` branch. `main` is what your live Render site deploys, so pushing this branch does **not** change the live site. To try it online, create a second Render web service with Branch = `sizzle-scramble`.

## How to play

1. Every chef gets a random recipe: **4 ingredients from 4 different stations**. The top of your phone shows the 4 station symbols, with the food you need under each.
2. **Tilt to walk** (or use the joystick / arrow pad). When you reach a station you need, your phone buzzes and the button under the tilt circle lights up. Tap it.
3. **Do the motion** to fill the progress bar. The big screen shows your progress card and the station animating next to your chef.
4. With all 4 made, walk to the **PASS** in the middle and tap **SEND DISH**. +100 points (+50 if served within 35 s, +25 within 60 s), then you get a new ticket.
5. The last 30 seconds are **RUSH HOUR**: double points. Highest score after 3:00 wins.

| Station | Motion on the phone | Makes (5 each) |
| --- | --- | --- |
| 🔪 Chopping Board | Hold the phone sideways, chop straight down (8 chops) | Lettuce, tomato, onion, mushroom, carrot |
| 🔥 Frying Pan | Flick your wrist up, then bring it back level (5 flips). Flicking without leveling, or flailing, costs progress | Patty, fried egg, bacon, grilled chicken, fish |
| 🥄 Stirring Pot | Phone flat, move it in full circles (4 circles) | Tomato sauce, cheese sauce, chocolate sauce, soup base, curry sauce |
| 🫓 Dough Bench | Push forward and pull back in a steady rhythm (6 kneads) | Bread, burger bun, pizza dough, tortilla, sandwich bread |
| 🥣 Mixing Bowl | Gentle side-to-side shakes (12) | Pancake batter, omelette mixture, cake batter, cookie mixture, cream filling |
| 🧃 Juicer & Crusher | Tilt forward, HOLD steady, level it when the screen says RELEASE (2 pours). Holding too long spills | Orange juice, lemon juice, fruit purée, apple juice, water |

Every station also has an **on-screen fallback** (⚙️ Controls → "Use buttons at stations", or automatic when motion isn't available): tap CHOP; tap FLIP in the timing zone; drag circles round the pot; alternate PUSH/PULL; alternate LEFT/RIGHT; hold-and-release to pour. Partly made ingredients are remembered if you step away. Two chefs can share a station.

**Adding recipes:** add a row to `RECIPES` in `packages/shared/src/kitchen.ts`: an id, name, emoji and 4 ingredient ids from 4 different stations. `validateRecipes()` (run by the tests) rejects anything else. No station code changes are needed.

## Quick start

Requires **Node 20.19+ or 22 LTS**.

```bash
npm install
npm run dev          # shared (watch) + server :3000 + Vite :5173
```

Open http://localhost:5173 on the laptop and click **Create room**. For extra test players without phones, use Incognito windows (joystick + station buttons).

Other commands:

```bash
npm test             # unit tests + socket integration test (server)
npm run typecheck    # all packages
npm run build        # production build (shared -> server -> web)
npm start            # serves the built web app + Socket.IO on PORT (default 3000)
```

Copy `.env.example` to `.env` to change settings (port, `MIN_PLAYERS`, public URL).

## Testing with real phones

Phones need an **https** link to read motion sensors (iOS and recent Chrome both require it). `http://localhost` only works on the laptop itself. Choose one:

**A. Tunnel (easiest, works on any Wi-Fi or on cellular)**

```bash
npm run build && npm start                      # one server on :3000
npx cloudflared tunnel --url http://localhost:3000
```

Open the `https://….trycloudflare.com` URL on the laptop and create the room there. The QR code then points at the same https URL. (`ngrok http 3000` also works.)

**B. Dev mode with hot reload**

Run `npm run dev`, tunnel port **5173**, and open the tunnel URL on the laptop. Vite proxies `/socket.io` to the server.

**C. Same Wi-Fi, no tunnel**

Set `VITE_PUBLIC_URL=http://<laptop-LAN-IP>:5173` in `.env`. Players can join, but **motion controls are blocked on plain http**, so phones fall back to the on-screen joystick.

On the phone: scan the QR code, enter a name and tap **Join**. That same tap asks for motion permission on iPhone. Hold the phone flat like a tray. The controller recenters automatically when the countdown starts, and there's a **Recenter** button.

## Deploying (HTTPS + WebSockets)

The server serves the frontend and Socket.IO from one origin, so any host that runs a persistent Node process with WebSockets works. Use one instance, because room state is in memory.

**Render** (free tier is fine for a demo): New → Web Service → connect the repo.
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/health`

**Railway / Fly.io**: same build and start commands. `PORT` is provided by the platform.

Free tiers may sleep when idle. Open the URL a minute before your demo.

If you host the frontend separately (e.g. Vercel), set `VITE_SERVER_URL` at web build time and `CORS_ORIGIN` on the server.

## How it works

- **Rooms**: unchanged from the base project. `RoomManager` keeps rooms in memory; 4-letter codes; reconnect tokens rotate on every resume; reloading a phone or the host restores the same chef or host.
- **Kitchen engine** (`apps/server/src/game/GameEngine.ts`): keeps the same public methods the room manager calls (`addPlayer`, `startCountdown`, `update`, `snapshot`, `standings`…), so `RoomManager.ts` is untouched. 30 Hz fixed step. Walls, counters and the pass table are solid; chefs freeze while working. The server decides which station you're at, whether your recipe needs it, progress, points and the 3-minute timer. Gestures are rate-limited per station (e.g. one chop per 140 ms), so mashing doesn't help.
- **Gesture detection** (`packages/shared/src/gestures.ts`, unit-tested with simulated motion): every reading is converted relative to **gravity** (up/down, left/right, forward/back), so it works however the phone is held and despite iOS/Android axis differences. Chop = sharp vertical spikes; flip = fast pitch rotation followed by a return swing; stir = the horizontal acceleration vector turning a full circle (shaking back and forth resets it); knead = forward/back strokes with a steady period (frantic shaking ignored); mix = side-to-side strokes with the other axis quiet (so circles don't count); pour = tilt angle from the starting pose with a hold timer and a release window.
- **Kitchen events** (`apps/server/src/socket/kitchenHandlers.ts`): a separate, additive set of handlers for interact, gesture, step away and serve. Each looks the sender up through the RoomManager, so a phone can only control its own chef.
- **Network**: phones send movement at 30 Hz (volatile) and one event per recognised gesture. Snapshots go only to the host screen (30 Hz); each phone gets its own `kitchen:status` about 10× per second (recipe, progress, can-interact, can-send, score, rank, time).
- **Rendering**: the host canvas renders ~100 ms behind live and interpolates between snapshots; the six stations animate from whoever is working them (knife strikes, pan flips, swirling pot, stretching dough, shaking bowl, filling glass).

### Events (see `packages/shared/src/events.ts`)

| Client → server | Ack | Notes |
| --- | --- | --- |
| `room:create {nickname?}` | `{code, playerId, role:'host', token}` | |
| `room:resume-host {code, token}` | same | host reload / reconnect |
| `room:join {code, nickname, token?}` | `{code, playerId, token, nickname, color, phase, resumed}` | |
| `game:start {}` / `game:rematch {}` | `{ok}` | host only |
| `player:input {seq, x, y}` | — | volatile |
| `player:recenter {}` | — | stops the character until next input |
| `net:ping {}` | `{serverTime}` | connectivity test |
| `kitchen:interact {}` | — | start working at the station you're standing at |
| `kitchen:rep {good}` | — | one recognised gesture (or a messed-up one) |
| `kitchen:cancel {}` | — | step away (progress kept) |
| `kitchen:serve {}` | — | send the finished dish at the pass |

Server → client: `room:created`, `room:state`, `game:started`, `game:snapshot` (host only), `game:ended`, `game:results` (rankings + stats), `kitchen:status` (to one phone), `server:error`. Error codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `INVALID_INPUT`, `INVALID_NICKNAME`, `INVALID_SESSION`, `NOT_HOST`, `INVALID_PHASE`, `NOT_ENOUGH_PLAYERS`, `RATE_LIMITED`.

### Tuning

Stations (gesture counts, rate limits, penalties, ingredients), recipes, kitchen layout and scoring live in `packages/shared/src/kitchen.ts`; gesture thresholds in `packages/shared/src/gestures.ts`; round length (3:00) in `packages/shared/src/config.ts`. Players adjust tilt sensitivity on their phone (⚙️ Controls). For solo testing, set `MIN_PLAYERS=1`.

## Manual phone checklist (must be done on real devices)

Motion sensors can't be fully emulated, so before the demo check on at least one iPhone (Safari) and one Android phone (Chrome):

- [ ] QR code opens `/play/CODE` over https
- [ ] iPhone shows the motion permission prompt on **Join**; Allow → tilt indicator moves
- [ ] Phone held still → indicator stays centered (dead zone OK)
- [ ] Tilt left / right / forward / back → character moves the **same** way on the big screen
- [ ] Recenter while tilted → movement stops; new pose is neutral
- [ ] Denying permission → touch joystick appears and works
- [ ] Rotating the phone to landscape still feels right (landscape mapping is best-effort; use the flip toggles if not)
- [ ] Lock or switch away from the phone and come back → it reconnects as the same player
- [ ] Works over cellular data, not just venue Wi-Fi
- [ ] Walking up to a needed station buzzes (Android) and lights up the button under the circle
- [ ] Each station's motion fills its bar: chop, flip, stir, knead, mix, pour (try each on iPhone **and** Android, adjust thresholds in `gestures.ts` if one is too strict)
- [ ] The wrong motion at a station does nothing (e.g. shaking at the pot)
- [ ] "Use buttons at stations" works for all six
- [ ] SEND at the pass scores and deals a new recipe; rush hour doubles points
- [ ] Full 3-minute round with 4+ phones: join → cook → results → another shift
