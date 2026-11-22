// End-to-end server test with real HTTP + Socket.IO clients: auth, rooms, a full session,
// persistence, leaderboards, validation and reconnection.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../../server/app';
import { api, connect, emitAck, guest, trackState, waitFor, type TestUser } from '../helpers/client';

let srv: RunningServer;
let A: TestUser;
let B: TestUser;

beforeAll(async () => {
  srv = await startServer({ port: 0, host: '127.0.0.1', dbPath: ':memory:', quiet: true, speed: 6 });
  A = await guest(srv.url);
  B = await guest(srv.url);
});

afterAll(async () => {
  await srv?.close();
});

describe('auth + profile', () => {
  it('creates distinct guest accounts and remembers them via cookie', async () => {
    expect(A.profile.id).not.toEqual(B.profile.id);
    const again = await api(srv.url, '/api/auth/guest', { method: 'POST', body: {}, cookie: A.cookie });
    expect(again.json.data.id).toEqual(A.profile.id);
    const me = await api(srv.url, '/api/me', { cookie: A.cookie });
    expect(me.json.data.username).toEqual(A.profile.username);
  });

  it('rejects unauthenticated + CSRF-less requests', async () => {
    expect((await api(srv.url, '/api/me')).status).toBe(401);
    const res = await fetch(srv.url + '/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: A.cookie }, body: '{}' });
    expect(res.status).toBe(403);
  });

  it('validates avatar unlocks and usernames', async () => {
    const ok = await api(srv.url, '/api/me', { method: 'PATCH', cookie: A.cookie, body: { avatar: { color: 'c-sky', eyes: 'e-happy', mouth: 'm-grin', hat: 'h-beanie', acc: 'a-blush' } } });
    expect(ok.status).toBe(200);
    expect(ok.json.progress?.achievements).toContain('customizer');
    const locked = await api(srv.url, '/api/me', { method: 'PATCH', cookie: A.cookie, body: { avatar: { color: 'c-galaxy', eyes: 'e-happy', mouth: 'm-grin', hat: 'h-beanie', acc: 'a-blush' } } });
    expect(locked.status).toBe(403);
    const bad = await api(srv.url, '/api/me', { method: 'PATCH', cookie: A.cookie, body: { username: 'x' } });
    expect(bad.status).toBe(400);
    const rude = await api(srv.url, '/api/me', { method: 'PATCH', cookie: A.cookie, body: { username: 'shithead' } });
    expect(rude.status).toBe(400);
  });

  it('registers and logs in with a password', async () => {
    const C = await guest(srv.url);
    const reg = await api(srv.url, '/api/auth/register', { method: 'POST', cookie: C.cookie, body: { username: 'PartyTester', password: 'hunter22' } });
    expect(reg.status).toBe(200);
    expect(reg.json.data.registered).toBe(true);
    const dup = await api(srv.url, '/api/auth/register', { method: 'POST', cookie: B.cookie, body: { username: 'partytester', password: 'hunter22' } });
    expect(dup.status).toBe(409);
    const bad = await api(srv.url, '/api/auth/login', { method: 'POST', body: { username: 'PartyTester', password: 'nope-nope' } });
    expect(bad.status).toBe(401);
    const good = await api(srv.url, '/api/auth/login', { method: 'POST', body: { username: 'PartyTester', password: 'hunter22' } });
    expect(good.status).toBe(200);
    expect(good.json.data.id).toEqual(C.profile.id);
  });
});

describe('rooms + a full session', () => {
  it('plays a complete session over sockets and persists results', async () => {
    const sA = await connect(srv.url, A.cookie);
    const sB = await connect(srv.url, B.cookie);
    const stA = trackState(sA);
    const stB = trackState(sB);
    // invalid joins
    expect((await emitAck<any>(sB, 'room:join', 'ZZZZ')).ok).toBe(false);
    expect((await emitAck<any>(sB, 'room:join', '12')).ok).toBe(false);

    const created = await emitAck<any>(sA, 'room:create', null);
    expect(created.ok).toBe(true);
    const code = created.data.code;
    const joined = await emitAck<any>(sB, 'room:join', code.toLowerCase());
    expect(joined.ok).toBe(true);
    await waitFor(sA, 'room:state', (st) => st.members.length === 2);
    expect(stA.get().hostId).toEqual(A.profile.id);

    // non-host cannot change settings or start
    expect((await emitAck<any>(sB, 'room:settings', { rounds: 3 })).ok).toBe(false);
    expect((await emitAck<any>(sB, 'room:start')).ok).toBe(false);
    // host settings validation
    expect((await emitAck<any>(sA, 'room:settings', { rounds: 999 })).ok).toBe(false);
    expect((await emitAck<any>(sA, 'room:settings', { rounds: 2, mode: 'playlist', playlist: ['lightning-reflex'], allowRepeats: true })).ok).toBe(true);
    sA.emit('room:bot', 'add');
    await waitFor(sA, 'room:state', (st) => st.members.length === 3 && st.members.some((m: any) => m.isBot));

    // auto-tap whenever the light turns green
    for (const s of [sA, sB]) {
      s.on('game:pub', (pub: any) => {
        if (pub?.phase === 'go') s.emit('game:action', { t: 'tap', ms: 240 + Math.random() * 60 });
      });
      s.on('room:state', (st: any) => {
        if (st.phase === 'intro' || st.phase === 'results' || st.phase === 'standings') s.emit('room:skip');
      });
    }
    const started = await emitAck<any>(sA, 'room:start');
    expect(started.ok).toBe(true);
    await waitFor(sB, 'room:state', (st) => st.phase === 'intro');
    await waitFor(sB, 'room:state', (st) => st.phase === 'playing', undefined, 30000);

    // mid-game disconnect + reconnect of B
    sB.disconnect();
    await waitFor(sA, 'room:state', (st) => st.members.find((m: any) => m.id === B.profile.id)?.status === 'disconnected');
    const sB2 = await connect(srv.url, B.cookie);
    sB2.on('game:pub', (pub: any) => {
      if (pub?.phase === 'go') sB2.emit('game:action', { t: 'tap', ms: 260 });
    });
    sB2.on('room:state', (st: any) => {
      if (st.phase === 'intro' || st.phase === 'results' || st.phase === 'standings') sB2.emit('room:skip');
    });
    const restored = await waitFor<any>(sB2, 'room:state');
    expect(restored.code).toEqual(code);
    await waitFor(sA, 'room:state', (st) => st.members.find((m: any) => m.id === B.profile.id)?.connected === true);

    const results = await waitFor<any>(sA, 'room:results', () => true, 60000);
    expect(results.players.length).toBe(3);
    for (const p of results.players) {
      expect(p.points).toBeGreaterThanOrEqual(0);
      expect(p.points).toBeLessThanOrEqual(1000);
      expect(p.breakdown.length).toBeGreaterThan(0);
    }
    const final = await waitFor<any>(sA, 'room:final', () => true, 90000);
    expect(final.standings.length).toBe(3);
    expect(final.rounds.length).toBe(2);
    expect(stB.get()).toBeTruthy();

    // persistence: two rounds for each human, nothing for the bot
    const rows = srv.repos.db.prepare('SELECT user_id, COUNT(*) n FROM score_entries GROUP BY user_id').all() as any[];
    expect(rows.length).toBe(2);
    for (const r of rows) expect(r.n).toBe(2);
    const hist = await api(srv.url, '/api/history', { cookie: A.cookie });
    expect(hist.json.data.length).toBe(1);
    const lb = await api(srv.url, '/api/leaderboard?scope=daily', { cookie: A.cookie });
    expect(lb.json.data.rows.length).toBe(2);
    const me = await api(srv.url, '/api/me', { cookie: B.cookie });
    expect(me.json.data.stats.roundsPlayed).toBe(2);
    expect(me.json.data.achievements.map((a: any) => a.id)).toContain('first-round');
    expect(me.json.data.xp).toBeGreaterThan(0);

    // host returns to lobby, then B leaves
    sA.emit('room:lobby');
    await waitFor(sA, 'room:state', (st) => st.phase === 'lobby');
    await emitAck(sB2, 'room:leave');
    await waitFor(sA, 'room:state', (st) => !st.members.some((m: any) => m.id === B.profile.id));
    sA.disconnect();
    sB2.disconnect();
  }, 120000);

  it('quick play matches two players into the same public room', async () => {
    const C = await guest(srv.url);
    const D = await guest(srv.url);
    const sC = await connect(srv.url, C.cookie);
    const sD = await connect(srv.url, D.cookie);
    const rc = await emitAck<any>(sC, 'match:quick');
    const rd = await emitAck<any>(sD, 'match:quick');
    expect(rc.ok && rd.ok).toBe(true);
    expect(rc.data.code).toEqual(rd.data.code);
    const st = await waitFor<any>(sC, 'room:state', (s) => s.members.length === 2 && s.autoStartAt != null);
    expect(st.isPublic).toBe(true);
    sC.disconnect();
    sD.disconnect();
  });

  it('friends: request, accept, friends leaderboard', async () => {
    const r1 = await api(srv.url, '/api/friends/request', { method: 'POST', cookie: A.cookie, body: { username: B.profile.username } });
    expect(r1.json.data.result).toBe('sent');
    const listB = await api(srv.url, '/api/friends', { cookie: B.cookie });
    expect(listB.json.data[0].status).toBe('incoming');
    const acc = await api(srv.url, '/api/friends/accept', { method: 'POST', cookie: B.cookie, body: { id: A.profile.id } });
    expect(acc.status).toBe(200);
    const lb = await api(srv.url, '/api/leaderboard?scope=friends', { cookie: A.cookie });
    expect(lb.json.data.rows.map((r: any) => r.id).sort()).toEqual([A.profile.id, B.profile.id].sort());
  });
});
