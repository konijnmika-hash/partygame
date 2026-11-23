# Bloop Bash — build progress

Working checklist. Each minigame = server logic (`server/games/<category>/`) + client view
(`client/src/games/<category>/<id>.tsx`) + bot, verified by the bot simulation test
(`tests/unit/games.test.ts`) and the browser smoke test (`tests/e2e/smoke-games.cjs`).

## Platform
- [x] Shared core: types, catalog (105 games), scoring normalization, RNG, levels, cosmetics, achievements
- [x] Server: SQLite + migrations, guest/password auth, REST API, Socket.IO, rooms, matchmaking, runner, progression
- [x] Client: design system, avatar art, screens (home, lobby, intro, game, results, standings, final,
      leaderboards, profile, friends, catalog, settings), procedural SFX + music, input (keys/gamepad/joystick)
- [x] Canvas frameworks: interpolated arena, client-predicted ghost sims, drawing canvas
- [x] Tests: bot simulation per game, socket integration, browser smoke test per game

## Minigames
- [x] Reaction (10/10)
- [x] Puzzle (10/10)
- [x] Memory (10/10)
- [x] Social (10/10)
- [x] Drawing (10/10)
- [x] Physics (10/10)
- [x] Racing (10/10)
- [x] Team (12/12)
- [x] Weird (10/10)
- [x] Arcade originals (13/13)

**Total: 105 playable games** (90 from the original list + 15 originals: 2 extra team games and 13
arcade games). The target was set to ~100 games in total, so the planned Skill, Brain and Mind
categories were dropped instead of shipping placeholders; `tests/unit/catalog.test.ts` enforces
that every catalog entry has server logic and a client view.
