import { useEffect, useMemo, useState } from 'react';
import { addDays, dateKey, DAY_LONG, DAY_SHORT, fmt, parseKey, weekday } from '../lib/date';
import { usePlan } from '../lib/hooks';
import { FOCUS_OPTIONS, PLACE_OPTIONS } from '../lib/options';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { EXPERIENCE, SPLIT_NAME, workoutKcal, type WorkoutDay } from '../lib/workout';
import { Figure } from '../components/Figure';
import { I, toast, AvatarButton } from '../components/ui';

export function Training() {
  const profile = useStore((s) => s.profile)!;
  const days = useStore((s) => s.days);
  const plan = usePlan();
  const { open, startSession } = useUI();
  const today = dateKey();
  const todayWd = weekday(today);
  const monday = addDays(today, -todayWd);
  const [sel, setSel] = useState(todayWd);

  const wd = plan.find((p) => p.weekday === sel);
  const selDate = addDays(monday, sel);
  const done = wd ? days[selDate]?.workoutsDone.includes(wd.id) : false;
  const doneThisWeek = plan.filter((p) => days[addDays(monday, p.weekday)]?.workoutsDone.includes(p.id)).length;
  const focus = FOCUS_OPTIONS.find((f) => f.v === profile.focus)!;
  const place = PLACE_OPTIONS.find((f) => f.v === profile.place)!;

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="page-title">Training</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => open({ type: 'planEdit' })}>Aanpassen</button>
          <AvatarButton />
        </div>
      </header>

      <div className="chips">
        <span className="tag brand">{profile.trainDays.length}× per week</span>
        <span className="tag">{focus.em} {focus.t}</span>
        <span className="tag">{place.em} {place.t}</span>
        <span className="tag">{EXPERIENCE[profile.experience].t}</span>
        {plan.length > 0 && <span className="tag">{SPLIT_NAME(plan.length)}</span>}
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <b>Deze week</b>
          <span className="small muted num">{doneThisWeek} / {plan.length} trainingen</span>
        </div>
        <div className="week">
          {DAY_SHORT.map((d, i) => {
            const date = addDays(monday, i);
            const p = plan.find((x) => x.weekday === i);
            const isDone = p && days[date]?.workoutsDone.includes(p.id);
            return (
              <button key={d} className={['wd', p && 'train', isDone && 'done', sel === i && 'sel', i === todayWd && 'today'].filter(Boolean).join(' ')} onClick={() => setSel(i)} aria-label={`${DAY_LONG[i]}${p ? `: ${p.name}` : ': rustdag'}`}>
                <span className="d">{d}</span>
                <span className="n num">{parseKey(date).getDate()}</span>
                <span className="dot" />
              </button>
            );
          })}
        </div>
      </div>

      {plan.length === 0 ? (
        <div className="card empty">
          <div className="em">🗓️</div>
          <p>Je hebt nog geen trainingsdagen gekozen.</p>
          <button className="btn" onClick={() => open({ type: 'planEdit' })}>Maak mijn schema</button>
        </div>
      ) : wd ? (
        <>
          <section className="workout-hero">
            <span className="glyph" aria-hidden>{wd.emoji}</span>
            <div className="eyebrow">{sel === todayWd ? 'Vandaag' : DAY_LONG[sel]} · {wd.subtitle}</div>
            <h2>{wd.name}</h2>
            <div className="meta num">
              <span>⏱ ± {wd.estMinutes} min</span>
              <span>🏋️ {wd.exercises.length} oefeningen</span>
              <span>🔥 ± {fmt(workoutKcal(wd, profile.weightKg))} kcal</span>
            </div>
            {done ? (
              <div className="btn block" style={{ cursor: 'default' }}>✓ Afgerond, goed bezig!</div>
            ) : (
              <button className="btn block" onClick={() => startSession(wd.id)}>Start training</button>
            )}
          </section>
          <WorkoutList wd={wd} />
        </>
      ) : (
        <div className="card row">
          <div className="meal-icon" style={{ background: 'var(--surface-2)', fontSize: 26 }}>🌿</div>
          <div className="grow">
            <b>Rustdag op {DAY_LONG[sel]}</b>
            <div className="small muted">Spieren groeien tijdens herstel. Een wandeling helpt je stappendoel.</div>
          </div>
        </div>
      )}

      {plan.length > 0 && (
        <>
          <div className="section-title"><h2>Jouw week</h2></div>
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="list">
              {plan.map((p) => (
                <button key={p.id} className="item" onClick={() => setSel(p.weekday)}>
                  <div className="ico">{p.emoji}</div>
                  <div className="grow">
                    <div className="t">{p.name}</div>
                    <div className="s">{DAY_LONG[p.weekday]} · {p.subtitle}</div>
                  </div>
                  <span className="small muted num">{p.estMinutes} min</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WorkoutList({ wd }: { wd: WorkoutDay }) {
  const open = useUI((s) => s.open);
  const lifts = useStore((s) => s.lifts);
  return (
    <div className="card" style={{ padding: '4px 14px' }}>
      {wd.exercises.map((e, i) => (
        <button key={e.exercise.id} className="exrow" onClick={() => open({ type: 'exercise', id: e.exercise.id, slotKey: e.slotKey })}>
          <span className="fig-thumb" aria-label={`Oefening ${i + 1}`}><Figure anim={e.exercise.anim} still /></span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{e.exercise.name}</div>
            <div className="small muted num">
              {e.sets} × {e.reps} · rust {restLabel(e.restSec)}
              {lifts[e.exercise.id] ? ` · ${fmt(lifts[e.exercise.id], 1)} kg` : ''}
            </div>
          </div>
          <span className="tag">{e.alternatives.length ? 'Uitleg · wissel' : 'Uitleg'}</span>
        </button>
      ))}
      {wd.cardio && (
        <div className="exrow">
          <span className="exnum">🏃</span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{wd.cardio.label}</div>
            <div className="small muted">{wd.cardio.minutes} minuten</div>
          </div>
        </div>
      )}
    </div>
  );
}

const restLabel = (s: number) => (s >= 120 ? `${fmt(s / 60, 1)} min` : `${s} sec`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function WorkoutSession({ id }: { id: string }) {
  const plan = usePlan();
  const wd = plan.find((p) => p.id === id);
  const kg = useStore((s) => s.profile?.weightKg ?? 70);
  const savedLifts = useStore((s) => s.lifts);
  const { startSession, open } = useUI();
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(savedLifts).map(([k, v]) => [k, String(v).replace('.', ',')])),
  );
  const [cardioDone, setCardioDone] = useState(false);
  const [rest, setRest] = useState<{ until: number } | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (rest && now >= rest.until) {
      setRest(null);
      navigator.vibrate?.(200);
    }
  }, [now, rest]);

  const totals = useMemo(() => {
    if (!wd) return { sets: 0, done: 0 };
    const sets = wd.exercises.reduce((s, e) => s + e.sets, 0);
    const d = wd.exercises.reduce((s, e) => s + Math.min(e.sets, done[e.exercise.id] ?? 0), 0);
    return { sets, done: d };
  }, [wd, done]);

  if (!wd) return null;
  const elapsed = (now - started) / 1000;

  const tapSet = (exId: string, i: number, restSec: number) => {
    const cur = done[exId] ?? 0;
    const next = i < cur ? i : i + 1;
    setDone({ ...done, [exId]: next });
    if (next > cur) setRest({ until: Date.now() + restSec * 1000 });
  };

  const finish = () => {
    const strengthFrac = totals.sets ? totals.done / totals.sets : 0;
    const cardioMin = wd.cardio && cardioDone ? wd.cardio.minutes : 0;
    const strengthMin = Math.max(0, wd.estMinutes - (wd.cardio?.minutes ?? 0));
    const minutes = Math.max(Math.round(elapsed / 60), Math.round(strengthMin * strengthFrac + cardioMin));
    const kcal = Math.round(5 * kg * ((minutes - cardioMin) / 60) + 8 * kg * (cardioMin / 60));
    const lifts: Record<string, number> = {};
    for (const [k, v] of Object.entries(weights)) {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) lifts[k] = n;
    }
    useStore.getState().completeWorkout(dateKey(), wd.id, { name: wd.name, emoji: wd.emoji, minutes, kcal }, lifts);
    startSession(null);
    toast(`Training afgerond! ${fmt(kcal)} kcal verbrand 🎉`);
  };

  return (
    <div className="session" role="dialog" aria-label={`Training ${wd.name}`}>
      <div className="session-inner">
        <div className="row between">
          <button className="iconbtn" onClick={() => (totals.done ? setConfirmQuit(true) : startSession(null))} aria-label="Training sluiten"><I.close /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="tiny" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{wd.name}</div>
            <div className="kpi num">{mmss(elapsed)}</div>
          </div>
          <span className="tag brand num">{totals.done}/{totals.sets}</span>
        </div>
        <div className="bar" style={{ height: 8 }}><i style={{ width: `${(totals.done / Math.max(1, totals.sets)) * 100}%`, background: 'var(--brand)' }} /></div>

        {confirmQuit && (
          <div className="card stack">
            <b>Training stoppen zonder op te slaan?</b>
            <div className="row">
              <button className="btn ghost sm grow" onClick={() => setConfirmQuit(false)}>Doorgaan</button>
              <button className="btn danger sm grow" onClick={() => startSession(null)}>Stoppen</button>
            </div>
          </div>
        )}

        {wd.exercises.map((e) => {
          const n = done[e.exercise.id] ?? 0;
          const complete = n >= e.sets;
          return (
            <div key={e.exercise.id} className="card" style={complete ? { outline: '2px solid var(--brand)' } : undefined}>
              <div className="row">
                <button className="fig-thumb" onClick={() => open({ type: 'exercise', id: e.exercise.id, slotKey: e.slotKey })} aria-label={`Uitleg ${e.exercise.name}`} style={complete ? { outline: '2px solid var(--brand)' } : undefined}><Figure anim={e.exercise.anim} still /></button>
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => open({ type: 'exercise', id: e.exercise.id, slotKey: e.slotKey })}>
                  <div style={{ fontWeight: 700 }}>{e.exercise.name}</div>
                  <div className="small muted num">{e.sets} × {e.reps} · rust {restLabel(e.restSec)}</div>
                </button>
                {e.exercise.weighted && (
                  <label className="weight-in small muted">
                    <input
                      id={`w-${e.exercise.id}`} inputMode="decimal" placeholder="0"
                      value={weights[e.exercise.id] ?? ''} onChange={(ev) => setWeights({ ...weights, [e.exercise.id]: ev.target.value })}
                      aria-label={`Gewicht ${e.exercise.name} in kg`}
                    />
                    kg
                  </label>
                )}
              </div>
              <div className="sets">
                {Array.from({ length: e.sets }, (_, i) => (
                  <button key={i} className={'set' + (i < n ? ' done' : '')} onClick={() => tapSet(e.exercise.id, i, e.restSec)} aria-label={`Set ${i + 1} ${i < n ? 'ongedaan maken' : 'afvinken'}`}>
                    <b>{i < n ? '✓' : i + 1}</b>
                    <span>{e.reps.replace(' langzaam', '').replace(' sec', 's')}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {wd.cardio && (
          <button className="card row" style={{ textAlign: 'left', outline: cardioDone ? '2px solid var(--brand)' : undefined }} onClick={() => setCardioDone(!cardioDone)}>
            <span className="exnum">{cardioDone ? '✓' : '🏃'}</span>
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{wd.cardio.label}</div>
              <div className="small muted">{wd.cardio.minutes} minuten · tik om af te vinken</div>
            </div>
          </button>
        )}
      </div>

      {rest && (
        <div className="resttimer" role="timer">
          <span style={{ width: 22, height: 22 }}><I.timer /></span>
          <div><div className="tiny" style={{ color: 'inherit', opacity: 0.7 }}>Rust</div><div className="t num">{mmss(Math.max(0, (rest.until - now) / 1000))}</div></div>
          <button onClick={() => setRest({ until: rest.until + 15000 })}>+15s</button>
          <button onClick={() => setRest(null)}>Klaar</button>
        </div>
      )}

      <div className="session-foot">
        <div>
          <button className="btn block" disabled={totals.done === 0 && !cardioDone} onClick={finish}>
            Training afronden
          </button>
        </div>
      </div>
    </div>
  );
}
