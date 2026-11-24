import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_EMOJI, CATEGORY_LABEL, FOODS, searchFoods, type Food, type FoodCategory } from '../data/foods';
import { fmt } from '../lib/date';
import { lookupBarcode, searchOff } from '../lib/openfoodfacts';
import { RECIPE_FOODS } from '../lib/recipes';
import { newId, useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { MEALS, type FoodEntry, type MealKey } from '../lib/types';
import { MEAL_META } from '../screens/Today';
import { I, NumField, Sheet, toast } from './ui';

type View = { kind: 'search' } | { kind: 'detail'; food: Food } | { kind: 'quick' } | { kind: 'custom' } | { kind: 'scan' };

export function AddFoodSheet({ meal: initialMeal }: { meal: MealKey }) {
  const close = useUI((s) => s.close);
  const [meal, setMeal] = useState<MealKey>(initialMeal);
  const [view, setView] = useState<View>({ kind: 'search' });

  const title =
    view.kind === 'detail' ? 'Hoeveel?' : view.kind === 'quick' ? 'Snel toevoegen' : view.kind === 'custom' ? 'Nieuw product' : view.kind === 'scan' ? 'Barcode scannen' : 'Eten toevoegen';
  const back = view.kind !== 'search' ? (
    <button className="iconbtn" onClick={() => setView({ kind: 'search' })} aria-label="Terug"><I.left /></button>
  ) : null;

  return (
    <Sheet onClose={close} full title={<span className="row" style={{ gap: 10 }}>{back}{title}</span>}>
      <div className="chips scroll" style={{ marginBottom: 14 }}>
        {MEALS.map((m) => (
          <button key={m} className={'chip' + (m === meal ? ' on' : '')} onClick={() => setMeal(m)}>{MEAL_META[m].label}</button>
        ))}
      </div>
      {view.kind === 'search' && <SearchView meal={meal} onPick={(food) => setView({ kind: 'detail', food })} onView={setView} />}
      {view.kind === 'detail' && <FoodDetail food={view.food} meal={meal} onDone={close} />}
      {view.kind === 'quick' && <QuickAdd meal={meal} onDone={close} />}
      {view.kind === 'custom' && <CustomFood onSaved={(food) => setView({ kind: 'detail', food })} />}
      {view.kind === 'scan' && <Scanner onFound={(food) => setView({ kind: 'detail', food })} />}
    </Sheet>
  );
}

function SearchView({ meal, onPick, onView }: { meal: MealKey; onPick: (f: Food) => void; onView: (v: View) => void }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'recent' | 'fav' | 'cat'>('recent');
  const [cat, setCat] = useState<FoodCategory | null>(null);
  const [online, setOnline] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; items: Food[] }>({ state: 'idle', items: [] });
  const recent = useStore((s) => s.recent);
  const favIds = useStore((s) => s.favorites);
  const custom = useStore((s) => s.customFoods);
  const premium = useStore((s) => s.premium);
  const open = useUI((s) => s.open);
  const all = useMemo(() => [...custom, ...RECIPE_FOODS, ...FOODS], [custom]);
  const local = useMemo(() => searchFoods(q, all), [q, all]);
  const favs = useMemo(() => {
    const byId = new Map([...all, ...recent].map((f) => [f.id, f]));
    return favIds.map((id) => byId.get(id)).filter((f): f is Food => !!f);
  }, [favIds, all, recent]);

  useEffect(() => {
    if (q.trim().length < 3) {
      setOnline({ state: 'idle', items: [] });
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setOnline((o) => ({ ...o, state: 'loading' }));
      searchOff(q, ctrl.signal)
        .then((items) => setOnline({ state: 'done', items }))
        .catch(() => !ctrl.signal.aborted && setOnline({ state: 'error', items: [] }));
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const list = q ? local : tab === 'recent' ? recent : tab === 'fav' ? favs : cat ? all.filter((f) => f.cat === cat) : [];

  return (
    <div className="stack">
      <div className="search">
        <I.search />
        <input id="food-search" className="input" placeholder={`Zoek voor ${MEAL_META[meal].label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <button className="btn ghost sm" onClick={() => (premium ? onView({ kind: 'scan' }) : open({ type: 'premium', reason: 'De barcodescanner zit in Puls Premium.' }))}>
          <span style={{ width: 18, height: 18, display: 'inline-flex' }}><I.barcode /></span>Scan
        </button>
        <button className="btn ghost sm" onClick={() => onView({ kind: 'quick' })}><span style={{ width: 18, height: 18, display: 'inline-flex' }}><I.bolt /></span>Snel</button>
        <button className="btn ghost sm" onClick={() => onView({ kind: 'custom' })}><span style={{ width: 18, height: 18, display: 'inline-flex' }}><I.pencil /></span>Eigen</button>
      </div>

      {!q && (
        <div className="seg" role="tablist">
          <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recent</button>
          <button className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>Favorieten</button>
          <button className={tab === 'cat' ? 'on' : ''} onClick={() => { setTab('cat'); setCat(null); }}>Categorieën</button>
        </div>
      )}

      {!q && tab === 'cat' && !cat && (
        <div className="grid2" style={{ gap: 8 }}>
          {(Object.keys(CATEGORY_LABEL) as Food['cat'][])
            .filter((c) => c !== 'online' && c !== 'eigen')
            .map((c) => (
              <button key={c} className="card flat row" style={{ padding: 12, borderRadius: 16 }} onClick={() => setCat(c as FoodCategory)}>
                <span style={{ fontSize: 22 }}>{CATEGORY_EMOJI[c]}</span>
                <span className="small" style={{ fontWeight: 600, textAlign: 'left' }}>{CATEGORY_LABEL[c]}</span>
              </button>
            ))}
        </div>
      )}
      {!q && tab === 'cat' && cat && (
        <button className="tag" style={{ alignSelf: 'flex-start' }} onClick={() => setCat(null)}>← {CATEGORY_LABEL[cat]}</button>
      )}

      {list.length > 0 && (
        <div className="card" style={{ padding: '4px 14px' }}>
          <FoodList foods={list} onPick={onPick} />
        </div>
      )}

      {!q && list.length === 0 && tab !== 'cat' && (
        <div className="empty">
          <div className="em">{tab === 'fav' ? '💚' : '🥗'}</div>
          <p>{tab === 'fav' ? 'Tik op het hartje bij een product om het hier te bewaren.' : 'Zoek in meer dan 200 basisproducten en miljoenen merkproducten.'}</p>
          <div className="chips" style={{ justifyContent: 'center' }}>
            {['Havermout', 'Banaan', 'Kipfilet', 'Skyr', 'Pindakaas'].map((s) => (
              <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {q && (
        <>
          {local.length === 0 && online.state !== 'loading' && online.items.length === 0 && (
            <div className="empty">
              <p>Niets gevonden voor “{q}” in de basisdatabase.</p>
              <button className="btn sm" onClick={() => onView({ kind: 'custom' })}>Maak “{q}” zelf aan</button>
            </div>
          )}
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2 style={{ fontSize: 16 }}>Merkproducten</h2>
            <span className="tiny">Open Food Facts</span>
          </div>
          {online.state === 'loading' && <div className="small muted">Zoeken in de online database…</div>}
          {online.state === 'idle' && <div className="small muted">Typ minstens 3 letters om ook online te zoeken.</div>}
          {online.state === 'error' && <div className="small muted">Online zoeken lukt nu niet. Controleer je verbinding; de basisdatabase werkt gewoon offline.</div>}
          {online.state === 'done' && online.items.length === 0 && <div className="small muted">Geen merkproducten gevonden.</div>}
          {online.items.length > 0 && (
            <div className="card" style={{ padding: '4px 14px' }}>
              <FoodList foods={online.items} onPick={onPick} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div className="list">
      {foods.map((f) => {
        const p = f.portions[0];
        return (
          <button key={f.id} className="item" onClick={() => onPick(f)}>
            <div className="ico">{CATEGORY_EMOJI[f.cat]}</div>
            <div className="grow">
              <div className="t ellipsis">{f.name}</div>
              <div className="s ellipsis num">
                {f.brand ? `${f.brand} · ` : ''}
                {p ? `1 ${p.label} (${p.g} ${f.unit}) · ${fmt((f.kcal * p.g) / 100)} kcal` : `100 ${f.unit} · ${fmt(f.kcal)} kcal`}
              </div>
            </div>
            <span className="addbtn" style={{ width: 34, height: 34 }}><I.plus /></span>
          </button>
        );
      })}
    </div>
  );
}

/** Portion picker shared by "add" and "edit". */
function usePortion(food: Food, initialGrams?: number) {
  const units = [...food.portions, { label: food.unit === 'ml' ? 'ml' : 'gram', g: 1 }];
  const init = (() => {
    if (initialGrams === undefined) return { unit: 0, amount: food.portions.length ? 1 : 100 };
    const i = food.portions.findIndex((p) => Math.abs(initialGrams / p.g - Math.round((initialGrams / p.g) * 2) / 2) < 0.01);
    return i >= 0 ? { unit: i, amount: initialGrams / food.portions[i].g } : { unit: units.length - 1, amount: initialGrams };
  })();
  const [unit, setUnit] = useState(init.unit);
  const [amount, setAmount] = useState(init.amount);
  const u = units[unit];
  const grams = Math.round(amount * u.g * 10) / 10;
  const isRaw = u.g === 1;
  const label = isRaw ? `${fmt(grams)} ${food.unit}` : `${fmt(amount, 2)} × ${u.label} (${fmt(grams)} ${food.unit})`;
  return { units, unit, setUnit: (i: number) => { setUnit(i); setAmount(units[i].g === 1 ? Math.round(grams) || 100 : 1); }, amount, setAmount, grams, label, isRaw };
}

function PortionEditor({ food, ps }: { food: Food; ps: ReturnType<typeof usePortion> }) {
  const k = ps.grams / 100;
  const step = ps.isRaw ? (food.unit === 'ml' ? 50 : 10) : 0.5;
  return (
    <div className="stack">
      <div className="chips">
        {ps.units.map((u, i) => (
          <button key={u.label} className={'chip' + (i === ps.unit ? ' on' : '')} onClick={() => ps.setUnit(i)}>
            {u.g === 1 ? u.label : `${u.label} · ${u.g}${food.unit}`}
          </button>
        ))}
      </div>
      <div className="stepper">
        <button onClick={() => ps.setAmount(Math.max(step, Math.round((ps.amount - step) * 100) / 100))} aria-label="Minder">−</button>
        <NumField id="portion-amount" className="input num" value={ps.amount} onValue={ps.setAmount} />
        <button onClick={() => ps.setAmount(Math.round((ps.amount + step) * 100) / 100)} aria-label="Meer">+</button>
      </div>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
        <div><div className="kpi num">{fmt(food.kcal * k)}</div><div className="tiny">kcal</div></div>
        <div><div className="kpi num" style={{ color: 'var(--carb)', fontSize: 18 }}>{fmt(food.c * k, 1)}</div><div className="tiny">koolh. g</div></div>
        <div><div className="kpi num" style={{ color: 'var(--protein)', fontSize: 18 }}>{fmt(food.p * k, 1)}</div><div className="tiny">eiwit g</div></div>
        <div><div className="kpi num" style={{ color: 'var(--fat)', fontSize: 18 }}>{fmt(food.f * k, 1)}</div><div className="tiny">vet g</div></div>
      </div>
      <div className="tiny num">Per 100 {food.unit}: {fmt(food.kcal)} kcal · K {fmt(food.c, 1)} · E {fmt(food.p, 1)} · V {fmt(food.f, 1)}</div>
    </div>
  );
}

function FoodDetail({ food, meal, onDone }: { food: Food; meal: MealKey; onDone: () => void }) {
  const date = useUI((s) => s.date);
  const { addFood, toggleFavorite } = useStore.getState();
  const fav = useStore((s) => s.favorites.includes(food.id));
  const ps = usePortion(food);
  return (
    <div className="stack">
      <div className="row">
        <div className="grow">
          <h2 style={{ fontSize: 24 }}>{food.name}</h2>
          <div className="small muted">{food.brand ?? CATEGORY_LABEL[food.cat]}</div>
        </div>
        <button className="iconbtn" style={{ color: fav ? 'var(--protein)' : undefined }} onClick={() => toggleFavorite(food.id)} aria-label={fav ? 'Uit favorieten' : 'Aan favorieten toevoegen'}>
          <I.heart filled={fav} />
        </button>
      </div>
      <PortionEditor food={food} ps={ps} />
      <button
        className="btn block" disabled={ps.grams <= 0}
        onClick={() => { addFood(date, meal, food, ps.grams, ps.label); toast(`${food.name} toegevoegd aan ${MEAL_META[meal].label.toLowerCase()}`); onDone(); }}
      >
        Toevoegen aan {MEAL_META[meal].label.toLowerCase()}
      </button>
    </div>
  );
}

export function EditEntrySheet({ meal, entryId }: { meal: MealKey; entryId: string }) {
  const { date, close } = useUI();
  const entry = useStore((s) => s.days[date]?.meals[meal].find((e) => e.id === entryId));
  if (!entry) return null;
  return <EditEntryInner meal={meal} date={date} entry={entry} close={close} />;
}

function EditEntryInner({ meal, date, entry, close }: { meal: MealKey; date: string; entry: FoodEntry; close: () => void }) {
  const ps = usePortion(entry.food, entry.grams);
  const { updateEntry, removeEntry } = useStore.getState();
  return (
    <Sheet onClose={close} title={entry.food.name}>
      <div className="stack">
        <div className="small muted">{MEAL_META[meal].label}{entry.food.brand ? ` · ${entry.food.brand}` : ''}</div>
        <PortionEditor food={entry.food} ps={ps} />
        <div className="row">
          <button className="btn danger" onClick={() => { removeEntry(date, meal, entry.id); toast('Verwijderd'); close(); }} aria-label="Verwijderen"><I.trash /></button>
          <button className="btn grow" onClick={() => { updateEntry(date, meal, entry.id, ps.grams, ps.label); toast('Opgeslagen'); close(); }}>Opslaan</button>
        </div>
      </div>
    </Sheet>
  );
}

const numIn = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function QuickAdd({ meal, onDone }: { meal: MealKey; onDone: () => void }) {
  const date = useUI((s) => s.date);
  const [name, setName] = useState('');
  const [v, setV] = useState({ kcal: '', p: '', c: '', f: '' });
  const kcal = numIn(v.kcal) || numIn(v.p) * 4 + numIn(v.c) * 4 + numIn(v.f) * 9;
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>Weet je alleen de calorieën, bijvoorbeeld van een restaurant of een etiket? Vul ze hier direct in.</p>
      <div className="field"><label htmlFor="qa-name">Omschrijving (optioneel)</label><input id="qa-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. lunch op werk" /></div>
      <div className="field"><label htmlFor="qa-kcal">Calorieën (kcal)</label><input id="qa-kcal" className="input num" inputMode="decimal" value={v.kcal} onChange={(e) => setV({ ...v, kcal: e.target.value })} placeholder={kcal ? fmt(kcal) : '0'} /></div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {(['c', 'p', 'f'] as const).map((k) => (
          <div key={k} className="field">
            <label htmlFor={`qa-${k}`}>{k === 'c' ? 'Koolh. (g)' : k === 'p' ? 'Eiwit (g)' : 'Vet (g)'}</label>
            <input id={`qa-${k}`} className="input num" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder="0" />
          </div>
        ))}
      </div>
      <button
        className="btn block" disabled={kcal <= 0}
        onClick={() => {
          const food: Food = { id: 'quick-' + newId(), name: name.trim() || 'Snel toegevoegd', cat: 'eigen', kcal: Math.round(kcal), p: numIn(v.p), c: numIn(v.c), f: numIn(v.f), unit: 'g', portions: [{ label: 'portie', g: 100 }], source: 'custom' };
          useStore.getState().addFood(date, meal, food, 100, '1 portie');
          toast(`${fmt(kcal)} kcal toegevoegd`);
          onDone();
        }}
      >
        Toevoegen
      </button>
    </div>
  );
}

function CustomFood({ onSaved }: { onSaved: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [portion, setPortion] = useState('');
  const [v, setV] = useState({ kcal: '', p: '', c: '', f: '' });
  const ok = name.trim() && numIn(v.kcal) > 0;
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>Neem de waarden per 100 gram over van het etiket. Daarna staat het product altijd in je zoekresultaten.</p>
      <div className="field"><label htmlFor="cf-name">Productnaam</label><input id="cf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. eiwitpannenkoek" /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="cf-brand">Merk (optioneel)</label><input id="cf-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
        <div className="field"><label htmlFor="cf-portion">Portie in gram</label><input id="cf-portion" className="input num" inputMode="decimal" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="bijv. 30" /></div>
      </div>
      <div className="grid2">
        {(['kcal', 'c', 'p', 'f'] as const).map((k) => (
          <div key={k} className="field">
            <label htmlFor={`cf-${k}`}>{k === 'kcal' ? 'kcal per 100 g' : k === 'c' ? 'Koolhydraten' : k === 'p' ? 'Eiwit' : 'Vet'}{k === 'kcal' ? '' : ' (g)'}</label>
            <input id={`cf-${k}`} className="input num" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder="0" />
          </div>
        ))}
      </div>
      <button
        className="btn block" disabled={!ok}
        onClick={() => {
          const g = numIn(portion);
          const food: Food = { id: 'custom-' + newId(), name: name.trim(), brand: brand.trim() || undefined, cat: 'eigen', kcal: Math.round(numIn(v.kcal)), p: numIn(v.p), c: numIn(v.c), f: numIn(v.f), unit: 'g', portions: g > 0 ? [{ label: 'portie', g }] : [], source: 'custom' };
          useStore.getState().addCustomFood(food);
          toast('Product opgeslagen');
          onSaved(food);
        }}
      >
        Opslaan en kiezen
      </button>
    </div>
  );
}

interface BarcodeDetectorLike { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

function Scanner({ onFound }: { onFound: (f: Food) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string>('Camera starten…');
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const lookup = async (c: string) => {
    setBusy(true);
    setStatus(`Product ${c} opzoeken…`);
    try {
      const food = await lookupBarcode(c);
      if (food) onFound(food);
      else setStatus('Dit product staat nog niet in de database. Maak het zelf aan via “Eigen”.');
    } catch {
      setStatus('Opzoeken lukt nu niet. Controleer je internetverbinding.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!supported) {
      setStatus('Je browser ondersteunt scannen met de camera niet. Typ de cijfers onder de barcode hieronder in.');
      return;
    }
    let stream: MediaStream | undefined;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setStatus('Richt de camera op de barcode');
        const Detector = (window as unknown as { BarcodeDetector: new (o: object) => BarcodeDetectorLike }).BarcodeDetector;
        const det = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        while (!stop) {
          const res = await det.detect(v).catch(() => []);
          if (res[0]?.rawValue) {
            stop = true;
            lookup(res[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setStatus('Geen toegang tot de camera. Typ de barcode hieronder in.');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stack">
      {supported && (
        <div className="video-box">
          <video ref={videoRef} playsInline muted />
          <div className="frame" />
        </div>
      )}
      <div className="small muted">{status}</div>
      <div className="row">
        <input id="barcode" className="input num grow" inputMode="numeric" placeholder="Bijv. 8710400035508" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <button className="btn sm" disabled={code.length < 8 || busy} onClick={() => lookup(code)}>Zoek</button>
      </div>
    </div>
  );
}
