# Direction B — Bento

**Branch:** `design/ux-overhaul` · **Date:** 2026-07-25 · **Deliverables:**
`mockup-desktop.html`, `mockup-mobile.html`, this file.

Tier labels used throughout, so the dev-feasibility review can price each line:

| Tier | Meaning |
|---|---|
| **CSS-tier** | `styles.css` only. No markup, no logic. |
| **DOM-tier** | Markup or template change inside an existing view function. |
| **State-tier** | Needs client state that survives a re-render — drafts, autosave, routing, optimistic writes. |
| **Backend-tier** | Needs a new Apps Script endpoint or a new sheet column. |

---

## Direction

The information does not change; the **arrangement** does. Every screen becomes a
modular grid in which a block's size is a function of how much it can be acted on,
so a three-second glance answers "what needs me now" before anyone reads a word.

Its point of view is that the tool's real failure is not ugliness but **flatness** —
six equal tiles above one monolithic table, where a PR that has been stuck for six
days looks exactly like one that arrived this morning. Direction B makes the layout
itself carry the signal.

---

## What it fixes

### The audit's top 10, honestly

| # | Finding | Verdict | Tier to build | What Direction B actually does |
|---|---|---|---|---|
| 1 | Line-item grid has no mobile design | **Fixed** | DOM-tier | Card stack, not a reflowed row. Every field carries a visible top label — including the two anonymous `<select>`s. Qty and unit become one composite control. Four optional fields sit behind one `<details>` disclosure; nothing else is hidden. See `mockup-mobile.html`, frames 2 and 3. |
| 2 | All 14 field hints unreachable on touch | **Fixed** | DOM-tier | `.hq::after` hover tooltip → `<details class="hint">` with a 22px `?` summary. Tappable, keyboard-focusable, no JS, no positioning maths, no edge-anchoring guesswork. The trigger is `--ink-2` on `--block` at 8.05:1, up from 1.70:1. |
| 3 | Token expiry silently reloads and destroys the form | **Partially fixed — mostly engineering** | State-tier (+ auth work) | A redesign cannot stop a token expiring. Design contributes only the two visible pieces: a persistent "Draft saved 12 seconds ago" line under the item stack, and a re-authentication banner instead of `location.reload()`. The refresh loop, the draft store and the `beforeunload` guard are engineering, and this direction does not claim them. |
| 4 | Every cold load shows a false empty state | **Fixed** | DOM-tier | The bento's structural advantage: a block is small enough to state its own condition. Every block type ships a loading, empty and error variant, so "we have not loaded yet", "you have none" and "the fetch failed" stop sharing one string. `s.loading` already exists and is already emitted. |
| 5 | No search, sort, filter or pagination | **Partially fixed** | DOM-tier (chips + search over loaded data) · State-tier (URL-reflected filters) · Backend-tier (real pagination) | Filter chips carry live counts and sit inside the ledger block; a search field lives in the rail. All of it operates on the already-fetched array, which is honest at 8–200 PRs and dishonest at 2,000. Pagination is not designed here because it needs a paged endpoint. |
| 6 | A just-created PR renders "not found" | **Out of scope for design** | — | An ordering defect: the hash is set before `store.refresh()` resolves. No arrangement of pixels fixes it. |
| 7 | UI misrepresents the status model, three ways | **(a) and (c) fixed · (b) out of scope** | CSS-tier + DOM-tier | (c) `paymentStatus` becomes a first-class column on the dashboard and a labelled event class in the detail timeline. (a) the approver's status control is generated from the transition matrix, so `On Hold` is reachable from the list. (b) the admin dropdown silently falling back to a raw field write is a code defect; a redesign cannot fix a bypass it cannot see. |
| 8 | Courier and tracking are unreachable | **Out of scope for design** | Backend-tier / engineering | The fields are backend-editable and rendered but no screen writes them. The detail mockup shows the block where they belong and says so on the block. That is the honest limit. |
| 9 | Every mutation costs a full refetch and two full rebuilds | **Out of scope for design** | State-tier | This is the render model, not the layout. Direction B makes the damage smaller — blocks are independent enough to re-render one at a time — but the `innerHTML` rebuild, the scroll collapse and the focus destruction are engineering. |
| 10 | Accessibility floor is at zero | **Fixed** | DOM-tier + CSS-tier | Rows are `<a>` not click-handled `<tr>`; tiles and cards are links or buttons; every input has a real `<label>`; `aria-invalid` + `aria-describedby` on errors; `role="tablist"` with arrow-key handling; one `:focus-visible` rule with `outline-offset`, applied everywhere; a skip link; 44px touch floor. No block sets `overflow:hidden`, which is how dense card grids usually clip their own focus rings. |

**Scoreboard:** 6 fixed, 2 partially fixed, 3 out of scope for design (one of them
counted twice because finding 7 splits). Three of the ten are engineering defects and
saying so is more useful than claiming them.

### Beyond the top 10

Each of these is a deliberate design decision, not a side effect.

| Finding | What changes | Tier |
|---|---|---|
| F-01 New PR reachable only from the dashboard | "New PR" is a primary control in the rail on desktop and the centre of the bottom bar on mobile | DOM-tier |
| F-17 Payment invisible in the table | Its own column, its own encoding channel | DOM-tier |
| F-18 "Total spend" shows one currency and reads as a total | Replaced by a per-currency small multiple that never sums | DOM-tier |
| F-19 Tiles use inconsistent denominators | Every aggregating block states its population **on the block face** | DOM-tier |
| F-20 `fmtCompact` and `fmtMoney` mix in one column | One money format everywhere: full value, mono, tabular, right-aligned | CSS-tier + DOM-tier |
| F-22 Rows are click-handled `<tr>`s with no affordance | Rows contain a real link on the ID | DOM-tier |
| F-24 Nothing conveys age | Every status chip carries time-in-state; the focus block sorts by it | DOM-tier |
| F-30/F-31 Department invisible but scopes three lists | Stated as a fact at the top of the form, with a hint explaining what it controls | DOM-tier |
| F-29 Empty dropdowns are silent dead ends | The empty case is a written explanation with an action, not a blank required select | DOM-tier |
| F-33/R-13 Submit scrolls off | Sticky bottom bar carrying item count, running total and Submit | CSS-tier |
| F-35 Five solid-red remove buttons | Icon button on a hairline, paired with Duplicate | CSS-tier + DOM-tier |
| F-36 No per-row line total | Every item card carries `qty × price = total` on its face, always visible | DOM-tier |
| F-45 No `:invalid` styling; errors arrive as toasts | Errors render on the control with `aria-invalid`, and the submit bar names the offending card | DOM-tier |
| F-48 Undifferentiated "Mark X" buttons | The expected next step is the primary button; exceptions are secondary | DOM-tier |
| F-49/F-50 Rejection and hold capture no reason | Both are required text on the transition; "held 6 days, no reason recorded" is shown as a defect until filled | Backend-tier (new column) |
| F-52 Notes filed under Delivery | Notes sit with the request | DOM-tier |
| F-53 Currency never labelled | The money block names the ISO code and the currency in words | DOM-tier |
| F-54 No history despite a full `Log` sheet | The detail focus block is latest-update-first with a reverse-chronological history below | Backend-tier (expose `Log`) |
| F-55 Delete card is the visual terminus | Demoted to a half-width recessed block with type-to-confirm | CSS-tier + DOM-tier |
| F-58 `.vcard:hover` snaps the border near-black | `--disp` is never used as a colour; hover is a surface change | CSS-tier |
| F-59 No vendor filter | Search plus three filter chips | DOM-tier |
| F-61 Four vendor stats of equal weight | Block size and content follow outstanding exposure | DOM-tier |
| F-62/F-87 Vendor spend shows one currency, or ₹0 for a USD vendor | Same small-multiple component as the dashboard | DOM-tier |
| A-01/A-02/A-03/A-04 Contrast failures | All measured and cleared — see Design tokens | CSS-tier |
| R-10 No touch-target sizing | 44px floor, enforced by a `--tap` token | CSS-tier |
| T-02/T-03/T-04 Dead CSS | `form.pr`, `.filters` and `.bar` are deleted; the filter bar is rebuilt as chips that actually render | CSS-tier |

### The two problems the brief singled out

**Status honesty.** There is no stepper anywhere in this direction, and no five-segment
track either. A linear track is a stepper wearing a different name: the test is whether
the primitive can render `On Hold`, `Rejected` and `Cancelled` without a special-case
replacement, and a track cannot — it needs three. IBM Carbon rules out a progress
indicator when a process "may be completed in any order", and Oizom's matrix permits
`On Hold → Submitted | Approved | Ordered | Cancelled`.

So the status axis is a **chip: hue + icon + word + age**, where hue encodes *kind* and
the icon and word encode *identity*:

| Kind | Hue | Statuses | Reading |
|---|---|---|---|
| Waiting | amber | Submitted | a person owes a decision |
| Moving | blue | Approved · Ordered · In Transit | the system owns it; no action needed |
| Done | green | Received | finished |
| Stopped | red | On Hold · Rejected | needs intervention, and both are recoverable |
| Closed | slate | Cancelled | terminal, no action |

All eight statuses are first-class. None is "on-path" and none is a detour. Colour is
never load-bearing alone, which is also the only way to make this pass a colourblindness
check — a red/green pair is indistinguishable under deuteranopia at any lightness, so the
icon and the word carry it. **CSS-tier for the palette, DOM-tier for the icons.**

**The payment axis uses a different encoding channel entirely.** Not a different hue —
a different *variable*: fill. Unpaid is a hollow ring, Partially Paid is half-filled, Paid
is a solid disc, FOC is a dashed slashed ring, and all four are drawn in ink. Status can
never borrow a fill state; payment can never borrow a status hue. Two independent
variables, two independent channels — this is the single idea in Direction B I would
defend hardest. **CSS-tier + DOM-tier.**

**Mixed currency.** No block sums across currencies, anywhere. "Committed, by currency"
is a small multiple: one row per currency, the amount in mono tabular figures, and a bar
whose length encodes **PR count** — the only quantity that is genuinely comparable across
INR, USD, EUR and GBP. The block footer states its population ("7 PRs — every Open or
Received request; excludes PR-2026-0137, Rejected") and states the absence: "amounts are
never summed or converted". An "≈ INR equivalent" control is drawn **disabled**, with the
reason on the page, because no rate or rate date is stored against a PR. Promising it
would be Backend-tier; showing where it would go is free. **DOM-tier.**

---

## Design tokens

Every value below is measured, not chosen by eye. Ratios are WCAG contrast, computed
from the hex pairs actually used.

### Colour

**Plane and ink**

| Token | Value | Role | Measured |
|---|---|---|---|
| `--deck` | `#EDF1EE` | page plane | — |
| `--block` | `#FFFFFF` | block surface | — |
| `--sunk` | `#F7FAF8` | recessed field / sub-surface | — |
| `--rail` | `#0F1C17` | dark instrument rail | — |
| `--ink` | `#0F1C17` | primary text | **17.52:1** on block |
| `--ink-2` | `#43544B` | secondary text | **8.05:1** |
| `--ink-3` | `#63756B` | muted — the floor for any text | **4.90:1** |
| `--on-rail` | `#D8E4DE` | text on rail | **13.41:1** |
| `--on-rail-2` | `#93A69C` | muted on rail | **6.82:1** |

**Structure — the rule that fixes A-02 and A-03**

Two border tokens with non-overlapping jobs. `--rule: #D5DFD9` is **decorative only**
(1.36:1 — it may separate, it may never bound a control). `--edge: #748A80` is the
**interactive boundary** and clears WCAG 1.4.11 on all three surfaces: **3.69:1** on
`--block`, **3.51:1** on `--sunk`, **3.24:1** on `--deck`. Today one token does both jobs
at 1.62:1.

`--focus: #0F5FD1` — **5.87:1** on block, **5.15:1** on deck. One `:focus-visible` rule,
2px, `outline-offset: 2px`. The current 1.50:1 halo is replaced outright.

**One green.** `--brand: #0B6B4F` — **6.50:1** both directions against white. It replaces
all five of the greens the audit inventoried (`#0E7B5B`, `#006e16`, `#306f37`, `#3ECF9A`,
`#1e7d3f`) and it is deliberately the *same token* as "Received". In this product, green
means done or do-this; it means nothing else.

**Status kinds** — three steps each: `-wash` (chip background), `-ink` (chip text, all
≥ 4.5:1 on their own wash), `-mark` (bars and dots, all ≥ 3:1 on white).

| Kind | wash | ink | ink on wash | mark | mark on white |
|---|---|---|---|---|---|
| Waiting | `#FBEFD8` | `#835000` | **5.92:1** | `#B87400` | **3.79:1** |
| Moving | `#E3ECF8` | `#1B5292` | **6.60:1** | `#1F5FA8` | **6.44:1** |
| Done | `#DDEFE7` | `#0B6046` | **6.33:1** | `#0B6B4F` | **6.50:1** |
| Stopped | `#FAE3E4` | `#9A1C2E` | **6.66:1** | `#A81F35` | **7.21:1** |
| Closed | `#E7ECE9` | `#4C5B54` | **5.99:1** | `#6B7A72` | **4.51:1** |

The current `.chip.Ordered` amber pair measures 4.08:1 and fails; every pair here clears
by more than a point. The four chromatic marks were run through the `dataviz` palette
validator: they pass the lightness band, the chroma floor, the normal-vision separation
floor (worst all-pairs ΔE 18.3) and contrast, and they **fail** adjacent-pair CVD
separation on red↔green (ΔE 4.3 deutan). That failure is not fixable by re-stepping —
red and green are the canonical confusion pair — so it is mitigated the way the method
prescribes for a status palette: icon and label always present, never colour alone.
Stated here rather than buried, because a reviewer will find it.

Payment is drawn in `--ink` / `--ink-2` / `--ink-3` only. It has no palette.

### Type

Two faces, both from the system stack, so nothing is fetched:

- **Sans** — `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Mono** — `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

**The rule that makes the mono face mean something:** mono is a value the system stores
verbatim — PR IDs, part numbers, quantities, money, dates, AWB numbers, PO references.
Sans is text a human wrote — purposes, notes, names, labels. That distinction is real in
this product and it is free to enforce, so the utility face carries the personality rather
than a display face nobody licensed. Space Grotesk is dropped; it survives today on four
selectors, one of which overrides it back to Inter.

Scale — six sizes, no half-pixel steps, replacing the sixteen the audit counted:

| Token | px | Used for |
|---|---|---|
| `--t-micro` | 11 | the one micro-label style, `.pop` population statements |
| `--t-small` | 12 | table cells, chips, secondary |
| `--t-body` | 14 | body |
| `--t-lead` | 17 | block subject lines, line totals |
| `--t-fig` | 22 | page title, tile figures |
| `--t-hero` | 34 | focus figures |

Weights 400 / 500 / 600 / 700. One uppercase micro-label style (`11px / .06em / 600`),
replacing the five near-identical ones. Money and identifiers always carry
`font-variant-numeric: tabular-nums`. Mobile inputs are **16px** so iOS does not zoom the
viewport on focus.

### Spacing, radius, elevation, motion

- **Spacing** — 4-base: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Grid gap 12px desktop, 8px mobile.
- **Radius — exactly three**: `6px` controls and chips, `12px` blocks, `999px` pills.
  Replaces eleven values.
- **Elevation — exactly two**: `flat` = `inset 0 0 0 1px var(--rule)`;
  `raised` = `0 1px 2px rgba(15,28,23,.06), 0 10px 28px -14px rgba(15,28,23,.28)`.
  Replaces six shadows across three rgba bases. Raised is reserved for the focus block —
  in a dense grid, if everything is raised, nothing is.
- **Motion** — one duration, `.15s`, on one property at a time. No `transition: all`.
  `prefers-reduced-motion` honoured.
- **Touch** — `--tap: 44px`, applied as `min-height` on every control on mobile.

**All of the above is CSS-tier.** It is one stylesheet rewrite with no markup change,
which means the token layer can land before any view is touched.

---

## Grid system

A bento direction without a stated system is just cards. This is the system.

### The lattice

| | Desktop | Mobile |
|---|---|---|
| Columns | 12 | **4** |
| Gap | 12px | 8px |
| Row unit **U** | 84px | 64px |
| Row sizing | `grid-auto-rows: minmax(84px, auto)` | `minmax(64px, auto)` |
| Max width | 1320px | — |

The row unit is `minmax(U, auto)`, never a fixed height. **A block's row span is a floor,
not a cage** — this single declaration is what stops a bento breaking on uneven content.
Column span is fixed; height is whatever the real data needs.

### Block size vocabulary

| Name | Class | Span | Contains |
|---|---|---|---|
| Tile | `.t1` | 3 × 1U | one honest figure and its population statement. No viz. |
| Gauge | `.t2` | 3 × 2U | one figure plus one micro-visual — a distribution, a due date, a tracking number |
| Panel | `.t3` / `.t3-narrow` | 6 × 3U / 4 × 3U | a list or a small multiple |
| Focus | `.t4` | 6 × 4U | the attention block. **Maximum one per view.** |
| Ledger | `.t5` | 12 × auto | the record list. Row span always content-driven. |

Mobile has its own vocabulary, not a scaled copy: `.m-band` (4 cols, full bleed),
`.m-pair` (2 cols, so stats sit two to a line), `.m-pair-tall` (2 × 2U).

### What earns a large block — four rules

1. **Actionability earns width.** A block the viewer can act on *now* takes 6 or more
   columns. A block that only reports takes 3 or fewer. "Waiting on you" is 6 wide and
   carries buttons; "Open · 5" is 3 wide and carries a number.
2. **Ambiguity earns height.** A figure that cannot honestly be stated as one number gets
   2U or more so it can show its parts. Mixed-currency spend is four rows, not one
   headline. "Awaiting approval" is a three-bucket age distribution, not a "1". A number
   that genuinely is one number stays at 1U.
3. **Irreducible content earns span, not truncation.** If the real data — a 52-character
   enclosure description, "Precision Sheet Metal Works", `₹1,84,500.00` next to `$2,310.00`
   — does not fit at the block's size, the block takes another column before the text
   clamps. Identifiers, money and vendor names are never clamped.
4. **Nothing is large because it is pretty.** Any block at 6 columns or more must carry
   either a control or a decision. If it carries neither, it demotes to a Tile. The focus
   block demotes to a tile when nothing is waiting; the vendors view demotes a
   never-purchased-from vendor to a 3 × 1 tile, because "none" does not need card height.

Rule 4 is what keeps this from becoming a dashboard of decorative squares, and it is
observable: `mockup-desktop.html` uses three block sizes on the vendors view and states
on the page why each vendor got the size it got.

### The overflow contract — system-level, not per-block

This content is uneven and a grid that only looks good with tidy data is a failed grid.
Every block obeys all of it:

- `min-width: 0` on the block and on every direct child, so grid items can actually shrink.
- `overflow-wrap: anywhere` on any cell that can hold user text.
- **Prose clamps at two lines** with `-webkit-line-clamp` plus a `+N more` counter.
  **Identifiers, money and vendor names never clamp** — a truncated part number is worse
  than a tall row.
- Money is mono, `tabular-nums`, right-aligned, always full value. `₹1,84,500.00`, not
  `₹1.8L`. The lakh grouping is preserved because it is what the audience reads.
- An absent value renders `—` in `--ink-3`. Never a blank cell — a reader must be able to
  tell "nobody yet" from "not applicable".
- **No block sets `overflow: hidden`.** The current `.dash .card` does, which clips focus
  rings; in a dense card grid that is how you become keyboard-hostile without noticing.
  Where clipping is genuinely needed it is `overflow: clip` with `overflow-clip-margin: 3px`.
- One interactive per block face. A block is either a link *or* a container of links,
  never both — nested interactives are the other way dense grids break keyboard use.
- Tables inside a block get their own `overflow-x: auto` wrapper. Today the dashboard and
  PR-detail tables have none and scroll the whole document, dragging the sticky rail.

**Grid, spans and overflow contract are entirely CSS-tier.** The blocks are the `.card`s
and `.kpi`s that already exist; what changes is the class they carry and the stylesheet
behind it.

---

## Mobile strategy

### The failure mode a bento has to avoid

A bento grid that collapses to one column on a phone is a responsive reflow with extra
steps, and the brief rules that out explicitly. So mobile gets **its own lattice and its
own block vocabulary**: 4 columns, 8px gap, 64px row unit, with `.m-pair` blocks that sit
two to a line. The dashboard's composition genuinely differs from desktop — the focus
block is full-bleed and first, stats pair up, and the ledger stops being a table and
becomes a stack of cards, each of which is **itself a three-zone mini-bento**
(`priority | identity + body | money`, with the two axes on a rule beneath). See
`mockup-mobile.html` frame 1. **CSS-tier + DOM-tier.**

### Line-item entry — the actual answer

The evidence points at a pushed per-item editor screen (Shopify, FreshBooks, Stripe all
do it) and the architecture points away from it: `main.js` rebuilds views from
`innerHTML`, and a route change mid-form discards a half-typed PR. Stripe makes the
pushed screen work by autosaving a draft; Oizom has no draft mechanism. So this is the
architecture-compatible approximation, and the reason it is not the pushed screen is
stated rather than hidden.

**1. A card per item, never a reflowed row. DOM-tier.**
Nine grid cells becoming `1fr 1fr` is what produces four rows of anonymous boxes. Each
item is a card in a vertical stack, and inside the card the fields sit on the same 4-column
mobile grid: description full-width, item type full-width, then quantity and unit price
paired two-up. Composition inside the card, single column of cards outside it.

**2. Every field has a visible top label. DOM-tier.**
This is the substance of finding #1, not a nicety. `i_materialType` today renders blank,
`required`, with no label and no placeholder — a mandatory dropdown the user cannot
identify. Here it is "Item type **(required)**" with a tappable hint. `i_unit` today reads
as a mystery dropdown showing "pcs"; here it is half of a labelled composite. Carbon's
required/optional flip is applied on visible labels, not inside placeholders that vanish
on the first keystroke.

**3. Quantity and unit are one control, not two fields. DOM-tier.**
Baymard is explicit that splitting a single input entity across mobile fields causes
navigation trouble and required-field confusion. `150` and `pcs` are one value; they share
one bordered group with one focus ring.

**4. One disclosure level, and only one. DOM-tier.**
Part number, purchase link and datasheet go behind a single native
`<details>` — "More details". NN/g's hard ceiling is two levels, and this design spends
only one, because **the item card itself is never collapsed.** That is a deliberate
departure from the accordion pattern: Baymard found that reopening completed steps to
verify data is "particularly problematic on mobile", so instead of a collapsed summary the
card keeps a permanent arithmetic strip — `150 pcs × ₹1,050.00` → `₹1,57,500.00` — on its
face. You never open anything to check your work. The cost is scroll length on a 5-item
PR, and the sticky bar is what pays for it.

**5. A sticky bottom bar that never leaves. CSS-tier.**
Item count, currency, running total, Submit. Today the only submit control lives in a
non-sticky header, so after three items on a phone it is off-screen (R-13), and the live
total is an unstyled muted `<span>` mid-document (R-14). One `position: sticky` footer
retires both.

**6. Duplicate beside Delete, both as icon buttons. DOM-tier.**
Delete stops being a full-width solid red button repeated once per row (R-12). Duplicate
is the affordance no researched competitor ships on mobile and the one Oizom's data most
wants — real items differ by a part number and nothing else. Copying eight values in one
tap, with an undo banner, is roughly ten lines.

**7. The right keyboard, every time. DOM-tier.**
`inputmode="decimal"` on qty and price; `type="url" inputmode="url" autocapitalize="off"
autocorrect="off" spellcheck="false"` on both link fields, which are the worst things to
type on a phone and are therefore demoted below the disclosure and treated as paste-only.
All inputs are 16px so iOS does not zoom.

**8. Department stated, not hidden. DOM-tier.**
"Raising for **Production**" sits at the top with a hint explaining that it decides which
projects, vendors and item types appear. It silently scopes three dropdowns today and is
displayed nowhere.

**9. Errors land on the field. DOM-tier.**
`aria-invalid` plus `aria-describedby` on the control, a ring on the card, and the sticky
bar switches to "Fix item 2". Today a backend message quoting the item description arrives
as a six-second toast while the form stays visually unchanged.

**10. The dead end is explained. DOM-tier.**
When a department has no item types mapped, the control is replaced by a written
explanation and an action — not a blank required select that answers "No match" forever.

**What is deliberately not here:** a bottom sheet (NN/g: sheets are transient and must not
hold complex content, and no researched product uses one as a line-item editor), a
multi-step wizard, and a separate add-item route. All three need draft persistence first,
which is State-tier and belongs to a direction that buys it.

---

## Stack implications

**The stack does not need to change.** No framework, no CSS framework, no build-step
addition, no component library, no runtime dependency. Everything in both mockups runs on
vanilla ES modules and hand-written CSS, and both files open from `file://` with zero
network requests — no fonts, no icon font, no CDN.

Three consequences worth pricing:

**1. The Material Symbols font goes.** Icons become an inline SVG `<symbol>` sprite
injected once in `index.html`. That removes F-08 outright — today, until a remote font
arrives, users read the literal words *refresh, notifications, delete, add* as body text
on a cold mobile connection. The sprite is about 3KB and ships with the document.
**DOM-tier, and it deletes a network dependency.**

**2. `collectItems()` changes shape, and market.md's "no change at all" claim is too
optimistic.** The current selector is `.itemrow:not(.ithead)` — a contract that already
broke once, in commit `898b344`, precisely because a header row shared the `.itemrow`
class. Restructuring items into cards means the selector becomes something like
`[data-item]`, and the header row disappears entirely because labels move inside the
cards. That is *better* — the fragile `:not()` goes away — but it is a real edit to
`prForm.js`, not free. **DOM-tier, small, and it should be done with the header-row bug in
mind.**

**3. Two things this design shows are Backend-tier and are drawn as such.**
Rejection and hold reasons need a column in `PR_HEADERS`; the detail view's history needs
the existing `Log` sheet exposed through a read endpoint. Both are drawn in the mockup
because the design is incomplete without them, and both are labelled on the block.
The FX-equivalent control is drawn **disabled** with its reason on the page rather than
faked.

**No new fields are invented for the dashboard.** Everything on it — age in status,
priority, payment status, per-currency totals, status counts — is derivable from data the
client already holds. `aging()`, `spendBy`, `statusCounts`, `vendorPerformance` and
`monthlyTrend` are all implemented and unit-tested in `lib/` and imported by nothing
(F-25). This direction consumes them; it does not ask for them.

**One soft argument.** Two of Direction B's biggest wins — filters that survive
navigation, and blocks that re-render independently instead of the whole document — are
blocked by the same thing: `render()` assigning `app.innerHTML` on every store emit. That
is State-tier and out of this direction's remit, but the grid is designed so each block is
an independently replaceable node whenever that work happens.

---

## Risks

**1. Ledger density on a 13-inch laptop.** Seven columns with two axis columns is the most
crowded thing here. At 1280px it is comfortable; at 1120px the grid drops to 8 columns and
the ledger keeps its own horizontal scroll. If it still reads tight in testing, the honest
cut is the department sub-line, not the payment column — the payment column is the point.

**2. Red↔green is invisible to deuteranopes, and I could not fix it.** The `dataviz`
validator failed my status marks on adjacent-pair CVD separation at ΔE 4.3, and no
re-stepping fixes red versus green. The mitigation is icon plus word on every chip, which
is the prescribed remedy for a status palette but is still a mitigation. If a colourblind
reviewer finds a case where the icons are too small to disambiguate at 12px, the icons get
bigger before the hues change.

**3. Five hues for eight statuses will be read as a regression by someone.** The audit's
complaint was that Approved and Received shared a colour and Ordered and In Transit shared
amber. Approved, Ordered and In Transit now share blue *on purpose*, and the defence is
that they share a meaning — nobody owes you anything, it is moving — while the icon and
word separate them. That is a stated system rather than an accident, but it is a judgement
call and it deserves a reviewer's scepticism.

**4. The focus block is only as good as its rule.** "Waiting on you · 2" is computed:
Submitted PRs with no approver, plus anything On Hold or Rejected, sorted by days in state.
If that rule is wrong the block is worse than useless, because it is the loudest thing on
the screen. It also needs a genuinely good empty state — a large block that says "0" would
be exactly the flatness this direction exists to remove, which is why the rule is that the
block demotes to a tile rather than showing a zero.

**5. Item cards are long.** Never collapsing the card is a deliberate trade against
Baymard's verification finding, but a 5-item PR is a long scroll on a 390px screen. The
sticky bar and the always-visible arithmetic are the mitigation. If real users complain,
the next move is a "jump to item" chip row, **not** a collapse — going back to collapsed
cards re-imports the verification problem.

**6. The block vocabulary can be overrun.** Five desktop sizes is a small vocabulary on
purpose. The first time somebody needs a 5 × 2, the system either grows a size or the
content changes to fit. Growing it once is fine; growing it four times means the earning
rules are not being enforced and this becomes a grid of arbitrary rectangles — which is
how bento designs usually die.

**7. Real data will be messier than eight rows.** The overflow contract is written for
long vendor names, 52-character descriptions, lakh-grouped INR beside four-figure USD, and
empty approvers, and the mockups render all of those on purpose. What they do not render
is 200 PRs, a vendor with five departments, or a PR with 12 line items. The clamp rules
should hold; the ledger's lack of pagination will not.

**8. Half of what this direction fixes it cannot build.** Three of the audit's top ten are
engineering defects, and two more need backend columns. A reviewer choosing Direction B
should read it as "the composition problem solved, with a list of engineering work still
attached" — not as a redesign that makes the tool correct.

