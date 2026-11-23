const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

/** 0 = maandag ... 6 = zondag */
export const weekday = (key: string) => (parseKey(key).getDay() + 6) % 7;

export const DAY_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const DAY_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];

export function dayTitle(key: string, today = dateKey()) {
  const d = parseKey(key);
  const dm = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '').toLowerCase();
  if (key === today) return `Vandaag, ${dm}`;
  if (key === addDays(today, -1)) return `Gisteren, ${dm}`;
  if (key === addDays(today, 1)) return `Morgen, ${dm}`;
  const name = DAY_LONG[weekday(key)];
  return `${name[0].toUpperCase()}${name.slice(1)}, ${dm}`;
}

export function greeting(h = new Date().getHours()) {
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('nl-NL', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const liters = (ml: number) => (ml / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
