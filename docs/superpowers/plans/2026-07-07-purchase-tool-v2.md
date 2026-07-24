# Oizom Purchase Tool v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Oizom procurement tracker as a Vite vanilla-JS SPA + Google Apps Script backend, with the Google Sheet as database, Google sign-in, server-enforced roles, reports, and courier tracking.

**Architecture:** Static frontend (GitHub Pages) calls one Apps Script web app (bound to the sheet, "execute as me") for all reads/writes. Frontend obtains a Google ID token via Google Identity Services and sends it in every POST body; the backend verifies it against Google's tokeninfo endpoint, restricts to `@oizom.com`, maps email→role from a `Users` tab, and audit-logs every mutation to a `Log` tab.

**Tech Stack:** Vite (vanilla template), Vitest, Google Apps Script (V8), Google Identity Services (GIS), Google Sheets.

## Global Constraints

- Sheet ID: `1FDpQlPnxBcF-jt9bOFshmHeq8gmyJMlG2J0mhNFCEmg` (script is BOUND to it — never hardcode the ID in code; use `SpreadsheetApp.getActive()`)
- Allowed sign-in domain: `oizom.com`
- Roles (exact strings): `admin`, `approver`, `requester`, `viewer`
- Statuses (exact strings): `Submitted`, `Approved`, `Rejected`, `Ordered`, `In Transit`, `Received`, `Cancelled`, `On Hold`
- PR id format: `PR-YYYY-NNNN` (year + zero-padded 4-digit counter per year)
- `PRs` tab columns, exact order: `id, createdAt, department, requesterEmail, item, qty, vendor, amount, currency, priority, status, approverEmail, approvedAt, paymentStatus, courier, trackingNo, expectedDate, receivedAt, notes, updatedAt`
- All fetches to Apps Script: POST, JSON string body, **no Content-Type header** (avoids CORS preflight — Apps Script cannot answer OPTIONS)
- All commits: plain messages, **no Co-Authored-By trailer** (user requirement)
- Frontend files live in `frontend/`, backend in `apps-script/`. Node ≥ 20.
- `.gs` files must pass `node --check` (V8 runtime is plain JS)

---

### Task 1: Frontend scaffold + design-system CSS

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/styles.css`, `frontend/src/config.js`, `.gitignore`

**Interfaces:**
- Produces: `CFG` object `{APP_URL, CLIENT_ID}` from `frontend/src/config.js`; CSS custom properties (`--bg`, `--brand`, `--line`, …) and classes `.chip`, `.btn`, `.card`, `.tbl` used by all views.

- [ ] **Step 1: Create package.json and vite config**

`frontend/package.json`:
```json
{
  "name": "oizom-purchase-tool",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist' }
});
```

`.gitignore` (repo root):
```
node_modules/
frontend/dist/
.clasp.json
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create index.html shell**

`frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OIZOM Procurement Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Port design system CSS from prototype**

Copy the `:root` variables from `index.html.bak` (lines ~10-17) and add app layout. `frontend/src/styles.css`:
```css
:root{
  --bg:#F4F7F5; --panel:#FFFFFF; --ink:#14241C; --mut:#5E7066; --line:#DEE7E1;
  --brand:#0E7B5B; --brand-soft:#E2F2EB; --dark:#0F1F18; --dark2:#16291F;
  --amber:#B25E09; --amber-soft:#FBEEDC; --red:#B3362B; --red-soft:#FAE6E3;
  --blue:#2A5FAA; --blue-soft:#E4ECF8; --grey-soft:#ECF0ED;
  --mono:'IBM Plex Mono',monospace; --disp:'Space Grotesk',sans-serif; --body:'Inter',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:14px}
a{color:var(--brand)}
.topbar{display:flex;align-items:center;gap:14px;padding:10px 18px;background:var(--dark);color:#fff;position:sticky;top:0;z-index:10}
.topbar .logo{font-family:var(--disp);font-weight:700;font-size:17px}
.topbar .logo b{color:#3ECF9A}
.topbar nav{display:flex;gap:4px;flex:1}
.topbar nav a{color:#cfe0d7;text-decoration:none;padding:6px 12px;border-radius:8px;font-size:13px}
.topbar nav a.active,.topbar nav a:hover{background:var(--dark2);color:#fff}
.userchip{font-size:12px;color:#cfe0d7}
.main{max-width:1200px;margin:0 auto;padding:20px 18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
.card h2{font-family:var(--disp);font-size:16px;margin-bottom:12px}
.btn{display:inline-block;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:9px;padding:8px 14px;font-size:13px;font-family:inherit;cursor:pointer;text-decoration:none}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}
.btn.danger{background:var(--red);border-color:var(--red);color:#fff}
.btn:disabled{opacity:.5;cursor:default}
.chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600}
.chip.Submitted{background:var(--blue-soft);color:var(--blue)}
.chip.Approved{background:var(--brand-soft);color:var(--brand)}
.chip.Rejected,.chip.Cancelled{background:var(--red-soft);color:var(--red)}
.chip.Ordered{background:var(--amber-soft);color:var(--amber)}
.chip.In.Transit,.chip[data-s="In Transit"]{background:var(--amber-soft);color:var(--amber)}
.chip.Received{background:var(--brand-soft);color:var(--brand)}
.chip[data-s="On Hold"]{background:var(--grey-soft);color:var(--mut)}
.sync-chip{font-size:11.5px;font-family:var(--mono);color:#9fc0b1}
.sync-chip.err{color:#ff9d92}
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
.tbl td{padding:9px 10px;border-bottom:1px solid var(--line);font-size:13px}
.tbl tr.rowlink{cursor:pointer}
.tbl tr.rowlink:hover{background:var(--brand-soft)}
.filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.filters select,.filters input,form.pr select,form.pr input,form.pr textarea{border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;color:var(--ink)}
form.pr{display:grid;grid-template-columns:1fr 1fr;gap:12px}
form.pr label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--mut);font-weight:500}
form.pr .full{grid-column:1/-1}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.kpi .v{font-family:var(--disp);font-size:22px;font-weight:700}
.kpi .l{font-size:11.5px;color:var(--mut)}
.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--dark);color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:99;display:flex;gap:12px;align-items:center}
.toast.err{background:var(--red)}
.auth-gate{position:fixed;inset:0;z-index:50;background:linear-gradient(160deg,#0F1F18,#16291F);display:flex;align-items:center;justify-content:center}
.auth-box{background:#fff;border-radius:16px;padding:30px 28px;width:min(380px,90%);text-align:center}
.auth-box h1{font-family:var(--disp);font-size:20px;margin-bottom:6px}
.auth-box h1 b{color:var(--brand)}
.auth-box p{font-size:12.5px;color:var(--mut);margin-bottom:18px}
.bar{display:flex;align-items:center;gap:8px;margin:4px 0}
.bar .fill{height:10px;background:var(--brand);border-radius:5px;min-width:2px}
.bar .lbl{font-size:12px;min-width:110px;color:var(--mut)}
.bar .val{font-family:var(--mono);font-size:12px}
@media print{.topbar,.filters,.btn,.auth-gate{display:none!important}body{background:#fff}.card{border:none;page-break-inside:avoid}}
```

- [ ] **Step 5: Create config module**

`frontend/src/config.js`:
```js
// Fill these two values during deployment (see SETUP.md).
export const CFG = {
  // Apps Script web app URL, ends with /exec
  APP_URL: '',
  // Google OAuth client ID from Google Cloud console, ends with .apps.googleusercontent.com
  CLIENT_ID: ''
};
```

- [ ] **Step 6: Verify dev server boots**

Run: `cd frontend && timeout 10 npx vite --port 5199 & sleep 3 && curl -s http://localhost:5199 | grep -c 'main.js'`
Expected: `1`

- [ ] **Step 7: Commit**

```bash
git add .gitignore frontend
git commit -m "feat: scaffold Vite frontend with ported design system"
```

---

### Task 2: Currency library (ported from prototype) — TDD

**Files:**
- Create: `frontend/src/lib/currency.js`
- Test: `frontend/tests/currency.test.js`

**Interfaces:**
- Produces: `normCur(s)→string|null`, `detectCur(curCol, amtStr)→{cur, auto, guess?}`, `parseAmtStr(s)→{amt?, note?}`, `fmtMoney(cur, n)→string`, `fmtCompact(cur, n)→string`, `CUR_SYM` object. Used by reports and all views.

- [ ] **Step 1: Write failing tests**

`frontend/tests/currency.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { normCur, detectCur, parseAmtStr, fmtMoney, fmtCompact } from '../src/lib/currency.js';

describe('normCur', () => {
  it('maps tokens to ISO codes', () => {
    expect(normCur('USD')).toBe('USD');
    expect(normCur('rupee')).toBe('INR');
    expect(normCur('₹')).toBe('INR');
    expect(normCur('€')).toBe('EUR');
    expect(normCur('')).toBe(null);
    expect(normCur(null)).toBe(null);
  });
  it('passes through unknown 3-letter codes uppercased', () => {
    expect(normCur('sek')).toBe('SEK');
  });
});

describe('detectCur', () => {
  it('prefers currency column', () => {
    expect(detectCur('USD', '₹500')).toEqual({ cur: 'USD', auto: false });
  });
  it('falls back to amount string', () => {
    expect(detectCur('', '$120')).toEqual({ cur: 'USD', auto: true });
  });
  it('guesses INR for bare numbers', () => {
    expect(detectCur('', '4500')).toEqual({ cur: 'INR', auto: false, guess: true });
  });
});

describe('parseAmtStr', () => {
  it('parses numbers with commas', () => {
    expect(parseAmtStr('1,23,456.78').amt).toBe(123456.78);
  });
  it('returns empty for NA-like values', () => {
    expect(parseAmtStr('N/A')).toEqual({});
    expect(parseAmtStr('tbd')).toEqual({});
    expect(parseAmtStr(null)).toEqual({});
  });
  it('keeps note when no number found', () => {
    expect(parseAmtStr('pending quote').note).toBe('pending quote');
  });
});

describe('formatting', () => {
  it('formats INR with Indian locale', () => {
    expect(fmtMoney('INR', 123456)).toBe('₹1,23,456');
  });
  it('compacts INR to lakh/crore', () => {
    expect(fmtCompact('INR', 250000)).toBe('₹2.5L');
    expect(fmtCompact('INR', 30000000)).toBe('₹3.00 Cr');
  });
  it('compacts USD to K/M', () => {
    expect(fmtCompact('USD', 1500)).toBe('$1.5K');
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npx vitest run tests/currency.test.js`
Expected: FAIL — cannot resolve `../src/lib/currency.js`.

- [ ] **Step 3: Port implementation from prototype (index.html.bak lines 568–602)**

`frontend/src/lib/currency.js`:
```js
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd frontend && npx vitest run tests/currency.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/currency.js frontend/tests/currency.test.js
git commit -m "feat: port currency detection and formatting library"
```

---

### Task 3: Status transition machine — TDD

**Files:**
- Create: `frontend/src/lib/status.js`
- Test: `frontend/tests/status.test.js`

**Interfaces:**
- Produces: `STATUSES` array; `canTransition(from, to, role, isOwn)→boolean`; `nextStates(from, role, isOwn)→string[]`. Backend `prs.gs` (Task 5) mirrors the same matrix — keep both in sync.

- [ ] **Step 1: Write failing tests**

`frontend/tests/status.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { canTransition, nextStates, STATUSES } from '../src/lib/status.js';

describe('canTransition', () => {
  it('approver approves/rejects submitted PRs', () => {
    expect(canTransition('Submitted', 'Approved', 'approver', false)).toBe(true);
    expect(canTransition('Submitted', 'Rejected', 'approver', false)).toBe(true);
  });
  it('requester cannot approve, even own PR', () => {
    expect(canTransition('Submitted', 'Approved', 'requester', true)).toBe(false);
  });
  it('requester can cancel own submitted PR only', () => {
    expect(canTransition('Submitted', 'Cancelled', 'requester', true)).toBe(true);
    expect(canTransition('Submitted', 'Cancelled', 'requester', false)).toBe(false);
  });
  it('requester can resubmit own rejected PR', () => {
    expect(canTransition('Rejected', 'Submitted', 'requester', true)).toBe(true);
  });
  it('admin can do everything approver can', () => {
    expect(canTransition('Approved', 'Ordered', 'admin', false)).toBe(true);
    expect(canTransition('Ordered', 'In Transit', 'admin', false)).toBe(true);
  });
  it('viewer can transition nothing', () => {
    for (const from of STATUSES) for (const to of STATUSES) {
      expect(canTransition(from, to, 'viewer', true)).toBe(false);
    }
  });
  it('terminal states have no exits except Rejected→Submitted', () => {
    expect(nextStates('Received', 'admin', false)).toEqual([]);
    expect(nextStates('Cancelled', 'admin', false)).toEqual([]);
  });
  it('no skipping: Submitted cannot jump to Received', () => {
    expect(canTransition('Submitted', 'Received', 'admin', false)).toBe(false);
  });
});

describe('nextStates', () => {
  it('lists approver options from Submitted', () => {
    expect(nextStates('Submitted', 'approver', false).sort())
      .toEqual(['Approved', 'Cancelled', 'On Hold', 'Rejected'].sort());
  });
  it('On Hold resumes to active states', () => {
    expect(nextStates('On Hold', 'admin', false).sort())
      .toEqual(['Approved', 'Cancelled', 'Ordered', 'Submitted'].sort());
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npx vitest run tests/status.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement the transition matrix**

`frontend/src/lib/status.js`:
```js
export const STATUSES = ['Submitted', 'Approved', 'Rejected', 'Ordered', 'In Transit', 'Received', 'Cancelled', 'On Hold'];

// role tokens: 'approver' and 'admin' are staff; 'requester:own' means
// role==='requester' AND the PR belongs to the caller.
const STAFF = ['approver', 'admin'];
const T = {
  'Submitted':  { 'Approved': STAFF, 'Rejected': STAFF, 'Cancelled': [...STAFF, 'requester:own'], 'On Hold': STAFF },
  'Approved':   { 'Ordered': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF },
  'Ordered':    { 'In Transit': STAFF, 'Received': STAFF, 'Cancelled': STAFF, 'On Hold': STAFF },
  'In Transit': { 'Received': STAFF, 'On Hold': STAFF },
  'On Hold':    { 'Submitted': STAFF, 'Approved': STAFF, 'Ordered': STAFF, 'Cancelled': STAFF },
  'Rejected':   { 'Submitted': [...STAFF, 'requester:own'] },
  'Received':   {},
  'Cancelled':  {}
};

export function canTransition(from, to, role, isOwn) {
  const allowed = (T[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(tok => tok === 'requester:own' ? (role === 'requester' && isOwn) : tok === role);
}

export function nextStates(from, role, isOwn) {
  return Object.keys(T[from] || {}).filter(to => canTransition(from, to, role, isOwn));
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd frontend && npx vitest run tests/status.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/status.js frontend/tests/status.test.js
git commit -m "feat: role-gated PR status transition machine"
```

---

### Task 4: Report aggregations + CSV — TDD

**Files:**
- Create: `frontend/src/lib/reports.js`
- Test: `frontend/tests/reports.test.js`

**Interfaces:**
- Consumes: PR objects with fields from the Global Constraints schema (`amount` numeric or '', `currency` ISO string, dates as `YYYY-MM-DD` or ISO strings).
- Produces: `spendBy(prs, keyFn)`, `spendByMonth(prs)`, `statusCounts(prs)`, `aging(prs, nowMs)`, `vendorPerformance(prs)`, `toCSV(rows, cols)`.

- [ ] **Step 1: Write failing tests**

`frontend/tests/reports.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { spendBy, spendByMonth, statusCounts, aging, vendorPerformance, toCSV } from '../src/lib/reports.js';

const PRS = [
  { id: 'PR-2026-0001', department: 'R&D', vendor: 'Mouser', amount: 100, currency: 'USD', status: 'Received', createdAt: '2026-05-02', approvedAt: '2026-05-03', receivedAt: '2026-05-10', expectedDate: '2026-05-08', updatedAt: '2026-05-10T10:00:00Z' },
  { id: 'PR-2026-0002', department: 'R&D', vendor: 'Robu', amount: 5000, currency: 'INR', status: 'Ordered', createdAt: '2026-06-01', approvedAt: '2026-06-02', receivedAt: '', expectedDate: '', updatedAt: '2026-06-02T10:00:00Z' },
  { id: 'PR-2026-0003', department: 'Production', vendor: 'Mouser', amount: 200, currency: 'USD', status: 'Received', createdAt: '2026-06-05', approvedAt: '2026-06-06', receivedAt: '2026-06-09', expectedDate: '2026-06-12', updatedAt: '2026-06-09T10:00:00Z' },
  { id: 'PR-2026-0004', department: 'Production', vendor: '', amount: '', currency: '', status: 'Submitted', createdAt: '2026-06-20', approvedAt: '', receivedAt: '', expectedDate: '', updatedAt: '2026-06-20T10:00:00Z' }
];

describe('spendBy', () => {
  it('groups amounts per key per currency, skips blank amounts', () => {
    const r = spendBy(PRS, p => p.department);
    expect(r['R&D']).toEqual({ USD: 100, INR: 5000 });
    expect(r['Production']).toEqual({ USD: 200 });
  });
});

describe('spendByMonth', () => {
  it('keys by YYYY-MM of createdAt', () => {
    const r = spendByMonth(PRS);
    expect(Object.keys(r).sort()).toEqual(['2026-05', '2026-06']);
    expect(r['2026-06']).toEqual({ INR: 5000, USD: 200 });
  });
});

describe('statusCounts', () => {
  it('counts each status', () => {
    expect(statusCounts(PRS)).toEqual({ Received: 2, Ordered: 1, Submitted: 1 });
  });
});

describe('aging', () => {
  it('returns active PRs with days in current status, oldest first', () => {
    const now = Date.parse('2026-07-07T10:00:00Z');
    const rows = aging(PRS, now);
    expect(rows.map(r => r.id)).toEqual(['PR-2026-0002', 'PR-2026-0004']);
    expect(rows[0].daysInStatus).toBe(35);
  });
});

describe('vendorPerformance', () => {
  it('computes avg delivery days and delayed count from received PRs', () => {
    const r = vendorPerformance(PRS);
    const mouser = r.find(v => v.vendor === 'Mouser');
    expect(mouser.received).toBe(2);
    expect(mouser.avgDays).toBe(5); // (7 + 3) / 2
    expect(mouser.delayed).toBe(1); // PR-0001 received after expectedDate
  });
});

describe('toCSV', () => {
  it('escapes quotes and commas', () => {
    const csv = toCSV([{ a: 'x,y', b: 'he said "hi"' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    expect(csv).toBe('A,B\r\n"x,y","he said ""hi"""');
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npx vitest run tests/reports.test.js`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

`frontend/src/lib/reports.js`:
```js
const ACTIVE = ['Submitted', 'Approved', 'Ordered', 'In Transit', 'On Hold'];
const DAY = 86400000;

export function spendBy(prs, keyFn) {
  const out = {};
  for (const p of prs) {
    const amt = Number(p.amount);
    if (!p.amount || !isFinite(amt)) continue;
    const k = keyFn(p) || '—';
    const cur = p.currency || 'Unknown';
    (out[k] = out[k] || {})[cur] = (out[k][cur] || 0) + amt;
  }
  return out;
}

export function spendByMonth(prs) {
  return spendBy(prs, p => String(p.createdAt || '').slice(0, 7));
}

export function statusCounts(prs) {
  const out = {};
  for (const p of prs) out[p.status] = (out[p.status] || 0) + 1;
  return out;
}

export function aging(prs, nowMs) {
  return prs
    .filter(p => ACTIVE.includes(p.status))
    .map(p => ({ ...p, daysInStatus: Math.floor((nowMs - Date.parse(p.updatedAt || p.createdAt)) / DAY) }))
    .sort((a, b) => b.daysInStatus - a.daysInStatus);
}

export function vendorPerformance(prs) {
  const map = {};
  for (const p of prs) {
    if (!p.vendor) continue;
    const v = map[p.vendor] = map[p.vendor] || { vendor: p.vendor, orders: 0, received: 0, delayed: 0, _days: [] };
    v.orders++;
    if (p.status === 'Received' && p.receivedAt) {
      v.received++;
      if (p.approvedAt) v._days.push((Date.parse(p.receivedAt) - Date.parse(p.approvedAt)) / DAY);
      if (p.expectedDate && Date.parse(p.receivedAt) > Date.parse(p.expectedDate)) v.delayed++;
    }
  }
  return Object.values(map).map(v => ({
    vendor: v.vendor, orders: v.orders, received: v.received, delayed: v.delayed,
    avgDays: v._days.length ? Math.round(v._days.reduce((a, b) => a + b, 0) / v._days.length) : null
  })).sort((a, b) => b.orders - a.orders);
}

export function toCSV(rows, cols) {
  const escape = v => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.map(c => escape(c.label)).join(',')];
  for (const r of rows) lines.push(cols.map(c => escape(r[c.key])).join(','));
  return lines.join('\r\n');
}
```

- [ ] **Step 4: Run all tests, verify pass**

Run: `cd frontend && npx vitest run`
Expected: PASS — currency, status, reports suites all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/reports.js frontend/tests/reports.test.js
git commit -m "feat: report aggregation and CSV export functions"
```

---

### Task 5: Apps Script backend — router + auth

**Files:**
- Create: `apps-script/appsscript.json`, `apps-script/Code.gs`, `apps-script/auth.gs`

**Interfaces:**
- Produces: `doPost(e)` JSON API — request body `{action, token, ...params}`, response `{ok:true, ...}` or `{ok:false, error}`. `requireUser_(body)→{email, role}` used by prs.gs/users.gs. Actions registered in `ROUTES` object (later tasks add to it).
- Consumes: `Users` tab (`email`, `role` columns).

Apps Script cannot run locally — verification is `node --check` syntax pass; behavioral verification happens in Task 10 (deployment).

- [ ] **Step 1: Create manifest**

`apps-script/appsscript.json`:
```json
{
  "timeZone": "Asia/Kolkata",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 2: Create router**

`apps-script/Code.gs`:
```js
// Oizom Purchase Tool backend. Bound to the procurement Google Sheet.
// All requests: POST JSON {action, token, ...}. Response: {ok, ...} JSON.

var ROUTES = {}; // filled by registerRoute_ calls in other files

function registerRoute_(action, opts, handler) {
  ROUTES[action] = { minRole: opts.minRole || 'viewer', handler: handler };
}

// role ordering for minRole checks
var ROLE_RANK = { viewer: 0, requester: 1, approver: 2, admin: 3 };

function doGet(e) {
  return json_({ ok: true, service: 'oizom-purchase-tool', time: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON body' });
  }
  try {
    var route = ROUTES[body.action];
    if (!route) throw new Error('Unknown action: ' + body.action);
    var user = requireUser_(body);
    if (ROLE_RANK[user.role] < ROLE_RANK[route.minRole]) {
      throw new Error('Your role (' + user.role + ') cannot perform ' + body.action);
    }
    var result = route.handler(user, body) || {};
    result.ok = true;
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() { return SpreadsheetApp.getActive(); }

function sheet_(name, headers) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function nowIso_() { return new Date().toISOString(); }

// Convert a sheet cell to a plain string (dates → ISO date part)
function cellStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  return v == null ? '' : String(v);
}
```

- [ ] **Step 3: Create auth module**

`apps-script/auth.gs`:
```js
var ALLOWED_DOMAIN = 'oizom.com';
// Must match frontend/src/config.js CLIENT_ID. Empty string = skip audience
// check (set it before real deployment!).
var OAUTH_CLIENT_ID = '';

var USERS_HEADERS = ['email', 'role', 'addedBy', 'addedAt'];

function requireUser_(body) {
  var email = verifyToken_(body.token);
  var role = getRole_(email);
  return { email: email, role: role };
}

function verifyToken_(idToken) {
  if (!idToken) throw new Error('Not signed in (missing token)');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var cached = cache.get(key);
  if (cached) return cached;

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sign-in token invalid or expired — sign in again');
  var info = JSON.parse(res.getContentText());
  if (OAUTH_CLIENT_ID && info.aud !== OAUTH_CLIENT_ID) throw new Error('Token audience mismatch');
  if (info.email_verified !== 'true') throw new Error('Email not verified');
  var email = String(info.email || '').toLowerCase();
  if (email.split('@')[1] !== ALLOWED_DOMAIN) {
    throw new Error('Only @' + ALLOWED_DOMAIN + ' accounts are allowed');
  }
  var ttl = Math.min(Math.max(Number(info.exp) - Math.floor(Date.now() / 1000), 1), 3600);
  cache.put(key, email, ttl);
  return email;
}

function getRole_(email) {
  var sh = sheet_('Users', USERS_HEADERS);
  var data = sh.getDataRange().getValues();
  // Bootstrap: empty Users tab (only header) → first caller becomes admin
  if (data.length < 2) {
    sh.appendRow([email, 'admin', 'bootstrap', nowIso_()]);
    return 'admin';
  }
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email) return String(data[i][1]).toLowerCase();
  }
  return 'viewer'; // domain user not in Users tab → read-only
}
```

- [ ] **Step 4: Syntax check**

Run: `node --check apps-script/Code.gs && node --check apps-script/auth.gs && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add apps-script
git commit -m "feat: Apps Script router with Google ID token auth and roles"
```

---

### Task 6: Apps Script — PR CRUD, transitions, audit log

**Files:**
- Create: `apps-script/prs.gs`

**Interfaces:**
- Consumes: `registerRoute_`, `sheet_`, `cellStr_`, `nowIso_` from Code.gs.
- Produces actions: `me` → `{email, role}`; `list` → `{prs:[…], me}`; `create` (minRole requester) → `{pr}`; `update` (requester) → `{pr}`; `transition` (requester) → `{pr}`. PR objects use the Global Constraints column schema.

- [ ] **Step 1: Implement**

`apps-script/prs.gs`:
```js
var PR_HEADERS = ['id', 'createdAt', 'department', 'requesterEmail', 'item', 'qty', 'vendor',
  'amount', 'currency', 'priority', 'status', 'approverEmail', 'approvedAt', 'paymentStatus',
  'courier', 'trackingNo', 'expectedDate', 'receivedAt', 'notes', 'updatedAt'];

var LOG_HEADERS = ['timestamp', 'user', 'prId', 'action', 'detail'];

// fields a requester/approver may edit directly (status changes go through 'transition')
var EDITABLE_FIELDS = ['department', 'item', 'qty', 'vendor', 'amount', 'currency', 'priority',
  'paymentStatus', 'courier', 'trackingNo', 'expectedDate', 'notes'];

// ==== status matrix — MUST mirror frontend/src/lib/status.js ====
var STAFF_ = ['approver', 'admin'];
var TRANSITIONS_ = {
  'Submitted':  { 'Approved': STAFF_, 'Rejected': STAFF_, 'Cancelled': STAFF_.concat(['requester:own']), 'On Hold': STAFF_ },
  'Approved':   { 'Ordered': STAFF_, 'Cancelled': STAFF_, 'On Hold': STAFF_ },
  'Ordered':    { 'In Transit': STAFF_, 'Received': STAFF_, 'Cancelled': STAFF_, 'On Hold': STAFF_ },
  'In Transit': { 'Received': STAFF_, 'On Hold': STAFF_ },
  'On Hold':    { 'Submitted': STAFF_, 'Approved': STAFF_, 'Ordered': STAFF_, 'Cancelled': STAFF_ },
  'Rejected':   { 'Submitted': STAFF_.concat(['requester:own']) },
  'Received':   {},
  'Cancelled':  {}
};

function canTransition_(from, to, role, isOwn) {
  var allowed = (TRANSITIONS_[from] || {})[to];
  if (!allowed) return false;
  return allowed.some(function (tok) {
    return tok === 'requester:own' ? (role === 'requester' && isOwn) : tok === role;
  });
}

function prSheet_() { return sheet_('PRs', PR_HEADERS); }

function rowToPr_(row) {
  var pr = {};
  PR_HEADERS.forEach(function (h, i) { pr[h] = cellStr_(row[i]); });
  return pr;
}

function listPrs_() {
  var data = prSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var pr = rowToPr_(data[i]);
    pr._row = i + 1;
    if (pr.id) out.push(pr);
  }
  return out;
}

function findPr_(id) {
  var prs = listPrs_();
  for (var i = 0; i < prs.length; i++) if (prs[i].id === id) return prs[i];
  throw new Error('PR not found: ' + id);
}

function nextId_() {
  var year = new Date().getFullYear();
  var prefix = 'PR-' + year + '-';
  var max = 0;
  listPrs_().forEach(function (p) {
    if (p.id.indexOf(prefix) === 0) max = Math.max(max, parseInt(p.id.slice(prefix.length), 10) || 0);
  });
  return prefix + ('0000' + (max + 1)).slice(-4);
}

function log_(user, prId, action, detail) {
  sheet_('Log', LOG_HEADERS).appendRow([nowIso_(), user.email, prId, action, detail || '']);
}

function writePr_(pr) {
  var row = PR_HEADERS.map(function (h) { return pr[h] || ''; });
  prSheet_().getRange(pr._row, 1, 1, PR_HEADERS.length).setValues([row]);
}

registerRoute_('me', { minRole: 'viewer' }, function (user) {
  return { email: user.email, role: user.role };
});

registerRoute_('list', { minRole: 'viewer' }, function (user) {
  return { prs: listPrs_(), me: { email: user.email, role: user.role } };
});

registerRoute_('create', { minRole: 'requester' }, function (user, body) {
  var d = body.pr || {};
  if (!d.item) throw new Error('Item is required');
  if (!d.department) throw new Error('Department is required');
  var pr = { id: nextId_(), createdAt: nowIso_(), requesterEmail: user.email, status: 'Submitted', updatedAt: nowIso_() };
  EDITABLE_FIELDS.forEach(function (f) { pr[f] = d[f] != null ? String(d[f]) : ''; });
  prSheet_().appendRow(PR_HEADERS.map(function (h) { return pr[h] || ''; }));
  log_(user, pr.id, 'create', pr.item);
  return { pr: pr };
});

registerRoute_('update', { minRole: 'requester' }, function (user, body) {
  var pr = findPr_(body.id);
  var isOwn = pr.requesterEmail.toLowerCase() === user.email;
  var isStaff = user.role === 'approver' || user.role === 'admin';
  if (!isStaff && !(isOwn && pr.status === 'Submitted')) {
    throw new Error('You can only edit your own PRs while they are Submitted');
  }
  var changes = [];
  EDITABLE_FIELDS.forEach(function (f) {
    if (body.updates && body.updates[f] != null && String(body.updates[f]) !== pr[f]) {
      changes.push(f + ': "' + pr[f] + '" → "' + body.updates[f] + '"');
      pr[f] = String(body.updates[f]);
    }
  });
  if (changes.length) {
    pr.updatedAt = nowIso_();
    writePr_(pr);
    log_(user, pr.id, 'update', changes.join('; '));
  }
  return { pr: pr };
});

registerRoute_('transition', { minRole: 'requester' }, function (user, body) {
  var pr = findPr_(body.id);
  var to = body.to;
  var isOwn = pr.requesterEmail.toLowerCase() === user.email;
  if (!canTransition_(pr.status, to, user.role, isOwn)) {
    throw new Error('Cannot move ' + pr.id + ' from ' + pr.status + ' to ' + to + ' as ' + user.role);
  }
  var detail = pr.status + ' → ' + to;
  if (to === 'Approved' || to === 'Rejected') { pr.approverEmail = user.email; pr.approvedAt = nowIso_(); }
  if (to === 'Received') pr.receivedAt = nowIso_();
  pr.status = to;
  pr.updatedAt = nowIso_();
  writePr_(pr);
  log_(user, pr.id, 'transition', detail);
  return { pr: pr };
});
```

- [ ] **Step 2: Syntax check**

Run: `node --check apps-script/prs.gs && echo OK`
Expected: `OK`

- [ ] **Step 3: Cross-check transition matrices match**

Run: `grep -A9 "var TRANSITIONS_" apps-script/prs.gs && grep -A9 "const T = {" frontend/src/lib/status.js`
Expected: same states and role lists in both (manual eyeball — they must be identical).

- [ ] **Step 4: Commit**

```bash
git add apps-script/prs.gs
git commit -m "feat: PR CRUD, role-gated transitions, and audit log in backend"
```

---

### Task 7: Apps Script — user management + migration

**Files:**
- Create: `apps-script/users.gs`, `apps-script/migrate.gs`

**Interfaces:**
- Produces actions: `usersList` (admin) → `{users:[{email, role}]}`; `userSet` (admin, body `{email, role}`, role `''` removes) → `{users}`.
- Produces editor-run functions: `dumpHeaders()` (logs every tab's header row as JSON), `migrateDeptTabs()` (merges department tabs into `PRs`, idempotent).

- [ ] **Step 1: Implement user management**

`apps-script/users.gs`:
```js
function listUsers_() {
  var data = sheet_('Users', USERS_HEADERS).getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) out.push({ email: String(data[i][0]).toLowerCase(), role: String(data[i][1]).toLowerCase() });
  }
  return out;
}

registerRoute_('usersList', { minRole: 'admin' }, function () {
  return { users: listUsers_() };
});

registerRoute_('userSet', { minRole: 'admin' }, function (user, body) {
  var email = String(body.email || '').toLowerCase().trim();
  var role = String(body.role || '').toLowerCase().trim();
  if (!email) throw new Error('Email required');
  if (role && ROLE_RANK[role] == null) throw new Error('Invalid role: ' + role);
  var sh = sheet_('Users', USERS_HEADERS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email) {
      if (role) sh.getRange(i + 1, 2).setValue(role);
      else sh.deleteRow(i + 1);
      log_(user, '', 'userSet', email + ' → ' + (role || 'removed'));
      return { users: listUsers_() };
    }
  }
  if (!role) throw new Error('User not found: ' + email);
  sh.appendRow([email, role, user.email, nowIso_()]);
  log_(user, '', 'userSet', email + ' → ' + role);
  return { users: listUsers_() };
});
```

- [ ] **Step 2: Implement migration**

`apps-script/migrate.gs`:
```js
// ===== One-time migration: department tabs → master PRs tab =====
// Run BOTH functions from the Apps Script editor (they need editor context):
// 1. dumpHeaders()      — logs each tab's headers; save output to docs/sheet-headers.json
// 2. migrateDeptTabs()  — merges dept tabs into PRs. Idempotent. TEST ON A COPY FIRST.

var SYSTEM_TABS = ['PRs', 'Users', 'Log'];

// normalized old-header → PR field. Extend after inspecting dumpHeaders() output.
var HEADER_MAP = {
  item: ['item', 'itemname', 'itemdescription', 'description', 'material', 'materialname', 'product', 'particulars'],
  qty: ['qty', 'quantity', 'nos', 'noofunits'],
  vendor: ['vendor', 'vendorname', 'supplier', 'suppliername', 'party', 'platform', 'source'],
  amount: ['amount', 'price', 'cost', 'value', 'total', 'totalamount', 'totalcost', 'approxcost'],
  currency: ['currency', 'cur'],
  priority: ['priority', 'urgency'],
  status: ['status', 'materialstatus', 'orderstatus', 'currentstatus'],
  paymentStatus: ['payment', 'paymentstatus', 'paymentstate'],
  courier: ['courier', 'couriername', 'shippingvia'],
  trackingNo: ['tracking', 'trackingno', 'trackingnumber', 'awb', 'awbno', 'consignmentno'],
  expectedDate: ['expecteddate', 'expecteddelivery', 'eta', 'deliverydate'],
  receivedAt: ['receiveddate', 'receivedon'],
  createdAt: ['date', 'prdate', 'requestdate', 'requesteddate', 'createdat', 'orderdate'],
  requesterEmail: ['requester', 'requestedby', 'requesteremail', 'email', 'raisedby'],
  notes: ['remarks', 'notes', 'comment', 'comments']
};

var OLD_STATUS_MAP = {
  'in process': 'Ordered', 'in transit': 'In Transit', 'received': 'Received',
  'cancelled': 'Cancelled', 'on hold': 'On Hold'
};

function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function dumpHeaders() {
  var out = {};
  ss_().getSheets().forEach(function (sh) {
    if (SYSTEM_TABS.indexOf(sh.getName()) !== -1) return;
    if (sh.getLastRow() < 1) return;
    out[sh.getName()] = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  });
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function migrateDeptTabs() {
  var target = sheet_('PRs', PR_HEADERS);
  if (target.getLastRow() > 1) {
    Logger.log('PRs tab already has data — migration skipped (idempotent).');
    return;
  }
  var counter = 0;
  var rowsOut = [];
  ss_().getSheets().forEach(function (sh) {
    var tab = sh.getName();
    if (SYSTEM_TABS.indexOf(tab) !== -1 || sh.getLastRow() < 2) return;
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(norm_);
    // column index for each PR field
    var idx = {};
    Object.keys(HEADER_MAP).forEach(function (field) {
      for (var c = 0; c < headers.length; c++) {
        if (HEADER_MAP[field].indexOf(headers[c]) !== -1) { idx[field] = c; break; }
      }
    });
    var mapped = Object.keys(idx).map(function (f) { return idx[f]; });
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (row.every(function (c) { return c === '' || c == null; })) continue;
      counter++;
      var pr = { id: 'PR-MIG-' + ('00000' + counter).slice(-5), department: tab, updatedAt: nowIso_() };
      Object.keys(idx).forEach(function (f) { pr[f] = cellStr_(row[idx[f]]); });
      pr.status = OLD_STATUS_MAP[String(pr.status || '').toLowerCase().trim()] || 'Received';
      if (!pr.createdAt) pr.createdAt = nowIso_();
      // preserve unmapped columns in notes
      var extras = [];
      for (var c = 0; c < row.length; c++) {
        if (mapped.indexOf(c) === -1 && cellStr_(row[c])) {
          extras.push(String(data[0][c]) + ': ' + cellStr_(row[c]));
        }
      }
      if (extras.length) pr.notes = ((pr.notes || '') + ' | ' + extras.join(' | ')).replace(/^ \| /, '');
      rowsOut.push(PR_HEADERS.map(function (h) { return pr[h] || ''; }));
    }
  });
  if (rowsOut.length) target.getRange(2, 1, rowsOut.length, PR_HEADERS.length).setValues(rowsOut);
  Logger.log('Migrated ' + rowsOut.length + ' rows from department tabs.');
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check apps-script/users.gs && node --check apps-script/migrate.gs && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps-script/users.gs apps-script/migrate.gs
git commit -m "feat: admin user management and idempotent sheet migration"
```

---

### Task 8: Frontend — api, auth (GIS), state store

**Files:**
- Create: `frontend/src/api.js`, `frontend/src/auth.js`, `frontend/src/state.js`

**Interfaces:**
- Consumes: `CFG` from config.js; backend actions from Tasks 5–7.
- Produces: `api(action, payload)→Promise<data>`; `initAuth(onSignedIn)`, `getToken()`, `signOut()`, `renderSignIn(el)`; `store` with `subscribe(fn)`, `refresh()`, `startPolling()`, `get()` → `{prs, me, lastSync, err, loading}`.

- [ ] **Step 1: api.js**

`frontend/src/api.js`:
```js
import { CFG } from './config.js';
import { getToken } from './auth.js';

export class ApiError extends Error {}

export async function api(action, payload = {}) {
  if (!CFG.APP_URL) throw new ApiError('APP_URL not configured — edit src/config.js');
  const token = getToken();
  if (!token) throw new ApiError('SIGNED_OUT');
  // No Content-Type header: keeps this a "simple request" (no CORS preflight,
  // which Apps Script cannot answer).
  const res = await fetch(CFG.APP_URL, {
    method: 'POST',
    body: JSON.stringify({ action, token, ...payload })
  });
  if (!res.ok) throw new ApiError('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new ApiError(data.error || 'Request failed');
  return data;
}
```

- [ ] **Step 2: auth.js (GIS)**

`frontend/src/auth.js`:
```js
import { CFG } from './config.js';

const KEY = 'oizom-id-token';
let onSignedInCb = null;

function decodeExp(token) {
  try { return JSON.parse(atob(token.split('.')[1])).exp * 1000; } catch { return 0; }
}

export function getToken() {
  const t = sessionStorage.getItem(KEY);
  if (!t) return null;
  if (decodeExp(t) < Date.now() + 30000) { sessionStorage.removeItem(KEY); return null; }
  return t;
}

export function tokenEmail() {
  const t = getToken();
  if (!t) return null;
  try { return JSON.parse(atob(t.split('.')[1])).email; } catch { return null; }
}

export function signOut() {
  sessionStorage.removeItem(KEY);
  location.reload();
}

export function initAuth(onSignedIn) {
  onSignedInCb = onSignedIn;
  if (getToken()) { onSignedIn(); return; }
  whenGisReady(() => {
    google.accounts.id.initialize({
      client_id: CFG.CLIENT_ID,
      hd: 'oizom.com',
      callback: res => {
        sessionStorage.setItem(KEY, res.credential);
        onSignedInCb();
      }
    });
  });
}

function whenGisReady(fn, tries = 0) {
  if (window.google && google.accounts) return fn();
  if (tries > 100) { console.error('Google Identity Services failed to load'); return; }
  setTimeout(() => whenGisReady(fn, tries + 1), 100);
}

export function renderSignIn(el) {
  whenGisReady(() => {
    google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', width: 280 });
  });
}
```

- [ ] **Step 3: state.js**

`frontend/src/state.js`:
```js
import { api } from './api.js';

const POLL_MS = 60000;
let state = { prs: [], me: null, lastSync: null, err: '', loading: false };
const listeners = new Set();
let timer = null;

function emit() { listeners.forEach(fn => fn(state)); }

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async refresh() {
    state = { ...state, loading: true };
    emit();
    try {
      const d = await api('list');
      state = { prs: d.prs, me: d.me, lastSync: new Date(), err: '', loading: false };
    } catch (e) {
      state = { ...state, err: e.message, loading: false };
    }
    emit();
  },
  startPolling() {
    if (timer) return;
    store.refresh();
    timer = setInterval(() => store.refresh(), POLL_MS);
  }
};
```

- [ ] **Step 4: Syntax check via build**

Run: `cd frontend && npx vite build 2>&1 | tail -3`
Expected: build succeeds (main.js doesn't import these yet — that's fine; build proves syntax).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.js frontend/src/auth.js frontend/src/state.js
git commit -m "feat: API client, Google sign-in, and polling state store"
```

---

### Task 9: Frontend — router, auth gate, dashboard view

**Files:**
- Create: `frontend/src/main.js`, `frontend/src/views/dashboard.js`, `frontend/src/ui.js`

**Interfaces:**
- Consumes: `store`, `initAuth/renderSignIn/signOut/tokenEmail`, currency lib.
- Produces: hash router (`#/`, `#/new`, `#/pr/:id`, `#/reports`, `#/admin`); `ui.js` helpers `esc(s)`, `toast(msg, isErr)`, `chip(status)` used by all views. Views are functions `(container, state, params) => void` registered in `VIEWS` in main.js.

- [ ] **Step 1: ui helpers**

`frontend/src/ui.js`:
```js
export const esc = s => s == null ? '' : String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function chip(status) {
  return `<span class="chip ${esc(status)}" data-s="${esc(status)}">${esc(status)}</span>`;
}

export function toast(msg, isErr = false) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), isErr ? 6000 : 3000);
}

export const fmtDate = s => s ? String(s).slice(0, 10) : '—';
```

- [ ] **Step 2: main.js router + auth gate + nav**

`frontend/src/main.js`:
```js
import './styles.css';
import { initAuth, renderSignIn, signOut } from './auth.js';
import { store } from './state.js';
import { esc } from './ui.js';
import { dashboardView } from './views/dashboard.js';
import { prFormView } from './views/prForm.js';
import { prDetailView } from './views/prDetail.js';
import { reportsView } from './views/reports.js';
import { adminView } from './views/admin.js';

const app = document.getElementById('app');

const VIEWS = {
  '': { fn: dashboardView, nav: 'Dashboard' },
  'new': { fn: prFormView, nav: 'New PR', minRole: 'requester' },
  'pr': { fn: prDetailView },
  'reports': { fn: reportsView, nav: 'Reports' },
  'admin': { fn: adminView, nav: 'Admin', minRole: 'admin' }
};
const RANK = { viewer: 0, requester: 1, approver: 2, admin: 3 };

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || '', param: parts[1] || null };
}

function showAuthGate() {
  app.innerHTML = `
    <div class="auth-gate"><div class="auth-box">
      <h1>OIZOM <b>Procurement</b></h1>
      <p>Sign in with your @oizom.com Google account</p>
      <div id="gsignin" style="display:flex;justify-content:center"></div>
    </div></div>`;
  renderSignIn(document.getElementById('gsignin'));
}

function render() {
  const s = store.get();
  const { name, param } = route();
  const view = VIEWS[name] || VIEWS[''];
  const role = s.me ? s.me.role : 'viewer';
  const sync = s.err
    ? `<span class="sync-chip err" title="${esc(s.err)}">sync failed — retrying</span>`
    : s.lastSync
      ? `<span class="sync-chip">● Live · ${s.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${s.prs.length} PRs</span>`
      : `<span class="sync-chip">syncing…</span>`;
  const nav = Object.entries(VIEWS)
    .filter(([, v]) => v.nav && (!v.minRole || RANK[role] >= RANK[v.minRole]))
    .map(([k, v]) => `<a href="#/${k}" class="${name === k ? 'active' : ''}">${v.nav}</a>`).join('');
  app.innerHTML = `
    <div class="topbar">
      <span class="logo">OIZOM <b>Procurement</b></span>
      <nav>${nav}</nav>
      ${sync}
      <span class="userchip">${esc(s.me ? s.me.email + ' · ' + s.me.role : '')}</span>
      <button class="btn" id="btnOut" style="padding:4px 10px;font-size:12px">Sign out</button>
    </div>
    <div class="main" id="view"></div>`;
  document.getElementById('btnOut').onclick = signOut;
  view.fn(document.getElementById('view'), s, param);
}

window.addEventListener('hashchange', render);
store.subscribe(render);

initAuth(() => {
  store.startPolling();
  render();
});
if (!sessionStorage.getItem('oizom-id-token')) showAuthGate();
```

- [ ] **Step 3: dashboard view**

`frontend/src/views/dashboard.js`:
```js
import { esc, chip, fmtDate } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { statusCounts } from '../lib/reports.js';

const FILTERS = { dept: '', status: '', q: '' };

export function dashboardView(el, s) {
  const depts = [...new Set(s.prs.map(p => p.department).filter(Boolean))].sort();
  const statuses = [...new Set(s.prs.map(p => p.status).filter(Boolean))].sort();
  const counts = statusCounts(s.prs);
  const open = (counts['Submitted'] || 0);
  const inFlight = (counts['Ordered'] || 0) + (counts['In Transit'] || 0);

  const rows = s.prs.filter(p =>
    (!FILTERS.dept || p.department === FILTERS.dept) &&
    (!FILTERS.status || p.status === FILTERS.status) &&
    (!FILTERS.q || (p.item + ' ' + p.vendor + ' ' + p.id + ' ' + p.requesterEmail).toLowerCase().includes(FILTERS.q.toLowerCase()))
  ).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  el.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="v">${s.prs.length}</div><div class="l">Total PRs</div></div>
      <div class="kpi"><div class="v">${open}</div><div class="l">Pending approval</div></div>
      <div class="kpi"><div class="v">${inFlight}</div><div class="l">Ordered / In transit</div></div>
      <div class="kpi"><div class="v">${counts['Received'] || 0}</div><div class="l">Received</div></div>
    </div>
    <div class="card">
      <div class="filters">
        <select id="fDept"><option value="">All departments</option>${depts.map(d => `<option ${FILTERS.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <select id="fStatus"><option value="">All statuses</option>${statuses.map(x => `<option ${FILTERS.status === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <input id="fQ" placeholder="Search item / vendor / id…" value="${esc(FILTERS.q)}" style="flex:1;min-width:180px">
        <a class="btn primary" href="#/new">+ New PR</a>
      </div>
      <table class="tbl"><thead><tr>
        <th>ID</th><th>Date</th><th>Dept</th><th>Item</th><th>Vendor</th><th>Amount</th><th>Status</th>
      </tr></thead><tbody>
        ${rows.map(p => `<tr class="rowlink" data-id="${esc(p.id)}">
          <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
          <td>${fmtDate(p.createdAt)}</td><td>${esc(p.department)}</td>
          <td>${esc(p.item)}</td><td>${esc(p.vendor)}</td>
          <td>${p.amount ? fmtCompact(p.currency || 'INR', Number(p.amount)) : '—'}</td>
          <td>${chip(p.status)}</td>
        </tr>`).join('') || '<tr><td colspan="7" style="color:var(--mut)">No PRs match.</td></tr>'}
      </tbody></table>
    </div>`;

  el.querySelector('#fDept').onchange = e => { FILTERS.dept = e.target.value; dashboardView(el, s); };
  el.querySelector('#fStatus').onchange = e => { FILTERS.status = e.target.value; dashboardView(el, s); };
  el.querySelector('#fQ').oninput = e => { FILTERS.q = e.target.value; dashboardView(el, s); };
  el.querySelectorAll('tr.rowlink').forEach(tr => tr.onclick = () => location.hash = '#/pr/' + tr.dataset.id);
}
```

- [ ] **Step 4: Stub remaining views so build passes**

Create minimal placeholders (replaced in Tasks 10–11):

`frontend/src/views/prForm.js`:
```js
export function prFormView(el) { el.innerHTML = '<div class="card">PR form — Task 10</div>'; }
```
`frontend/src/views/prDetail.js`:
```js
export function prDetailView(el) { el.innerHTML = '<div class="card">PR detail — Task 10</div>'; }
```
`frontend/src/views/reports.js`:
```js
export function reportsView(el) { el.innerHTML = '<div class="card">Reports — Task 11</div>'; }
```
`frontend/src/views/admin.js`:
```js
export function adminView(el) { el.innerHTML = '<div class="card">Admin — Task 11</div>'; }
```

- [ ] **Step 5: Build + visual smoke test**

Run: `cd frontend && npx vite build 2>&1 | tail -3`
Expected: build succeeds.
Run: `cd frontend && npm run dev` and open http://localhost:5173 — expect the auth gate (sign-in fails until config.js is filled; gate rendering is the check).

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: router, auth gate, and live dashboard view"
```

---

### Task 10: PR form + PR detail (create, edit, transitions, tracking)

**Files:**
- Modify: `frontend/src/views/prForm.js`, `frontend/src/views/prDetail.js` (replace stubs)

**Interfaces:**
- Consumes: `api`, `store`, `nextStates` from lib/status.js, `toast/esc/chip/fmtDate` from ui.js.
- Produces: working create/edit form and detail page with role-gated transition buttons and courier tracking links.

- [ ] **Step 1: PR form (create + edit modes)**

`frontend/src/views/prForm.js`:
```js
import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc } from '../ui.js';

const PRIORITIES = ['High', 'Medium', 'Low'];
const PAYMENTS = ['Unpaid', 'Paid', 'Partially Paid', 'FOC / Free'];
export const COURIERS = ['', 'BlueDart', 'DHL', 'FedEx', 'DTDC', 'India Post', 'Delhivery', 'Other'];

export function prFormView(el, s, editId) {
  const editing = editId ? s.prs.find(p => p.id === editId) : null;
  const p = editing || {};
  const depts = [...new Set(s.prs.map(x => x.department).filter(Boolean))].sort();
  const opt = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

  el.innerHTML = `
    <div class="card"><h2>${editing ? 'Edit ' + esc(p.id) : 'New Purchase Request'}</h2>
    <form class="pr" id="prForm">
      <label>Item / description* <input name="item" required value="${esc(p.item)}"></label>
      <label>Department* <input name="department" list="depts" required value="${esc(p.department)}">
        <datalist id="depts">${depts.map(d => `<option>${esc(d)}</option>`).join('')}</datalist></label>
      <label>Quantity <input name="qty" value="${esc(p.qty)}"></label>
      <label>Vendor / platform <input name="vendor" value="${esc(p.vendor)}"></label>
      <label>Amount <input name="amount" type="number" step="0.01" min="0" value="${esc(p.amount)}"></label>
      <label>Currency <select name="currency">${opt(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CNY'], p.currency || 'INR')}</select></label>
      <label>Priority <select name="priority">${opt(PRIORITIES, p.priority || 'Medium')}</select></label>
      <label>Payment status <select name="paymentStatus">${opt(PAYMENTS, p.paymentStatus || 'Unpaid')}</select></label>
      <label>Expected delivery <input name="expectedDate" type="date" value="${esc((p.expectedDate || '').slice(0, 10))}"></label>
      <label>Courier <select name="courier">${opt(COURIERS, p.courier || '')}</select></label>
      <label>Tracking number <input name="trackingNo" value="${esc(p.trackingNo)}"></label>
      <label class="full">Notes <textarea name="notes" rows="3">${esc(p.notes)}</textarea></label>
      <div class="full" style="display:flex;gap:10px">
        <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Submit PR'}</button>
        <a class="btn" href="${editing ? '#/pr/' + esc(p.id) : '#/'}">Cancel</a>
      </div>
    </form></div>`;

  el.querySelector('#prForm').onsubmit = async ev => {
    ev.preventDefault();
    const btn = ev.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Saving…';
    const fields = Object.fromEntries(new FormData(ev.target));
    try {
      if (editing) {
        await api('update', { id: p.id, updates: fields });
        toast('PR updated');
        location.hash = '#/pr/' + p.id;
      } else {
        const d = await api('create', { pr: fields });
        toast('Created ' + d.pr.id);
        location.hash = '#/pr/' + d.pr.id;
      }
      store.refresh();
    } catch (e) {
      toast(e.message, true);
      btn.disabled = false; btn.textContent = editing ? 'Save changes' : 'Submit PR';
    }
  };
}
```

- [ ] **Step 2: PR detail with transitions + tracking links**

`frontend/src/views/prDetail.js`:
```js
import { api } from '../api.js';
import { store } from '../state.js';
import { toast, esc, chip, fmtDate } from '../ui.js';
import { nextStates } from '../lib/status.js';
import { fmtMoney } from '../lib/currency.js';

const COURIER_URLS = {
  'BlueDart': t => `https://www.bluedart.com/tracking?trackFor=0&trackNo=${t}`,
  'DHL': t => `https://www.dhl.com/in-en/home/tracking.html?tracking-id=${t}`,
  'FedEx': t => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  'DTDC': t => `https://txn.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cnNo=${t}`,
  'Delhivery': t => `https://www.delhivery.com/track-v2/package/${t}`
};
const trackUrl = (courier, t) =>
  (COURIER_URLS[courier] || (x => `https://t.17track.net/en#nums=${x}`))(encodeURIComponent(t));

export function prDetailView(el, s, id) {
  const p = s.prs.find(x => x.id === id);
  if (!p) { el.innerHTML = `<div class="card">PR ${esc(id)} not found ${s.prs.length ? '' : '(still syncing…)'}</div>`; return; }
  const me = s.me || { role: 'viewer', email: '' };
  const isOwn = p.requesterEmail.toLowerCase() === me.email.toLowerCase();
  const canEdit = me.role === 'admin' || me.role === 'approver' || (isOwn && p.status === 'Submitted');
  const targets = nextStates(p.status, me.role, isOwn);
  const row = (l, v) => `<tr><th style="width:160px">${l}</th><td>${v || '—'}</td></tr>`;

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <h2 style="margin:0;font-family:var(--mono)">${esc(p.id)}</h2>${chip(p.status)}
        <span style="flex:1"></span>
        ${canEdit ? `<a class="btn" href="#/new/${esc(p.id)}">Edit</a>` : ''}
      </div>
      <table class="tbl">
        ${row('Item', esc(p.item))}${row('Department', esc(p.department))}${row('Quantity', esc(p.qty))}
        ${row('Vendor', esc(p.vendor))}
        ${row('Amount', p.amount ? fmtMoney(p.currency || 'INR', Number(p.amount)) : '')}
        ${row('Priority', esc(p.priority))}${row('Payment', esc(p.paymentStatus))}
        ${row('Requested by', esc(p.requesterEmail) + ' on ' + fmtDate(p.createdAt))}
        ${row('Approved by', p.approverEmail ? esc(p.approverEmail) + ' on ' + fmtDate(p.approvedAt) : '')}
        ${row('Expected', fmtDate(p.expectedDate))}${row('Received', fmtDate(p.receivedAt))}
        ${row('Tracking', p.trackingNo
          ? `${esc(p.courier || '')} <a href="${trackUrl(p.courier, p.trackingNo)}" target="_blank" rel="noopener">${esc(p.trackingNo)} ↗</a>`
          : '')}
        ${row('Notes', esc(p.notes))}
      </table>
      ${targets.length ? `<div style="display:flex;gap:8px;margin-top:14px" id="transitions">
        ${targets.map(t => `<button class="btn ${t === 'Approved' || t === 'Received' ? 'primary' : t === 'Rejected' || t === 'Cancelled' ? 'danger' : ''}" data-to="${esc(t)}">Mark ${esc(t)}</button>`).join('')}
      </div>` : ''}
    </div>`;

  el.querySelectorAll('#transitions button').forEach(btn => btn.onclick = async () => {
    const to = btn.dataset.to;
    if ((to === 'Rejected' || to === 'Cancelled') && !confirm(`Mark ${p.id} as ${to}?`)) return;
    btn.disabled = true;
    try {
      await api('transition', { id: p.id, to });
      toast(p.id + ' → ' + to);
      store.refresh();
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  });
}
```

Note: the edit route reuses `#/new/:id` — update the `VIEWS` entry check in `main.js` is not needed (`new` view already receives `param`).

- [ ] **Step 3: Build + unit tests still pass**

Run: `cd frontend && npx vite build 2>&1 | tail -2 && npx vitest run 2>&1 | tail -3`
Expected: build OK, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/prForm.js frontend/src/views/prDetail.js
git commit -m "feat: PR create/edit form and detail view with transitions and tracking"
```

---

### Task 11: Reports view + Admin view

**Files:**
- Modify: `frontend/src/views/reports.js`, `frontend/src/views/admin.js` (replace stubs)

**Interfaces:**
- Consumes: `lib/reports.js` functions, `fmtCompact`, `api`, `toast`.
- Produces: reports page (spend, status/aging, vendor performance, CSV download, print button) and admin user management page.

- [ ] **Step 1: Reports view**

`frontend/src/views/reports.js`:
```js
import { esc, chip, fmtDate } from '../ui.js';
import { fmtCompact } from '../lib/currency.js';
import { spendBy, spendByMonth, statusCounts, aging, vendorPerformance, toCSV } from '../lib/reports.js';

function downloadCSV(name, csv) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function spendTable(title, data) {
  const keys = Object.keys(data).sort();
  const max = Math.max(1, ...keys.map(k => Object.values(data[k]).reduce((a, b) => a + b, 0)));
  return `<div class="card"><h2>${title}</h2>
    ${keys.map(k => {
      const totals = Object.entries(data[k]);
      const sum = totals.reduce((a, [, v]) => a + v, 0);
      return `<div class="bar"><span class="lbl">${esc(k)}</span>
        <span class="fill" style="width:${Math.round(sum / max * 55)}%"></span>
        <span class="val">${totals.map(([c, v]) => fmtCompact(c, v)).join(' + ')}</span></div>`;
    }).join('') || '<p style="color:var(--mut)">No spend data.</p>'}</div>`;
}

export function reportsView(el, s) {
  const now = Date.now();
  const ag = aging(s.prs, now).slice(0, 15);
  const vp = vendorPerformance(s.prs);
  const sc = statusCounts(s.prs);

  el.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <button class="btn" id="csvAll">⬇ CSV — all PRs</button>
      <button class="btn" id="csvVendors">⬇ CSV — vendor performance</button>
      <button class="btn" onclick="window.print()">🖨 Print / PDF</button>
    </div>
    <div class="card"><h2>PR status</h2>
      ${Object.entries(sc).map(([k, v]) => `${chip(k)} <b style="margin-right:14px">${v}</b>`).join('')}</div>
    ${spendTable('Spend by department', spendBy(s.prs, p => p.department))}
    ${spendTable('Spend by vendor (top 12)', Object.fromEntries(Object.entries(spendBy(s.prs, p => p.vendor)).slice(0, 12)))}
    ${spendTable('Spend by month', spendByMonth(s.prs))}
    <div class="card"><h2>Aging — longest in current status</h2>
      <table class="tbl"><thead><tr><th>ID</th><th>Item</th><th>Status</th><th>Days</th></tr></thead><tbody>
      ${ag.map(p => `<tr class="rowlink" onclick="location.hash='#/pr/${esc(p.id)}'">
        <td style="font-family:var(--mono);font-size:12px">${esc(p.id)}</td>
        <td>${esc(p.item)}</td><td>${chip(p.status)}</td><td>${p.daysInStatus}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="card"><h2>Vendor performance</h2>
      <table class="tbl"><thead><tr><th>Vendor</th><th>Orders</th><th>Received</th><th>Avg days (approve→receive)</th><th>Delayed</th></tr></thead><tbody>
      ${vp.map(v => `<tr><td>${esc(v.vendor)}</td><td>${v.orders}</td><td>${v.received}</td>
        <td>${v.avgDays == null ? '—' : v.avgDays}</td><td>${v.delayed}</td></tr>`).join('')}
      </tbody></table></div>`;

  el.querySelector('#csvAll').onclick = () => downloadCSV('oizom-prs.csv', toCSV(s.prs,
    ['id', 'createdAt', 'department', 'requesterEmail', 'item', 'qty', 'vendor', 'amount', 'currency',
     'priority', 'status', 'paymentStatus', 'courier', 'trackingNo', 'expectedDate', 'receivedAt', 'notes']
      .map(k => ({ key: k, label: k }))));
  el.querySelector('#csvVendors').onclick = () => downloadCSV('oizom-vendor-performance.csv',
    toCSV(vp, [{ key: 'vendor', label: 'Vendor' }, { key: 'orders', label: 'Orders' },
      { key: 'received', label: 'Received' }, { key: 'avgDays', label: 'AvgDays' }, { key: 'delayed', label: 'Delayed' }]));
}
```

- [ ] **Step 2: Admin view**

`frontend/src/views/admin.js`:
```js
import { api } from '../api.js';
import { toast, esc } from '../ui.js';

const ROLES = ['admin', 'approver', 'requester', 'viewer'];
let USERS = null;

export function adminView(el, s) {
  if (USERS === null) {
    el.innerHTML = '<div class="card">Loading users…</div>';
    api('usersList').then(d => { USERS = d.users; adminView(el, s); })
      .catch(e => { el.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
    return;
  }
  el.innerHTML = `
    <div class="card"><h2>Users & roles</h2>
      <table class="tbl"><thead><tr><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
      ${USERS.map(u => `<tr>
        <td>${esc(u.email)}</td>
        <td><select data-email="${esc(u.email)}" class="roleSel">
          ${ROLES.map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
        <td><button class="btn danger rmBtn" data-email="${esc(u.email)}">Remove</button></td>
      </tr>`).join('')}
      </tbody></table>
      <div class="filters" style="margin-top:14px">
        <input id="newEmail" placeholder="person@oizom.com" style="flex:1">
        <select id="newRole">${ROLES.map(r => `<option>${r}</option>`).join('')}</select>
        <button class="btn primary" id="addBtn">Add user</button>
      </div>
    </div>`;

  const setUser = async (email, role) => {
    try {
      const d = await api('userSet', { email, role });
      USERS = d.users;
      toast(role ? `${email} → ${role}` : `${email} removed`);
      adminView(el, s);
    } catch (e) { toast(e.message, true); }
  };
  el.querySelectorAll('.roleSel').forEach(sel => sel.onchange = () => setUser(sel.dataset.email, sel.value));
  el.querySelectorAll('.rmBtn').forEach(b => b.onclick = () => {
    if (confirm(`Remove ${b.dataset.email}?`)) setUser(b.dataset.email, '');
  });
  el.querySelector('#addBtn').onclick = () =>
    setUser(el.querySelector('#newEmail').value.trim(), el.querySelector('#newRole').value);
}
```

- [ ] **Step 3: Build + tests**

Run: `cd frontend && npx vite build 2>&1 | tail -2 && npx vitest run 2>&1 | tail -3`
Expected: build OK, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/reports.js frontend/src/views/admin.js
git commit -m "feat: reports with CSV/print export and admin user management"
```

---

### Task 12: SETUP.md deployment guide + E2E checklist

**Files:**
- Create: `SETUP.md`, `README.md`

**Interfaces:**
- Consumes: everything above. This is the user-facing runbook — the user performs the Google-side steps interactively.

- [ ] **Step 1: Write SETUP.md**

`SETUP.md` must contain these sections with exact click-paths:

```markdown
# Setup Guide

## 1. Backend (Google Apps Script)
1. Open the procurement Google Sheet → Extensions → Apps Script.
2. Delete any default Code.gs content. Create one file per file in `apps-script/`
   (Code.gs, auth.gs, prs.gs, users.gs, migrate.gs) and paste the contents.
   Also: Project Settings → check "Show appsscript.json" → paste apps-script/appsscript.json.
3. Run `dumpHeaders` once from the editor (select function → Run). Authorize when
   prompted. View → Logs. Copy the JSON into `docs/sheet-headers.json` in this repo.
   If any header names are missing from HEADER_MAP in migrate.gs, add them.
4. Make a COPY of the sheet (File → Make a copy) and test `migrateDeptTabs` on the
   copy first (open the copy's Apps Script, same code). Verify the PRs tab looks right.
5. Run `migrateDeptTabs` on the real sheet.
6. Deploy → New deployment → type: Web app → Execute as: **Me** → Who has access:
   **Anyone** → Deploy. Copy the /exec URL.

## 2. OAuth client (Google sign-in)
1. console.cloud.google.com → create/select a project → APIs & Services →
   OAuth consent screen → Internal (Workspace) → fill name/email → Save.
2. Credentials → Create credentials → OAuth client ID → Web application.
3. Authorized JavaScript origins: add `http://localhost:5173` and your
   GitHub Pages origin (e.g. `https://<org>.github.io`).
4. Copy the client ID (ends .apps.googleusercontent.com).

## 3. Configure
- `frontend/src/config.js`: set APP_URL (step 1.6) and CLIENT_ID (step 2.4).
- `apps-script/auth.gs`: set OAUTH_CLIENT_ID to the same client ID, then create a
  NEW deployment version (Deploy → Manage deployments → edit → new version).

## 4. First sign-in
The first @oizom.com user to call the API becomes admin automatically.
Add everyone else in the Admin tab.

## 5. Frontend deploy (GitHub Pages)
cd frontend && npm run build → publish frontend/dist
(or push and use an Actions workflow; any static host works)
```

- [ ] **Step 2: Write README.md**

`README.md`: one-paragraph description, architecture diagram (copy from spec), local dev commands (`cd frontend && npm install && npm run dev`), test command (`npm test`), link to SETUP.md and the spec. Include the E2E checklist:

```markdown
## E2E verification checklist
- [ ] Sign in with @oizom.com account → dashboard loads with migrated PRs
- [ ] Non-oizom Google account → rejected with clear error
- [ ] Create PR as requester → appears in sheet PRs tab + Log row written
- [ ] Approve as approver → status chip updates, approverEmail/approvedAt set
- [ ] Requester cannot see Approve button on others' PRs (and API rejects if forced)
- [ ] Ordered → In Transit → Received flow works; receivedAt set
- [ ] Tracking number renders courier link that opens correct tracking page
- [ ] Reports: spend totals match sheet sums; CSV downloads open in Sheets
- [ ] Admin tab: add user as viewer → that user gets read-only UI
- [ ] Repeat sign-in + one write from the DEPLOYED GitHub Pages URL (catches CORS)
- [ ] Poll: edit a cell directly in the sheet → dashboard reflects it within 60s
```

- [ ] **Step 3: Full local verification**

Run: `cd frontend && npx vitest run && npx vite build 2>&1 | tail -2 && for f in ../apps-script/*.gs; do node --check "$f" || exit 1; done && echo ALL-OK`
Expected: tests pass, build OK, `ALL-OK`.

- [ ] **Step 4: Commit**

```bash
git add SETUP.md README.md
git commit -m "docs: deployment guide and E2E verification checklist"
```

---

## Self-Review Notes

- **Spec coverage:** live tracking (Task 8/9 polling + sync chip), PR creation (Task 10), roles (Tasks 5/6/11), all 4 reports + CSV/PDF (Task 11), courier tracking (Task 10), migration (Task 7), auth (Tasks 5/8), error handling (toast + retry-on-next-poll, no optimistic writes), tests (Tasks 2–4). Deployment/user-interactive steps isolated in Task 12's SETUP.md.
- **Known deferred item:** real sheet headers are unknown until `dumpHeaders()` runs (user-interactive). `HEADER_MAP` in migrate.gs is synonym-based and preserves unmapped columns in `notes`, so no data is lost even if mapping is incomplete.
- **Type consistency:** status matrix duplicated in `lib/status.js` and `prs.gs` — Task 6 Step 3 cross-checks them; both use the same state names from Global Constraints.
