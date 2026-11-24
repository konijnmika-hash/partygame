import { useState } from 'react';
import { bmi } from '../lib/calc';
import { addDays, dateKey, DAY_SHORT, fmt, parseKey, weekday } from '../lib/date';
import { dayTotals, useTargets } from '../lib/hooks';
import { emptyDay, useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { BarChart, I, LineChart, AvatarButton } from '../components/ui';

export function Progress() {
  const profile = useStore((s) => s.profile)!;
  const days = useStore((s) => s.days);
  const weights = useStore((s) => s.weights);
  const premium = useStore((s) => s.premium);
  const open = useUI((s) => s.open);
  const t = useTargets()!;
  const [range, setRange] = useState<7 | 30>(7);
  const today = dateKey();

  const keys = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const label = (k: string) => (range === 7 ? DAY_SHORT[weekday(k)] : String(parseKey(k).getDate()));
  const logs = keys.map((k) => days[k] ?? emptyDay());
  const kcal = logs.map((d, i) => ({ label: label(keys[i]), value: Math.round(dayTotals(d).eaten.kcal) }));
  const water = logs.map((d, i) => ({ label: label(keys[i]), value: d.waterMl }));
  const steps = logs.map((d, i) => ({ label: label(keys[i]), value: d.steps }));
  const logged = kcal.filter((k) => k.value > 0);
  const avgKcal = logged.length ? logged.reduce((s, k) => s + k.value, 0) / logged.length : 0;
  const workouts = logs.reduce((s, d) => s + d.workoutsDone.length, 0);

  // Streak: aaneengesloten dagen (t/m vandaag of gisteren) waarop iets gegeten is gelogd
  let streak = 0;
  for (let k = days[today] && dayTotals(days[today]).count ? today : addDays(today, -1); days[k] && dayTotals(days[k]).count > 0; k = addDays(k, -1)) streak++;

  const start = profile.startWeightKg ?? weights[0]?.kg ?? profile.weightKg;
  const current = profile.weightKg;
  const diff = current - start;
  const toGo = current - profile.goalWeightKg;
  const wpts = weights.slice(-(range === 7 ? 10 : 30)).map((w) => ({ label: parseKey(w.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' }), value: w.kg }));
  const b = bmi(current, profile.heightCm);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="page-title">Voortgang</h1>
        <AvatarButton />
      </header>
      <div className="row between" style={{ marginTop: -6 }}>
        <span className="small muted">Jouw trends</span>
        <div className="seg" role="tablist" aria-label="Periode">
          <button className={range === 7 ? 'on' : ''} onClick={() => setRange(7)}>7 dagen</button>
          <button className={range === 30 ? 'on' : ''} onClick={() => (premium ? setRange(30) : open({ type: 'premium', reason: 'Bekijk je voortgang over 30 dagen met Premium.' }))}>
            30 dagen {!premium && <span className="lock" style={{ width: 14, height: 14 }}><I.lock /></span>}
          </button>
        </div>
      </div>

      <div className="tiles3">
        <div className="tile"><div className="v num">{streak}🔥</div><div className="l">dagen op rij</div></div>
        <div className="tile"><div className="v num">{workouts}</div><div className="l">trainingen</div></div>
        <div className="tile"><div className="v num">{avgKcal ? fmt(avgKcal) : '–'}</div><div className="l">gem. kcal</div></div>
      </div>

      <section className="card stack">
        <div className="row between">
          <div>
            <div className="label-cap">Gewicht</div>
            <div className="kpi num" style={{ fontSize: 30 }}>{fmt(current, 1)} <small>kg</small></div>
          </div>
          <button className="btn sm" onClick={() => open({ type: 'weight' })}>+ Wegen</button>
        </div>
        <div className="chips">
          <span className={'tag' + (diff < 0 ? ' brand' : '')}>{diff > 0 ? '+' : ''}{fmt(diff, 1)} kg sinds start</span>
          {profile.goal !== 'onderhouden' && <span className="tag">{Math.abs(toGo) < 0.3 ? 'Streefgewicht bereikt!' : `nog ${fmt(Math.abs(toGo), 1)} kg tot ${fmt(profile.goalWeightKg, 1)}`}</span>}
          <span className="tag">BMI {fmt(b, 1)}</span>
        </div>
        {wpts.length > 1 ? (
          <LineChart points={wpts} goal={profile.goal !== 'onderhouden' ? profile.goalWeightKg : undefined} />
        ) : (
          <p className="small muted" style={{ margin: 0 }}>Weeg je een paar keer per week; hier verschijnt dan je lijn naar je streefgewicht (oranje stippellijn).</p>
        )}
      </section>

      <section className="card stack">
        <div className="row between">
          <div className="label-cap">Calorieën</div>
          <span className="tiny">stippellijn = doel {fmt(t.kcal)}</span>
        </div>
        <BarChart data={kcal} target={t.kcal} color="var(--brand)" unit="kcal" />
      </section>

      <section className="card stack">
        <div className="row between">
          <div className="label-cap" style={{ color: 'var(--water)' }}>Water (ml)</div>
          <span className="tiny">doel {fmt(t.waterMl)} ml</span>
        </div>
        <BarChart data={water} target={t.waterMl} color="var(--water)" height={120} />
      </section>

      <section className="card stack">
        <div className="row between">
          <div className="label-cap" style={{ color: 'var(--steps)' }}>Stappen</div>
          <span className="tiny">doel {fmt(t.steps)}</span>
        </div>
        <BarChart data={steps} target={t.steps} color="var(--steps)" height={120} />
      </section>
    </div>
  );
}
