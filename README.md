# Bloop Bash 🎉

A colourful multiplayer party game for phones, tablets and PCs: **105 minigames** in 10 categories,
starring the Bloops, a cast of squishy original characters. Make a room, share the 4-letter code or
link, and play chaotic rounds together. Everyone plays on their own device, and the server keeps
the score.

- **105 playable minigames**: drawing, reaction, social deduction, physics chaos, racing, memory,
  puzzles, team games, weird & funny, and 13 original real-time arcade brawls.
  The full list with rules is in [docs/GAMES.md](docs/GAMES.md).
- **Real multiplayer**: rooms with codes, invite links and QR codes, quick-play matchmaking into
  public rooms, live presence, automatic reconnect (reload mid-game and you're back in), host
  controls (rounds, game mode and playlist, difficulty, speed mode, teams, kick, bots), late joiners
  spectate until the next round, and room chat.
- **Fair scoring**: every round converts into 0–1000 points (placement, performance,
  participation, bonuses) with a per-player breakdown, so no single game dominates.
- **Progression**: XP and 100 levels, 34 achievements, 103 cosmetics (colours, eyes, mouths, hats,
  accessories, titles) that are all earned by playing, plus lifetime stats and personal records.
- **Leaderboards**: room/session standings, daily, weekly, all-time and friends.
- **Made for touch**: on-screen joysticks and buttons, swipe and tap gestures, haptics, portrait
  and landscape layouts; keyboard and gamepad on desktop.
- **Original audio**: all sound effects and music are synthesised in the browser (Web Audio).
- **Cheat-resistant**: the server runs every game. Clients only send inputs, which are validated
  and rate-limited; scores are never accepted from a client. Predicted real-time games are
  re-simulated on the server from timestamped inputs.

## Quick start

Requires Node.js 22+.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 (the Vite dev server proxies the API and sockets to the game server on
port 3001). To play with a phone on the same Wi-Fi, open `http://<your-computer-ip>:5173`.

### Production build

```bash
npm run build
```

```bash
npm start
```

The server serves the built client and the API on http://localhost:3001. Data lives in SQLite at
`data/bloopbash.db`.

### Docker

```bash
docker build -t bloop-bash .
```

```bash
docker run -p 3001:3001 -v bloop-data:/app/data bloop-bash
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Interface to bind |
| `DATABASE_PATH` | `data/bloopbash.db` | SQLite database file |
| `NODE_ENV` | — | `production` turns off the dev-only socket origin allowances (localhost / LAN dev servers) |
| `COOKIE_SECURE` | auto | `Secure` session cookie: `1` always, `0` never; by default only for HTTPS requests, so phones can join a LAN game over plain `http://<ip>:3001` |
| `TRUST_PROXY` | off | `1` behind a reverse proxy, so client IPs (rate limits) and HTTPS detection (cookies) are correct |
| `ALLOWED_ORIGINS` | — | Extra comma-separated origins allowed to open a socket (tunnels, dev tools) |
| `MAX_ROOMS` | `2000` | Upper limit on simultaneous rooms |

## Tests

```bash
npm test
```

Runs the unit and integration suites (Vitest):

- every minigame is played to the end by bots at several player counts and on hard difficulty,
  checking for errors, payload size, valid scores and participation;
- deterministic simulations replay identically and survive late-input rewinds;
- the catalog test guarantees every listed game has server logic and a client view;
- socket integration tests cover guest/password auth, a complete session with persistence,
  quick-play matchmaking and friends leaderboards.

```bash
npm run test:e2e
```

Builds the app, starts a throwaway server and drives real browsers with Playwright: a full UI
session (desktop host + phone guest via the invite link, mid-game reload/reconnect, final podium,
leaderboards) and a UI smoke test of a sample of games. Add `-- --all` to smoke-test all 105 games.

```bash
npm run typecheck
```

## Project layout

```
client/            React app (Vite)
  src/screens/     Home, lobby, intro, game, results, final, leaderboards, profile, friends, settings
  src/games/       One view per minigame: games/<category>/<game-id>.tsx (auto-registered)
  src/game/        Game UI kit: canvases (arena, predicted sims, drawing), controls, HUD widgets
  src/audio/       Procedural sound effects and music
server/            Node game server (Express + Socket.IO + SQLite)
  games/           One module per minigame: rules, bots and scoring
  engine/          Game runner, arena physics, predicted-sim host, quiz/drawing/team helpers
  rooms/           Rooms, matchmaking, playlists, bots
  realtime/        Sockets, presence, rate limiting
  db/ auth/ progression/   Persistence, sessions, XP, achievements, records
shared/            Code used by both sides: types, game catalog, scoring, levels, cosmetics,
                   deterministic simulations
tests/             Unit, integration and browser end-to-end tests
docs/              Architecture, game list and build checklist
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together and how to add a game.
