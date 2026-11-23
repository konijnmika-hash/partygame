# Bloop Bash — architecture

One Node.js process serves the React client, a small REST API and a Socket.IO endpoint, and runs
every room and every minigame in memory. Durable data (accounts, stats, scores, achievements,
friends, session history) is stored in SQLite. TypeScript runs on both sides, and `shared/` holds
everything both sides must agree on.

```
 browser (React, Vite)                     server (Node 22)
 ┌───────────────────────┐   REST /api    ┌──────────────────────────────────────────┐
 │ screens  ── zustand ──┼───────────────►│ http: auth, profile, leaderboards, friends│
 │ game views (111)      │   Socket.IO    │ realtime: sockets, presence, rate limits  │
 │ canvases, input, audio├◄──────────────►│ rooms: lifecycle, playlists, bots, match  │
 └───────────────────────┘  pub/priv/evt  │ engine: GameRunner + 111 game modules     │
                                          │ progression: XP, achievements, records    │
                                          │ db: better-sqlite3                        │
                                          └──────────────────────────────────────────┘
```

## Rooms and sessions

A room moves through `lobby → intro → playing → results → standings → (next round) → final`.

- **Creating and joining**: rooms get a 4-letter code (no look-alike letters). Clients join with the
  code, the invite link (`/?join=CODE`), a QR code, or quick play, which places the player in an
  open public room or creates one.
- **Host controls**: rounds, game mode (random, categories or a hand-picked playlist), difficulty,
  team mode, house rules (double-points final, speed mode, hidden scores, underdog bonus), max
  players, kicking, adding and removing bots, and "play now with bots" for solo practice. If the
  host leaves, the host role passes to the next player.
- **Planner**: picks the next game from the pool, skipping games that don't fit the current player
  count and avoiding repeats.
- **Presence and reconnect**: a disconnected player keeps their seat for a grace period. On
  reconnect the server sends a full resync (room state, the game's public and private state, and
  cached assets) so a reloaded page continues the running game. Players who join mid-game
  spectate until the next round.

## The game engine

Every minigame is a `GameDef` (`server/engine/types.ts`), a plain object holding the game's rules:

| Hook | Purpose |
|---|---|
| `setup(ctx)` / `start(s, ctx)` | build the initial state, start timers |
| `action(s, ctx, pid, a)` | discrete player actions (answers, votes, taps, strokes) |
| `input(s, ctx, pid, frame)` | continuous joystick/button frames for real-time games |
| `tick(s, ctx, dt)` | runs every 50 ms server step |
| `pub(s, ctx)` / `priv(s, ctx, pid)` | what everyone sees / what one player sees (hidden roles, own hand) |
| `bot(s, ctx, pid)` | bot brain, called on a randomised cadence |
| `results(s, ctx)` | raw score, 0–1 performance, participation, bonuses, records and stats per player |

`GameRunner` (`server/engine/runner.ts`) owns the clock, the seeded RNG, timers and output.
Turn-based games publish a new state only when it changes (JSON diff). Real-time games publish
every N steps. `ctx` offers difficulty scaling (`ctx.diff(easy, normal, hard)`), speed-mode
time scaling, teams, events, cached assets (puzzles, drawings) and participation tracking.

Three real-time models cover the action games:

1. **Arena** (`engine/arena.ts`): the server simulates bodies, collisions and dashes; clients render
   snapshots with ~90 ms interpolation (`client/src/game/ArenaCanvas.tsx`).
2. **Predicted simulations** (`shared/ghost.ts`, `shared/ghosts/*`): each player runs their own
   deterministic simulation that uses only arithmetic and polynomial trigonometry, so it is
   bit-identical everywhere. The client applies its input immediately and streams timestamped
   inputs. The server re-simulates (rewinding for late inputs) and corrects the client when they
   disagree. Other players appear as ghosts.
3. **Phased games**: quizzes, drawing, voting and reaction games run on timers with all-answered
   early exits. They use shared helpers for quizzes (`engine/quiz.ts`), drawing (`engine/drawing.ts`)
   and teams (`engine/teams.ts`).

## Scoring and progression

`shared/scoring.ts` turns every round into 0–1000 points: placement (up to 500, ties share),
absolute performance (up to 400), participation (50) and game-specific bonuses (up to 50).
Players who never act get no placement or participation points. Team games give every teammate
the team result plus a share for individual contribution.

After each round the server records points, XP (`shared/levels.ts`, levels 1–100), per-game stats,
personal records and achievements (`server/progression/`). Cosmetics (`shared/cosmetics.ts`)
unlock through levels and achievements, and the server checks every avatar change against the
player's unlocks.

Leaderboards (`server/db/leaderboard.ts`) cover daily, weekly and all-time points, plus friends.
Room and session standings come from the live room.

## Security and anti-cheat

- The server runs every game. Clients send only inputs and actions; scores are always computed
  on the server.
- Socket payloads are validated (types, ranges, lengths) and rate-limited per socket and per
  event type (token buckets); HTTP routes are rate-limited per IP.
- Predicted simulations are re-run on the server, so a modified client cannot fake its position
  or progress.
- Sessions use random tokens in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production).
  Passwords are hashed with scrypt. State-changing API calls need a custom header (CSRF), and
  sockets check the `Origin`.
- Strict security headers and a Content-Security-Policy; free text (names, chat, answers) is
  length-limited, cleaned and profanity-filtered.

## Client

- `client/src/state/store.ts`: one zustand store (profile, room, game state, settings, toasts).
- `client/src/net/`: REST helper, Socket.IO client with clock sync (`serverNow()`), reconnect and
  resync.
- `client/src/screens/`: the app screens. `GameScreen` hosts the current game view behind an error
  boundary.
- `client/src/game/`: the game UI kit (HUD widgets, choice grids, number pads, virtual joystick
  and buttons, swipe/tilt input, the three canvas frameworks).
- `client/src/games/<category>/<id>.tsx`: one lazily loaded view per game, registered
  automatically through `import.meta.glob`.
- `client/src/audio/`: synthesised SFX and original chiptune tracks for lobby, games and podium (Web Audio), plus haptics.

## Adding a minigame

1. Add its metadata to `shared/catalog/<category>.ts`: id, name, emoji, tagline, instructions,
   controls, player range, typical duration and flags (`teams`, `realtime`, …).
2. Write the rules in `server/games/<category>/<name>.ts` with `defineGame`, including a bot and
   `results`, and register it in that category's `index.ts`.
3. Write the view `client/src/games/<category>/<id>.tsx` (default export). It receives
   `pub`, `priv`, `send` (actions), `input` (real-time frames), `players`, `me` and helpers.
4. Run `npm test` (the bot simulation and catalog tests pick the game up automatically) and
   `node tests/e2e/smoke-games.cjs <url> <id>` against a running server.
5. Run `npm run games:doc` to refresh `docs/GAMES.md`.
