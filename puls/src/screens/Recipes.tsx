import { useMemo, useState } from 'react';
import { RECIPES, type Recipe } from '../data/recipes';
import { normalize } from '../data/foods';
import { FoodArt } from '../components/FoodArt';
import { AvatarButton, I, toast } from '../components/ui';
import { dateKey, fmt } from '../lib/date';
import { dayTotals, useMealRoom, useTargets } from '../lib/hooks';
import {
  dayMenu, mealTarget, portionFor, portionText, recentlyEaten, recipeNutrients, recipeTags, scaleN, suggest, TAG_LABEL, type RecipeTag,
} from '../lib/recipes';
import { useStore } from '../lib/store';
import { MEALS, type MealKey } from '../lib/types';
import { mealForNow, useUI } from '../lib/ui';
import { MEAL_META } from './Today';

const MEAL_MOMENT: Record<MealKey, string> = {
  ontbijt: 'je ontbijt',
  lunch: 'je lunch',
  diner: 'je avondeten',
  snacks: 'een tussendoortje',
};

type Filter = RecipeTag | 'fav';
const FILTERS: Filter[] = ['fav', 'eiwitrijk', 'snel', 'mealprep', 'budget', 'zoet', 'comfort'];

export function Recipes() {
  const today = dateKey();
  const [meal, setMeal] = useState<MealKey | 'alles'>('alles');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const prefs = useStore((s) => s.recipePrefs);
  const favs = useStore((s) => s.favRecipes);
  const shopping = useStore((s) => s.shopping);
  const open = useUI((s) => s.open);
  const t = useTargets();

  const list = useMemo(() => {
    const terms = normalize(q.trim()).split(/\s+/).filter(Boolean);
    return RECIPES.filter((r) => {
      if (meal !== 'alles' && r.meal !== meal) return false;
      const tags = recipeTags(r);
      if (prefs.vega && !tags.includes('vega')) return false;
      for (const f of filters) {
        if (f === 'fav' ? !favs.includes(r.id) : !tags.includes(f)) return false;
      }
      if (terms.length) {
        const hay = normalize(r.name + ' ' + r.ing.map((i) => (typeof i === 'string' ? i : i[0])).join(' '));
        if (!terms.every((term) => hay.includes(term))) return false;
      }
      return true;
    });
  }, [meal, q, filters, prefs.vega, favs]);

  const toBuy = shopping.filter((i) => !i.done).length;

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="page-title">Recepten</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="iconbtn bell" style={{ width: 42, height: 42, background: 'var(--surface)' }} onClick={() => open({ type: 'shopping' })} aria-label={`Boodschappenlijst${toBuy ? `, ${toBuy} producten` : ''}`}>
            <I.cart />
            {toBuy > 0 && <span className="badge num">{toBuy}</span>}
          </button>
          <AvatarButton />
        </div>
      </header>

      {t && <ForYou date={today} />}
      {t && <DayMenuCard />}

      <div className="section-title" style={{ marginTop: 4 }}>
        <h2>Alle recepten</h2>
        <span className="small muted num">{list.length} {list.length === 1 ? 'recept' : 'recepten'}</span>
      </div>

      <div className="search">
        <I.search />
        <input className="input" placeholder="Zoek op gerecht of ingrediënt" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek recepten" />
      </div>

      <div className="seg seg-wide" role="tablist" aria-label="Maaltijd">
        {(['alles', ...MEALS] as const).map((m) => (
          <button key={m} role="tab" aria-selected={meal === m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>
            {m === 'alles' ? 'Alles' : MEAL_META[m].label}
          </button>
        ))}
      </div>

      <div className="chips scroll">
        <button className={'chip' + (prefs.vega ? ' on' : '')} onClick={() => { useStore.getState().setRecipePrefs({ vega: !prefs.vega }); toast(prefs.vega ? 'Alle recepten weer zichtbaar' : 'Alleen vegetarisch, ook in je suggesties'); }}>🌱 Vega</button>
        {FILTERS.map((f) => (
          <button key={f} className={'chip' + (filters.includes(f) ? ' on' : '')} onClick={() => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))}>
            {f === 'fav' ? '♥ Favorieten' : TAG_LABEL[f]}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty card">
          <div className="em">🍳</div>
          <b>Geen recepten gevonden</b>
          <div className="small">{filters.includes('fav') && !favs.length ? 'Tik op het hartje bij een recept om het te bewaren.' : 'Probeer een ander filter of zoekwoord.'}</div>
        </div>
      ) : (
        <div className="recipe-grid">
          {list.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}
    </div>
  );
}

/** Een kaart in het overzicht, met de portie die bij jou past. */
export function RecipeCard({ recipe, meal }: { recipe: Recipe; meal?: MealKey }) {
  const t = useTargets();
  const fav = useStore((s) => s.favRecipes.includes(recipe.id));
  const cooked = useStore((s) => s.cooked[recipe.id] ?? 0);
  const open = useUI((s) => s.open);
  const factor = t ? portionFor(recipe, mealTarget(recipe.meal, t.kcal)) : 1;
  const n = scaleN(recipeNutrients(recipe), factor);
  return (
    <article className="rcard">
      <button className="rcard-main" onClick={() => open({ type: 'recipe', id: recipe.id, meal })} aria-label={`${recipe.name} bekijken`}>
        <div className="rcard-photo">
          <FoodArt recipe={recipe} />
          <span className="rcard-time"><span className="i"><I.clock /></span>{recipe.minutes} min</span>
        </div>
        <div className="rcard-body">
          <div className="rcard-name">{recipe.name}</div>
          <div className="rcard-meta num">{fmt(n.kcal)} kcal · {fmt(n.p)} g eiwit</div>
          {factor !== 1 && <div className="rcard-portion">Jouw portie: {portionText(factor)}</div>}
          {cooked > 0 && factor === 1 && <div className="rcard-portion">{cooked}× gemaakt</div>}
        </div>
      </button>
      <button className={'rcard-fav' + (fav ? ' on' : '')} onClick={() => { useStore.getState().toggleFavRecipe(recipe.id); toast(fav ? 'Uit je favorieten' : 'Bewaard bij je favorieten'); }} aria-label={fav ? 'Uit favorieten' : 'Bewaar als favoriet'} aria-pressed={fav}>
        <I.heart filled={fav} />
      </button>
    </article>
  );
}

/** "Voor jou, nu": voorstellen op basis van wat je vandaag nog over hebt. */
function ForYou({ date }: { date: string }) {
  const now = mealForNow();
  const [meal, setMeal] = useState<MealKey>(now);
  const room = useMealRoom(meal, date);
  const t = useTargets()!;
  const prefs = useStore((s) => s.recipePrefs);
  const favorites = useStore((s) => s.favRecipes);
  const days = useStore((s) => s.days);
  const day = days[date];
  const open = useUI((s) => s.open);
  const eaten = day ? dayTotals(day).eaten : null;
  const already = day ? day.meals[meal].length > 0 : false;
  const recent = useMemo(() => recentlyEaten(days, date), [days, date]);
  const picks = useMemo(() => (room ? suggest(meal, room, { prefs, favorites, recent, seed: date }).slice(0, 4) : []), [meal, room, prefs, favorites, recent, date]);
  if (!room) return null;

  const left = eaten ? Math.max(0, t.kcal - eaten.kcal) : t.kcal;
  const pLeft = eaten ? Math.max(0, t.p - eaten.p) : t.p;
  const name = useStore.getState().profile?.name;
  const intro = already
    ? `Je hebt ${MEAL_MOMENT[meal]} al ingevuld. Toch nog iets? Deze passen nog in je dag.`
    : eaten && eaten.kcal > 0
      ? `Je hebt vandaag nog ${fmt(left)} kcal en ${fmt(pLeft)} g eiwit over. Voor ${MEAL_MOMENT[meal]} houd ik ongeveer ${fmt(Math.round(room.kcal / 10) * 10)} kcal aan.`
      : `Voor ${MEAL_MOMENT[meal]} past ongeveer ${fmt(Math.round(room.kcal / 10) * 10)} kcal bij jouw doel${name ? `, ${name}` : ''}. Ik heb de porties al voor je uitgerekend.`;

  return (
    <section className="foryou" aria-label="Voorstellen voor jou">
      <div className="foryou-head">
        <span className="foryou-badge"><I.sparkle /></span>
        <div className="grow">
          <div className="foryou-eyebrow">Je coach raadt aan</div>
          <h2>{meal === now ? 'Wat ga je nu eten?' : `Idee voor ${MEAL_META[meal].label.toLowerCase()}`}</h2>
        </div>
      </div>
      <p className="foryou-text">{intro}</p>
      <div className="chips scroll" style={{ marginBottom: 2 }}>
        {MEALS.map((m) => (
          <button key={m} className={'chip sm' + (m === meal ? ' on' : '')} onClick={() => setMeal(m)}>{MEAL_META[m].label}</button>
        ))}
      </div>
      <div className="foryou-row">
        {picks.map((s) => (
          <button key={s.recipe.id} className="pick" onClick={() => open({ type: 'recipe', id: s.recipe.id, meal })}>
            <div className="pick-photo"><FoodArt recipe={s.recipe} /></div>
            <div className="pick-body">
              <b>{s.recipe.name}</b>
              <div className="pick-meta num">{fmt(s.n.kcal)} kcal · {fmt(s.n.p)} g eiwit · {s.recipe.minutes} min</div>
              <div className="pick-why"><span className="i"><I.check /></span>{s.why}</div>
              {s.factor !== 1 && <div className="pick-portion">Jouw portie: {portionText(s.factor)}</div>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Een compleet dagmenu dat je doelen haalt. */
function DayMenuCard() {
  const t = useTargets()!;
  const prefs = useStore((s) => s.recipePrefs);
  const favorites = useStore((s) => s.favRecipes);
  const [n, setN] = useState(0);
  const open = useUI((s) => s.open);
  const menu = useMemo(() => dayMenu(t, prefs, `${dateKey()}#${n}`, favorites), [t, prefs, n, favorites]);
  if (!menu) return null;
  const kcalPct = Math.round((menu.total.kcal / t.kcal) * 100);
  const pOk = menu.total.p >= t.p * 0.9;

  return (
    <section className="card daymenu" aria-label="Jouw dagmenu">
      <div className="row between">
        <div>
          <div className="label-cap" style={{ color: 'var(--brand)' }}>Jouw dagmenu</div>
          <h3 style={{ fontSize: 19, marginTop: 2 }}>Een hele dag, precies op maat</h3>
        </div>
        <button className="iconbtn" onClick={() => setN(n + 1)} aria-label="Ander dagmenu"><I.shuffle /></button>
      </div>
      <div className="list" style={{ marginTop: 6 }}>
        {MEALS.map((m) => {
          const s = menu.items[m];
          return (
            <button key={m} className="item menu-item" onClick={() => open({ type: 'recipe', id: s.recipe.id, meal: m })}>
              <div className="menu-thumb"><FoodArt recipe={s.recipe} /></div>
              <div className="grow">
                <div className="s">{MEAL_META[m].label}{s.factor !== 1 ? ` · ${portionText(s.factor)}` : ''}</div>
                <div className="t ellipsis">{s.recipe.name}</div>
              </div>
              <b className="num small">{fmt(s.n.kcal)}</b>
            </button>
          );
        })}
      </div>
      <div className="menu-total">
        <div><b className="num">{fmt(menu.total.kcal)}</b> <span className="muted small">/ {fmt(t.kcal)} kcal ({kcalPct}%)</span></div>
        <div className={pOk ? 'good' : ''}><b className="num">{fmt(menu.total.p)} g</b> <span className="muted small">eiwit {pOk ? '✓' : `/ ${fmt(t.p)} g`}</span></div>
      </div>
      <button
        className="btn sm ghost block"
        onClick={() => {
          const s = useStore.getState();
          for (const m of MEALS) s.addToShopping(menu.items[m].recipe, menu.items[m].factor);
          toast('Dagmenu op je boodschappenlijst gezet 🛒');
        }}
      >
        <span className="i18"><I.cart /></span> Zet alles op mijn boodschappenlijst
      </button>
    </section>
  );
}
