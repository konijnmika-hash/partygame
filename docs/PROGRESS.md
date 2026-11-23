# Bloop Bash — build progress

Working checklist. Each minigame = server logic (`server/games/<category>/`) + client view
(`client/src/games/<category>/<id>.tsx`) + bot, verified by the bot simulation test
(`tests/unit/games.test.ts`) and the browser smoke test (`tests/e2e/smoke-games.cjs`).

## Platform
- [x] Shared core: types, catalog (150 games), scoring normalization, RNG, levels, cosmetics, achievements
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
- [ ] Physics (0/10)
- [ ] Racing (0/10)
- [ ] Team (0/12)
- [ ] Weird (0/10)
- [ ] Arcade originals (0/13)
- [ ] Skill originals (0/15)
- [ ] Brain originals (0/17)
- [ ] Mind originals (0/13)
