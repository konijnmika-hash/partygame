import { useState } from 'react';
import { ACTIVITIES } from '../data/activities';
import { EXERCISES } from '../data/exercises';
import { ACTIVITY, PACE, calcTargets, metKcal } from '../lib/calc';
import { dateKey, DAY_SHORT, fmt } from '../lib/date';
import { useDay, useTargets } from '../lib/hooks';
import { FOCUS_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, PLACE_OPTIONS, SEX_OPTIONS } from '../lib/options';
import { useStore } from '../lib/store';
import { mealForNow, useUI } from '../lib/ui';
import type { ActivityLevel, Pace, Profile } from '../lib/types';
import { SPLIT_NAME } from '../lib/workout';
import { I, Sheet, Stepper, Switch, toast } from './ui';

export function StepsSheet() {
  const { date, close, open } = useUI();
  const day = useDay(date);
  const [v, setV] = useState(day.steps);
  return (
    <Sheet onClose={close} title="Stappen">
      <div className="stack">
        <Stepper id="steps-input" value={v} onChange={setV} step={500} max={100000} />
        <div className="chips">
          {[1000, 2500, 5000].map((n) => (
            <button key={n} className="chip" onClick={() => setV(v + n)}>+{fmt(n)}</button>
          ))}
        </div>
        <button className="btn block" onClick={() => { useStore.getState().setSteps(date, v); toast('Stappen opgeslagen'); close(); }}>Opslaan</button>
        <button className="btn outline block" onClick={() => open({ type: 'connect' })}>
          <span style={{ width: 20, height: 20, display: 'inline-flex' }}><I.link /></span> Automatisch koppelen
        </button>
      </div>
    </Sheet>
  );
}

export function ConnectSheet() {
  const close = useUI((s) => s.close);
  const [picked, setPicked] = useState<string | null>(null);
  const apps = [
    { id: 'hc', name: 'Google Health Connect', s: 'Android · Google Fit, Samsung Health, Fitbit', em: '🤖' },
    { id: 'apple', name: 'Apple Gezondheid', s: 'iPhone en Apple Watch', em: '🍎' },
  ];
  return (
    <Sheet onClose={close} title="Stappen koppelen">
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>Koppel je telefoon, dan lopen je stappen en workouts vanzelf binnen in Fris.</p>
        <div className="card" style={{ padding: '4px 14px' }}>
          <div className="list">
            {apps.map((a) => (
              <button key={a.id} className="item" onClick={() => setPicked(a.id)}>
                <div className="ico">{a.em}</div>
                <div className="grow"><div className="t">{a.name}</div><div className="s">{a.s}</div></div>
                <span className="tag">Koppelen</span>
              </button>
            ))}
          </div>
        </div>
        {picked && (
          <div className="card flat row" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 22, height: 22, flex: 'none', color: 'var(--water)' }}><I.info /></span>
            <div className="small">
              Automatisch synchroniseren werkt in de Fris-app uit de {picked === 'hc' ? 'Google Play Store' : 'App Store'}. In deze webversie vul je je stappen zelf in via <b>Invoeren</b>, of lees ze af in de Gezondheid-app van je telefoon.
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function ActivitySheet() {
  const { date, close } = useUI();
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const [act, setAct] = useState(ACTIVITIES[0]);
  const [min, setMin] = useState(30);
  const kcal = metKcal(act.met, kg, min);
  return (
    <Sheet onClose={close} title="Activiteit">
      <div className="stack">
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {ACTIVITIES.map((a) => (
            <button key={a.id} className={'card flat'} onClick={() => setAct(a)}
              style={{ padding: '10px 4px', borderRadius: 16, textAlign: 'center', borderColor: a.id === act.id ? 'var(--brand)' : undefined, borderWidth: a.id === act.id ? 2 : 1 }}>
              <div style={{ fontSize: 24 }}>{a.emoji}</div>
              <div className="tiny" style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.name}</div>
            </button>
          ))}
        </div>
        <div className="field">
          <span className="lbl">Duur in minuten</span>
          <Stepper id="act-min" value={min} onChange={setMin} step={5} min={1} max={600} />
        </div>
        <div className="card row between">
          <span className="muted">Geschat verbrand</span>
          <b className="kpi num" style={{ color: 'var(--steps)' }}>{fmt(kcal)} kcal</b>
        </div>
        <button className="btn block" disabled={min <= 0} onClick={() => { useStore.getState().addActivity(date, { name: act.name, emoji: act.emoji, minutes: min, kcal }); toast(`${act.name} toegevoegd: ${fmt(kcal)} kcal`); close(); }}>
          Toevoegen
        </button>
      </div>
    </Sheet>
  );
}

export function WeightSheet() {
  const close = useUI((s) => s.close);
  const current = useStore((s) => s.profile?.weightKg ?? 70);
  const [v, setV] = useState(current);
  return (
    <Sheet onClose={close} title="Gewicht vandaag">
      <div className="stack">
        <Stepper id="weight-input" value={v} onChange={setV} step={0.1} min={30} max={300} />
        <p className="small muted" style={{ margin: 0 }}>Tip: weeg jezelf ’s ochtends, na het plassen en vóór het ontbijt. Dan zijn de cijfers het best te vergelijken.</p>
        <button className="btn block" onClick={() => { useStore.getState().logWeight(dateKey(), v); toast(`${fmt(v, 1)} kg opgeslagen`); close(); }}>Opslaan</button>
      </div>
    </Sheet>
  );
}

export function QuickSheet() {
  const { close, open, date } = useUI();
  const glass = useStore((s) => s.glassMl);
  const items = [
    { t: 'Eten toevoegen', s: 'Zoek in de database of scan', ico: <I.apple />, c: 'var(--brand)', go: () => open({ type: 'addFood', meal: mealForNow() }) },
    { t: `Glas water (${glass} ml)`, s: 'Direct toevoegen', ico: <I.drop />, c: 'var(--water)', go: () => { const d = useStore.getState().days[date]; useStore.getState().setWater(date, (d?.waterMl ?? 0) + glass); toast(`+${glass} ml water`); close(); } },
    { t: 'Activiteit', s: 'Hardlopen, fietsen, padel…', ico: <I.flame />, c: 'var(--steps)', go: () => open({ type: 'activity' }) },
    { t: 'Stappen', s: 'Stappen van vandaag invullen', ico: <I.shoe />, c: 'var(--steps)', go: () => open({ type: 'steps' }) },
    { t: 'Gewicht', s: 'Weeg je en houd je voortgang bij', ico: <I.scale />, c: 'var(--fat)', go: () => open({ type: 'weight' }) },
  ];
  return (
    <Sheet onClose={close} title="Snel loggen">
      <div className="card" style={{ padding: '4px 14px' }}>
        <div className="list">
          {items.map((it) => (
            <button key={it.t} className="item" onClick={it.go}>
              <div className="ico" style={{ color: it.c, background: `color-mix(in srgb, ${it.c} 14%, transparent)` }}><span style={{ width: 22, height: 22, display: 'grid' }}>{it.ico}</span></div>
              <div className="grow"><div className="t">{it.t}</div><div className="s">{it.s}</div></div>
              <I.right />
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

const PREMIUM_FEATURES = [
  ['Barcodescanner', 'Scan een product en het staat er meteen in.'],
  ['Eigen doelen', 'Stel je eigen calorie-, water- en stappendoel in.'],
  ['Volledige voortgang', 'Grafieken over 30 dagen in plaats van 7.'],
];

export function PremiumSheet({ reason }: { reason?: string }) {
  const close = useUI((s) => s.close);
  const premium = useStore((s) => s.premium);
  const [plan, setPlan] = useState<'maand' | 'jaar'>('maand');
  return (
    <Sheet onClose={close}>
      <div className="stack">
        <div className="premium-hero">
          <svg className="leaf" viewBox="0 0 32 32" aria-hidden><path d="M4 26C4 12 14 4 30 3c-1 17-10 25-24 25" fill="#c9f27a" /></svg>
          <span className="tag gold">Fris Premium</span>
          <h2 style={{ marginTop: 10 }}>Haal alles uit je dag</h2>
          <p style={{ margin: '6px 0 0', opacity: 0.85 }}>{reason ?? 'Voor wie serieus werk maakt van eten, drinken en trainen.'}</p>
        </div>
        <div className="stack">
          {PREMIUM_FEATURES.map(([t, s]) => (
            <div key={t} className="feat"><I.check /><div><b>{t}</b><div className="small muted">{s}</div></div></div>
          ))}
        </div>
        {premium ? (
          <>
            <div className="card row"><span style={{ fontSize: 26 }}>🌟</span><div className="grow"><b>Premium staat aan</b><div className="small muted">Alle functies zijn ontgrendeld.</div></div></div>
            <button className="btn outline block" onClick={() => { useStore.getState().setPremium(false); toast('Premium uitgezet (demo)'); }}>Premium uitzetten (demo)</button>
          </>
        ) : (
          <>
            <button className={'plan' + (plan === 'maand' ? ' on' : '')} onClick={() => setPlan('maand')}>
              <span className="radio" />
              <div className="grow"><b>Maandelijks</b><div className="small muted">Elke maand opzegbaar</div></div>
              <div className="price num">€ 4,99<span className="tiny"> /mnd</span></div>
            </button>
            <button className={'plan' + (plan === 'jaar' ? ' on' : '')} onClick={() => setPlan('jaar')}>
              <span className="radio" />
              <div className="grow"><b>Jaarlijks <span className="tag brand">−33%</span></b><div className="small muted num">€ 39,99 per jaar · € 3,33 /mnd</div></div>
              <div className="price num">€ 39,99</div>
            </button>
            <button className="btn block" onClick={() => { useStore.getState().setPremium(true); toast('Premium geactiveerd (demo, er wordt niets afgeschreven)'); close(); }}>
              Probeer 7 dagen gratis
            </button>
            <p className="tiny" style={{ textAlign: 'center', margin: 0 }}>Daarna {plan === 'maand' ? '€ 4,99 per maand' : '€ 39,99 per jaar'}. Op elk moment opzegbaar via de App Store of Google Play.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function GoalsSheet() {
  const close = useUI((s) => s.close);
  const profile = useStore((s) => s.profile)!;
  const auto = calcTargets({ ...profile, custom: undefined });
  const t = useTargets()!;
  const [kcal, setKcal] = useState(t.kcal);
  const [water, setWater] = useState(t.waterMl);
  const [steps, setSteps] = useState(t.steps);
  return (
    <Sheet onClose={close} title="Eigen doelen">
      <div className="stack">
        <div className="field"><span className="lbl">Calorieën per dag (advies {fmt(auto.kcal)})</span><Stepper id="g-kcal" value={kcal} onChange={setKcal} step={50} min={1000} max={6000} /></div>
        <div className="field"><span className="lbl">Water in ml (advies {fmt(auto.waterMl)})</span><Stepper id="g-water" value={water} onChange={setWater} step={250} min={1000} max={6000} /></div>
        <div className="field"><span className="lbl">Stappen (advies {fmt(auto.steps)})</span><Stepper id="g-steps" value={steps} onChange={setSteps} step={500} min={1000} max={40000} /></div>
        <p className="tiny" style={{ margin: 0 }}>Eiwit, koolhydraten en vet worden automatisch over je nieuwe calorie-doel verdeeld.</p>
        <div className="row">
          <button className="btn outline" onClick={() => { useStore.getState().updateProfile({ custom: undefined }); toast('Terug naar advieswaarden'); close(); }}>Advies</button>
          <button className="btn grow" onClick={() => { useStore.getState().updateProfile({ custom: { kcal, waterMl: water, steps } }); toast('Doelen opgeslagen'); close(); }}>Opslaan</button>
        </div>
      </div>
    </Sheet>
  );
}

export function ProfileEditSheet() {
  const close = useUI((s) => s.close);
  const profile = useStore((s) => s.profile)!;
  const [p, setP] = useState<Profile>(profile);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  return (
    <Sheet onClose={close} title="Mijn gegevens">
      <div className="stack">
        <div className="field"><label htmlFor="pe-name">Naam</label><input id="pe-name" className="input" value={p.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="field"><span className="lbl">Geslacht</span>
          <div className="chips">{SEX_OPTIONS.map((o) => <button key={o.v} className={'chip' + (p.sex === o.v ? ' on' : '')} onClick={() => set('sex', o.v)}>{o.v === 'anders' ? 'Anders' : o.t}</button>)}</div>
        </div>
        <div className="grid2">
          <div className="field"><span className="lbl">Leeftijd</span><Stepper id="pe-age" value={p.age} onChange={(v) => set('age', v)} min={14} max={100} /></div>
          <div className="field"><span className="lbl">Lengte (cm)</span><Stepper id="pe-h" value={p.heightCm} onChange={(v) => set('heightCm', v)} min={120} max={230} /></div>
        </div>
        <div className="field"><span className="lbl">Streefgewicht (kg)</span><Stepper id="pe-goal" value={p.goalWeightKg} onChange={(v) => set('goalWeightKg', v)} step={0.5} min={35} max={250} /></div>
        <div className="field"><span className="lbl">Doel</span>
          <div className="chips">{GOAL_OPTIONS.map((o) => <button key={o.v} className={'chip' + (p.goal === o.v ? ' on' : '')} onClick={() => set('goal', o.v)}>{o.t}</button>)}</div>
        </div>
        {p.goal !== 'onderhouden' && (
          <div className="field"><span className="lbl">Tempo</span>
            <div className="chips">{(Object.keys(PACE) as Pace[]).map((k) => <button key={k} className={'chip' + (p.pace === k ? ' on' : '')} onClick={() => set('pace', k)}>{PACE[k].label} · {fmt(PACE[k].kgPerWeek, 2)} kg/week</button>)}</div>
          </div>
        )}
        <div className="field"><span className="lbl">Dagelijkse activiteit</span>
          <div className="chips">{(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => <button key={k} className={'chip' + (p.activity === k ? ' on' : '')} onClick={() => set('activity', k)}>{ACTIVITY[k].label}</button>)}</div>
        </div>
        <p className="tiny" style={{ margin: 0 }}>Je gewicht pas je aan via <b>Gewicht loggen</b>, zodat je voortgang klopt.</p>
        <button className="btn block" onClick={() => { useStore.getState().updateProfile(p); toast('Gegevens opgeslagen, je doelen zijn bijgewerkt'); close(); }}>Opslaan</button>
      </div>
    </Sheet>
  );
}

export function PlanEditSheet() {
  const close = useUI((s) => s.close);
  const profile = useStore((s) => s.profile)!;
  const [days, setDays] = useState(profile.trainDays);
  const [focus, setFocus] = useState(profile.focus);
  const [level, setLevel] = useState(profile.level);
  const [place, setPlace] = useState(profile.place);
  return (
    <Sheet onClose={close} title="Schema aanpassen">
      <div className="stack">
        <div className="field"><span className="lbl">Op welke dagen train je? ({days.length}× per week)</span>
          <div className="week">
            {DAY_SHORT.map((d, i) => {
              const on = days.includes(i);
              return (
                <button key={d} className={'wd' + (on ? ' sel train' : '')} style={on ? { background: 'var(--ink)', color: 'var(--bg)' } : undefined}
                  onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())}>
                  <span className="n" style={{ fontSize: 15, color: 'inherit' }}>{d}</span>
                </button>
              );
            })}
          </div>
          {days.length > 0 && <span className="tiny">Schema: {SPLIT_NAME(days.length, level)}</span>}
        </div>
        <div className="field"><span className="lbl">Waar train je?</span>
          <div className="chips">{PLACE_OPTIONS.map((o) => <button key={o.v} className={'chip' + (place === o.v ? ' on' : '')} onClick={() => setPlace(o.v)}>{o.em} {o.t}</button>)}</div>
        </div>
        <div className="field"><span className="lbl">Focus</span>
          <div className="chips">{FOCUS_OPTIONS.map((o) => <button key={o.v} className={'chip' + (focus === o.v ? ' on' : '')} onClick={() => setFocus(o.v)}>{o.em} {o.t}</button>)}</div>
        </div>
        <div className="field"><span className="lbl">Ervaring</span>
          <div className="chips">{LEVEL_OPTIONS.map((o) => <button key={o.v} className={'chip' + (level === o.v ? ' on' : '')} onClick={() => setLevel(o.v)}>{o.t}</button>)}</div>
        </div>
        <button className="btn block" onClick={() => { useStore.getState().updateProfile({ trainDays: days, focus, level, place }); toast('Nieuw schema staat klaar'); close(); }}>Schema opslaan</button>
      </div>
    </Sheet>
  );
}

export function ExerciseSheet({ id }: { id: string }) {
  const close = useUI((s) => s.close);
  const e = EXERCISES[id];
  const lift = useStore((s) => s.lifts[id]);
  if (!e) return null;
  return (
    <Sheet onClose={close} title={e.name}>
      <div className="stack">
        <div className="chips">{e.muscles.map((m) => <span key={m} className="tag brand">{m}</span>)}</div>
        <p style={{ margin: 0, fontSize: 16 }}>{e.how}</p>
        {lift ? <div className="card row between"><span className="muted">Laatst gebruikt gewicht</span><b className="num">{fmt(lift, 1)} kg</b></div> : null}
        <div className="card flat small muted">Kies een gewicht waarmee de laatste 2 herhalingen zwaar zijn, maar je techniek netjes blijft. Haal je alle herhalingen makkelijk? Doe er de volgende keer 2,5 kg bij.</div>
      </div>
    </Sheet>
  );
}

export function SettingsRows() {
  const glass = useStore((s) => s.glassMl);
  const addBurned = useStore((s) => s.addBurned);
  const set = useStore((s) => s.setSettings);
  return (
    <div className="list">
      <div className="item">
        <div className="grow"><div className="t">Glasgrootte</div><div className="s">Hoeveel ml een glas water telt</div></div>
        <div className="seg">
          {[200, 250, 330].map((ml) => <button key={ml} className={glass === ml ? 'on' : ''} onClick={() => set({ glassMl: ml })}>{ml}</button>)}
        </div>
      </div>
      <div className="item">
        <div className="grow"><div className="t">Verbrand bij budget optellen</div><div className="s">Sporten geeft je extra calorieën voor die dag</div></div>
        <Switch on={addBurned} onChange={(v) => set({ addBurned: v })} label="Verbrande calorieën optellen" />
      </div>
    </div>
  );
}
