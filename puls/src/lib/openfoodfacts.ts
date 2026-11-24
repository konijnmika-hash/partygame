// Open Food Facts: open database met miljoenen (ook Nederlandse) supermarktproducten.
// https://openfoodfacts.github.io/openfoodfacts-server/api/
import type { Food, Portion } from '../data/foods';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_nl?: string;
  brands?: string | string[];
  serving_quantity?: number | string;
  serving_size?: string;
  quantity?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const FIELDS = 'code,product_name,product_name_nl,brands,nutriments,serving_quantity,serving_size,quantity';

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function fromOff(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(n['energy_100g']) ?? num(n['energy-kj_100g']);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  const name = (p.product_name_nl || p.product_name || '').trim();
  if (!name || kcal === undefined) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0]?.trim();
  const isLiquid = /\bml\b|\bcl\b|\bl\b/i.test(p.quantity ?? '') || /\bml\b/i.test(p.serving_size ?? '');
  const portions: Portion[] = [];
  const serving = num(p.serving_quantity);
  if (serving && serving > 0 && serving < 2000) {
    portions.push({ label: p.serving_size ? `portie (${p.serving_size})` : 'portie', g: Math.round(serving) });
  }
  const pkg = p.quantity?.match(/^\s*(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);
  if (pkg) {
    const g = num(pkg[1]);
    if (g && g < 3000 && g !== serving) portions.push({ label: `verpakking (${p.quantity})`, g: Math.round(g) });
  }
  return {
    id: 'off-' + (p.code ?? name),
    name,
    brand: brand || undefined,
    cat: 'online',
    kcal: Math.round(kcal),
    p: r1(num(n['proteins_100g']) ?? 0),
    c: r1(num(n['carbohydrates_100g']) ?? 0),
    f: r1(num(n['fat_100g']) ?? 0),
    unit: isLiquid ? 'ml' : 'g',
    portions,
    source: 'off',
  };
}

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Zoekt producten op naam. Probeert eerst de snelle zoekdienst, daarna de klassieke API. */
export async function searchOff(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = encodeURIComponent(query.trim());
  let products: OffProduct[] = [];
  try {
    const data = await getJson(
      `https://search.openfoodfacts.org/search?q=${q}&langs=nl,en&page_size=25&fields=${FIELDS}`,
      signal,
    );
    products = data.hits ?? data.products ?? [];
  } catch (e) {
    if (signal?.aborted) throw e;
    const data = await getJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`,
      signal,
    );
    products = data.products ?? [];
  }
  const seen = new Set<string>();
  return products
    .map(fromOff)
    .filter((f): f is Food => !!f && !seen.has(f.id) && !!seen.add(f.id));
}

/** Zoekt een product op barcode (EAN). */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  const data = await getJson(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
    signal,
  );
  if (data.status !== 1 && !data.product) return null;
  return fromOff({ code, ...data.product });
}
