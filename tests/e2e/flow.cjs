// End-to-end user flow through the real UI (no debug shortcuts for actions):
// a desktop host creates a room, picks two games and adds a bot; a phone guest joins through the
// invite link, readies up, reloads mid-game (reconnect), and both play through results,
// standings and the final podium; the host then checks the leaderboards.
//   node tests/e2e/flow.cjs http://localhost:3311 [shotDir]
const { chromium, devices } = require('playwright');

const base = process.argv[2] || 'http://localhost:3311';
const shotDir = process.argv[3] || '';
const GAMES = ['Lightning Reflex', 'Color Reaction'];

const phaseOf = (page) => page.evaluate(() => (window.__bb && window.__bb.get().room ? window.__bb.get().room.phase : null));

async function waitPhase(page, phases, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ph = await phaseOf(page).catch(() => null);
    if (phases.includes(ph)) return ph;
    await page.waitForTimeout(150);
  }
  throw new Error(`timeout waiting for ${phases.join('/')} (now ${await phaseOf(page).catch(() => '?')})`);
}

/** Taps whatever the current game offers (tap zones, choices, buttons) for a while. */
async function play(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const els = await page.$$('.game-main .tap-zone, .game-main .choice, .game-main button:not([disabled])');
      if (els.length) {
        const el = els[Math.floor(Math.random() * els.length)];
        const box = await el.boundingBox();
        if (box && box.width > 2) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else await page.keyboard.press(' ');
    } catch {
      // the element went away mid-click: fine
    }
    await page.waitForTimeout(120 + Math.random() * 200);
  }
}

/** Clicks the visible "continue"-style button on intro / results / standings screens if present. */
async function advance(page) {
  const btn = page.locator('button:not([disabled])', { hasText: /Got it|Continue|Next: round|See the winners/ }).first();
  if (await btn.count()) await btn.click({ timeout: 2000 }).catch(() => {});
}

async function main() {
  const browser = await chromium.launch();
  const host = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const guest = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = [];
  const ignore = /favicon|Failed to load resource|WebSocket connection/;
  for (const [who, p] of [['host', host], ['guest', guest]]) {
    p.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && !ignore.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
  }
  const step = (s) => console.log('• ' + s);

  step('host creates a room');
  await host.goto(base + '/?debug=1');
  await host.getByRole('button', { name: /Create Room/ }).click();
  await host.waitForSelector('.room-code', { timeout: 20000 });
  const code = ((await host.textContent('.room-code')) || '').match(/[A-Z]{4}/)[0];
  step(`room ${code}: 2 rounds, picked games`);
  for (let i = 0; i < 25; i++) {
    const n = Number(await host.locator('.sf-num').first().textContent());
    if (n === 2) break;
    await host.getByRole('button', { name: n > 2 ? 'Fewer rounds' : 'More rounds' }).click();
    await host.waitForTimeout(120);
  }
  await host.getByRole('radio', { name: /Pick games/ }).click();
  await host.getByRole('button', { name: /Choose games/ }).click();
  for (const g of GAMES) {
    await host.getByPlaceholder('Search games...').fill(g);
    await host.locator('.picker-grid .gt-name', { hasText: g }).first().click();
  }
  await host.getByRole('button', { name: 'Save playlist' }).click();
  await host.waitForFunction((n) => window.__bb.get().room.settings.playlist.length === n, GAMES.length);

  step('guest joins with the invite link on a phone and readies up');
  await guest.goto(`${base}/?join=${code}&debug=1`);
  await guest.waitForSelector('.lobby', { timeout: 20000 });
  await guest.getByRole('button', { name: 'Ready?' }).click();
  await guest.getByRole('button', { name: '✓ Ready!' }).waitFor();

  step('host adds a bot and starts');
  await host.click('.member-card.add');
  await host.waitForFunction(() => window.__bb.get().room.members.length === 3);
  await host.click('.start-btn', { force: true }); // the button pulses forever, so it never counts as "stable"

  for (let round = 1; round <= GAMES.length; round++) {
    await waitPhase(host, ['intro']);
    await waitPhase(guest, ['intro']);
    if (shotDir && round === 1) await guest.screenshot({ path: `${shotDir}/flow-intro-mobile.png` });
    await advance(host);
    await advance(guest);
    await waitPhase(host, ['playing']);
    step(`round ${round}: playing`);
    if (round === 1) {
      await Promise.all([play(host, 2500), play(guest, 2500)]);
      step('guest reloads mid-game and must land back in the running game');
      await guest.reload();
      await guest.waitForFunction(() => window.__bb && window.__bb.get().connected, null, { timeout: 20000 });
      const back = await waitPhase(guest, ['playing', 'results'], 20000);
      if (back !== 'playing' && back !== 'results') throw new Error('guest did not reconnect into the game');
    }
    // keep playing until the game ends
    while ((await phaseOf(host)) === 'playing') await Promise.all([play(host, 1500), play(guest, 1500)]);
    await waitPhase(host, ['results', 'standings', 'final']);
    if (shotDir && round === 1) await guest.screenshot({ path: `${shotDir}/flow-results-mobile.png` });
    // results -> standings -> next round / final
    for (let i = 0; i < 40; i++) {
      const ph = await phaseOf(host);
      if (ph === 'final' || (ph === 'intro' && round < GAMES.length)) break;
      await advance(host);
      await advance(guest);
      await host.waitForTimeout(400);
    }
  }

  step('final podium');
  await waitPhase(host, ['final']);
  await host.waitForSelector('.page.final .podium', { timeout: 15000 });
  await guest.waitForSelector('.page.final .podium', { timeout: 15000 });
  const title = await host.textContent('.page.final h1');
  if (!/wins|GG/.test(title || '')) throw new Error('unexpected final title: ' + title);
  if (shotDir) {
    await host.waitForTimeout(1800);
    await host.screenshot({ path: `${shotDir}/flow-final-desktop.png` });
    await guest.screenshot({ path: `${shotDir}/flow-final-mobile.png` });
  }

  step('back to the lobby, leave, and check the leaderboards');
  await host.getByRole('button', { name: /Back to lobby/ }).click();
  await waitPhase(host, ['lobby']);
  await host.getByRole('button', { name: /Leave/ }).first().click();
  await host.getByRole('button', { name: /Leaderboards/ }).click();
  await host.waitForSelector('.lb-row', { timeout: 15000 });
  const rows = await host.locator('.lb-row').count();
  if (rows < 1) throw new Error('leaderboard is empty after a finished session');
  if (shotDir) await host.screenshot({ path: `${shotDir}/flow-leaderboard-desktop.png` });

  await browser.close();
  if (errors.length) {
    console.log('FAIL: page errors\n  ' + errors.slice(0, 10).join('\n  '));
    process.exit(1);
  }
  console.log('PASS: full session flow');
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
