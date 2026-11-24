import { useState } from 'react';
import { ACTIVITY, bmi, bodyFat, leanMass } from '../lib/calc';
import { fmt, liters } from '../lib/date';
import { useTargets } from '../lib/hooks';
import { GOAL_OPTIONS } from '../lib/options';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { ReminderRows, SettingsRows } from '../components/Sheets';
import { I } from '../components/ui';

export function ProfileScreen() {
  const profile = useStore((s) => s.profile)!;
  const premium = useStore((s) => s.premium);
  const open = useUI((s) => s.open);
  const t = useTargets()!;
  const [confirm, setConfirm] = useState(false);
  const goal = GOAL_OPTIONS.find((g) => g.v === profile.goal)!;

  return (
    <div className="page">
      <header className="topbar">
        <div className="row" style={{ gap: 6 }}>
          <button className="iconbtn" onClick={() => useUI.getState().setTab('vandaag')} aria-label="Terug naar vandaag"><I.left /></button>
          <h1 className="page-title">Profiel</h1>
        </div>
        {premium && <span className="tag gold">🌟 Premium</span>}
      </header>

      <section className="card row" style={{ alignItems: 'flex-start' }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: 24, flex: 'none' }}>{(profile.name || 'P').slice(0, 1).toUpperCase()}</div>
        <div className="grow">
          <h2 style={{ fontSize: 22 }}>{profile.name || 'Jij'}</h2>
          <div className="small muted num">{profile.age} jaar · {profile.heightCm} cm · {fmt(profile.weightKg, 1)} kg</div>
          <div className="small muted">{goal.em} {goal.t} · {ACTIVITY[profile.activity].label.toLowerCase()}</div>
          <div className="profile-stats num">
            <span>BMI <b>{fmt(bmi(profile.weightKg, profile.heightCm), 1)}</b></span>
            <span>Vet <b>± {fmt(bodyFat(profile))}%</b></span>
            <span>Vetvrij <b>{fmt(leanMass(profile))} kg</b></span>
          </div>
        </div>
        <button className="iconbtn" onClick={() => open({ type: 'profileEdit' })} aria-label="Gegevens bewerken"><I.pencil /></button>
      </section>

      {!premium && (
        <button className="premium-banner" onClick={() => open({ type: 'premium' })}>
          <span style={{ fontSize: 28 }}>🌟</span>
          <div className="grow"><b>Puls Premium</b><div className="small muted">Barcodescanner, eigen doelen en meer · € 4,99 /mnd</div></div>
          <I.right />
        </button>
      )}

      <div className="section-title">
        <h2>Jouw dagdoelen</h2>
        <button className="link" onClick={() => open(premium ? { type: 'goals' } : { type: 'premium', reason: 'Eigen doelen instellen zit in Puls Premium.' })}>
          Aanpassen {!premium && <span className="lock" style={{ width: 14, height: 14, verticalAlign: '-2px' }}><I.lock /></span>}
        </button>
      </div>
      <section className="card stack">
        <div className="grid2">
          <Goal v={`${fmt(t.kcal)}`} u="kcal" l="Calorieën" c="var(--brand)" />
          <Goal v={liters(t.waterMl)} u="liter" l="Water (+0,5 L op trainingsdagen)" c="var(--water)" />
          <Goal v={fmt(t.steps)} u="stappen" l="Stappendoel" c="var(--steps)" />
          <Goal v={`${profile.trainDays.length}×`} u="per week" l="Trainen" c="var(--fat)" />
        </div>
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Goal v={`${t.c}`} u="g" l="Koolhydraten" c="var(--carb)" small />
          <Goal v={`${t.p}`} u="g" l="Eiwit" c="var(--protein)" small />
          <Goal v={`${t.f}`} u="g" l="Vet" c="var(--fat)" small />
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Berekend uit je lengte, gewicht, leeftijd en vetpercentage (Mifflin-St Jeor en Katch-McArdle): je rustverbranding is {fmt(t.bmr)} kcal, met je dagelijkse activiteit verbruik je ongeveer {fmt(t.tdee)} kcal.
          {profile.custom ? ' Je gebruikt eigen doelen.' : ''}
        </p>
      </section>

      <div className="section-title"><h2>Coach &amp; reminders</h2></div>
      <section className="card" style={{ padding: '4px 14px' }}>
        <ReminderRows />
      </section>

      <div className="section-title"><h2>Koppelingen</h2></div>
      <button className="card row" style={{ textAlign: 'left' }} onClick={() => open({ type: 'connect' })}>
        <div className="meal-icon" style={{ background: 'color-mix(in srgb, var(--steps) 16%, transparent)', color: 'var(--steps)' }}><I.shoe /></div>
        <div className="grow"><b>Stappen &amp; workouts</b><div className="small muted">Health Connect (Google) of Apple Gezondheid</div></div>
        <I.right />
      </button>

      <div className="section-title"><h2>Instellingen</h2></div>
      <section className="card" style={{ padding: '4px 14px' }}>
        <SettingsRows />
      </section>

      <section className="card stack">
        {confirm ? (
          <>
            <b>Alles wissen?</b>
            <p className="small muted" style={{ margin: 0 }}>Je profiel, dagboek, trainingen en gewichten worden van dit apparaat verwijderd. Dit kun je niet ongedaan maken.</p>
            <div className="row">
              <button className="btn ghost sm grow" onClick={() => setConfirm(false)}>Annuleren</button>
              <button className="btn danger sm grow" onClick={() => { useStore.getState().reset(); useUI.getState().setTab('vandaag'); }}>Ja, alles wissen</button>
            </div>
          </>
        ) : (
          <button className="btn danger block sm" onClick={() => setConfirm(true)}>Gegevens wissen en opnieuw beginnen</button>
        )}
      </section>
      <p className="tiny" style={{ textAlign: 'center' }}>Puls 0.2 · Je gegevens blijven op dit apparaat.<br />Voedingswaarden: eigen basisdatabase + Open Food Facts (ODbL).</p>
    </div>
  );
}

function Goal({ v, u, l, c, small }: { v: string; u: string; l: string; c: string; small?: boolean }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 16, padding: small ? 10 : 12 }}>
      <div className="kpi num" style={{ color: c, fontSize: small ? 18 : 22 }}>{v} <small>{u}</small></div>
      <div className="tiny" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{l}</div>
    </div>
  );
}
