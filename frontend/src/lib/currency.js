export const CUR_SYM = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥', AED: 'د.إ ', SGD: 'S$', AUD: 'A$', CAD: 'C$', CHF: 'CHF ', Unknown: '' };

const CUR_TOKENS = [
  ['USD', ['usd', 'us$', 'dollar', '$']], ['EUR', ['euro', 'eur', '€']], ['GBP', ['gbp', 'pound', '£']],
  ['INR', ['inr', 'rupee', 'rs.', 'rs ', '₹']], ['AED', ['aed', 'dirham']], ['SGD', ['sgd']],
  ['JPY', ['jpy', 'yen', '¥']], ['CNY', ['cny', 'rmb', 'yuan']], ['AUD', ['aud']], ['CAD', ['cad']], ['CHF', ['chf']]
];

export function normCur(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (!t) return null;
  for (const [code, toks] of CUR_TOKENS) for (const tok of toks) if (t.includes(tok)) return code;
  if (/^[a-z]{3}$/.test(t)) return t.toUpperCase();
  return null;
}

export function detectCur(curCol, amtStr) {
  let c = normCur(curCol);
  if (c) return { cur: c, auto: false };
  c = normCur(amtStr);
  if (c) return { cur: c, auto: true };
  if (amtStr && /\d/.test(String(amtStr))) return { cur: 'INR', auto: false, guess: true };
  return { cur: 'Unknown', auto: false, guess: true };
}

export function parseAmtStr(s) {
  if (s == null) return {};
  const t = String(s).trim();
  if (['', 'na', 'n/a', '-', 'nan', 'tbd', '--'].includes(t.toLowerCase())) return {};
  const m = t.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!m) return { note: t.slice(0, 80) };
  const amt = Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) / 100;
  const clean = t.replace(/[\d,.\s₹$€£¥]+/g, '').toLowerCase();
  const note = clean && !['inr', 'usd', 'rs', 'eur', 'euro', 'gbp', 'usd|pc'].includes(clean) ? t.slice(0, 80) : undefined;
  return note === undefined ? { amt } : { amt, note };
}

const cSym = c => CUR_SYM[c] != null ? CUR_SYM[c] : c + ' ';

export function fmtMoney(cur, n) {
  const loc = cur === 'INR' ? 'en-IN' : 'en-US';
  return cSym(cur) + Number(n).toLocaleString(loc, { maximumFractionDigits: 2 });
}

export function fmtCompact(cur, n) {
  if (cur === 'INR') {
    if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + 'L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  if (n >= 1e6) return cSym(cur) + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return cSym(cur) + (n / 1e3).toFixed(1) + 'K';
  return cSym(cur) + Math.round(n).toLocaleString('en-US');
}
