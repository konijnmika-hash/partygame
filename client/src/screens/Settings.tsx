import { useState } from 'react';
import { validatePassword, validateUsername } from '@shared/validation';
import { ACHIEVEMENT_MAP } from '@shared/achievements';
import { api } from '../net/api';
import { set, toast, useStore } from '../state/store';
import { updateSettings } from '../boot';
import { TopBar } from '../components/TopBar';
import { Toggle } from '../components/ui';
import { sfx } from '../audio/sfx';

export default function Settings() {
  const s = useStore((st) => st.settings);
  const profile = useStore((st) => st.profile!);
  const [regName, setRegName] = useState(profile.name);
  const [regPw, setRegPw] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [busy, setBusy] = useState(false);

  const register = async () => {
    const n = validateUsername(regName);
    if (!n.ok) return toast(n.error, 'error');
    const p = validatePassword(regPw);
    if (!p.ok) return toast(p.error, 'error');
    setBusy(true);
    const r = await api('/auth/register', { method: 'POST', body: { username: n.value, password: p.value } });
    setBusy(false);
    if (!r.ok) return toast(r.error || 'Could not register', 'error');
    set({ profile: r.data });
    setRegPw('');
    sfx('achievement');
    toast('Account secured! You can now sign in on any device.', 'success', { emoji: '🔐' });
    for (const a of r.progress?.achievements || []) toast(`Achievement unlocked: ${ACHIEVEMENT_MAP[a]?.name}`, 'achievement', { emoji: ACHIEVEMENT_MAP[a]?.emoji });
  };
  const login = async () => {
    setBusy(true);
    const r = await api('/auth/login', { method: 'POST', body: { username: loginName, password: loginPw } });
    setBusy(false);
    if (!r.ok) {
      sfx('wrong');
      return toast(r.error || 'Could not sign in', 'error');
    }
    toast(`Welcome back, ${r.data.name}!`, 'success');
    setTimeout(() => window.location.reload(), 600);
  };
  const logout = async () => {
    if (!confirm('Sign out? (Guests without a password cannot get this account back.)')) return;
    await api('/auth/logout', { method: 'POST', body: {} });
    window.location.reload();
  };

  return (
    <div className="page settings">
      <TopBar title="⚙️ Settings" />
      <section className="glass stack">
        <div className="panel-title">🔊 Sound</div>
        <Toggle checked={!s.sfxMuted} onChange={(v) => updateSettings({ sfxMuted: !v })} label="Sound effects" />
        <label className="slider-row">
          <span>Effects volume</span>
          <input className="slider" type="range" min={0} max={1} step={0.05} value={s.sfxVolume} onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })} onPointerUp={() => sfx('coin')} />
        </label>
        <Toggle checked={!s.musicMuted} onChange={(v) => updateSettings({ musicMuted: !v })} label="Music" />
        <label className="slider-row">
          <span>Music volume</span>
          <input className="slider" type="range" min={0} max={1} step={0.05} value={s.musicVolume} onChange={(e) => updateSettings({ musicVolume: Number(e.target.value) })} />
        </label>
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => sfx('win')}>▶ Test sound</button>
      </section>

      <section className="glass stack" style={{ marginTop: 14 }}>
        <div className="panel-title">♿ Comfort</div>
        <Toggle checked={s.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} label="Reduce motion & confetti" />
        <Toggle checked={s.haptics} onChange={(v) => updateSettings({ haptics: v })} label="Vibration feedback (phones)" />
      </section>

      <section className="glass stack" style={{ marginTop: 14 }}>
        <div className="panel-title">👤 Account</div>
        {profile.registered ? (
          <>
            <p>Signed in as <b>{profile.name}</b>. Your progress is saved to your account.</p>
            <button className="btn btn-red btn-sm" style={{ alignSelf: 'flex-start' }} onClick={logout}>Sign out</button>
          </>
        ) : (
          <>
            <p className="small">You are playing as a <b>guest</b>. Your progress is saved on this device. Add a password to keep it forever and sign in anywhere.</p>
            <form className="stack-s" onSubmit={(e) => { e.preventDefault(); register(); }}>
              <input className="input" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Username" maxLength={16} autoComplete="username" aria-label="Username" />
              <input className="input" type="password" value={regPw} onChange={(e) => setRegPw(e.target.value)} placeholder="Password (6+ characters)" autoComplete="new-password" aria-label="Password" />
              <button className="btn btn-green" type="submit" disabled={busy}>🔐 Secure my account</button>
            </form>
          </>
        )}
        <div className="divider" />
        <details>
          <summary className="small">Sign in to another account</summary>
          <form className="stack-s" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); login(); }}>
            <input className="input" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="Username" autoComplete="username" aria-label="Login username" />
            <input className="input" type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder="Password" autoComplete="current-password" aria-label="Login password" />
            <button className="btn btn-blue" type="submit" disabled={busy || !loginName || !loginPw}>Sign in</button>
          </form>
        </details>
      </section>

      <section className="glass stack-s small" style={{ marginTop: 14 }}>
        <div className="panel-title">ℹ️ About</div>
        <p>Bloop Bash is an original party game. All characters, art, sounds and music are generated in-app.</p>
        <p className="muted tiny">Fonts: Fredoka & Nunito (SIL Open Font License). Word list: word-list (MIT). Controls: touch, mouse, keyboard (WASD/arrows, space, shift) and gamepads.</p>
      </section>
    </div>
  );
}
