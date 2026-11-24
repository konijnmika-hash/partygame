import { useMemo, useState, type ReactNode } from 'react';
import { ALL_EQUIP, EQUIP_LABEL, type Equip } from '../data/exercises';
import { ACTIVITY, PACE, bmi, bodyFat, calcTargets, leanMass } from '../lib/calc';
import { DAY_SHORT, fmt, liters } from '../lib/date';
import { FAT_LABELS, FOCUS_OPTIONS, GOAL_OPTIONS, MUSCLE_LABELS, PLACE_OPTIONS, SEX_OPTIONS, defaultEquipment, defaultFocus, spreadDays } from '../lib/options';
import { DEFAULT_REMINDERS, useStore, type Reminders } from '../lib/store';
import type { ActivityLevel, Experience, Pace, Profile } from '../lib/types';
import { EXPERIENCE, SPLIT_NAME } from '../lib/workout';
import { requestNotifications } from '../components/Coach';
import { Body } from '../components/Body';
import { I, NumField, Ring, Switch, Wordmark } from '../components/ui';

const ACT_EMOJI: Record<ActivityLevel, string> = { zittend: '🪑', licht: '🚶', gemiddeld: '🚴', actief: '🏃', zeer: '⛹️' };

type Draft = Omit<Profile, 'createdAt'>;

const STEPS = ['welkom', 'naam', 'geslacht', 'leeftijd', 'lengte', 'gewicht', 'vet', 'spieren', 'doel', 'tempo', 'activiteit', 'dagen', 'uitrusting', 'ervaring', 'focus', 'coach', 'plan'] as const;

function Q({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
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

function Scale({ id, value, onChange, labels, color }: { id: string; value: number; onChange: (v: number) => void; labels: string[]; color: string }) {
  return (
    <div className="scale">
      <div className="scale-head">
        <span className="scale-num num" style={{ color }}>{value}</span>
        <span className="scale-label">{labels[value - 1]}</span>
      </div>
      <input id={id} type="range" min={1} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ['--pct' as string]: `${((value - 1) / 9) * 100}%`, ['--c' as string]: color }} aria-label="Schaal van 1 tot 10" />
      <div className="scale-ticks num">{Array.from({ length: 10 }, (_, i) => <button key={i} className={i + 1 === value ? 'on' : ''} onClick={() => onChange(i + 1)}>{i + 1}</button>)}</div>
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="welcome2">
      <div className="welcome-inner">
        <Wordmark light />
        <div className="preview" aria-hidden>
          <div className="pv pv-coach" style={{ animationDelay: '0.15s' }}>
            <span className="pv-dot" />
            <div><b>Goedemorgen, Sam!</b><span>Vandaag: Borst &amp; triceps · 45 min</span></div>
          </div>
          <div className="pv pv-ring" style={{ animationDelay: '0.45s' }}>
            <Ring size={74} stroke={9} value={0.62} color="#c9f27a" track="rgba(255,255,255,0.14)">
              <span className="pv-ring-num">62%</span>
            </Ring>
            <div className="pv-macros">
              <span><i style={{ width: '70%', background: '#f0a03a' }} />Koolh.</span>
              <span><i style={{ width: '85%', background: '#ff7a9a' }} />Eiwit</span>
              <span><i style={{ width: '48%', background: '#a99cff' }} />Vet</span>
            </div>
          </div>
          <div className="pv pv-cheer" style={{ animationDelay: '0.8s' }}>
            <span className="pv-check"><I.check /></span>
            <div><b>Waterdoel gehaald!</b><span>Goed bezig, houd dit vast.</span></div>
          </div>
          <div className="pv pv-nudge" style={{ animationDelay: '1.15s' }}>
            <span className="pv-dot amber" />
            <div><b>Nog 2.100 stappen</b><span>Een wandeling van 20 min?</span></div>
          </div>
        </div>
        <h1 className="welcome-title">Elke dag een beetje <em>sterker.</em></h1>
        <p className="welcome-sub">Je persoonlijke coach voor eten, trainen en energie. Een plan dat bij jou past, reminders op het juiste moment en een schouderklopje als je goed bezig bent.</p>
        <button className="btn block welcome-cta" onClick={onStart}>Maak mijn plan</button>
        <div className="welcome-foot">Klaar in 2 minuten · Gratis te proberen</div>
      </div>
    </div>
  );
}

export function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const [i, setI] = useState(0);
  const [rem, setRem] = useState<Reminders>(DEFAULT_REMINDERS);
  const [p, setP] = useState<Draft>({
    name: '', sex: 'vrouw', age: 28, heightCm: 172, weightKg: 72, goalWeightKg: 68, activity: 'licht', goal: 'afvallen', pace: 'normaal',
    trainDays: [0, 2, 4], focus: 'afvallen', experience: 'beginner', place: 'gym', equipment: [...ALL_EQUIP], excluded: [], swaps: {}, fat: 5, muscle: 4,
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setP((d) => ({ ...d, [k]: v }));
  const steps = STEPS.filter((s) => !(s === 'tempo' && p.goal === 'onderhouden') && !(s === 'uitrusting' && p.trainDays.length === 0));
  const step = steps[i];
  const next = () => setI((x) => Math.min(steps.length - 1, x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));
  const targets = useMemo(() => calcTargets({ ...p, createdAt: '' }), [p]);
  const bf = bodyFat(p);

  const valid = !(
    (step === 'leeftijd' && (p.age < 14 || p.age > 100)) ||
    (step === 'lengte' && (p.heightCm < 120 || p.heightCm > 230)) ||
    (step === 'gewicht' && (p.weightKg < 35 || p.weightKg > 300))
  );

  if (step === 'welkom') return <Welcome onStart={next} />;

  let content: ReactNode = null;
  switch (step) {
    case 'naam':
      content = (
        <Q title="Hoi! Hoe mogen we je noemen?" lead="Je coach spreekt je graag persoonlijk aan.">
          <input id="ob-name" className="input" style={{ height: 60, fontSize: 22, fontWeight: 600 }} placeholder="Je voornaam" value={p.name} onChange={(e) => set('name', e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && next()} />
        </Q>
      );
      break;
    case 'geslacht':
      content = (
        <Q title="Wat is je geslacht?" lead="Dit gebruiken we alleen om je verbranding te berekenen.">
          <div className="stack">
            {SEX_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.sex === o.v ? ' on' : '')} onClick={() => { set('sex', o.v); next(); }}>
                <span className="em">{o.em}</span><span className="t">{o.t}</span>
              </button>
            ))}
          </div>
        </Q>
      );
      break;
    case 'leeftijd':
      content = <Q title="Hoe oud ben je?"><Big id="ob-leeftijd" value={p.age} onChange={(v) => set('age', v)} unit="jaar" step={1} /></Q>;
      break;
    case 'lengte':
      content = <Q title="Hoe lang ben je?"><Big id="ob-lengte" value={p.heightCm} onChange={(v) => set('heightCm', v)} unit="cm" step={1} /></Q>;
      break;
    case 'gewicht':
      content = (
        <Q title="Hoe zwaar ben je nu?" lead="Een schatting is prima, je kunt het later bijwerken.">
          <Big id="ob-gewicht" value={p.weightKg} onChange={(v) => setP((d) => ({ ...d, weightKg: v, goalWeightKg: d.goal === 'onderhouden' ? v : d.goalWeightKg }))} unit="kg" step={0.5} decimals={1} />
          {p.weightKg >= 35 && <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>Je BMI is {fmt(bmi(p.weightKg, p.heightCm), 1)}</p>}
        </Q>
      );
      break;
    case 'vet':
      content = (
        <Q title="Hoeveel vet heb je?" lead="Kies wat het best bij je past. 1 is heel slank, 10 is veel overgewicht.">
          <div className="body-wrap"><Body fat={p.fat} muscle={p.muscle} sex={p.sex} /></div>
          <Scale id="ob-fat" value={p.fat} onChange={(v) => set('fat', v)} labels={FAT_LABELS} color="var(--carb)" />
          <p className="tiny" style={{ textAlign: 'center', margin: 0 }}>Geschat vetpercentage ± {fmt(bf)}%</p>
        </Q>
      );
      break;
    case 'spieren':
      content = (
        <Q title="En hoeveel spieren?" lead="1 is weinig spieren, 10 is bodybuilder. Spieren verbranden ook in rust energie.">
          <div className="body-wrap"><Body fat={p.fat} muscle={p.muscle} sex={p.sex} /></div>
          <Scale id="ob-muscle" value={p.muscle} onChange={(v) => set('muscle', v)} labels={MUSCLE_LABELS} color="var(--brand)" />
          <p className="tiny" style={{ textAlign: 'center', margin: 0 }}>Vetvrije massa ± {fmt(leanMass(p))} kg</p>
        </Q>
      );
      break;
    case 'doel':
      content = (
        <Q title="Wat wil je bereiken?">
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
        </Q>
      );
      break;
    case 'tempo':
      content = (
        <Q title="Naar welk gewicht wil je toe?">
          <Big id="ob-goal" value={p.goalWeightKg} onChange={(v) => set('goalWeightKg', v)} unit="kg" step={0.5} decimals={1} />
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
        </Q>
      );
      break;
    case 'activiteit':
      content = (
        <Q title="Hoe actief ben je op een normale dag?" lead="Zonder je trainingen mee te tellen. Hiermee bepalen we ook je stappendoel.">
          <div className="stack">
            {(Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => (
              <button key={k} className={'choice' + (p.activity === k ? ' on' : '')} onClick={() => { set('activity', k); next(); }} style={{ padding: 12 }}>
                <span className="em">{ACT_EMOJI[k]}</span>
                <div><div className="t">{ACTIVITY[k].label}</div><div className="s">{ACTIVITY[k].hint}</div></div>
              </button>
            ))}
          </div>
        </Q>
      );
      break;
    case 'dagen':
      content = (
        <Q title="Hoeveel dagen wil je trainen?" lead="Kies een aantal en tik eventueel andere dagen aan.">
          <div className="chips" style={{ justifyContent: 'space-between' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={'chip' + (p.trainDays.length === n ? ' on' : '')} style={{ width: 44, justifyContent: 'center', padding: 0 }} onClick={() => set('trainDays', spreadDays(n))}>{n}×</button>
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
          {p.trainDays.length > 0 && (
            <div className="card flat small">
              <b>{SPLIT_NAME(p.trainDays.length)}</b>
              <div className="muted">{p.trainDays.length <= 2 ? 'Met 1 of 2 dagen train je elke keer je hele lichaam.' : 'Vanaf 3 dagen train je per dag een paar spiergroepen, met genoeg hersteltijd ertussen.'}</div>
            </div>
          )}
          <div className="label-cap">Waar train je?</div>
          <div className="grid2">
            {PLACE_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.place === o.v ? ' on' : '')} onClick={() => setP((d) => ({ ...d, place: o.v, equipment: defaultEquipment(o.v) }))} style={{ padding: 12 }}>
                <span className="em" style={{ width: 40, height: 40, fontSize: 22 }}>{o.em}</span><span className="t">{o.t}</span>
              </button>
            ))}
          </div>
        </Q>
      );
      break;
    case 'uitrusting':
      content = (
        <Q title={p.place === 'gym' ? 'Wat heeft jouw gym?' : 'Wat heb je thuis?'} lead="Oefeningen waarvoor je iets mist, zetten we niet in je schema.">
          <div className="stack tight">
            {ALL_EQUIP.map((q: Equip) => {
              const on = p.equipment.includes(q);
              return (
                <button key={q} className={'choice' + (on ? ' on' : '')} style={{ padding: 12 }} onClick={() => set('equipment', on ? p.equipment.filter((x) => x !== q) : [...p.equipment, q])}>
                  <span className="em" style={{ width: 40, height: 40, fontSize: 20 }}>{EQUIP_LABEL[q].em}</span>
                  <div className="grow"><div className="t">{EQUIP_LABEL[q].t}</div><div className="s">{EQUIP_LABEL[q].s}</div></div>
                  <span className={'check' + (on ? ' on' : '')}><I.check /></span>
                </button>
              );
            })}
          </div>
          {p.equipment.length === 0 && <p className="small muted" style={{ margin: 0 }}>Geen probleem: je krijgt een schema met je eigen lichaamsgewicht, een stoel en een tafel.</p>}
        </Q>
      );
      break;
    case 'ervaring':
      content = (
        <Q title="Hoeveel gymervaring heb je?" lead="Daarop kiezen we hoe technisch je oefeningen zijn.">
          <div className="stack">
            {(Object.keys(EXPERIENCE) as Experience[]).map((k) => (
              <button key={k} className={'choice' + (p.experience === k ? ' on' : '')} onClick={() => { set('experience', k); next(); }} style={{ padding: 12 }}>
                <span className="em">{k === 'nieuw' ? '🌱' : k === 'beginner' ? '🌿' : k === 'gemiddeld' ? '🌳' : '🏆'}</span>
                <div><div className="t">{EXPERIENCE[k].t}</div><div className="s">{EXPERIENCE[k].s}</div></div>
              </button>
            ))}
          </div>
        </Q>
      );
      break;
    case 'focus':
      content = (
        <Q title="Waar wil je op focussen in de gym?">
          <div className="stack">
            {FOCUS_OPTIONS.map((o) => (
              <button key={o.v} className={'choice' + (p.focus === o.v ? ' on' : '')} onClick={() => set('focus', o.v)} style={{ padding: 12 }}>
                <span className="em">{o.em}</span>
                <div><div className="t">{o.t}</div><div className="s">{o.s}</div></div>
              </button>
            ))}
          </div>
        </Q>
      );
      break;
    case 'coach':
      content = (
        <Q title="Mag je coach je helpen herinneren?" lead="Puls stuurt je een seintje op de juiste momenten, en viert het als je je doelen haalt.">
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="list">
              {([
                ['water', 'Water drinken', 'Als je achterloopt op schema'],
                ['meals', 'Maaltijden invullen', 'Ontbijt, lunch en avondeten'],
                ['training', 'Trainen', 'Op je trainingsdagen'],
                ['evening', 'Dagoverzicht', 'Om 21:00 hoe je dag ging'],
              ] as [keyof Reminders, string, string][]).map(([k, t, s]) => (
                <div key={k} className="item">
                  <div className="grow"><div className="t">{t}</div><div className="s">{s}</div></div>
                  {k === 'training' && rem.training && (
                    <input id="ob-traintime" type="time" className="input" style={{ width: 118, height: 40 }} value={rem.trainingTime} onChange={(e) => setRem({ ...rem, trainingTime: e.target.value })} aria-label="Tijdstip trainingsreminder" />
                  )}
                  <Switch on={rem[k] as boolean} onChange={(v) => setRem({ ...rem, [k]: v })} label={t} />
                </div>
              ))}
            </div>
          </div>
        </Q>
      );
      break;
    case 'plan':
      content = (
        <Q title={`${p.name ? p.name + ', j' : 'J'}e plan staat klaar`} lead="Dit zijn je dagelijkse doelen. Je kunt ze altijd aanpassen.">
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
              <b>{p.trainDays.length ? `${p.trainDays.length}× per week · ${SPLIT_NAME(p.trainDays.length)}` : 'Nog geen trainingsdagen'}</b>
              <div className="small muted">{p.trainDays.map((d) => DAY_SHORT[d]).join(', ') || 'Je kunt later dagen kiezen'} · {EXPERIENCE[p.experience].t.toLowerCase()}</div>
            </div>
          </div>
          <p className="tiny" style={{ margin: 0 }}>
            Berekend uit je lengte, gewicht, leeftijd en je geschatte vetpercentage (± {fmt(bf)}%) en vetvrije massa (± {fmt(leanMass(p))} kg). Je eiwit is afgestemd op je spiermassa.
          </p>
        </Q>
      );
      break;
  }

  const autoAdvance = step === 'geslacht' || step === 'doel' || step === 'activiteit' || step === 'ervaring';
  const finish = async () => {
    useStore.getState().setReminders(rem);
    setProfile({ ...p, name: p.name.trim(), startWeightKg: p.weightKg, createdAt: new Date().toISOString() });
  };
  return (
    <div className="ob">
      <div className="ob-top">
        <button className="iconbtn" onClick={back} aria-label="Terug"><I.left /></button>
        <div className="ob-progress"><i style={{ width: `${(i / (steps.length - 1)) * 100}%` }} /></div>
      </div>
      <div key={step} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{content}</div>
      {!autoAdvance && step === 'coach' && (
        <div className="stack tight" style={{ marginTop: 20 }}>
          <button className="btn block" onClick={async () => { await requestNotifications(); setRem((r) => ({ ...r, on: true })); next(); }}>Ja, help me herinneren</button>
          <button className="btn ghost block" onClick={() => { setRem((r) => ({ ...r, on: false })); next(); }}>Liever niet</button>
        </div>
      )}
      {!autoAdvance && step !== 'coach' && (
        <button className="btn block" style={{ marginTop: 20 }} disabled={!valid} onClick={() => (step === 'plan' ? finish() : next())}>
          {step === 'plan' ? 'Aan de slag' : step === 'naam' && !p.name.trim() ? 'Overslaan' : 'Volgende'}
        </button>
      )}
    </div>
  );
}
