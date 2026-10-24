# Tilt Mayhem

A Jackbox-style party game. One laptop/TV shows the arena; 2–8 players join from their phone browsers (no app install) and **tilt their phones** to roll their character around and grab gems. Gems are 1 point, gold stars are 3. Rounds last 60 seconds, then a leaderboard and one-click rematch.

```
packages/shared   TypeScript types, socket event contracts, game config
apps/server       Node + Express + Socket.IO; RoomManager, GameEngine (server-authoritative, 30 Hz)
apps/web          React + Vite; /host/:code (big screen), /play/:code (phone controller)
```

## Quick start

Requires **Node 20.19+ or 22 LTS**.

```bash
npm install
npm run dev          # shared (watch) + server :3000 + Vite :5173
```

Open http://localhost:5173 on the laptop and click **Create room**.

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

- **Rooms**: `RoomManager` keeps rooms in memory Maps. Room codes are 4 random letters (no I/O), checked for collisions. Each player gets a server-issued reconnect token, which rotates on every resume. Reloading a phone or the host screen restores the same player or host. Disconnected players keep their slot for 60 seconds in the lobby and results screens, and for the whole round during play. Empty rooms expire after 10 minutes.
- **Game loop**: `GameEngine` has no socket code. It uses a fixed-step accumulator at 30 Hz and runs at most 5 catch-up ticks after a stall. Phase deadlines (3 s countdown, 60 s round) use wall-clock time, so a round always lasts 60 s. Movement is `pos += input * 220 * dt`, clamped to the 1000×600 arena. There is light separation so players don't overlap. Each collectible goes to the closest player and is removed in the same tick, so it can't score twice.
- **Network**: phones send `player:input {seq,x,y}` at 30 Hz with volatile delivery. The server drops stale sequence numbers, non-finite values, values outside [-1, 1], non-players, and out-of-phase input, and rate-limits each socket with a token bucket. Snapshots go **only to the host screen** at 30 Hz, also volatile. Phones receive low-frequency `room:state` updates, max 5 per second, for score and phase. Join, start, and results use acknowledgements and reliable delivery.
- **Rendering**: the host canvas runs at display refresh rate. It renders about 100 ms behind the newest snapshot and interpolates between snapshots using server timestamps. The timer is also derived from server time.
- **Tilt** (`apps/web/src/hooks/useTilt.ts`): gamma controls left/right and beta controls forward/back, relative to a captured neutral pose. There is a 3° dead zone, 25° counts as full tilt, and an EMA smoothing factor of 0.25 is applied. Angle deltas handle wraparound. Values are kept in refs to avoid React re-renders. The hook verifies that sensor data actually arrives (2 s timeout) before reporting motion as available. Otherwise the phone shows a touch joystick. Players can flip either axis with "Controls feel backwards?".

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

Server → client: `room:created`, `room:state`, `game:started`, `game:snapshot` (host only), `game:ended`, `server:error`. Error codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `INVALID_INPUT`, `INVALID_NICKNAME`, `INVALID_SESSION`, `NOT_HOST`, `INVALID_PHASE`, `NOT_ENOUGH_PLAYERS`, `RATE_LIMITED`.

### Tuning

All gameplay numbers live in `packages/shared/src/config.ts`. Tilt sensitivity is set in `useTilt` options (`fullTiltDeg`, `deadZoneDeg`, `smoothing`). For solo testing, set `MIN_PLAYERS=1`.

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
- [ ] Full flow with as many phones as you can find: join → start → round → results → rematch
