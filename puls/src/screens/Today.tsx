import type { ReactElement } from 'react';
import { mealRange, entryNutrients, stepsToKm, sumNutrients } from '../lib/calc';
import { addDays, dateKey, dayTitle, fmt, greeting, liters, weekday } from '../lib/date';
import { dayTotals, useDay, usePlan, useTargets, useWaterTarget } from '../lib/hooks';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { MEALS, type MealKey } from '../lib/types';
import { Bar, I, Logo, Ring, toast } from '../components/ui';
import { CoachCard, useCoachCtx } from '../components/Coach';
import { coachFeed } from '../lib/coach';

const NONE: never[] = [];

export const MEAL_META: Record<MealKey, { label: string; icon: () => ReactElement; tint: string; color: string }> = {
  ontbijt: { label: 'Ontbijt', icon: I.sunrise, tint: 'color-mix(in srgb, var(--carb) 22%, transparent)', color: 'var(--carb)' },
  lunch: { label: 'Lunch', icon: I.sun, tint: 'color-mix(in srgb, var(--brand) 18%, transparent)', color: 'var(--brand)' },
  diner: { label: 'Avondeten', icon: I.moon, tint: 'color-mix(in srgb, var(--fat) 18%, transparent)', color: 'var(--fat)' },
  snacks: { label: 'Snacks', icon: I.apple, tint: 'color-mix(in srgb, var(--protein) 16%, transparent)', color: 'var(--protein)' },
};

export function Today() {
  const profile = useStore((s) => s.profile)!;
  const addBurned = useStore((s) => s.addBurned);
  const { date, setDate, open } = useUI();
  const t = useTargets()!;
  const day = useDay(date);
  const { eaten, burned } = dayTotals(day);
  const budget = t.kcal + (addBurned ? burned : 0);
  const remaining = Math.round(budget - eaten.kcal);
  const over = remaining < 0;
  const today = dateKey();

  return (
    <div className="page">
      <header className="topbar">
        <div className="row">
          <Logo size={36} />
          <div className="hello">
            {greeting()}
            <b>{profile.name || 'daar'}</b>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Bell />
          <button className="avatar" onClick={() => useUI.getState().setTab('profiel')} aria-label="Profiel">
            {(profile.name || 'P').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <nav className="datenav" aria-label="Dag kiezen">
        <button className="arrow" onClick={() => setDate(addDays(date, -1))} aria-label="Vorige dag"><I.left /></button>
        <button className="label" onClick={() => setDate(today)}>{dayTitle(date, today)}</button>
        <button className="arrow" onClick={() => setDate(addDays(date, 1))} aria-label="Volgende dag"><I.right /></button>
      </nav>

      <CoachCard date={date} />

      <section className="daycard" aria-label="Calorieën vandaag">
        <div className="ringwrap">
          <div className="stat">
            <div className="v num">{fmt(eaten.kcal)}</div>
            <div className="l">Gegeten</div>
          </div>
          <Ring size={186} stroke={15} value={eaten.kcal / budget} color={over ? 'var(--protein)' : 'var(--brand)'} dot>
            <div className="ring-center">
              <div className="cap">{over ? 'Te veel' : 'Nog over'}</div>
              <div className="big num">{fmt(Math.abs(remaining))}</div>
              <div className="goal num">doel {fmt(t.kcal)} kcal</div>
            </div>
          </Ring>
          <div className="stat">
            <div className="v num">{fmt(burned)}</div>
            <div className="l">Verbrand</div>
          </div>
        </div>
        <div className="macros">
          <Macro name="Koolhydraten" v={eaten.c} t={t.c} color="var(--carb)" />
          <Macro name="Eiwit" v={eaten.p} t={t.p} color="var(--protein)" />
          <Macro name="Vet" v={eaten.f} t={t.f} color="var(--fat)" />
        </div>
      </section>

      <div className="grid2">
        <WaterCard date={date} />
        <StepsCard date={date} heightCm={profile.heightCm} target={t.steps} />
      </div>

      <TrainingTeaser date={date} />

      <div className="section-title">
        <h2>Voedingslogboek</h2>
        <span className="small muted num">{fmt(eaten.kcal)} kcal</span>
      </div>
      {MEALS.map((m) => (
        <MealCard key={m} meal={m} date={date} kcal={t.kcal} />
      ))}

      <div className="section-title">
        <h2>Beweging</h2>
        <button className="link" onClick={() => open({ type: 'activity' })}>+ Activiteit</button>
      </div>
      <div className="card">
        {day.activities.length === 0 ? (
          <div className="row">
            <div className="meal-icon" style={{ background: 'color-mix(in srgb, var(--steps) 16%, transparent)', color: 'var(--steps)' }}><I.flame /></div>
            <div className="grow">
              <b>Nog niets gelogd</b>
              <div className="small muted">Hardlopen, fietsen of een training? Verbrande kcal komen bij je budget.</div>
            </div>
          </div>
        ) : (
          <div className="list">
            {day.activities.map((a) => (
              <div key={a.id} className="item">
                <div className="ico">{a.emoji}</div>
                <div className="grow">
                  <div className="t">{a.name}</div>
                  <div className="s num">{a.minutes} min</div>
                </div>
                <b className="num" style={{ color: 'var(--steps)' }}>−{fmt(a.kcal)} kcal</b>
                <button className="iconbtn" aria-label={`${a.name} verwijderen`} onClick={() => { useStore.getState().removeActivity(date, a.id); toast('Activiteit verwijderd'); }}>
                  <I.trash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bell() {
  const ctx = useCoachCtx(dateKey());
  const open = useUI((s) => s.open);
  const n = ctx ? coachFeed(ctx).filter((m) => m.tone === 'nudge').length : 0;
  return (
    <button className="iconbtn bell" style={{ width: 42, height: 42, background: 'var(--surface)' }} onClick={() => open({ type: 'inbox' })} aria-label={`Berichten van je coach${n ? `, ${n} nieuw` : ''}`}>
      <I.bell />
      {n > 0 && <span className="badge num">{n}</span>}
    </button>
  );
}

function Macro({ name, v, t, color }: { name: string; v: number; t: number; color: string }) {
  return (
    <div className="macro">
      <div className="name">{name}</div>
      <div className="val num">{fmt(v)}<span> / {fmt(t)} g</span></div>
      <Bar value={v / t} color={color} />
    </div>
  );
}

function Glass({ pct }: { pct: number }) {
  const h = 52 * Math.min(1, pct);
  return (
    <svg className="glass" viewBox="0 0 46 62" aria-hidden>
      <defs>
        <clipPath id="glassclip"><path d="M4 4h38l-4.5 52a3 3 0 01-3 2.7H11.5a3 3 0 01-3-2.7z" /></clipPath>
      </defs>
      <g clipPath="url(#glassclip)">
        <rect x="0" y="0" width="46" height="62" fill="color-mix(in srgb, var(--water) 10%, transparent)" />
        <g style={{ transform: `translateY(${58 - h}px)`, transition: 'transform 0.6s cubic-bezier(.2,.8,.2,1)' }}>
          <path d="M-46 3 q11.5 -6 23 0 t23 0 t23 0 t23 0 t23 0 V70 H-46z" fill="var(--water)" opacity="0.9">
            <animateTransform attributeName="transform" type="translate" from="0 0" to="46 0" dur="2.4s" repeatCount="indefinite" />
          </path>
        </g>
      </g>
      <path d="M4 4h38l-4.5 52a3 3 0 01-3 2.7H11.5a3 3 0 01-3-2.7z" fill="none" stroke="var(--water)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function WaterCard({ date }: { date: string }) {
  const day = useDay(date);
  const glass = useStore((s) => s.glassMl);
  const setWater = useStore((s) => s.setWater);
  const target = useWaterTarget(date);
  const ml = day.waterMl;
  const pct = ml / target;
  const left = Math.max(0, target - ml);
  const glassesLeft = Math.ceil(left / glass);

  let hint = `Nog ${glassesLeft} ${glassesLeft === 1 ? 'glas' : 'glazen'} te gaan`;
  let cls = 'hint';
  if (pct >= 1) {
    hint = 'Doel gehaald, lekker gehydrateerd!';
    cls = 'hint good';
  } else if (date === dateKey()) {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const expected = target * Math.max(0, Math.min(1, (h - 7) / 14));
    if (ml < expected - glass * 2) {
      hint = 'Je loopt achter. Tijd voor een glas water!';
      cls = 'hint warn';
    } else if (ml >= expected) hint = `Goed op schema · nog ${glassesLeft} ${glassesLeft === 1 ? 'glas' : 'glazen'}`;
  } else if (date < dateKey()) {
    hint = `${Math.round(pct * 100)}% van je doel gedronken`;
  }

  return (
    <div className="card water">
      <div className="label-cap" style={{ color: 'var(--water)' }}>Water</div>
      <div className="top">
        <Glass pct={pct} />
        <div className="kpi num">
          {liters(ml)}<small> / {liters(target)} L</small>
        </div>
      </div>
      <div className={cls}>{hint}</div>
      <div className="pillbtns">
        <button onClick={() => setWater(date, ml - glass)} aria-label="Glas eraf">−</button>
        <button className="primary" onClick={() => setWater(date, ml + glass)} aria-label={`Glas water toevoegen (${glass} ml)`}>+ glas</button>
      </div>
    </div>
  );
}

function StepsCard({ date, target, heightCm }: { date: string; target: number; heightCm: number }) {
  const day = useDay(date);
  const open = useUI((s) => s.open);
  const pct = day.steps / target;
  return (
    <div className="card water">
      <div className="label-cap" style={{ color: 'var(--steps)' }}>Stappen</div>
      <div className="top">
        <Ring size={52} stroke={6} value={pct} color="var(--steps)"><span style={{ color: 'var(--steps)', width: 22, height: 22, display: 'grid' }}><I.shoe /></span></Ring>
        <div className="kpi num">
          {fmt(day.steps)}
          <small><br />van {fmt(target)}</small>
        </div>
      </div>
      <div className={'hint' + (pct >= 1 ? ' good' : '')}>
        {pct >= 1 ? 'Stappendoel gehaald!' : `${fmt(stepsToKm(day.steps, heightCm), 1)} km · nog ${fmt(Math.max(0, target - day.steps))}`}
      </div>
      <div className="pillbtns">
        <button onClick={() => open({ type: 'steps' })}>Invoeren</button>
        <button className="primary steps" onClick={() => open({ type: 'connect' })} aria-label="Stappen koppelen"><span style={{ width: 18, height: 18, display: 'inline-block', verticalAlign: '-3px' }}><I.link /></span></button>
      </div>
    </div>
  );
}

function TrainingTeaser({ date }: { date: string }) {
  const plan = usePlan();
  const day = useDay(date);
  const wd = plan.find((p) => p.weekday === weekday(date));
  const { setTab, startSession } = useUI();
  if (!wd) {
    const next = plan.find((p) => p.weekday > weekday(date)) ?? plan[0];
    return (
      <button className="card row" style={{ textAlign: 'left' }} onClick={() => setTab('training')}>
        <div className="meal-icon" style={{ background: 'var(--surface-2)', fontSize: 24 }}>🌿</div>
        <div className="grow">
          <b>Rustdag</b>
          <div className="small muted">{next ? `Volgende training: ${next.name}` : 'Stel je trainingsschema in'}</div>
        </div>
        <I.right />
      </button>
    );
  }
  const done = day.workoutsDone.includes(wd.id);
  return (
    <div className="card row">
      <div className="meal-icon" style={{ background: 'color-mix(in srgb, var(--brand) 16%, transparent)', fontSize: 24 }}>{wd.emoji}</div>
      <button className="grow" style={{ textAlign: 'left' }} onClick={() => setTab('training')}>
        <div className="tiny" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Training vandaag</div>
        <b>{wd.name}</b>
        <div className="small muted">{wd.exercises.length} oefeningen · ± {wd.estMinutes} min</div>
      </button>
      {done ? (
        <span className="tag brand"><span style={{ width: 14, height: 14, display: 'inline-block' }}><I.check /></span> Klaar</span>
      ) : (
        <button className="btn sm" onClick={() => startSession(wd.id)}>Start</button>
      )}
    </div>
  );
}

function MealCard({ meal, date, kcal }: { meal: MealKey; date: string; kcal: number }) {
  const day = useDay(date);
  const open = useUI((s) => s.open);
  const entries = day.meals[meal];
  const sum = sumNutrients(entries);
  const [lo, hi] = mealRange(meal, kcal);
  const meta = MEAL_META[meal];
  const Icon = meta.icon;
  const yesterday = useStore((s) => s.days[addDays(date, -1)]?.meals[meal]) ?? NONE;

  return (
    <div className="card meal">
      <div className="meal-head">
        <div className="meal-icon" style={{ background: meta.tint, color: meta.color }}><Icon /></div>
        <div className="grow">
          <h3>{meta.label}</h3>
          <div className="small muted num">
            {entries.length ? `${fmt(sum.kcal)} kcal · E ${fmt(sum.p)} g` : `Aanbevolen ${fmt(lo)} – ${fmt(hi)} kcal`}
          </div>
        </div>
        <button className={'addbtn' + (entries.length ? '' : ' solid')} onClick={() => open({ type: 'addFood', meal })} aria-label={`Toevoegen aan ${meta.label}`}>
          <I.plus />
        </button>
      </div>
      {entries.length > 0 && (
        <div className="entries">
          {entries.map((e) => (
            <button key={e.id} className="entry" onClick={() => open({ type: 'editEntry', meal, entryId: e.id })}>
              <div className="grow">
                <div className="name ellipsis">{e.food.name}</div>
                <div className="sub ellipsis">{e.label}{e.food.brand ? ` · ${e.food.brand}` : ''}</div>
              </div>
              <span className="kc num">{fmt(entryNutrients(e).kcal)}</span>
            </button>
          ))}
        </div>
      )}
      {entries.length === 0 && yesterday.length > 0 && (
        <button
          className="tag"
          style={{ marginTop: 10, marginLeft: 58 }}
          onClick={() => { useStore.getState().copyMeal(addDays(date, -1), date, meal); toast(`${meta.label} van gisteren gekopieerd`); }}
        >
          <span style={{ width: 14, height: 14, display: 'inline-block' }}><I.copy /></span> Zelfde als gisteren
        </button>
      )}
    </div>
  );
}
