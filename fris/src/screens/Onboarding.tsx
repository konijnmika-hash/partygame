import { useMemo, useState, type ReactNode } from 'react';
import { ACTIVITY, PACE, bmi, calcTargets } from '../lib/calc';
import { DAY_SHORT, fmt, liters } from '../lib/date';
import { FOCUS_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS, PLACE_OPTIONS, SEX_OPTIONS, defaultFocus, spreadDays } from '../lib/options';
import { useStore } from '../lib/store';
import type { ActivityLevel, Pace, Profile } from '../lib/types';
import { SPLIT_NAME } from '../lib/workout';
import { I, Logo, NumField } from '../components/ui';

const ACT_EMOJI: Record<ActivityLevel, string> = { zittend: '🪑', licht: '🚶', gemiddeld: '🚴', actief: '🏃', zeer: '⛹️' };

type Draft = Omit<Profile, 'createdAt'>;

const STEPS = ['welkom', 'naam', 'geslacht', 'leeftijd', 'lengte', 'gewicht', 'doel', 'tempo', 'activiteit', 'dagen', 'focus', 'plan'] as const;

function Body({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div className="ob-body">
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </div>
  );
}

function Big({ id, value, onChange, unit, step, decimals = 0 }: { id: string; value: number; onChange: (v: number) => void; unit: string; step: number; decimals?: number }) {
  return (
    <>
      <div className="bignum">
        <NumField id={id} className="num" value={value} onValue={onChange} aria-label={unit} />
        <span>{unit}</span>
      </div>
      <div className="nudge">
        {[-step * 5, -step, step, step * 5].map((d) => (
          <button key={d} onClick={() => onChange(Math.round((value + d) * 10 ** decimals) / 10 ** decimals)}>{d > 0 ? '+' : '−'}{fmt(Math.abs(d), 1)}</button>
        ))}
      </div>
    </>
  );
}

export function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const [i, setI] = useState(0);
  const [p, setP] = useState<Draft>({
    name: '', sex: 'vrouw', age: 28, heightCm: 172, weightKg: 72, goalWeightKg: 68, activity: 'licht', goal: 'afvallen', pace: 'normaal',
    trainDays: [0, 2, 4], focus: 'afvallen', level: 'beginner', place: 'gym',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((d) => ({ ...d, [k]: v }));
  const steps = STEPS.filter((s) => !(s === 'tempo' && p.goal === 'onderhouden'));
  const step = steps[i];
  const next = () => setI((x) => Math.min(steps.length - 1, x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));
  const targets = useMemo(() => calcTargets({ ...p, createdAt: '' }), [p]);

  const valid =
    (step === 'leeftijd' && (p.age < 14 || p.age > 100)) ||
    (step === 'lengte' && (p.heightCm < 120 || p.heightCm > 230)) ||
    (step === 'gewicht' && (p.weightKg < 35 || p.weightKg > 300)) ? false : true;

  if (step === 'welkom') {
    return (
      <div className="ob">
        <div className="welcome">
          <div className="sunrise" aria-hidden>
            <div className="sun" />
            <span className="floaty" style={{ left: '12%', top: '18%' }}>🥑</span>
            <span className="floaty" style={{ right: '14%', top: '12%', animationDelay: '1s' }}>🍓</span>
            <span className="floaty" style={{ left: '22%', top: '52%', animationDelay: '2s' }}>💧</span>
            <span className="floaty" style={{ right: '20%', top: '46%', animationDelay: '1.5s' }}>🏋️</span>
          </div>
          <div className="brand"><Logo size={34} /> fris</div>
          <h1>Eet slim.<br />Drink genoeg.<br /><em>Beweeg met plan.</em></h1>
          <p className="muted" style={{ margin: 0, fontSize: 16 }}>Calorieën, macro’s, water, stappen en een gymschema op maat. In één minuut ingesteld.</p>
          <button className="btn block" onClick={next}>Start</button>
        </div>
      </div>
    );
  }

  let content: ReactNode = null;
  switch (step) {
    case 'naam':
      content = (
        <Body title="Hoi! Hoe mogen we je noemen?">
          <input id="ob-name" className="input" style={{ height: 60, fontSize: 22, fontWeight: 600 }} placeholder="Je voornaam" value={p.name} onChange={(e) => set('name', e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && next()} />
        </Body>
      );
      break;
    case 'geslacht':
      content = (
        <Body title="Wat is je geslacht?" lead="Dit gebruiken we alleen om je verbranding te berekenen.">
          <div className="stack">
            {SEX_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.sex === o.v ? ' on' : '')} onClick={() => { set('sex', o.v); next(); }}>
                <span className="em">{o.em}</span><span className="t">{o.t}</span>
              </button>
            ))}
          </div>
        </Body>
      );
      break;
    case 'leeftijd':
      content = <Body title="Hoe oud ben je?"><Big id={`ob-${step}`} value={p.age} onChange={(v) => set('age', v)} unit="jaar" step={1} /></Body>;
      break;
    case 'lengte':
      content = <Body title="Hoe lang ben je?"><Big id={`ob-${step}`} value={p.heightCm} onChange={(v) => set('heightCm', v)} unit="cm" step={1} /></Body>;
      break;
    case 'gewicht':
      content = (
        <Body title="Hoe zwaar ben je nu?" lead="Een schatting is prima, je kunt het later bijwerken.">
          <Big id={`ob-${step}`} value={p.weightKg} onChange={(v) => setP((d) => ({ ...d, weightKg: v, goalWeightKg: d.goal === 'onderhouden' ? v : d.goalWeightKg }))} unit="kg" step={0.5} decimals={1} />
          {p.weightKg >= 35 && <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>Je BMI is {fmt(bmi(p.weightKg, p.heightCm), 1)}</p>}
        </Body>
      );
      break;
    case 'doel':
      content = (
        <Body title="Wat wil je bereiken?">
          <div className="stack">
            {GOAL_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.goal === o.v ? ' on' : '')}
                onClick={() => {
                  setP((d) => ({ ...d, goal: o.v, focus: defaultFocus(o.v), goalWeightKg: o.v === 'onderhouden' ? d.weightKg : o.v === 'afvallen' ? Math.round(d.weightKg * 0.93) : Math.round(d.weightKg * 1.05) }));
                  next();
                }}>
                <span className="em">{o.em}</span>
                <div><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
              </button>
            ))}
          </div>
        </Body>
      );
      break;
    case 'tempo':
      content = (
        <Body title={p.goal === 'afvallen' ? 'Naar welk gewicht?' : 'Naar welk gewicht wil je toe?'}>
          <Big id={`ob-${step}`} value={p.goalWeightKg} onChange={(v) => set('goalWeightKg', v)} unit="kg" step={0.5} decimals={1} />
          <div className="label-cap">Hoe snel?</div>
          <div className="stack">
            {(Object.keys(PACE) as Pace[]).map((k) => {
              const weeks = Math.abs(p.weightKg - p.goalWeightKg) / PACE[k].kgPerWeek;
              return (
                <button key={k} className={'choice' + (p.pace === k ? ' on' : '')} onClick={() => set('pace', k)} style={{ padding: 12 }}>
                  <div className="grow">
                    <div className="t">{PACE[k].label} · {fmt(PACE[k].kgPerWeek, 2)} kg per week</div>
                    <div className="s">{weeks >= 1 ? `Doel bereikt in ± ${Math.round(weeks)} weken` : 'Je bent er bijna'}{k === 'normaal' ? ' · aanbevolen' : ''}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Body>
      );
      break;
    case 'activiteit':
      content = (
        <Body title="Hoe actief ben je op een normale dag?" lead="Zonder je trainingen mee te tellen. Hiermee bepalen we ook je stappendoel.">
          <div className="stack">
            {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => (
              <button key={k} className={'choice' + (p.activity === k ? ' on' : '')} onClick={() => { set('activity', k); next(); }} style={{ padding: 12 }}>
                <span className="em">{ACT_EMOJI[k]}</span>
                <div><div className="t">{ACTIVITY[k].label}</div><div className="s">{ACTIVITY[k].hint}</div></div>
              </button>
            ))}
          </div>
        </Body>
      );
      break;
    case 'dagen':
      content = (
        <Body title="Hoeveel dagen wil je sporten?" lead="Tik de dagen aan. Wij maken er een schema bij.">
          <div className="chips" style={{ justifyContent: 'space-between' }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={'chip' + (p.trainDays.length === n ? ' on' : '')} style={{ width: 48, justifyContent: 'center', padding: 0 }} onClick={() => set('trainDays', spreadDays(n))}>{n}×</button>
            ))}
          </div>
          <div className="week">
            {DAY_SHORT.map((d, idx) => {
              const on = p.trainDays.includes(idx);
              return (
                <button key={d} className="wd" style={on ? { background: 'var(--brand)', color: 'var(--brand-ink)' } : undefined}
                  onClick={() => set('trainDays', on ? p.trainDays.filter((x) => x !== idx) : [...p.trainDays, idx].sort())}>
                  <span className="n" style={{ fontSize: 15, color: 'inherit' }}>{d}</span>
                </button>
              );
            })}
          </div>
          <div className="label-cap">Waar train je?</div>
          <div className="grid2">
            {PLACE_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.place === o.v ? ' on' : '')} onClick={() => set('place', o.v)} style={{ padding: 12 }}>
                <span className="em" style={{ width: 40, height: 40, fontSize: 22 }}>{o.em}</span><span className="t">{o.t}</span>
              </button>
            ))}
          </div>
        </Body>
      );
      break;
    case 'focus':
      content = (
        <Body title="Waar wil je op focussen in de gym?">
          <div className="stack">
            {FOCUS_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.focus === o.v ? ' on' : '')} onClick={() => set('focus', o.v)} style={{ padding: 12 }}>
                <span className="em">{o.em}</span>
                <div><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
              </button>
            ))}
          </div>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            {LEVEL_OPTIONS.map((o) => <button key={o.v} className={p.level === o.v ? 'on' : ''} onClick={() => set('level', o.v)}>{o.t}</button>)}
          </div>
        </Body>
      );
      break;
    case 'plan':
      content = (
        <Body title={`${p.name ? p.name + ', j' : 'J'}e plan staat klaar`} lead="Dit zijn je dagelijkse doelen. Je kunt ze altijd aanpassen.">
          <div className="daycard" style={{ textAlign: 'center' }}>
            <div className="label-cap">Per dag</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }} className="num">{fmt(targets.kcal)}</div>
            <div className="muted">kcal</div>
          </div>
          <div className="plan-tiles">
            <div className="plan-tile"><div className="v num" style={{ color: 'var(--protein)' }}>{targets.p} g</div><div className="l">Eiwit</div></div>
            <div className="plan-tile"><div className="v num" style={{ color: 'var(--carb)' }}>{targets.c} g</div><div className="l">Koolhydraten</div></div>
            <div className="plan-tile"><div className="v num" style={{ color: 'var(--water)' }}>{liters(targets.waterMl)} L</div><div className="l">Water</div></div>
            <div className="plan-tile"><div className="v num" style={{ color: 'var(--steps)' }}>{fmt(targets.steps)}</div><div className="l">Stappen</div></div>
          </div>
          <div className="card row">
            <span style={{ fontSize: 28 }}>🏋️</span>
            <div className="grow">
              <b>{p.trainDays.length}× per week · {p.trainDays.length ? SPLIT_NAME(p.trainDays.length, p.level) : 'geen schema'}</b>
              <div className="small muted">{p.trainDays.map((d) => DAY_SHORT[d]).join(', ') || 'Je kunt later dagen kiezen'} · {p.place === 'gym' ? 'gym' : 'thuis'}</div>
            </div>
          </div>
        </Body>
      );
      break;
  }

  const autoAdvance = step === 'geslacht' || step === 'doel' || step === 'activiteit';
  return (
    <div className="ob">
      <div className="ob-top">
        <button className="iconbtn" onClick={back} aria-label="Terug"><I.left /></button>
        <div className="ob-progress"><i style={{ width: `${(i / (steps.length - 1)) * 100}%` }} /></div>
      </div>
      <div key={step} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{content}</div>
      {!autoAdvance && (
        <button
          className="btn block" style={{ marginTop: 20 }} disabled={!valid}
          onClick={() => (step === 'plan' ? setProfile({ ...p, name: p.name.trim(), startWeightKg: p.weightKg, createdAt: new Date().toISOString() }) : next())}
        >
          {step === 'plan' ? 'Aan de slag' : step === 'naam' && !p.name.trim() ? 'Overslaan' : 'Volgende'}
        </button>
      )}
    </div>
  );
}
