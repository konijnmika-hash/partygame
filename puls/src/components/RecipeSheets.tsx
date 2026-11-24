import { useEffect, useMemo, useRef, useState } from 'react';
import { FOOD_BY_ID, type FoodCategory } from '../data/foods';
import { RECIPE_BY_ID, type Recipe } from '../data/recipes';
import { dateKey, fmt } from '../lib/date';
import { dayTotals, useMealRoom, useTargets } from '../lib/hooks';
import {
  amountLabel, ingredients, plainName, portionFor, portionText, PORTION_STEPS, recipeNutrients, recipeTags, scaleN, TAG_LABEL,
} from '../lib/recipes';
import { mealRange } from '../lib/calc';
import { useStore } from '../lib/store';
import { MEALS, type MealKey } from '../lib/types';
import { useUI } from '../lib/ui';
import { MEAL_META } from '../screens/Today';
import { FoodArt } from './FoodArt';
import { I, Sheet, toast } from './ui';

/* ---------- Recept ---------- */

export function RecipeSheet({ id, meal: mealProp, planned }: { id: string; meal?: MealKey; planned?: number }) {
  const recipe = RECIPE_BY_ID.get(id);
  const { close, date, startCook, setTab, setDate } = useUI();
  const t = useTargets();
  const today = dateKey();
  // vanaf het dagscherm log je op de dag die openstaat, vanuit Recepten altijd op vandaag
  const [logDate] = useState(() => (useUI.getState().tab === 'vandaag' ? date : today));
  const [meal, setMeal] = useState<MealKey>(mealProp ?? recipe?.meal ?? 'lunch');
  const room = useMealRoom(meal, logDate);
  const day = useStore((s) => s.days[logDate]);
  const fav = useStore((s) => s.favRecipes.includes(id));
  const cooked = useStore((s) => s.cooked[id] ?? 0);
  const fromMenu = planned !== undefined && meal === (mealProp ?? recipe?.meal);
  const advised = fromMenu ? planned : recipe && room ? portionFor(recipe, room.kcal) : 1;
  const [factor, setFactor] = useState(advised);
  const [servings, setServings] = useState(1);
  const [have, setHave] = useState<string[]>([]);
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setFactor(advised);
  }, [advised]);

  if (!recipe || !t) return null;
  const n = scaleN(recipeNutrients(recipe), factor);
  const { items, extras } = ingredients(recipe);
  const tags = recipeTags(recipe);
  const eaten = day ? dayTotals(day).eaten : { kcal: 0, p: 0 };
  const after = Math.round(t.kcal - eaten.kcal - n.kcal);
  const [lo, hi] = mealRange(meal, t.kcal);
  const setF = (f: number) => {
    touched.current = true;
    setFactor(f);
  };
  const fi = PORTION_STEPS.indexOf(factor);
  const mult = factor * servings;

  const log = () => {
    useStore.getState().logRecipe(logDate, meal, recipe, factor);
    close();
    if (useUI.getState().tab !== 'vandaag') {
      setDate(logDate);
      setTab('vandaag');
    }
    toast(after >= 0 ? `Gelogd bij ${MEAL_META[meal].label.toLowerCase()}. Nog ${fmt(after)} kcal over vandaag 👌` : `Gelogd bij ${MEAL_META[meal].label.toLowerCase()}.`);
  };

  return (
    <Sheet onClose={close} full>
      <div className="recipe">
        <div className="recipe-hero">
          <FoodArt recipe={recipe} />
          <button className="hero-btn left" onClick={close} aria-label="Sluiten"><I.close /></button>
          <button className={'hero-btn right' + (fav ? ' on' : '')} onClick={() => { useStore.getState().toggleFavRecipe(id); toast(fav ? 'Uit je favorieten' : 'Bewaard bij je favorieten'); }} aria-label={fav ? 'Uit favorieten' : 'Bewaar als favoriet'} aria-pressed={fav}>
            <I.heart filled={fav} />
          </button>
        </div>

        <div className="recipe-body">
          <div className="tiny" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: MEAL_META[recipe.meal].color }}>{MEAL_META[recipe.meal].label}{cooked ? ` · ${cooked}× gemaakt` : ''}</div>
          <h2 className="recipe-title">{recipe.name}</h2>
          <p className="muted" style={{ margin: 0 }}>{recipe.intro}</p>
          <div className="chips" style={{ gap: 6 }}>
            <span className="tag"><span className="i14"><I.clock /></span>{recipe.minutes} min</span>
            {tags.map((g) => <span key={g} className={'tag' + (g === 'eiwitrijk' || g === 'vega' ? ' brand' : '')}>{TAG_LABEL[g]}</span>)}
          </div>

          {/* Jouw portie */}
          <section className="portion">
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="label-cap" style={{ color: 'var(--brand)' }}>Jouw portie</div>
                <div className="portion-big">{portionText(factor)}</div>
              </div>
              <div className="pstep">
                <button onClick={() => setF(PORTION_STEPS[Math.max(0, fi - 1)])} disabled={fi <= 0} aria-label="Kleinere portie">−</button>
                <button onClick={() => setF(PORTION_STEPS[Math.min(PORTION_STEPS.length - 1, fi + 1)])} disabled={fi >= PORTION_STEPS.length - 1} aria-label="Grotere portie">+</button>
              </div>
            </div>
            <div className="pmacros num">
              <div><b>{fmt(n.kcal)}</b><span>kcal</span></div>
              <div><b style={{ color: 'var(--protein)' }}>{fmt(n.p)} g</b><span>eiwit</span></div>
              <div><b style={{ color: 'var(--carb)' }}>{fmt(n.c)} g</b><span>koolh.</span></div>
              <div><b style={{ color: 'var(--fat)' }}>{fmt(n.f)} g</b><span>vet</span></div>
            </div>
            <p className="portion-why">
              {factor === advised
                ? <><b>Afgestemd op jou.</b> {fromMenu ? 'Met deze portie haalt je dagmenu precies je doelen van vandaag.' : room?.adjusted ? `Op basis van wat je vandaag al at, houd ik voor ${MEAL_META[meal].label.toLowerCase()} ${fmt(Math.round((room.kcal) / 10) * 10)} kcal aan.` : `Voor ${MEAL_META[meal].label.toLowerCase()} past ${fmt(lo)}–${fmt(hi)} kcal bij jouw doel.`}{factor !== 1 && !fromMenu ? ` Daarom raad ik ${portionText(factor)} aan.` : ''}</>
                : <>Ik raadde {portionText(advised)} aan ({fmt(recipeNutrients(recipe).kcal * advised)} kcal). <button className="link" onClick={() => setF(advised)}>Terug naar advies</button></>}
              {logDate === today && <> Na deze maaltijd heb je vandaag nog <b className="num">{after >= 0 ? `${fmt(after)} kcal` : `${fmt(-after)} kcal te veel`}</b>{after >= 0 ? ' over' : ''}.</>}
            </p>
          </section>

          {/* Ingrediënten */}
          <div className="row between" style={{ marginTop: 6 }}>
            <h3 className="recipe-h">Ingrediënten</h3>
            <div className="servings">
              <span className="i18" style={{ color: 'var(--ink-3)' }}><I.users /></span>
              <button onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Voor minder personen">−</button>
              <span className="num">{servings} {servings === 1 ? 'pers.' : 'pers.'}</span>
              <button onClick={() => setServings(Math.min(8, servings + 1))} aria-label="Voor meer personen">+</button>
            </div>
          </div>
          {servings > 1 && <p className="tiny" style={{ margin: '-4px 0 0' }}>Hoeveelheden voor {servings} personen. Jouw eigen deel daarvan is {portionText(factor)}.</p>}
          <ul className="ings">
            {items.map(({ food, grams }) => {
              const a = amountLabel(food, grams * mult);
              const on = have.includes(food.id);
              return (
                <li key={food.id}>
                  <button className={'ing' + (on ? ' on' : '')} onClick={() => setHave(on ? have.filter((x) => x !== food.id) : [...have, food.id])} aria-pressed={on}>
                    <span className={'check' + (on ? ' on' : '')}>{on && <I.check />}</span>
                    <span className="grow">{plainName(food.name)}</span>
                    <span className="amt num">{a.amount}{a.grams && <small> · {a.grams}</small>}</span>
                  </button>
                </li>
              );
            })}
            {extras.map((e) => <li key={e} className="extra">+ {e}</li>)}
          </ul>
          <button className="btn sm ghost" onClick={() => { useStore.getState().addToShopping(recipe, mult); toast('Op je boodschappenlijst gezet 🛒'); }}>
            <span className="i18"><I.cart /></span> Op boodschappenlijst
          </button>

          {/* Bereiding */}
          <h3 className="recipe-h" style={{ marginTop: 10 }}>Bereiding</h3>
          <ol className="howto">
            {recipe.steps.map((s, i) => (
              <li key={i}>
                <div className="grow">
                  {s.t}
                  {s.min && <span className="tag" style={{ marginLeft: 6 }}><span className="i14"><I.timer /></span>{s.min} min</span>}
                </div>
              </li>
            ))}
          </ol>

          {recipe.tip && (
            <div className="coach-tip">
              <span className="i18"><I.sparkle /></span>
              <div><b>Tip van je coach</b><div className="small">{recipe.tip}</div></div>
            </div>
          )}
          <div style={{ height: 8 }} />
        </div>
      </div>

      <div className="recipe-foot">
        <div className="foot-lbl">Log bij</div>
        <div className="chips scroll" style={{ marginBottom: 10 }} role="radiogroup" aria-label="Log bij maaltijd">
          {MEALS.map((m) => <button key={m} role="radio" aria-checked={m === meal} className={'chip sm' + (m === meal ? ' on' : '')} onClick={() => setMeal(m)}>{MEAL_META[m].label}</button>)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost cook-btn" onClick={() => startCook({ id, servings, factor, meal })} aria-label="Kookmodus starten"><span className="i20"><I.chef /></span> Koken</button>
          <button className="btn grow" onClick={log} aria-label={`Log bij ${MEAL_META[meal].label.toLowerCase()}, ${fmt(n.kcal)} kcal`}>Loggen <span className="btn-sub num">{fmt(n.kcal)} kcal</span></button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Kookmodus ---------- */

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.3);
    });
  } catch {
    /* geen geluid beschikbaar */
  }
}

export function CookMode() {
  const cook = useUI((s) => s.cook);
  const { startCook, setTab, setDate } = useUI();
  const recipe = cook ? RECIPE_BY_ID.get(cook.id) : undefined;
  const [step, setStep] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const [timer, setTimer] = useState<{ end: number; left: number; running: boolean } | null>(null);
  const [, tick] = useState(0);

  // achtergrond niet laten meescrollen en Escape sluit de kookmodus
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useUI.getState().startCook(null);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // scherm aan houden tijdens het koken
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  useEffect(() => {
    if (!timer?.running) return;
    const id = setInterval(() => {
      if (Date.now() >= timer.end) {
        setTimer({ ...timer, left: 0, running: false });
        beep();
        navigator.vibrate?.([300, 150, 300]);
        toast('⏰ De tijd is om!');
      } else tick((x) => x + 1);
    }, 250);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => setTimer(null), [step]);

  if (!cook || !recipe) return null;
  const steps = recipe.steps;
  const last = step >= steps.length;
  const cur = steps[Math.min(step, steps.length - 1)];
  const { items, extras } = ingredients(recipe);
  const mult = cook.factor * cook.servings;
  const left = timer ? (timer.running ? Math.max(0, timer.end - Date.now()) : timer.left) : (cur.min ?? 0) * 60000;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const exit = () => startCook(null);

  return (
    <div className="cook" role="dialog" aria-modal aria-label={`Kookmodus: ${recipe.name}`}>
      <div className="cook-inner">
        <div className="row between">
          <button className="iconbtn" onClick={exit} aria-label="Kookmodus sluiten"><I.close /></button>
          <div className="small muted ellipsis" style={{ flex: 1, textAlign: 'center' }}>{recipe.name}</div>
          <button className="iconbtn" onClick={() => setShowIng(!showIng)} aria-expanded={showIng} aria-label="Ingrediënten tonen"><I.book /></button>
        </div>
        <div className="cook-progress">{steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}<i className={last ? 'on' : ''} /></div>

        {showIng && (
          <div className="card cook-ings">
            {items.map(({ food, grams }) => { const a = amountLabel(food, grams * mult); return <div key={food.id} className="row between small"><span>{plainName(food.name)}</span><b className="num">{a.amount}</b></div>; })}
            {extras.map((e) => <div key={e} className="small muted">+ {e}</div>)}
          </div>
        )}

        {!last ? (
          <div className="cook-step" key={step}>
            <div className="cook-num">Stap {step + 1} van {steps.length}</div>
            <p className="cook-text">{cur.t}</p>
            {cur.min && (
              <div className={'cook-timer' + (timer && !timer.running && timer.left === 0 ? ' done' : '')}>
                <div className="t num">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</div>
                <div className="row" style={{ gap: 8 }}>
                  {!timer || (!timer.running && timer.left > 0) ? (
                    <button className="btn sm" onClick={() => { const l = timer?.left ?? cur.min! * 60000; setTimer({ end: Date.now() + l, left: l, running: true }); }}><span className="i18"><I.play /></span> {timer ? 'Verder' : 'Start wekker'}</button>
                  ) : timer.running ? (
                    <button className="btn sm ghost" onClick={() => setTimer({ ...timer, left: Math.max(0, timer.end - Date.now()), running: false })}><span className="i18"><I.pause /></span> Pauze</button>
                  ) : (
                    <button className="btn sm ghost" onClick={() => setTimer(null)}>Opnieuw</button>
                  )}
                  {timer && <button className="btn sm ghost" onClick={() => setTimer({ end: Date.now() + left + 60000, left: left + 60000, running: timer.running })}>+1 min</button>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="cook-step done" key="done">
            <div style={{ fontSize: 64 }}>🍽️</div>
            <h2 style={{ fontSize: 30 }}>Eet smakelijk!</h2>
            <p className="muted" style={{ margin: 0 }}>Zal ik je portie ({portionText(cook.factor)}, {fmt(recipeNutrients(recipe).kcal * cook.factor)} kcal) meteen in je dagboek zetten?</p>
            <button
              className="btn block"
              onClick={() => {
                const d = dateKey();
                useStore.getState().logRecipe(d, cook.meal, recipe, cook.factor);
                exit();
                setDate(d);
                setTab('vandaag');
                toast(`Gelogd bij ${MEAL_META[cook.meal].label.toLowerCase()}. Lekker bezig!`);
              }}
            >
              Log bij {MEAL_META[cook.meal].label.toLowerCase()}
            </button>
            <button className="btn ghost block" onClick={exit}>Nee, sluiten</button>
          </div>
        )}
      </div>
      {!last && (
        <div className="session-foot">
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} aria-label="Vorige stap"><I.left /></button>
            <button className="btn grow" onClick={() => setStep(step + 1)}>{step === steps.length - 1 ? 'Klaar met koken' : 'Volgende stap'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Boodschappen ---------- */

const AISLES: { label: string; cats: (FoodCategory | 'x')[] }[] = [
  { label: 'Groente & fruit', cats: ['groente', 'fruit'] },
  { label: 'Zuivel & eieren', cats: ['zuivel'] },
  { label: 'Vlees, vis & vega', cats: ['vlees', 'vega'] },
  { label: 'Brood & ontbijt', cats: ['brood', 'beleg'] },
  { label: 'Pasta, rijst & granen', cats: ['granen', 'gerecht'] },
  { label: 'Voorraadkast', cats: ['saus', 'snack', 'drank'] },
  { label: 'Kruiden & extra’s', cats: ['x'] },
];

export function ShoppingSheet() {
  const close = useUI((s) => s.close);
  const list = useStore((s) => s.shopping);
  const { toggleShop, clearShopping } = useStore.getState();
  const groups = useMemo(
    () =>
      AISLES.map((a) => ({
        ...a,
        items: list
          .filter((i) => {
            const cat = FOOD_BY_ID.get(i.id)?.cat ?? 'x';
            return a.cats.includes(cat as FoodCategory | 'x');
          })
          .sort((x, y) => Number(x.done) - Number(y.done) || x.name.localeCompare(y.name)),
      })).filter((g) => g.items.length),
    [list],
  );
  const open = list.filter((i) => !i.done).length;
  const done = list.length - open;

  const text = () =>
    groups
      .map((g) => `${g.label}\n` + g.items.filter((i) => !i.done).map((i) => `• ${i.name}${i.grams ? ` (${qty(i.grams, i.unit)})` : ''}`).join('\n'))
      .filter((s) => s.includes('•'))
      .join('\n\n');

  const share = async () => {
    const body = `Boodschappen\n\n${text()}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Boodschappen', text: body });
      else {
        await navigator.clipboard.writeText(body);
        toast('Lijst gekopieerd');
      }
    } catch {
      /* geannuleerd */
    }
  };

  return (
    <Sheet onClose={close} full title="Boodschappen" right={list.length ? <button className="iconbtn" onClick={share} aria-label="Lijst delen"><I.share /></button> : undefined}>
      {list.length === 0 ? (
        <div className="empty">
          <div className="em">🛒</div>
          <b>Je lijst is nog leeg</b>
          <p className="small" style={{ margin: '6px 0 0' }}>Open een recept en tik op “Op boodschappenlijst”. Ik tel dezelfde producten voor je bij elkaar en sorteer ze per afdeling.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="small muted">{open ? `Nog ${open} ${open === 1 ? 'product' : 'producten'} te halen` : 'Alles in je mandje! 🎉'}</div>
          {groups.map((g) => (
            <section key={g.label}>
              <div className="label-cap" style={{ marginBottom: 6 }}>{g.label}</div>
              <div className="card" style={{ padding: '2px 12px' }}>
                {g.items.map((i) => (
                  <button key={i.key} className={'shop-item' + (i.done ? ' done' : '')} onClick={() => toggleShop(i.key)} aria-pressed={i.done}>
                    <span className={'check' + (i.done ? ' on' : '')}>{i.done && <I.check />}</span>
                    <span className="grow">
                      <span className="t">{i.name}</span>
                      <span className="s ellipsis">{i.from.join(', ')}</span>
                    </span>
                    {i.grams !== undefined && <span className="num small" style={{ fontWeight: 700 }}>{qty(i.grams, i.unit)}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="row" style={{ gap: 8 }}>
            {done > 0 && <button className="btn sm ghost grow" onClick={() => clearShopping(true)}>Afgevinkt wissen</button>}
            <button className="btn sm danger grow" onClick={() => { clearShopping(false); toast('Lijst gewist'); }}>Alles wissen</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function qty(grams: number, unit: 'g' | 'ml' = 'g') {
  if (grams >= 1000) return `${fmt(grams / 1000, 2)} ${unit === 'ml' ? 'L' : 'kg'}`;
  return `${grams < 10 ? fmt(grams, 1) : Math.round(grams / 5) * 5} ${unit}`;
}

/** Klein recept-voorstel voor een lege maaltijd op het dagscherm. */
export function MealIdea({ recipe, factor, kcal, protein, meal }: { recipe: Recipe; factor: number; kcal: number; protein: number; meal: MealKey }) {
  const open = useUI((s) => s.open);
  return (
    <button className="meal-idea" onClick={() => open({ type: 'recipe', id: recipe.id, meal })}>
      <div className="meal-idea-photo"><FoodArt recipe={recipe} /></div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="meal-idea-eyebrow"><span className="i14"><I.sparkle /></span> Idee van je coach</div>
        <div className="meal-idea-name ellipsis">{recipe.name}</div>
        <div className="tiny num ellipsis">{fmt(kcal)} kcal · {fmt(protein)} g eiwit{factor !== 1 ? ` · ${portionText(factor)}` : ` · ${recipe.minutes} min`}</div>
      </div>
      <I.right />
    </button>
  );
}

