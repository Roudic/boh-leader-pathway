const pad = (n) => String(n).padStart(2, '0');

export function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// Whole days from a to b (b - a). Both are YYYY-MM-DD.
export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export function addDays(iso, n) {
  const t = new Date(parse(iso) + n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
