// UI smoke test: plays each minigame in real browsers (desktop host + mobile guest) with random
// interactions, failing on page errors / crashed views. Usage:
//   node tests/e2e/smoke-games.cjs http://localhost:3311 [gameId,gameId|all] [secondsPerGame] [shotDir]
const { chromium, devices } = require('playwright');

const base = process.argv[2] || 'http://localhost:3311';
const which = process.argv[3] || 'all';
const secs = Number(process.argv[4] || 9);
const shotDir = process.argv[5] || '';

function call(page, expr) {
  return page.evaluate(expr);
}

async function waitPhase(page, phases, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ph = await page.evaluate(() => (window.__bb.get().room ? window.__bb.get().room.phase : null));
    if (phases.includes(ph)) return ph;
    await page.waitForTimeout(150);
  }
  throw new Error('timeout waiting for phase ' + phases.join('/'));
}

async function randomPlay(page, ms) {
  const end = Date.now() + ms;
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', '1', '2', '3', '4', 'a', 'd', 'w', 's'];
  const words = ['apple', 'cat', 'banana', '42', 'house', 'fish', 'yes', 'rain', 'tree'];
  while (Date.now() < end) {
    const r = Math.random();
    try {
      if (r < 0.45) {
        const btns = await page.$$('.game-main button:not([disabled]), .game-main .tap-zone, .game-main .cell, .game-main .choice');
        if (btns.length) {
          const b = btns[Math.floor(Math.random() * btns.length)];
          const box = await b.boundingBox();
          if (box && box.width > 2 && box.height > 2) {
            await page.mouse.click(box.x + box.width * (0.2 + Math.random() * 0.6), box.y + box.height * (0.2 + Math.random() * 0.6));
          }
        }
      } else if (r < 0.65) {
        await page.keyboard.press(keys[Math.floor(Math.random() * keys.length)]);
      } else if (r < 0.8) {
        const cv = await page.$('.game-main canvas');
        const box = cv && (await cv.boundingBox());
        if (box) {
          await page.mouse.move(box.x + box.width * Math.random(), box.y + box.height * Math.random());
          await page.mouse.down();
          for (let i = 0; i < 6; i++) await page.mouse.move(box.x + box.width * Math.random(), box.y + box.height * Math.random(), { steps: 3 });
          await page.mouse.up();
        }
      } else if (r < 0.9) {
        const inp = await page.$('.game-main input:not([disabled])');
        if (inp) {
          await inp.fill(words[Math.floor(Math.random() * words.length)]);
          await inp.press('Enter');
        }
      } else {
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(200);
        await page.keyboard.up('ArrowRight');
      }
    } catch (e) {
      // element vanished mid-action: fine
    }
    await page.waitForTimeout(80 + Math.random() * 160);
  }
}

async function main() {
  const browser = await chromium.launch();
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  const errors = { host: [], guest: [] };
  const ignore = /favicon|Failed to load resource|WebSocket connection/;
  host.on('pageerror', (e) => errors.host.push(e.message));
  guest.on('pageerror', (e) => errors.guest.push(e.message));
  host.on('console', (m) => { if (m.type() === 'error' && !ignore.test(m.text())) errors.host.push('console: ' + m.text()); });
  guest.on('console', (m) => { if (m.type() === 'error' && !ignore.test(m.text())) errors.guest.push('console: ' + m.text()); });
  await host.goto(base + '/?debug=1');
  await guest.goto(base + '/?debug=1');
  await host.waitForFunction(() => window.__bb && window.__bb.get().connected, null, { timeout: 20000 });
  await guest.waitForFunction(() => window.__bb && window.__bb.get().connected, null, { timeout: 20000 });
  const avail = await host.evaluate(() => [...window.__bb.get().available]);
  const ids = which === 'all' ? avail : which.split(',').filter(Boolean);
  const results = [];
  for (const id of ids) {
    errors.host.length = 0;
    errors.guest.length = 0;
    const t0 = Date.now();
    let status = 'ok';
    try {
      const c = await host.evaluate((gid) => window.__bb.emitAck('room:create', { rounds: 1, mode: 'playlist', playlist: [gid], allowRepeats: true }), id);
      if (!c.ok) throw new Error('create failed: ' + c.error);
      const code = c.data.code;
      const j = await guest.evaluate((cd) => window.__bb.emitAck('room:join', cd), code);
      if (!j.ok) throw new Error('join failed: ' + j.error);
      for (let i = 0; i < 2; i++) await call(host, () => window.__bb.emit('room:bot', 'add'));
      await host.waitForTimeout(300);
      const s = await call(host, () => window.__bb.emitAck('room:start'));
      if (!s.ok) throw new Error('start failed: ' + s.error);
      await waitPhase(host, ['intro']);
      await host.waitForTimeout(600);
      if (shotDir) await guest.screenshot({ path: shotDir + '/' + id + '-intro-mobile.png' });
      await call(host, () => window.__bb.emit('room:skip'));
      await call(guest, () => window.__bb.emit('room:skip'));
      await waitPhase(host, ['playing'], 15000);
      await waitPhase(guest, ['playing'], 15000);
      await host.waitForTimeout(1200);
      await Promise.all([randomPlay(host, secs * 500), randomPlay(guest, secs * 500)]);
      if (shotDir) {
        await host.screenshot({ path: shotDir + '/' + id + '-desktop.png' });
        await guest.screenshot({ path: shotDir + '/' + id + '-mobile.png' });
      }
      await Promise.all([randomPlay(host, secs * 500), randomPlay(guest, secs * 500)]);
      for (const p of [host, guest]) {
        const who = p === host ? 'host' : 'guest';
        const crashed = await p.$('text=This game hiccuped');
        if (crashed) throw new Error('error boundary shown on ' + who);
        const phase = await p.evaluate(() => window.__bb.get().room && window.__bb.get().room.phase);
        const hasView = await p.$('.game-main .g-stage, .game-main .arena-wrap, .game-main canvas');
        if (!hasView && phase === 'playing') throw new Error('no game view rendered on ' + who);
      }
    } catch (e) {
      status = 'FAIL: ' + e.message;
    }
    try {
      await call(guest, () => window.__bb.emitAck('room:leave'));
      await call(host, () => window.__bb.emitAck('room:leave'));
    } catch (e) {
      // ignore
    }
    await host.waitForTimeout(200);
    const errs = errors.host.map((e) => 'host: ' + e).concat(errors.guest.map((e) => 'guest: ' + e));
    if (errs.length && status === 'ok') status = 'ERRORS';
    results.push({ id, status, errs, sec: Math.round((Date.now() - t0) / 1000) });
    console.log((status === 'ok' ? 'PASS ' : 'FAIL ') + id.padEnd(26) + ' ' + status + (errs.length ? '\n     ' + errs.slice(0, 5).join('\n     ') : ''));
  }
  await browser.close();
  const bad = results.filter((r) => r.status !== 'ok');
  console.log('\n' + (results.length - bad.length) + '/' + results.length + ' games passed UI smoke test');
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
