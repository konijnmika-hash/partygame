// The catalog is the single source of truth for the game list: every entry must be a real,
// playable game with server logic and a client view (no placeholders).
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { CATALOG } from '@shared/catalog/index';
import { CATEGORIES } from '@shared/categories';
import { GAME_DEFS } from '../../server/games/index';

const views = new Set<string>();
for (const c of readdirSync('client/src/games')) {
  for (const f of readdirSync(`client/src/games/${c}`)) if (f.endsWith('.tsx') && !f.startsWith('_')) views.add(f.replace('.tsx', ''));
}
const server = new Set(GAME_DEFS.map((d) => d.id));

describe('game catalog', () => {
  it('has at least 100 games', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(100);
  });

  it('every catalog game has server logic and a client view', () => {
    const missing = CATALOG.filter((g) => !server.has(g.id) || !views.has(g.id)).map((g) => `${g.id}${server.has(g.id) ? '' : ' (no server)'}${views.has(g.id) ? '' : ' (no view)'}`);
    expect(missing).toEqual([]);
  });

  it('every server game is in the catalog', () => {
    const ids = new Set(CATALOG.map((g) => g.id));
    expect([...server].filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every category has games and every game has complete metadata', () => {
    for (const c of CATEGORIES) expect(CATALOG.some((g) => g.category === c.id), c.id).toBe(true);
    for (const g of CATALOG) {
      expect(g.instructions.length, g.id).toBeGreaterThanOrEqual(3);
      expect(g.controls.length, g.id).toBeGreaterThan(0);
      expect(g.minPlayers, g.id).toBeGreaterThanOrEqual(1);
      expect(g.maxPlayers, g.id).toBeGreaterThanOrEqual(g.minPlayers);
      expect(g.duration, g.id).toBeGreaterThan(0);
    }
  });
});
