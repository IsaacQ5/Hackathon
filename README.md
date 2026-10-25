# Sizzle Scramble

An Overcooked-style party game played like Jackbox. One laptop or TV shows the kitchen; 2–8 chefs join from their phone browsers (no app install), **tilt their phones to walk**, and use **real cooking motions** to prep ingredients. Collect your recipe's four ingredients, take them to the **SERVE** table, hit **SERVE**. Watch out for spills, fires, a loose chicken, meatball meteors, runaway cheese wheels and other chefs shoving you. Most points when the timer runs out wins.

```
packages/shared   Types, socket events, stations + 20 recipes + hazards (kitchen.ts), phone gesture detectors (gestures.ts)
apps/server       Node + Express + Socket.IO; RoomManager, GameEngine (server-authoritative kitchen, 30 Hz)
apps/web          React + Vite; / (home), /host/:code (big screen), /play/:code (phone controller)
```

## How to play

1. **Open a kitchen** on the laptop or TV (home page → **Create room**). Players scan the QR code or type the 4-letter code on their phones and enter a name (15 characters max).
2. **Customize** while you wait: pick a colour (each colour can only be used by one chef) and a face (Plain, Handlebar, Big Beard, Goatee, Shades, Specs, Pirate, Rosy). The chef hat always stays on.
3. **The first phone to join is the head chef.** Their phone has the shift-length picker (2, 3, 5, 7 or 10 minutes), a **Pushing On / Off** switch, and the **OPEN THE KITCHEN!** button, and after a round, **NEXT SHIFT!**. If the head chef disconnects, the next connected phone takes over (and the first joiner gets it back when they reconnect). The TV has no buttons.
4. Every chef gets a random recipe: **4 ingredients from 4 different stations**. The top of your phone shows the 4 station symbols, with the food you need under each.
5. **Tilt to walk.** When you reach a station you need, your phone buzzes and the big button lights up. Tap it, then **do the motion** to fill the bar (the phone shows a 3D demo of exactly what to do).
6. With all 4 made, walk to the **SERVE** table in the middle (a hungry diner sits there; he's solid, like the table) and tap **SERVE!**. +100 points (+50 if served within 35 s, +25 within 60 s), then you get a new ticket. The diner eats your dish and leaves the empty plate.
7. The last 30 seconds are **RUSH HOUR**: double points. A full-screen alarm flashes on the TV when it starts.
8. Highest score wins: the winner is crowned and dances on the results screen while everyone else looks sad. A tie for first says **IT'S A TIE!** and the tied chefs just shrug.

### Stations

| Station | Motion on the phone | Makes (5 each) |
| --- | --- | --- |
| 🔪 Chopping Board (CHOP) | Hold the phone sideways like a knife and chop straight down (8 chops) | Lettuce, tomato, onion, mushroom, carrot |
| 🍳 Frying Pan (FLIP) | Hold the phone flat, lift the top edge up (that's a flip), back to flat, repeat. Wildly over-flicking spills and costs progress | Burger patty, fried egg, bacon, grilled chicken, fish |
| 🥄 Stirring Pot (STIR) | Phone flat, move it in big full circles (4 circles) | Tomato sauce, cheese sauce, chocolate sauce, soup base, curry sauce |
| 🫓 Dough Bench (KNEAD) | Push the phone forward and pull it back; every stroke counts (12 strokes) | Bread, burger bun, pizza dough, tortilla, sub roll |
| 🥣 Mixing Bowl (MIX) | Gentle side-to-side shakes (12) | Pancake batter, omelette mix, cake batter, cookie mixture, cream filling |
| 🧃 Juicer (POUR) | One long pour: tilt the phone sideways and hold it there until the glass is full (~4 s; a partial tilt pours slower) | Orange juice, lemon juice, fruit purée, apple juice, water |

Phones that can't do motion (no sensor, permission denied, or plain http) automatically get **on-screen controls** instead: a joystick to walk, and per station: tap CHOP; tap FLIP in the timing zone; drag circles round the pot; alternate PUSH/PULL; alternate LEFT/RIGHT; press and hold HOLD TO POUR. Partly made ingredients are remembered if you step away.

**How the bar fills:** with motion, there are no fixed counts. The bar fills smoothly at a speed set by **how accurate your motion is**: the phone streams an accuracy score (0–100%) about 10 times a second, and the bar fills at that fraction of full speed. Clean, well-timed motions keep accuracy near 100% (a station takes 2.5–4.5 s, its `fillMs` in `kitchen.ts`); a partly-right motion fills it slower; below 20% (holding still, or the wrong motion) it doesn't move at all. The server measures the time itself, so sending faster can't cheat it. The counts in the table above are for the on-screen buttons only. Two chefs can share a station.

If someone taps **Deny** on the phone's motion permission popup, the game shows "This game runs on phone motion" with an **Allow motion** button, which brings back the phone's own grey **Allow / Deny** box. iPhones won't show that box twice on the same page, so if it's blocked the page reloads by itself first (you stay in the game) and the next tap on **Allow motion** opens the box. If an iPhone still blocks it after that, the popup explains how to reset it (close the tab and reopen the link).

### Pushing

Standing right next to another chef? **Shake your phone hard** (three strong jolts in under a second) to shove them. They slide a short, controlled distance straight away from you and stop. A chef who was cooking gets knocked off the station (their progress is kept, but they have to tap the station again), and their phone says who pushed them. Each chef's push recharges for **5 seconds**; the bar above the movement circle (in your chef's colour) shows when it's ready. Missing (nobody close enough) doesn't use up the cooldown. Phones without motion get a **TAP TO PUSH** button instead.

Pushing is **on by default**. The head chef can switch it **off** on their phone before a shift (or between shifts); then nobody can push, the push bar disappears and the TV lobby shows "Pushing off".

### Kitchen chaos

Nothing happens for the first 12% of the shift. After that, hazards appear every ~20 s, speeding up to every ~9 s near the end (a bit faster in rush hour), and bigger ones unlock as the shift goes on. **Every kind appears at least once per shift.** Big ones flash a warning on the TV first.

| Hazard | Unlocks | What happens | To recover, your phone takes over until you… |
| --- | --- | --- | --- |
| 💦 Water spill | start | A puddle on the floor; walk into it and you slip | wipe it: phone flat, big circles (3). Cleans it for everyone |
| 🐔 Runaway chicken | 30% | Runs around for ~12 s; bump into it and you're covered in feathers | shake them off: forward/back strokes (6) |
| 🔥 Station fire | 35% | A station burns and can't be used (cooks there jump back, progress kept). Tap the station to fight it | spray the extinguisher: sweep side to side (10) |
| ☄️ Meatball meteor | 50% | A red target flashes for 2.5 s, then it lands and knocks down anyone under it. Up to 2 at once late in the shift | get up: lift the phone up and down (5) |
| 🧀 Cheese wheel | 60% | A lane flashes for 2.5 s, then a giant cheese rolls across it, flattening anyone in the way | get up: lift the phone up and down (5) |

Recovery fills **by accuracy**, just like the stations: the more accurately you do the recovery motion, the faster the bar fills (3.5–5 s at full accuracy, `fillMs` in `STUCK`); below 20% it doesn't move. The numbers in brackets above are taps for the on-screen buttons only. After recovering you can't be hit again for 2 seconds. On the TV, chefs act it out: rubbing the puddle with a cloth, spraying foam on the fire, pushing themselves up with dizzy stars, or shaking off feathers.

### Adding recipes

Add a row to `RECIPES` in `packages/shared/src/kitchen.ts`: an id, a short name, an emoji and 4 ingredient ids from 4 different stations. `validateRecipes()` (run by the tests) rejects anything else. No station code changes are needed.

## Quick start

Requires **Node 20.19+ or 22 LTS**.

```bash
npm install
npm run dev          # shared (watch) + server :3000 + Vite :5173
```

Open http://localhost:5173 on the laptop and click **Create room**. For extra test players without phones, use Incognito windows (they get the joystick and station buttons). The first one to join is the head chef and starts the game.

Other commands:

```bash
npm test             # unit tests + socket integration test (server)
npm run typecheck    # all packages
npm run build        # production build (shared -> server -> web); the web build type-checks first
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

Set `VITE_PUBLIC_URL=http://<laptop-LAN-IP>:5173` in `.env`. Players can join, but **motion controls are blocked on plain http**, so phones fall back to the on-screen joystick and buttons.

On the phone: scan the QR code, enter a name and tap **Join**. That same tap asks for motion permission on iPhone. The controller recenters automatically when the countdown starts, and there's a **Recenter** button. ⚙️ Controls has tilt sensitivity, flip left/right and flip forward/back.

## Deploying (HTTPS + WebSockets)

The server serves the frontend and Socket.IO from one origin, so any host that runs a persistent Node process with WebSockets works. Use one instance, because room state is in memory.

**Render** (free tier is fine for a demo): New → Web Service → connect the repo, and pick the branch you want live.
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/health`

If the build fails (for example a TypeScript error), Render keeps serving the previous version, so check the deploy log if a change doesn't show up.

**Railway / Fly.io**: same build and start commands. `PORT` is provided by the platform.

Free tiers may sleep when idle. Open the URL a minute before your demo.

If you host the frontend separately (e.g. Vercel), set `VITE_SERVER_URL` at web build time and `CORS_ORIGIN` on the server.

## How it works

- **Rooms** (`apps/server/src/rooms/RoomManager.ts`): rooms live in memory with 4-letter codes; reconnect tokens rotate on every resume, so reloading a phone or the host restores the same chef or host. The room also tracks the **head chef** (first connected phone, in join order), the next shift's length, and each chef's colour and face (colours are unique per room).
- **Kitchen engine** (`apps/server/src/game/GameEngine.ts`): 30 Hz fixed step. Walls, counters, the serve table and the diner are solid; chefs freeze while working or while knocked down. The server decides which station you're at, whether your recipe needs it, progress, points, pushes (range + cooldown), hazards (spawn schedule, warnings, who gets hit, recovery) and the timer. Gestures are rate-limited per station (e.g. one chop per 140 ms), so mashing doesn't help.
- **Gesture detection** (`packages/shared/src/gestures.ts`, unit-tested with simulated motion): readings are converted relative to **gravity** (up/down, left/right, forward/back), so it works however the phone is held and despite iOS/Android axis differences. Chop = sharp vertical spikes; flip = from flat, the top edge lifting past ~25° (from the gravity direction, so it works whatever the phone's gyro reports; a quick top-edge-up gyro rotation also counts), then back to flat to arm the next one; stir = the horizontal acceleration vector turning a full circle (shaking back and forth resets it); knead = forward/back strokes with the other axis fairly quiet (frantic shaking ignored); mix = side-to-side strokes with the other axis quiet (so circles don't count); pour = how far gravity has swung onto the phone's short axis (held sideways = pouring at full speed). Hazard recovery reuses these: stir to wipe, chop to get up, knead to shake off feathers, mix to spray. Shake-to-push is detected separately in `apps/web/src/hooks/useShake.ts`.
- **Kitchen events** (`apps/server/src/socket/kitchenHandlers.ts`): interact, gesture, recover, push, step away and serve. Each looks the sender up through the RoomManager, so a phone can only control its own chef.
- **Network**: phones send movement at 30 Hz (volatile) and one event per recognised gesture. Snapshots (chefs + hazards + events) go only to the host screen at 30 Hz; each phone gets its own `kitchen:status` about 10× per second (recipe, progress, can-interact, can-serve, fire here, stuck, push cooldown, who pushed you, score, rank, time).
- **Rendering**: the host canvas renders ~100 ms behind live and interpolates between snapshots. Stations animate only while someone is using them. Emoji are drawn as **3D models** from [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT), loaded from GitHub (`apps/web/src/game/emoji3d.ts`); if they can't load, the normal emoji is shown instead. Hazard art is in `apps/web/src/game/hazardArt.ts`, the phone's 3D motion demos in `apps/web/src/components/GestureDemo.tsx` + `styles/demo.css`, and the home screen's background chases in `apps/web/src/components/HomeChase.tsx`.

### Events (see `packages/shared/src/events.ts`)

| Client → server | Ack | Notes |
| --- | --- | --- |
| `room:create {nickname?}` | `{code, playerId, role:'host', token}` | |
| `room:resume-host {code, token}` | same | host reload / reconnect |
| `room:join {code, nickname, token?}` | `{code, playerId, token, nickname, color, phase, resumed}` | |
| `room:settings {roundMinutes?, pushing?}` | `{ok}` | head chef (or host), between shifts; shift length 2/3/5/7/10 and/or pushing on/off |
| `player:customize {color?, face?}` | `{color, face}` | between shifts; taken colours are refused |
| `game:start {}` / `game:rematch {}` | `{ok}` | head chef phone (or host) |
| `player:input {seq, x, y}` | — | volatile |
| `player:recenter {}` | — | stops the character until next input |
| `net:ping {}` | `{serverTime}` | connectivity test |
| `kitchen:interact {}` | — | start working at your station (or start fighting its fire) |
| `kitchen:rep {good}` | — | one on-screen button step (or a messed-up motion, which costs progress) |
| `kitchen:effort {a}` | — | ~10×/s while working with motion: accuracy 0–1; the server fills the meter by accuracy × time |
| `kitchen:recover {good}` | — | one recovery motion while knocked down / slipped / feathered / fighting a fire |
| `kitchen:push {}` | — | shove the chef right next to you (5 s cooldown) |
| `kitchen:cancel {}` | — | step away (progress kept) |
| `kitchen:serve {}` | — | serve the finished dish at the serve table |

Server → client: `room:created`, `room:state` (includes `captainId` and `roundDurationMs`), `game:started`, `game:snapshot` (host only), `game:ended`, `game:results` (rankings + stats), `kitchen:status` (to one phone), `server:error`. Error codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `INVALID_INPUT`, `INVALID_NICKNAME`, `INVALID_SESSION`, `NOT_HOST`, `INVALID_PHASE`, `NOT_ENOUGH_PLAYERS`, `COLOR_TAKEN`, `RATE_LIMITED`.

### Tuning

All in `packages/shared/src/` unless noted:

- `kitchen.ts`: stations (gesture counts, rate limits, penalties, ingredients), recipes, kitchen layout, scoring, `HAZARDS` (unlock times, spawn rate, sizes, speeds), `STUCK` (recovery motions and counts), `PUSH` (reach, cooldown, shove distance), chef faces.
- `gestures.ts`: gesture thresholds.
- `config.ts`: default shift length, shift-length options, player limits, `hazards` (set to 0 to turn off random hazards; the tests do this).
- `apps/web/src/hooks/useShake.ts`: how hard you have to shake to push.

Players adjust tilt sensitivity on their phone (⚙️ Controls). For solo testing, set `MIN_PLAYERS=1`.

## Manual phone checklist (must be done on real devices)

Motion sensors can't be fully emulated, so before the demo check on at least one iPhone (Safari) and one Android phone (Chrome):

- [ ] QR code opens `/play/CODE` over https
- [ ] iPhone shows the motion permission prompt on **Join**; Allow → tilt indicator moves
- [ ] Deny → the "This game runs on phone motion" popup appears; **Allow motion** brings back the iPhone's grey Allow/Deny box (after an automatic reload if needed) and Allow gets motion working
- [ ] Phone held still → indicator stays centered; tilt left / right / forward / back → chef moves the **same** way on the big screen
- [ ] First phone to join shows the head chef card; changing the shift length updates the TV; another phone can't start
- [ ] Colour and face changes show on the TV; a taken colour can't be picked
- [ ] Lock or switch away from the phone and come back → it reconnects as the same player
- [ ] Works over cellular data, not just venue Wi-Fi
- [ ] Walking up to a needed station buzzes (Android) and lights up the button
- [ ] Each station's motion fills its bar: chop, flip, stir, knead, mix, pour (try each on iPhone **and** Android; adjust thresholds in `gestures.ts` if one is too strict or too easy)
- [ ] The wrong motion at a station does nothing (e.g. shaking at the pot)
- [ ] A phone without motion (or denied) gets the joystick and station buttons, and pour still needs 4
- [ ] Shake next to another chef pushes them; cooldown bar refills over 5 s; a cooking chef gets knocked off and sees who did it
- [ ] Each hazard appears during a full shift, and each recovery motion works
- [ ] SERVE at the serve table scores and deals a new recipe; rush hour alarm + double points
- [ ] Full round with 4+ phones: join → customize → cook → results (winner dances / tie shrugs) → next shift
