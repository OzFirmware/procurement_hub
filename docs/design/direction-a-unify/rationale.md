# Direction A — Unify

**Branch:** `design/ux-overhaul` · **Date:** 2026-07-25 · **Files:** `mockup-desktop.html`, `mockup-mobile.html`

Every substantive proposal below carries an implementation tier:
**CSS** (stylesheet only) · **DOM** (markup inside an existing view) ·
**State** (new client state) · **Backend** (new Apps Script endpoint or sheet column).

---

## Direction

The app already has the right six views, the right nouns and the right routes; what it does not have is one opinion about how any of them should look, because `styles.css` holds two design systems that argue with each other on every screen. Direction A resolves that argument — one palette, one type scale, one card, one table, one button, one focus ring — and then spends the room that discipline buys on the two things the current design is actually dishonest about: it draws a non-linear status model as if it were linear, and it prints totals across four currencies as if they were one number.

Nothing moves. No view is added, removed, split or reordered. The claim is that this could be adopted one view at a time, starting with a token layer that lands everywhere at once, and that the app never looks half-migrated at any point in between.

---

## What it fixes

### The audit's severity-ranked top 10

| # | Finding | Verdict | What Direction A does |
|---|---|---|---|
| 1 | **Line-item grid has no mobile design** (`styles.css:197–203`) | **Fixed** | The nine-column grid becomes one card per item below 700 px. Four fields on the face, three behind one reveal. Both selects get visible labels — the blank-and-`required` `i_materialType` is the specific defect and it is named on screen now. **CSS** for the regrid, **DOM** for the labels and card header. See § Mobile strategy. |
| 2 | **All 14 field hints unreachable on touch; `?` at 1.70:1** (`styles.css:248–253`) | **Fixed** | `.hq::after` (hover-only CSS generated content) is replaced by `<details class="hint">` — a real `<summary>` button that opens the hint inline below the label. Touch works, keyboard works, screen readers read it as text rather than as generated content, and the trigger is `--mut` on `--surface` (5.27:1) with a 44 px tap target via `::after{inset:-12px}`. The hint copy itself is unchanged; it is the best writing in the product. **DOM**, confined to the `lbl()` helper — one function, 14 fields. |
| 3 | **Token expiry reloads the page and destroys the open form** (`state.js:32–35`, `auth.js:13,41–57`) | **Out of scope for design** | This is an authentication defect: there is no refresh loop, and `location.reload()` is called with no `beforeunload` and no draft. No amount of visual design prevents it. Direction A shows a **Save draft** control in the mobile form header — that is a genuine mitigation, but it is **State**-tier (localStorage draft + restore) and it does not fix the underlying token handling. Naming it as an engineering fix is worth more than claiming it. |
| 4 | **Every cold load shows a false empty state** (`main.js:133–137`) | **Out of scope for design** | The cause is render order: `render()` runs synchronously against `prs: []` before `store.refresh()` resolves, and `s.loading` drives exactly one spin class. Gating the render on `s.loading` and splitting the three meanings of "No PRs here yet." into GitLab's taxonomy (blank content / empty search result / error) is the cure, and it is **DOM + State** engineering. **Neither mockup shows an empty or loading state**, so this direction claims nothing here beyond naming the split. |
| 5 | **No search, sort, filter or pagination** (`dashboard.js:75–100`) | **Fixed** | `.filters` is already fully styled at `styles.css:63–64,184` and rendered by no view. Direction A renders it: search, department, status, payment, clear — plus `aria-sort` on the sortable header. This is the cheapest win in the audit; the visual design for it is already paid for. **DOM** to render the bar, **State** if filter selection is to survive navigation or reach the URL (`F-26`). |
| 6 | **A just-created PR renders "not found"** (`prForm.js:297–301`) | **Out of scope for design** | A race: the hash is set before `store.refresh()` resolves. It needs the navigation to await the refetch, or an optimistic insert. Neither is a design decision. |
| 7 | **UI misrepresents the status model in three ways** (`dashboard.js:9,69,128–131,97`) | **Fixed (a) and (c); (b) is engineering** | (a) The inline status control now offers exactly `nextStates()` for the current status and role, so `On Hold` is reachable from the list where the work happens. (c) `paymentStatus` becomes a first-class column with its own visual class — an outlined tag, not a pill — so `Received/Unpaid` and `Received/Paid` can never look identical. (b) The silent fallback from `transition` to a raw `update` when the matrix refuses is a backend-bypass bug; restricting the dropdown to legal moves removes the *path* to it, but the fallback branch itself has to be deleted in code. **DOM** for (a) and (c). |
| 8 | **Courier and tracking unreachable — no screen writes them** (`prDetail.js:98–100`) | **Partially fixed** | The backend has always accepted `courier`, `trackingNo` and `trackingLink` (`prs.gs:12–14`); only the UI was missing. The PR-detail Delivery card in `mockup-desktop.html` renders all three as staff-editable controls wired to the existing `update` action. That closes the loop with **no new endpoint** — **DOM**-tier. The dead `FALLBACK.couriers` / `COURIER_URLS` support code becomes live. What design cannot fix: nothing here — this one is genuinely recoverable at the DOM layer, which is why it is worth doing early. |
| 9 | **Every mutation costs a full refetch and two whole-page rebuilds** (`state.js:16–38`) | **Out of scope for design** | Scroll collapse and focus destruction are properties of `app.innerHTML = …` on every emit. A design can reduce how often a mutation is needed (fewer accidental status changes) but cannot make an `innerHTML` rebuild preserve `document.activeElement`. **State**-tier engineering. |
| 10 | **Accessibility floor is one ARIA attribute app-wide** (`ui.js:18`) | **Mostly fixed** | Both mockups are built to WCAG 2.1 AA: real `<label>` on every control, `<th scope>` and `<caption>` on tables, `aria-sort`, `aria-pressed` on KPI tiles, `aria-expanded` on menus and comboboxes, `role="listbox"/"option"`, `<nav aria-label>`, `aria-current="page"`, a single visible `:focus-visible` ring at 6.48:1, 44 px targets throughout, `prefers-reduced-motion` honoured, and inline SVG replacing the Material Symbols ligature font so screen readers stop reading "shield_person". **DOM**-tier, per view. Two things remain **State**-tier: an `aria-live` region for toasts, and focus restoration after re-render (blocked by finding #9). |

**Score, stated plainly: 6 fixed, 1 partially fixed, 4 out of scope for design.** Findings 3, 4, 6 and 9 are engineering defects — token handling, render order, a create race and the `innerHTML` render model. A redesign that claimed them would be lying, and three of them have to be fixed *before* any State-tier design work is worth attempting.

### Additional findings this direction closes

| ID | Finding | Fix | Tier |
|---|---|---|---|
| F-01 | "New PR" reachable only from the dashboard | Persistent primary action in the page header on every view; docked on mobile | DOM |
| F-12 / R-03 | Dashboard and PR-detail tables overflow the document | `.scroller{overflow-x:auto}` wrapper, same as admin tables already have | CSS |
| F-13 / H-04 | Status column renders a `<select>` for staff and a chip for requesters | The `<select>` *wears* the chip — same visual weight for everyone, control only where permitted | CSS + DOM |
| F-17 | `paymentStatus` absent from the table | Own column, own shape | DOM |
| F-18 | "Total spend" shows one currency and reads as a total | Deleted. Replaced by per-currency readings — see § Mixed currency | DOM |
| F-19 | Tiles use inconsistent denominators | Every tile states its population in its sub-line | DOM |
| F-20 | `fmtCompact` on the dashboard vs `fmtMoney` on detail | Full precision everywhere, tabular figures, right-aligned, lakh grouping for INR | CSS + DOM |
| F-22 | Nothing signals rows are clickable | The ID is a real `<a>` inside `<th scope="row">` — keyboard reachable, visibly a link | DOM |
| F-23 / H-01 | Approver lands on a tab about themselves | "Waiting on you" is the default tile and the default filter for approvers | DOM |
| F-24 / H-02 | Nothing conveys age or priority | Age inside the status pill (`Submitted · 3 d`); priority as a coloured row rail plus a text flag for Critical/High only | CSS + DOM |
| F-33 / R-13 | Submit scrolls off the top | Docked action bar carrying the running total and Submit | CSS + DOM |
| F-35 / C-20 | Remove is solid red once per row; Add item is the quietest control | Remove becomes a ghost icon button; Add item becomes a full-width dashed primary-tinted button | CSS |
| F-36 / H-06 / R-14 | No per-row line total; running total is a muted mid-page span | Line total in every item card header; running total docked | CSS + DOM |
| F-40 / R-09 | Combobox list opens downward behind the soft keyboard | List flips above the input when there is not room below | CSS + DOM |
| F-45 / A-24 / S-16 | No `:invalid` styling anywhere, and errors are not attached to the field that caused them | `:invalid:not(:placeholder-shown)` and `[aria-invalid="true"]` carry a red border plus an inset rule, with the message rendered inline under the control via `aria-describedby`. Demonstrated on item 3 of `mockup-mobile.html` screen 3 — the blank-and-`required` item-type select, which is the exact field the backend rejects on | CSS + DOM |
| F-46 / H-05 | Header fields and item fields are visually identical | Sections carry a `--sunken` header band with an item count; items are cards, not form rows | CSS |
| F-49 / F-50 | Rejection and hold capture no reason | Reason shown on the chip's second line where one exists (see PR-2026-0137 in the desktop table). Capturing it needs a column | **Backend** |
| F-53 | Currency never labelled on PR detail | "EUR — Euro €" as an explicit field | DOM |
| F-54 | No history or audit trail | Timeline on PR detail, built from `createdAt`/`approvedAt`/`poDate`/`receivedAt` already on the record. The full `Log` sheet with before→after diffs needs a route | DOM now, **Backend** for the full log |
| F-56 | "Not found" card picks up the legacy card treatment | There is only one card treatment now | CSS |
| F-58 / T-01 | `.vcard:hover{border-color:var(--disp)}` resolves to near-black | `--disp` is deleted with Space Grotesk, so this line must be rewritten to `var(--border)` rather than merely orphaned | CSS |
| F-08 / A-23 | Material Symbols ligature text renders as literal words on cold load | Inline SVG sprite. Removes a remote font request and the words "delete", "shield_person", "chevron_left" from the accessibility tree | DOM |
| H-09 | The PR ID is the largest element; the decision facts are buried | Purpose becomes the page title, ID becomes a mono eyebrow, amount and vendor sit top-right beside the actions | DOM |
| H-17 | Every view opens with a 32 px title plus static help prose | Title drops to 20 px; the static paragraph is replaced by one line of live context ("Signed in as approver · Saturday 25 July 2026") | CSS + DOM |
| C-13 | "Mark Approved" / "Mark Received" | Domain verbs: **Approve**, **Reject**, **Put on hold**, **Mark received** | DOM |
| T-02 / T-03 / T-04 | Dead rulesets: `form.pr`, `.filters`, `.bar` | `form.pr` deleted; `.filters` rendered; `.bar` deleted with the reports view unbuilt | CSS |
| T-05 | `.chip.In.Transit` works by accidental class splitting | One mechanism only: `data-status` attribute selectors | CSS + DOM |
| T-07 | `@media print` misses seven interactive elements | Print rule keyed to a single `.no-print` class | CSS |
| T-09 | `.pd-form label` forces three separate undo rules | Uppercase micro-label is its own class, never inherited by the control | CSS |
| A-01 – A-05 | Five measured contrast failures | All five re-specified — see § Design tokens | CSS |

---

## Design tokens

The audit is explicit that the existing palette is **mostly compliant** and that a direction should not fix what is not broken (`audit.md` §6.1). So this is not a new palette. It is a set of tiebreaks — which existing value wins each role, which are deleted as duplicates, and the small number that change because they were measured as failures.

Scales (spacing, radius, type steps) follow **Open Props**' published values. Not as a dependency — nothing is installed — but so that "why 12 px and not 14 px" has an answer other than "the admin.html mockup said so".

### Colour — the tiebreaks

**Green.** Five values compete for the primary accent (`audit.md` §2.1). I checked the brand asset rather than arguing from token history: `frontend/public/oizom-logo.png` is a single flat green, **`#47B448`**, hue ≈ 120.6°. `--adm-secondary #006e16` is hue 132°. `--brand #0E7B5B` is hue 163° — a teal, a different hue family from the mark. So the *legacy* token loses on brand fidelity, and it also loses on contrast (5.25:1 vs 6.48:1 on white). This is the one place where the Material-3 block imported from `admin.html` turns out to be right.

| Role | Value | Was | Ratio |
|---|---|---|---|
| `--brand` | `#006E16` | `--adm-secondary`; **deletes** `#0E7B5B`, `#306f37`, `#1e7d3f`, `#3ECF9A` | 6.48:1 on white; white on it 6.48:1 |
| `--brand-tint` | `#DAEDDB` | `--adm-green-bg`; deletes `--brand-soft #E2F2EB` | brand on tint **5.28:1** |

`#306f37` existed only to be legible on `#daeddb` (4.96:1). `--brand` clears the same pair at 5.28:1, so the third green is unnecessary.

**Rule, stated so it is enforceable:** saturated `--brand` as a *fill* is reserved for one primary action per screen, plus the terminal `Received` pill. Every other green in the UI is `--brand` on `--brand-tint`. Without this rule, Approved and Received chips compete with buttons — which is exactly what happens today, where `.btn.primary` and `.adm-addbtn` are both "the primary button" in two different greens on the same screen.

**The five measured failures, re-specified.**

| ID | What failed | Was | Now | Ratio |
|---|---|---|---|---|
| A-01 / T-12 | `.hq` help trigger, white on a border token used as a fill | `#FFF` on `#c3c7cc` — **1.70:1** | `--mut #5E7066` glyph, `--surface` fill, `--border` ring | **5.27:1** |
| A-02 | Every input, select and textarea boundary | `#c3c7cc` on `#fbf9f8` — **1.62:1**, fails WCAG 1.4.11 | `--border #778D82` | **3.55** on surface, **3.29** on page, **3.09** on sunken |
| A-03 | Secondary button border | `--line #DEE7E1` on white — **1.26:1** | `--border #778D82` | **3.55:1** |
| A-04 | `Ordered` / `In Transit` chips | `#B25E09` on `#FBEEDC` — **4.08:1** at 11.5 px bold | `--amber #8A4A05` on `--amber-tint #FBEEDC`; In Transit moves to violet | **6.00:1** |
| A-05 / A-08 / A-10 | Focus indicator: `outline:none` plus a halo compositing to `#d0d3d7` | **1.50:1** | `:focus-visible{outline:2px solid var(--brand);outline-offset:2px}` — one rule, everything, including buttons, tabs, links and pager controls which had none | **6.48 / 6.01:1** |

`--border` is deliberately darker than most teams would draw a form border. 1.4.11 asks 3:1 for control boundaries and this is the value that delivers it on all three surfaces the app puts inputs on. It is the single most visible change in the whole token set.

**The full set.**

```css
:root{
  /* surfaces — 5 near-whites → 3.  --panel and --adm-lowest were byte-identical. */
  --surface:#FFFFFF;   /* was --panel + --adm-lowest                              */
  --bg:#F4F7F5;        /* page. deletes --adm-low #f5f3f3, --adm-surface #fbf9f8  */
  --sunken:#ECF0ED;    /* was --grey-soft. table heads, section bands, inset rows */
  --dark:#0F1F18; --dark-2:#16291F;              /* topbar, unchanged             */
  --on-dark:#FFFFFF; --on-dark-mut:#CFE0D7;      /* 12.44:1 — already passing     */

  /* lines — 2 incompatible tokens → 2 with named, non-overlapping jobs */
  --hairline:#BFCFC6;  /* decorative rules only.       1.62:1 — was --line @1.26  */
  --border:#778D82;    /* every control boundary.  3.55 / 3.29 / 3.09             */

  /* ink — 4 near-blacks → 2 */
  --ink:#14241C;       /* was --ink + --adm-primary #132535.        16.17:1       */
  --mut:#5E7066;       /* was --mut + --adm-on-var #43474c. 5.27 / 4.89 / 4.58    */

  /* semantic hues — one fg/bg pair each, no literals anywhere */
  --brand:#006E16;  --brand-tint:#DAEDDB;   /* 6.48 / 5.28 */
  --blue:#2A5FAA;   --blue-tint:#E4ECF8;    /* 6.33 / 5.32 */
  --amber:#8A4A05;  --amber-tint:#FBEEDC;   /* 6.86 / 6.00 */
  --violet:#5340A0; --violet-tint:#EAE6F7;  /* 8.05 / 6.58 */
  --red:#B3362B;    --red-tint:#FAE6E3;     /* 6.04 / 5.03 */

  /* type — 21 sizes (16 CSS + 5 inline in JS) → 6.  3 faces → 2. */
  --ui: -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
  --num: ui-monospace,SFMono-Regular,"SF Mono","IBM Plex Mono",Menlo,monospace;
  --t-micro:11px; --t-sm:12px; --t-base:14px; --t-md:16px; --t-lg:20px; --t-xl:28px;

  /* space — 35 distinct paddings → a 4px base, 6 steps (Open Props) */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px;

  /* radius — 11 values → 3 */
  --r1:6px;    /* controls, buttons, payment tags, hint bubbles */
  --r2:10px;   /* cards, panels, popovers                       */
  --rf:999px;  /* status pills, avatars, icon buttons           */

  /* elevation — 6 shadows on 3 rgba bases → 2 on one base */
  --e1:0 1px 2px rgba(20,36,28,.06),0 1px 3px rgba(20,36,28,.05);  /* resting card */
  --e2:0 10px 28px -10px rgba(20,36,28,.28);                        /* popover, dock */

  /* motion — 4 durations + one transition:all → 1 duration, named properties */
  --dur:140ms; --ease:cubic-bezier(.2,0,0,1);
}
```

**Deleted outright:** `--adm-primary`, `--adm-secondary`, `--adm-on-var`, `--adm-outline`, `--adm-low`, `--adm-lowest`, `--adm-surface`, `--adm-green`, `--adm-green-bg`, `--adm-error`, `--adm-error-bg`, `--brand-soft`, `--line`, `--grey-soft`, `--red-soft`, `--amber-soft`, `--blue-soft`, `--disp`, `--body`. Nineteen custom properties removed; the two-system problem is a naming problem as much as a colour one, and `--adm-*` as a prefix guaranteed the two would never merge.

**Also deleted:** the four hardcoded alphas (`rgba(48,111,55,.2)`, `rgba(48,111,55,.3)`, `rgba(195,199,204,.5)` — which is literally `--adm-outline` at 50% — and `rgba(255,218,214,.2)`), and `#5c6f7e`, the chevron stroke colour duplicated verbatim inside three URL-encoded SVG data-URIs. The chevron is one data-URI now, stroked `--mut`, so changing it is one edit rather than three.

### Type

Two faces, and the split carries meaning rather than decoration: **`--ui` for prose, `--num` for anything measured.** IDs, money, quantities, dates, tracking numbers and line totals all take the mono face with `font-variant-numeric: tabular-nums`, so a column of amounts aligns on the decimal and can be checked by eye. That is the whole typographic idea, and it comes from what Oizom builds — instruments whose readings are only useful if the unit is stated and the digits line up.

**Space Grotesk is retired.** `audit.md` §2.4 records that the display face is already effectively abandoned: `.card h2` sets it and `.dash .card>h2` overrides it back to Inter, no `<h1>` in the app uses it, and it survives on four selectors. Keeping a display face that the app overrides everywhere is the two-system problem in miniature. Retiring it also removes the last consumer of `--disp` — which is what makes `styles.css:208` fixable rather than merely orphaned.

Six sizes, all whole pixels. The half-pixel steps in the current file (11.5, 12.5, 13.5) are the signature of a scale nudged by eye; 13 / 14 / 15 / 16 / 17 all being in use as distinct sizes is the same tell.

| Token | Size / line | Weight | Used for |
|---|---|---|---|
| `--t-micro` | 11 / 1.1, `.06em`, uppercase | 600–700 | column heads, field micro-labels, currency codes, priority flags |
| `--t-sm` | 12 / 1.45 | 400–600 | secondary lines, help text, table sub-lines, chips on mobile |
| `--t-base` | 14 / 1.45 | 400–600 | body, table cells, controls (**16 px on mobile inputs** — below that iOS zooms on focus) |
| `--t-md` | 16 / 1.35 | 600 | card headings |
| `--t-lg` | 20 / 1.25 | 600 | page title — down from 32 px, which consumed a disproportionate share of a 360 px first viewport across five views (`R-05`) |
| `--t-xl` | 28 / 1.1, `-.02em` | 600 | KPI numerals and the PR-detail amount only — the two numbers a screen exists to deliver |

**Five near-identical uppercase micro-labels become one class.** `.tbl th`, `.adm-tbl th`, `.adm-sec`, `.vc-l` and `.ithead span` differ only in whether they express letter-spacing as `.04em` or `.4px` at 10 px — the same value in two units.

### The status system

This is the part of the token set that is a design argument rather than a merge, so it is stated as rules.

**Two axes, two shapes.** A filled **pill** is a workflow status. An outlined **square tag** is a payment status. They are different geometries, so they can never be read as points on one scale. This is the cheapest possible expression of Shopify's finding that an order-like object has independent tracks — and Oizom's `Unpaid / Paid / Partially Paid / FOC · Free` is a genuine second axis, not a stage.

**Fill encodes terminality.** A tinted pill is a live state you can still move. A **solid** pill is terminal — `Received` and `Cancelled`, the two states the transition matrix has no exits from. That single rule makes the graph legible at a glance and is why `Approved` (tint) and `Received` (solid) can share a hue without being confusable — which is the exact failure `audit.md` §2.1 records today, where both are `--brand-soft`/`--brand`.

**Colour never works alone.** Every pill carries an icon and a text label. Polaris names colour-alone as the don't; the current chips are colour-only and two pairs of them duplicate.

| Status | Treatment | Colour | Glyph | Why |
|---|---|---|---|---|
| Submitted | tint | blue | clock | waiting on a person |
| Approved | tint | brand | check | decided, not yet bought |
| Ordered | tint | amber | document | PO placed, nothing moving yet |
| In Transit | tint | **violet** | truck | the only state with an ETA. Violet is the one new hue in the whole system and it exists solely to break the `Ordered`/`In Transit` collision the brief names |
| Received | **solid** | brand on white text | check-in-circle | terminal, good outcome |
| Cancelled | **solid** | mut on white text | slashed circle | terminal, inert |
| Rejected | tint | red | cross | **recoverable** — `Rejected → Submitted` is a legal transition, so it must not look terminal |
| On Hold | tint + 3 px amber inset rail | mut on sunken | pause | a pause laid over whatever stage the PR was in. Neutral because it is not a stage; railed because it needs attention |

`On Hold` also renders a second line — `held from Approved · no reason recorded`. That is the honest representation of a state the matrix lets you enter from four places and exit to four others. **Storing** which stage it was held from, and why, needs two columns (`heldFrom`, `holdReason`) — **Backend**-tier, and the same column pays for the rejection reason (`F-49`). Until then the second line is derived where it can be and says "no reason recorded" where it cannot, which is at least true.

*A note on completeness.* Both mockups ship the full eight-status and four-payment vocabulary in CSS even though no single screen renders all twelve — `mockup-mobile.html` shows five requests, so `Approved`, `Rejected`, `Cancelled` and `FOC / Free` are declared and unused there. That is deliberate, and it is a different thing from the dead rulesets this direction deletes: `.filters` (`T-03`) and `.bar` (`T-04`) are whole components no view renders, whereas a status palette is an enumerated vocabulary that is only correct when it is complete. Every other unused rule was removed from both files.

**Age is part of the status.** `Submitted · 3 d`, `On Hold · 6 d`, `Ordered · 9 d`. `aging()` exists in `reports.js`, is unit-tested, and is imported by nothing. A bare chip is a fact; a chip with a duration is a signal. **CSS + DOM.**

### Mixed currency

`sample-data.md` is blunt: any KPI that sums across currencies is wrong unless it states a conversion basis. The app has no exchange rate and no place to put one, so Direction A does not print a converted number — and it does not print an unconverted one that reads like a total either, which is what `dashboard.js:53` does today by showing `spendTotals[0]` as the headline with everything else demoted to `+ …`.

The replacement:

1. **KPI tiles are counts only.** Counts across currencies are commensurable; money is not. Five tiles — Waiting on you, Open, On hold, In transit, Received in July — and **every tile states its population in its sub-line** ("excludes received, rejected, cancelled"; "1–25 Jul, all departments"). That is the fix for `F-19`, where `receivedPct` divides by all PRs and `spendTotals` does not, with nothing on screen saying so.
2. **Money lives in its own panel, as one reading per currency.** `₹3,47,900.00 / 3 requests`, `€4,820.00 / 1 request`, `$2,310.00 / 1 request` — plus a muted `GBP — no open requests`, because the fourth currency's absence from the open set is itself information. Tabular figures, right-aligned, INR in lakh grouping.
3. **The panel says what it is not.** "Four currencies are in play this month. These are four separate readings, not one number — the tool holds no exchange rate, so it will not print a figure it cannot stand behind."

No chart. Four categories over eight records carries nothing a two-column list does not, and a stacked bar of counts would be decoration standing in for a number the design has just refused to give.

If the business genuinely needs a single figure, that is a **Backend** change: a rate table on the sheet, a rate date stamped on every PR, and a headline that reads `≈ ₹52.4L at 25 Jul RBI reference`. That is a finance decision about which rate and as-of when, not a design decision, and it should not be smuggled in behind a chart.

---

## Mobile strategy

`BRIEF.md` §4 names line-item entry on a phone as the sharpest unsolved problem, and it rules out a responsive reflow as an answer. `market.md` §3 establishes why: every product that ships this well — Shopify draft orders, FreshBooks, Stripe invoices — pushes a dedicated per-item screen, and every one of them can afford to because it autosaves a draft first. Oizom cannot navigate mid-form: `main.js` rebuilds views from `innerHTML`, and there is an explicit guard at `main.js:112` that exempts the PR form from re-render precisely because a rebuild would wipe it.

So Direction A takes the lane `market.md` leaves open for it — **the architecture-compatible approximation of the pushed screen, not the pushed screen itself** — and does it properly rather than apologetically. The pushed screen is Direction C's, and only if C buys draft persistence first.

### The shape

**One card per item, not a reflowed row.** Below 700 px the nine-column grid is discarded and each `.itemrow` becomes an `<article>`. Card header carries the item number, the **live line total**, and a ghost delete icon. The face carries four fields, single column, labels above:

| Face | Control | Why it is on the face |
|---|---|---|
| Description | text | required, and the thing that identifies the row |
| Item type | `<select>` | required, and today it renders **blank** with no label, no placeholder and no reachable hint — a mandatory dropdown the user cannot identify. This is the single worst defect in the audit |
| Quantity + unit | **one composite control** | required. Baymard is explicit that splitting a single value across two mobile fields causes navigation and required-ness confusion; qty × unit is exactly such a pair, so it is one bordered group with a right-aligned numeric input and a unit picker sharing the border |
| Unit price | numeric with an inline currency symbol | drives the line total, and a pricing error on row 3 of 6 is currently invisible |

**One reveal, and only one.** `<details class="more">` holds purchase link, datasheet and — for Production only — the Zoho part number. Four required-ish fields on the face, three optional behind one disclosure. That is Stripe's two-tier split, and it stays inside NN/g's hard ceiling of two disclosure levels: page → card face is level one, the reveal is level two, and there is no third. **The item cards are deliberately not collapsible.** An accordion on top of the reveal would be the third level, and Baymard's accordion research is specific that reopening completed steps to verify data is "particularly problematic on mobile".

The `<summary>` is not bare. It reads **"More details · 2 of 3 filled"**, so the collapsed tier is verifiable without opening it — which is Baymard's requirement of any collapsed summary.

**Native `<details>` is doing real work here.** Every input stays in the DOM whether the reveal is open or shut, so `collectItems()` (`prForm.js:69–77`), which queries `[name=…]` regardless of visibility, needs **no change at all**. No conditional mounting, no new state, and the `main.js:112` re-render guard is untouched. Zero JavaScript.

**The total is docked.** A fixed bottom bar carries `3 items · €4,820.00` and the Submit button. Today the running total is a muted `<span>` beside "+ Add item" in the middle of the document, and Submit lives in a non-sticky header that is off-screen after three items on a phone. Docking fixes `F-33`, `F-36`, `H-06`, `H-07`, `R-13` and `R-14` with one element. It is justified by Baymard's finding that users continuously reference running-summary information, not by a thumb-reach argument.

**Delete is quiet; duplicate is loud.** The current remove button is `.btn danger` — solid red, one per row, occupying half a grid cell at mobile width. On a five-item PR the five loudest elements on screen are all destructive, competing with a single Submit. Here delete is a 44 px ghost icon button in the card header, and the wide button in the card footer is **Duplicate**. No researched product ships per-line duplication on mobile, and real Oizom items are near-identical — same type, same unit, same supplier, different part number — so copying eight values in one tap is worth more here than in any of the reference products. **DOM + ~10 lines**, no new state model.

**Swipe-to-delete is not proposed.** NN/g: lack of signifiers makes it unclear where a contextual swipe applies, and burying an action behind it prevents discovery. The visible icon is the answer; swipe would only ever be an accelerator, and it needs undo, which is State-tier.

### The keyboard, which is half the screen

Screen 4 of `mockup-mobile.html` exists because this is the failure that only shows up on a real device. `.curList` is absolutely positioned below its input with `max-height:230px` and no upward flip, so a combobox in the lower half of the form opens its options behind the raised keyboard. The fix is a flip: the list renders above the input when there is not room below, with 44 px options and `role="listbox"`/`role="option"` so it is a combobox to assistive technology rather than an `<input>` beside a `<div>` of `<div>`s.

Two related fixes ride along. `input.onfocus` calls `input.select()`, so tapping a filled Vendor field selects its whole contents and the first keystroke erases the committed value — that goes. And the blur-commit that silently snaps unrecognised text back to the last value after 120 ms is replaced by keeping what was typed and marking the field `aria-invalid` with a message naming the cause, because "no match" today is also what a requester sees when their department has **no vendors mapped at all**.

### The rest of mobile

Inputs are **16 px** on mobile — below that, iOS zooms the viewport on focus and the user has to pinch back out. Every interactive target clears 44 px, including the help trigger, which is a 20 px circle with an invisible `::after{inset:-12px}` expanding the hit area. `type="url"` with `autocapitalize="off"` and `autocorrect="off"` on both link fields; `inputmode="decimal"` on quantity and price. The dashboard table becomes a card stack rather than a sideways scroll. The topbar gains `overflow-x:auto` on its nav, which is the whole of `R-01`.

---

## Stack implications

**Nothing new is required.** No framework, no CSS framework, no component library, no build-step change, no runtime dependency. The mockups are single files with inline CSS and no network requests, which is the same constraint the app itself runs under. This is the direction's main argument, so it would be self-defeating to spend it on a dependency.

Three things are worth naming explicitly.

**1. Open Props is cited, not installed.** The spacing, radius and type scales take Open Props' published values so that the answer to "why 12 px" is an external published scale rather than a mockup. `market.md` §6 recommends exactly this — a token library rather than a component library — for a codebase whose core debt is two competing token sets. **Copy the numbers; add no dependency.**

**2. Material Symbols should go.** It is a remote ligature font (`index.html:9`). Until it loads, users read the literal words *refresh, notifications, delete, add, person_add, storefront, category, shield_person, chevron_left, chevron_right, close, check_circle, error* as body text — seconds of visibly broken UI on a cold mobile connection — and screen readers read them permanently. Replacing it with an inline SVG `<defs>` sprite (both mockups carry the full set, ~2 KB) removes a third-party request, removes the flash, and removes the words from the accessibility tree. **DOM**-tier, one edit per icon call site, and it can be done view by view because the two mechanisms coexist harmlessly.

**3. Two new sheet columns are requested, and only two.** `holdReason` and `rejectionReason` — or one `statusReason` column written on every transition, which is cheaper. `sample-data.md` treats the rejection reason as essential content ("Use existing booth hardware from last cycle. Resubmit only for the LED panel."), and `F-49`/`F-50` record that neither is captured anywhere. A third would be nice — `heldFrom`, the stage a PR was paused over — but it is derivable from the `Log` sheet the backend already writes, so it should be a read, not a write. **Backend**-tier, and it is the only backend ask in this direction.

Two things are deliberately **not** asked for: an exchange-rate table (a finance decision, see § Mixed currency) and an audit-log route (worth doing, but it is `F-54`'s cure and it belongs to whoever prices the `Log` sheet, not to a redesign).

### Where the CSS lands

Current `styles.css` is 264 lines. The token layer plus the unified component rules replace roughly lines 1–95 and 96–204 wholesale; the estimate is a **net reduction**, because the merge deletes 19 custom properties, three duplicate component treatments (card, KPI, table), the `form.pr` and `.bar` dead rulesets, and the three duplicated chevron data-URIs. The additions are the status/payment system, the mobile item card block, and one `:focus-visible` rule that replaces three `:focus` rules that each set `outline:none`.

### Tier summary

| Tier | Share of the proposals | Examples |
|---|---|---|
| **CSS** | ~40% | the entire token merge, card/table/button/KPI unification, all five contrast fixes, the focus ring, `overflow-x` wrappers, the mobile item-card regrid, dock styling, `:invalid` states, print rule, `prefers-reduced-motion` |
| **DOM** | ~45% | item-card labels and header, `<details>` hints, `<details>` reveal, status control restricted to `nextStates()`, payment column, age and priority, filter bar render, courier inputs, PR-detail timeline and header re-rank, SVG sprite, verb changes |
| **State** | ~10% | draft persistence, filter state in the URL, `aria-live` toasts, focus restoration, undo |
| **Backend** | ~5% | `statusReason` column; audit-log route if `F-54` is wanted in full |

Read that as: **roughly 85% of this direction is stylesheet-and-template work with no new client state.** That is the adoptability claim, stated as a number.

---

## Risks

**The `<select>` wearing a chip is the most load-bearing idea and the most likely to be argued with.** It works by overlaying a transparent, full-size native `<select>` on a styled span, which keeps every keyboard and screen-reader behaviour for free and needs no custom key handling — but it means the option list renders in the platform's own style, not the chip's. On desktop this is fine and arguably correct. On Android the list can be a full-screen dialog. It is worth a device check before it ships, and the fallback is unglamorous but safe: an explicit "Change status" button opening the same native select.

**`--border` at `#778D82` is visually heavier than anyone expects.** It is the value 1.4.11 requires for a control boundary across all three surfaces the app uses, and it is the change most likely to be described as "too dark" on first sight. The honest framing: the current border fails at 1.62:1 and the app has never had a compliant one, so this looks like a change rather than a fix. If it is rejected, the compliant alternative is a filled input (`--sunken`) whose *fill* carries the boundary, not a lighter border.

**Retiring Space Grotesk is a brand conversation, not a CSS one.** The audit's evidence is strong — the app overrides the display face back to Inter inside `.dash`, and no `<h1>` uses it — but "we removed the brand typeface" is a sentence that needs the product owner in the room. It is also the least entangled decision here: `--disp` has four consumers, and `styles.css:208` has to be rewritten either way.

**Violet for In Transit is the one new hue in the system, and it is the weakest-argued token.** Everything else is a merge of values already in the file. Violet exists solely because the brief asks for Ordered and In Transit to stop sharing amber, and there is no procurement-domain reason for it to be violet specifically. If it reads as out of family, the fallback is amber for both with the icon and label carrying the difference — which Polaris would accept, since colour is not working alone — and the brief's complaint would then be answered by the icons rather than by the hue.

**`heldFrom` on the On Hold chip is currently a promise.** The mockup shows "held from Approved · no reason recorded". Deriving the prior stage is possible from the `Log` sheet but not from the PR record, so until that read exists the chip either shows a second line it cannot always fill, or shows nothing. The design degrades to "On Hold · 6 d" alone, which is still better than today, but the second line should not be drawn in a spec review as if it were free.

**Docking the total on mobile costs vertical space permanently.** Roughly 62 px of a 844 px viewport, on the screen where the soft keyboard already takes half. The trade is deliberate — a running total the user never sees is worth less than the space it saves — but it is a trade, and it will feel tight on a 667 px device.

**The card-stack does not scale to a 20-item PR.** Oizom's typical request is one to five lines, and `market.md` is explicit that the CSV-import paths in Procurify and Precoro exist because those products routinely see 50–75. If Oizom's volume ever changes, the card stack becomes a long scroll with no jump-to-item and no collapse — and the collapse is exactly what this design refused, on disclosure-depth grounds. That refusal is correct at five items and wrong at twenty.

**Full-precision amounts widen the table.** `fmtCompact` exists because `₹1.2L` is narrower than `₹1,84,500.00`. Replacing it fixes `F-20` — today `₹98,000` and `₹1.2L` sit in the same column and cannot be compared — but it costs roughly 60 px of column width, and long vendor names plus long descriptions are the realistic case, not the exception. The `overflow-x` wrapper absorbs it; a reviewer who expected the table to get narrower will be surprised.

**Nothing here was tested on a device, in a browser, or with a screen reader.** Contrast ratios are computed from the declared values and are reliable. Everything about the keyboard, the flipped combobox, the native select-in-chip, and the 44 px targets is designed against documented behaviour and reasoning, not observed. The single highest-value hour before implementation is opening `mockup-mobile.html` on an actual Android phone.
---

## Adoption path

This is Direction A's distinctive claim, so it is stated as an ordered sequence with a stopping point after every step. Each step ships on its own, is an improvement on its own, and leaves nothing looking half-migrated — because the sequence is built around one structural fact about the current code: **every view wraps its content in `.dash` or `.adm`**, so the base `.card` / `.kpi` / `.tbl` rules are dead weight in normal operation and surface only in loading and error states. That is what makes a token-first migration safe.

### Step 0 — the token layer, alone

Replace the `:root` blocks with the unified set and rewrite the component rules to reference it. **No markup changes anywhere.** Because both systems' selectors already exist and every view is inside `.dash` or `.adm`, redefining what those selectors resolve to lands on all six views in one commit.

*Buys:* one green, one card, one table padding scale, one button, one focus ring. All five measured contrast failures gone. `styles.css:208` fixed rather than orphaned. The legacy `.card`/`.kpi`/`.tbl` treatments — which today appear *only* when something has gone wrong, so the user sees an inconsistency exactly when they are least able to absorb one — stop diverging.
*Tier:* **CSS**. *Risk:* lowest in the sequence. *Revert:* one file.

### Step 1 — the icon sprite

Swap the Material Symbols ligature font for the inline SVG `<defs>` block. The two mechanisms coexist, so this can be done one call site at a time and stopped at any point.

*Buys:* no remote font request, no flash of literal words on cold load, thirteen strings out of the accessibility tree.
*Tier:* **DOM**. *Revert:* per call site.

### Step 2 — the dashboard

The highest-traffic view and the one carrying the most top-10 findings. Render `.filters`. Add the payment column, age, priority and the `overflow-x` wrapper. Restrict the status control to `nextStates()` and dress it as the chip it replaces. Rewrite the KPI tiles as counts with stated populations, and replace the spend tile with the per-currency panel. Default approvers to "Waiting on you".

*Buys:* top-10 **#5** and **#7 (a) and (c)** outright; `F-12`, `F-13`, `F-16`, `F-17`, `F-18`, `F-19`, `F-20`, `F-22`, `F-23`, `F-24`, `H-01`, `H-02`, `H-04`. The single largest jump in the sequence.
*Tier:* **DOM**, plus **State** only if filter selection is to reach the URL. *Revert:* one view file.

### Step 3 — the PR form on mobile

The item-card regrid, real labels on both selects, the `<details>` hint, the `<details>` reveal, the composite qty+unit control, the docked total, duplicate, and the combobox flip.

*Buys:* top-10 **#1** and **#2** — the two findings the brief cares most about, and the only two rated critical that a design can actually reach.
*Tier:* **CSS** for the regrid and dock, **DOM** for everything else, all of it inside `itemRowHtml()` and `lbl()` — two functions. *Revert:* one view file.

Deliberately **after** the dashboard, not before, despite being the sharper problem: the form is the one view exempted from the re-render loop (`main.js:112`), so it is the view where a mistake is hardest to observe in staging. Landing the token layer and one straightforward view first means that when the form changes, the only new variable is the form.

### Step 4 — PR detail

Re-rank the header (purpose as title, ID as eyebrow, amount and actions above the fold), add the timeline, add the courier and tracking inputs, label the currency, move Notes out of the Delivery card, differentiate the status actions by likelihood, and rename the verbs.

*Buys:* top-10 **#8** closed at the DOM layer with no new endpoint. `F-48`, `F-52`, `F-53`, `F-54` (partial), `F-57`, `H-09`, `H-10`, `H-11`, `C-13`.
*Tier:* **DOM**. *Revert:* one view file.

### Step 5 — vendors, then admin

Lowest traffic, lowest risk, and by this point they are already consistent because Step 0 restyled them. What remains is markup: labels in `admin.js` (which contains zero `<label>` elements), the fake pager, the mis-stated "Remove user" copy, the vendor card stat hierarchy, and `.adm-tabs` overflow.

*Buys:* the remainder of top-10 **#10**; `F-59`, `F-61`, `F-67`, `F-69`, `F-71`, `F-72`, `R-02`, `R-04`, `A-16`.
*Tier:* **DOM**.

### Then stop, and let engineering price the rest

Findings **#3** (token expiry), **#6** (create race) and **#9** (render model) are not on this path because no step of it fixes them. They should be priced separately, and the honest sequencing argument is that **#9 should be fixed before any State-tier design work is attempted** — draft persistence, undo, `aria-live` toasts and focus restoration all sit downstream of a render model that destroys `document.activeElement` on every emit.

