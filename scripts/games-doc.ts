// Generates docs/GAMES.md from the game catalog (the single source of truth).
// Usage: npm run games:doc
import { writeFileSync } from 'node:fs';
import { CATALOG } from '../shared/catalog/index';
import { CATEGORIES } from '../shared/categories';
import { formatDuration } from '../shared/catalog/helpers';

const CONTROL: Record<string, string> = {
  tap: 'tap', swipe: 'swipe', drag: 'drag', draw: 'draw', type: 'type', joystick: 'joystick', keys: 'keyboard',
  vote: 'vote', mic: 'microphone', hold: 'hold', tilt: 'tilt', numpad: 'number pad',
};

const lines: string[] = [];
lines.push('# Bloop Bash — game list', '');
lines.push(`${CATALOG.length} minigames in ${CATEGORIES.length} categories. Generated from \`shared/catalog\` by \`npm run games:doc\`; do not edit by hand.`, '');
lines.push('| Category | Games | Originals |', '|---|---:|---:|');
for (const c of CATEGORIES) {
  const gs = CATALOG.filter((g) => g.category === c.id);
  lines.push(`| ${c.emoji} ${c.name} | ${gs.length} | ${gs.filter((g) => g.original).length} |`);
}
lines.push(`| **Total** | **${CATALOG.length}** | **${CATALOG.filter((g) => g.original).length}** |`, '');
for (const c of CATEGORIES) {
  const gs = CATALOG.filter((g) => g.category === c.id);
  lines.push(`## ${c.emoji} ${c.name}`, '', `_${c.blurb}_`, '');
  for (const g of gs) {
    const tags = [g.teams && 'teams', g.realtime === 'arena' && 'real-time arena', g.realtime === 'ghost' && 'real-time (predicted)', g.original && 'original', g.mic && 'optional mic', g.needsSound && 'sound on', g.orientation === 'landscape' && 'best in landscape'].filter(Boolean);
    lines.push(`### ${g.emoji} ${g.name} \`${g.id}\``, '');
    lines.push(`${g.tagline}`, '');
    lines.push(`- **Players:** ${g.minPlayers}–${g.maxPlayers} · **Length:** ${formatDuration(g.duration)} · **Controls:** ${g.controls.map((k) => CONTROL[k] ?? k).join(', ')}${tags.length ? ` · **Notes:** ${tags.join(', ')}` : ''}`);
    for (const step of g.instructions) lines.push(`- ${step}`);
    lines.push('');
  }
}
writeFileSync('docs/GAMES.md', lines.join('\n'));
console.log(`docs/GAMES.md written (${CATALOG.length} games)`);
