# Direction C — "The Docket"

**Branch:** `design/ux-overhaul` · **Date:** 2026-07-25 · **Risk posture:** high
**Files:** `mockup-desktop.html`, `mockup-mobile.html`, this document.

Reads `BRIEF.md`, `sample-data.md`, `research/audit.md`, `research/market.md`. Does not restate them.

---

## Direction

The current app is shaped like the spreadsheet underneath it — a table of PRs, a table of
vendors, a table of users — and every role gets the same screen with rows hidden. This
direction replaces the table as the home surface with a **role-shaped work queue**: an
explicitly ranked list of the things a specific person has to do today, with the ranking
rule written on screen, and the table demoted to a second destination for finding and
auditing rather than for working.

Underneath that sits one claim about the data: **Oizom's `status` field is three facts
crushed into one word.** A request has a *stage* in the buying pipeline, a *state* (running,
paused, closed) and a *payment position*, and these move independently. Every screen in this
direction renders all three, always, in a fixed three-cell stamp — and when a fact genuinely
is not knowable from the sheet, the stamp says so instead of guessing.

### The information architecture, and the argument for it

**Today: six views, three nav items, one shape for everybody.**
`dashboard / vendors / admin`, with a requester, an approver and an admin all landing on the
same table and differing only in which controls are hidden. That is the sheet's shape — PRs
tab, Vendors tab, Users tab — not anyone's job.

**Proposed: two destinations, one persistent action, three queue shapes.**

```
  Raise a request        ← an action, on every screen, for everyone
  ─────────────────────
  Your queue             ← primary. ranked. DIFFERENT PER ROLE.
  All requests           ← the ledger: search, filter, sort, export, money
  Registry               ← admins only: vendors, people, projects, item types
```

Three arguments, in descending confidence.

**1. "Vendors" and "Admin" are the same object class and neither is a destination.**
Both are reference data that exists to make the PR form work. A requester has no job on a
vendor card — they need a vendor *inside a picker*. An approver's question about a vendor is
"how has this one behaved", which is a filter on the ledger, not a separate registry. Merging
them removes a top-level item and removes F-64, F-79, F-80 and F-81 (the vendor editor is not
a route, drifts from the store, and reopens itself unexpectedly) by making the registry a
plain, routed, admin-only surface.

**2. The primary object is work, not records.** `market.md` §1 notes Pipefy's structural
weakness — a board is an operator's view, and the requester needs a different one, which is
why Pipefy has to bolt a separate "Tasks & Requests" surface on top. Oizom has the same split
and currently resolves it by giving everyone the operator's view. The queue resolves it the
other way: each role gets their own, and the operator's view still exists, one click away,
for everybody.

**3. A table is a bad answer to "what should I do".** The dashboard's entire filtering
vocabulary is six KPI tiles (audit #5). The queue's bands *are* the filters, they are named
in job language ("Needs your decision", "Stuck", "Moving", "Settled"), and — critically — the
ranking rule is printed on the screen. A ranked list that will not say how it ranked is worse
than a table, so the mockup states it: *"Ranked by needs your decision, then days waiting.
Nothing is hidden by this ranking — all 8 requests are in All requests."*

#### What did **not** change, on purpose

- **Row click goes to a full page, not a modal** (`market.md` #14, Stripe). Already true; kept.
- **Human-readable IDs in the first column** (NN/g). Already true; kept.
- **The status matrix.** `lib/status.js` is correct and mirrored server-side. This direction
  changes how it is *displayed*, never what it permits.
- **One approver per PR.** No routing builder, no approval chain, no relative groups — all of
  it is configuration surface with nothing to configure at Oizom's size (`market.md` anti-pattern 7).

#### What I looked at and rejected

- **A kanban board of PRs by stage.** The obvious big swing, and wrong: a card lives in one
  column, so the board structurally cannot show the payment axis — the exact thing this
  direction argues is being lost. It also needs drag-and-drop to earn its keep, which is
  State-tier for no gain over an action strip. `market.md` §5 reaches the same conclusion.
- **A five-step stepper on detail.** Carbon names two explicit avoid-cases, and Oizom's flow
  hits both. A stepper cannot draw `On Hold` and degrades into a stepper plus a banner
  explaining that the stepper is wrong.
- **Bulk approve.** Verified only in Precoro. Costs a permanent checkbox column to save clicks
  at a volume Oizom does not have.
- **Charts.** Eight requests across four currencies. Any bar chart here is a demo artefact.
  See `## Design tokens` → money.

---

## What it fixes

### The audit's severity-ranked top 10

Honest column. Several of these are engineering defects that no redesign can close.

| # | Finding | Verdict | How, and what it costs |
|---|---|---|---|
| 1 | **Line-item grid has no mobile design** | **Fixed** | Creation becomes a pushed three-step flow (`mockup-mobile.html` screens 2–4): header step → item stack → check & send, with a dedicated single-item editor screen behind each card. Four fields on the editor's face, three behind one `<details>` disclosure — Stripe's two-tier split, inside NN/g's two-level ceiling. Item cards carry a *verifiable* summary (`SPS30-2M · Inventory · 40 pcs × €92.00 · €3,680.00`), never "Item 3". **State-tier** — the pushed screen only works with a draft; see `## Mobile strategy`. |
| 2 | **14 field hints unreachable on touch; `?` trigger at 1.70:1** | **Fixed** | The `?` affordance is deleted rather than restyled. The hint copy — which audit C-24 correctly calls the strongest writing in the product — becomes permanent help text under every label, on both surfaces. Nothing is behind a hover. **DOM-tier + CSS-tier.** |
| 3 | **Token expiry silently reloads and destroys the open form** | **Partially fixed** | The draft store means the reload no longer costs the user their work — the same mechanism that buys the mobile flow buys this. But the *silent* reload with no warning, no confirmation and no re-auth path is still there. That is `auth.js` / `state.js:32–35`: a token refresh loop and an in-place re-authentication prompt. Design cannot do it. **State-tier** for the draft; the re-auth is an engineering task this direction does not price. |
| 4 | **Every cold load asserts a false empty state** | **Fixed** | Three genuinely distinct states everywhere: loading (skeleton bands / skeleton rows), empty ("Nothing is waiting on you" with the raise action), failed (inline retry, not a 6-second toast). `s.loading` already exists and drives one spinner; this consumes it properly. **DOM-tier**, plus **State-tier** for a real error surface that is not a toast. |
| 5 | **No search, sort, filter or pagination** | **Fixed** | The ledger gets a real toolbar: free-text search, and independent filters on stage, state, payment and department — which is what the three axes make possible. Sortable column headers. The queue removes the *need* to filter on the primary surface, because it is already the answer to "what is mine". **DOM-tier** for controls; **State-tier** to reflect the filter in the URL so "pending approvals" is shareable (audit F-26). |
| 6 | **A just-created PR renders "not found"** | **Partially fixed** | Design contributes the right shape: creation ends on a confirmation state built from the `create` response the client already holds, rather than routing to a detail view that reads a list which has not refetched. That removes the user-visible failure. The underlying ordering bug at `prForm.js:297–301` is still an engineering fix. **DOM-tier** for the confirmation; the sequencing is a code change, not a design one. |
| 7 | **UI misrepresents the status model, three ways** | **(a) fixed · (b) partially · (c) fixed** | **(a)** The approver's actions come from `nextStates()`, so *Hold* is available from the queue where the work happens — the hardcoded `['Submitted','Approved','Rejected']` array goes. **DOM-tier.** **(c)** `paymentStatus` is a permanent third cell of the stamp on every card, every row and every detail header; `Received/Unpaid` and `Received/Paid` are never again identical. **DOM-tier.** **(b)** Removing illegal options from the admin control fixes the user-visible half, but `dashboard.js`'s silent fallback to a raw `update` write exists because the **backend `update` route accepts `status` for admins** (`prs.gs:179`, `ADMIN_FIELDS`). Closing it properly means the server refusing status writes outside `transition`. **Backend-tier.** |
| 8 | **Courier and tracking unreachable** | **Fixed — and it is cheap** | `courier`, `trackingNo` and `trackingLink` are already in `EDITABLE_FIELDS` (`prs.gs:12–14`) and already render on detail with a five-carrier deep-link table. Nothing needs building on the backend; a screen simply has to write them. Both mockups put tracking where the stage is *In transit* or *Ordered*. **DOM-tier, no new endpoint.** This is the cheapest item in the top 10 and has been sitting unclaimed. |
| 9 | **Full refetch + two whole-page `innerHTML` rebuilds per mutation** | **Out of scope for design** | Said plainly: a redesign cannot fix this, and this direction probably makes it *worse* — derived ranking and aging are more work per render than a sorted table. Every State-tier item below is State-tier **because** of this render model. It is the prerequisite, not a side effect. |
| 10 | **Accessibility floor at zero** | **Fixed as designed; not fixable by markup alone** | Both mockups ship real `<a>`/`<button>` targets, `<label for>`, `<fieldset>/<legend>`, `scope` on `<th>`, `<caption>`, `aria-current`, `aria-live` on running totals, `aria-invalid` + `aria-describedby` on the errored field, `aria-pressed` on toggles, native `<details>` for disclosure, visible `:focus-visible` rings, ≥44px targets and a `prefers-reduced-motion` block. But focus is destroyed on every re-render (`main.js:57`, audit S-02/A-11) — correct ARIA on a page that rebuilds itself under the user's cursor is still broken. Same root cause as #9. |

**Score, stated plainly: 6 fixed, 3 partially fixed, 1 out of scope.** Two of the three
partials and the one out-of-scope item share a single cause — the full-`innerHTML` render
model.

### Beyond the top 10

| Finding | What this direction does | Tier |
|---|---|---|
| F-01 · New PR reachable only from the dashboard | "Raise a request" is the first control in the nav rail on desktop and the centre of the bottom bar on mobile — present on every screen. | DOM |
| F-49 / F-50 / C-29 · Reject and Hold capture no reason | The one new sheet column this direction asks for: `statusReason`, written on Hold and Reject, shown on the card, and carried into the notification. `PR-2026-0138`'s card says outright that no reason was recorded. | **Backend** |
| F-54 · A complete `Log` sheet with before→after diffs, exposed nowhere | Read it back as the request's history, newest first (mobile screen 5). No schema change — `prs.gs:75–77,196–200` already writes it. | **Backend** (one read route) |
| F-23 / H-01 · Approver lands on a tab about themselves | The queue is defined per role. An approver's home is other people's submitted requests. | DOM |
| F-24 / H-02 · Nothing conveys age or priority in list views | Age is on every stamp and every ledger row; priority is a column with a shape as well as a colour. `aging()` in `lib/reports.js` is implemented, unit-tested and imported by nothing. | DOM (free) |
| F-25 · Ten report functions implemented, tested, unused | `pipelineGroups()` and `aging()` are literally the queue's bands. Claimed as free. | DOM (free) |
| F-18 / F-62 / F-87 · "Total spend" is one currency dressed as a total | Killed. The money strip is one cell per currency with the population and the words *no conversion applied* on it. See `## Design tokens` → money. | DOM |
| F-13 / H-04 · Every admin status cell is a dropdown | Gone. Status is never editable from a list row; transitions live on the card's action strip and on detail, where the consequence is visible. | DOM |
| F-37 / F-38 / F-39 / F-40 / A-15 · The custom combobox | Replaced with native `<select>` on mobile and a labelled `<datalist>`-backed input on desktop. It keyboards, it screen-reads, it does not revert what you typed, and it does not open behind the soft keyboard. | DOM |
| S-14 / S-15 / S-16 · One toast, 6 seconds, unattached to the field | Errors attach to the field that caused them (mobile screen 4) and to the item card that owns them (screen 3). Toasts stop being the error channel. | DOM + State |
| F-11 / F-59 / C-14 · "Vendors" as a top-level destination | Folded into Registry with people and lists. A requester has no job on a vendor card; they need a vendor *in a picker*. Vendor spend answers live in the ledger's vendor filter. | DOM |
| H-17 · Every view opens with a 32px title and static prose | Replaced by a one-line commitment header that changes daily and says something true. ~100px of dead chrome per screen recovered. | CSS + DOM |

---

## Design tokens

One set. Both mockups share it byte for byte; nothing is redefined for mobile.

### Colour

Grounded in the closest product archetype in the `ui-ux-pro-max` product database —
*E-signature / Document Workflow*, whose palette formula is **"trust navy + signature green +
pending amber + neutral grey"**. Every ratio below is computed with the WCAG 2.1
relative-luminance formula, not estimated.

| Token | Value | Role | Contrast |
|---|---|---|---|
| `--page` | `#F1F4F2` | app background | — |
| `--panel` | `#FFFFFF` | cards, table body | — |
| `--sunken` | `#F7F9F8` | inputs, table head, inset strips | — |
| `--rail` | `#0E1A16` | nav rail (the "navy" ground, green-shifted to stay Oizom) | — |
| `--rail-ink` | `#C6D6CE` | rail text | **11.81:1** on rail |
| `--ink` | `#101820` | body text | **16.16:1** on page |
| `--muted` | `#54635C` | secondary text | **5.72:1** page · **6.33:1** panel |
| `--edge` | `#DDE4E0` | decorative hairline — **table rules only** | 1.29:1, decorative |
| `--edge-strong` | `#7E8B84` | **every** interactive boundary | **3.55:1** :white · **3.21:1** :page |
| `--go` / `--go-soft` / `--go-ink` | `#0E7B5B` / `#E3F1EA` / `#0A6449` | approved, paid, done | **5.25:1** · **6.15:1** ink-on-soft |
| `--wait` / `--wait-soft` | `#8A4E00` / `#FBEEDC` | ordered, in transit, part-paid | **5.79:1** |
| `--stop` / `--stop-soft` | `#A32218` / `#FBE7E4` | rejected, unpaid, errors | **6.31:1** |
| `--hold` / `--hold-soft` | `#3F5158` / `#E8ECEE` | on hold, inert | **6.98:1** |
| `--new` / `--new-soft` | `#1F4E96` / `#E4EBF7` | submitted, informational | **6.77:1** |

Five greens become **one**. `#0E7B5B` wins over `#006e16`, `#306f37`, `#3ECF9A` and `#1e7d3f`
because it is the declared brand token and its ratios are already documented as passing
(audit §6.1). Six reds become one, two ambers become one, five near-whites become three with
a stated ordering (`page` < `sunken` < `panel`).

Three contrast defects the audit found are closed by construction rather than by patching:
`--edge-strong` at 3.55:1 replaces `--adm-outline` at 1.62:1 (A-02) and `--line` at 1.26:1
(A-03); the amber pair moves from 4.08:1 to 5.79:1 (A-04); and `.hq` (A-01, 1.70:1) does not
exist because hover-only help does not exist.

**Colour is never the only signal.** Every stamp cell carries an uppercase key, a word, and
an inline SVG glyph. Priority in the ledger is a triangle / circle / bar plus the word, not a
tint. Polaris's rule, and it is the one this codebase currently breaks worst.

**No dark mode.** Deliberate scope call, stated rather than hidden: a second surface set is a
second set of six status pairs to validate, and half-done dark mode is worse than none. If it
is wanted, it is a selected set of steps, not an inverted flip.

### Type

**No webfont is loaded, and none may be.** The brief forbids CDN links, and audit F-08 shows
what happens when a remote icon font is late — users read the literal word `refresh`. So
Space Grotesk, IBM Plex Mono and Inter are all absent from both mockups, and every icon is
inline SVG.

```
--ui   : -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
--data : ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace
```

The personality comes from *treatment*, not from a face. **The mono stack is used far more
aggressively than a system font stack usually is**: every identifier, quantity, amount, date,
age, currency code and micro-label is mono with `font-variant-numeric: tabular-nums`, and
prose is the only thing set in the sans face. That single rule is what makes the ledger read
as an instrument rather than a web page, and it costs nothing to load. Whether Oizom later
buys a licensed pair is a build-time decision, not a design blocker.

Scale — **six sizes, three weights**, replacing sixteen CSS sizes plus five hardcoded in JS:

| px | Use | Weight |
|---|---|---|
| 11 | micro-labels (mono, `.08em`, uppercase) | 600 |
| 12 | sub-values, help text, meta | 400 |
| 13 | table cells, buttons, dense body | 400 / 600 |
| 15 | mobile inputs (below 16px iOS zooms on focus — 15px plus `-webkit-text-size-adjust:100%`) | 400 |
| 20 | the commitment header | 600 |
| 26–28 | the one number that matters on a decision screen | 700 |

Half-pixel sizes (11.5, 12.5, 13.5) are gone. The 32px page title is gone with them.

### Space, radius, elevation

- **Space:** 4px base — `4 · 8 · 12 · 16 · 24 · 32 · 48`. Nothing at 9px, 10px or 14px.
- **Radius: exactly two.** `6px` for controls, stamps and inner blocks; `10px` for panels.
  Eleven values become two. No `999px` except nothing — even the count badge is 6px, because
  a pill and a stamp in the same row read as two systems.
- **Elevation: exactly two.** `0 1px 0 rgba(16,24,32,.05)` at rest; `0 6px 16px -6px
  rgba(16,24,32,.22)` for anything that floats (hover, the mobile dock). Six shadows across
  three rgba bases become two on one base.
- **Density** from the `ui-ux-pro-max` *Data-Dense Dashboard* row: `--head-h:56px`,
  `--rail-w:240px`, card padding 12–16px, small type 12px. One deviation, argued:
  `--row-h` is **40px, not the recommended 36px**, because Oizom's rows carry a two-line cell
  (value plus a mono sub-value) and 36px clips it. Touch rows are 48px throughout.

### Money, and the mixed-currency answer

This is the one place a design can lie without anyone noticing, so the rule is absolute:
**a number is only ever shown next to the currency it was raised in, and no figure sums across
currencies.**

- The ledger's money strip is **one cell per currency**, each stating its own population, with
  *"7 requests · the rejected one is excluded · no conversion applied — Oizom stores no FX
  rate"* printed on it. That last clause is the honest part: there is no rate anywhere in the
  sheet, so a converted total would be invented.
- Where a cross-currency figure is genuinely useful, it is a **count**, not a sum: *"Unpaid,
  all currencies — 3 requests, not a sum."* Counts are currency-safe.
- `fmtCompact` vs `fmtMoney` (audit F-20 — `₹98,000` and `₹1.2L` in one column) is resolved by
  deleting compact formatting. Every amount is full, grouped and tabular:
  `₹1,84,500.00`, `€4,820.00`, `$2,310.00`, `£1,240.00`. Indian lakh grouping for INR,
  Western grouping for the rest, which is what `Intl.NumberFormat('en-IN')` already gives.
- Currency is named, not inferred from a glyph (audit F-53). The picker reads
  `EUR — Euro (€)`.

### The signature: the stamp block

Three cells, one border, fixed order, **always all three present**, on the queue card, the
ledger row and the decision header:

```
┌ STAGE ────────────┬ STATE ──────┬ PAY ────────┐
│ ◷ In transit      │ ● Live      │ ✓ Paid      │
└───────────────────┴─────────────┴─────────────┘
┌ STAGE ────────────┬ STATE ──────┬ PAY ────────┐
│ ▨ Not recorded    │ ‖ Hold · 6d │ ✕ Unpaid    │   ← PR-2026-0138
└───────────────────┴─────────────┴─────────────┘
```

Fixed position is the whole point: the eye learns that payment is always the right-hand cell,
so `Received / Unpaid` can never again look like `Received / Paid`.

**The hatched cell is the honest part, and it is where this direction is most exposed.**
`On Hold` is enterable from `Submitted`, `Approved`, `Ordered` and `In Transit`; `Cancelled`
from four states too. The PRs sheet stores one word, so **the stage a held request paused at
is not recoverable from `status` alone.** The prior stage *is* in the Log sheet —
`prs.gs:220` writes `"Approved → On Hold"` as the transition detail — which means a
fully-populated stage axis for held and cancelled requests **depends on the same history
route** priced under F-54. Until that route exists, the stamp draws the cell hatched and reads
`Not recorded`. It never guesses a position, and it never draws `On Hold` as a stage, because
it is not one.

---

## Mobile strategy

**The evidence and the architecture point in opposite directions, and this direction sides
with the evidence.** `market.md` §3 is unambiguous: Shopify draft orders, FreshBooks and
Stripe all open a **dedicated single-item editor** and return to a summary list; Procurify
ships a six-tap wizard rather than a reflow; Airtable — the spreadsheet company — abandons the
grid on a phone entirely. No surveyed product edits a multi-column row inline on a phone, and
**no surveyed product uses a bottom sheet for it**, which NN/g independently argues against.

The reason A and B cannot have this pattern is that it needs somewhere to put a half-typed
request while the user navigates. So this direction buys that first.

### The flow (`mockup-mobile.html`)

```
Queue ──[Raise]──▶ 1. What & why ──▶ 2. Items ──▶ 3. Check & send ──▶ confirmation
                                        │  ▲
                                        ▼  │
                                    4. Item editor      (one item, pushed, returns)
```

**Step 1 — What & why.** Project, purpose, vendor, currency, needed-by, priority. Opens with
a context banner naming the department and its readiness — *"Raising for R&D. R&D has 4
projects, 6 vendors and 5 item types set up — you are good to go."* That is the pre-flight
check for F-29/F-30/F-31: today the department silently scopes three dropdowns, is never
shown, and a user with no department fills the entire form before being told.

**Step 2 — Items.** A vertical stack of cards. Each collapsed card shows description, part
number, type, `qty × unit price` and line total — Baymard's requirement that a collapsed row
be *verifiable without reopening it*, which mattered "particularly on mobile". Below the
stack: an explicit `Add an item` button, matching Shopify's *"Tap Add custom item"* and
FreshBooks' *"Tap on Add a Line"* — never a ghost row that materialises on typing. Per card:
visible **Duplicate** and **Remove**, no swipe-only actions (NN/g). Incomplete lines are
flagged **on the card** rather than in a corner toast the user must map back to a row (S-16).

**Duplicate is the one thing no researched product ships on mobile.** Real Oizom items are
near-identical — same type, same unit, same supplier, different part number. Copying eight
values in one tap is worth more here than in any reference product, and it is roughly ten
lines of code.

**Step 3 — Check & send** is the review; **step 4 — the item editor** is the substance:
top-aligned labels (Baymard: "above, with one exception"; Carbon: "the only label arrangement
currently offered"), `(Required)` on a visible label rather than an asterisk inside a
placeholder that vanishes on the first keystroke (Carbon's required/optional rule), and
`inputmode="decimal"` on qty and price, `type="url" inputmode="url" autocapitalize="off"
autocorrect="off"` on the two link fields — the fields Baymard identifies as the worst thing
to type on a phone. **Qty and unit sit on one line as one composite control**, because Baymard
found splitting a single input entity across stacked mobile fields causes navigation errors.

**Exactly two disclosure levels, and no more.** Level one is list → editor. Level two is the
`<details>` reveal holding part number and the two links. NN/g: "designs that go beyond 2
disclosure levels typically have low usability". Native `<details>` gives `aria-expanded` for
free and keeps every input in the DOM, so a collector querying `[name=…]` never has to know
about visibility.

**Sticky dock, thumb zone.** Running total plus the primary action, pinned to the bottom edge
on every step. Justified by Baymard's finding that users continuously reference running order
summary information — not by a reachability argument, which NN/g debunks. The total carries
`aria-live="polite"`.

### The draft — the load-bearing State-tier item

Stripe makes the pushed editor work by autosaving: *"Whenever you exit the invoice editor,
Stripe saves a draft."* Oizom has no state layer at all. So:

**Proposal.** A draft object in `localStorage`, keyed by user email and by
`new` / `edit:<prId>`, written on a **debounced `input` handler (~400ms)** — *not* on
navigation. Restored on entry with an explicit banner and a discard action. Cleared on
successful submit.

Three consequences, stated rather than buried:

1. **Write-on-input, not write-on-navigate, is mandatory.** If the pushed editor is a real
   sub-route (`#/new/item/2`), `hashchange` fires `render()`, which reassigns `#app.innerHTML`
   — so anything not already persisted at the moment of navigation is gone. Save-on-navigate
   would lose the header on the very first push.
2. **It replaces the `main.js:112–131` form guard rather than living beside it.** That guard
   exists precisely because a re-render wipes typed input (S-03), and it costs the form its
   live notification badge and its dropdown data. With a draft, re-render is survivable:
   rehydrate from the draft after render instead of refusing to render. That is a genuine
   simplification, and it is also the riskiest change in this document — get the rehydrate
   ordering wrong and you have a form that resets under the user.
3. **The draft is device-local.** Start on a phone, finish on a desktop, and it is not there.
   That is a real limitation and the honest alternative — a `Draft` sheet with a backend
   route — is a bigger ask than this direction wants to make for a tool where a typical
   request is one to five lines and one sitting.

The draft is also why audit #3 moves from *critical, total loss* to *partially fixed*: an
expired token still reloads the page silently, but it no longer costs the user a six-item
request.

### Approval, and the email question

`market.md` §4 asked for honesty here rather than an "Approve" button drawn in a mail mock.

- **Gmail one-click (`schema.org ConfirmAction`) is rejected for now.** Google requires
  registration before production use plus DKIM/SPF with the sending TLD matching `From:`, and
  the self-to-self exemption is per-account, so it does not cover `approver@oizom.com`
  receiving mail from an Apps Script service account. That is an infrastructure project, not
  a design decision, and it should be scoped as one.
- **The Apps Script signed-link fallback is rejected, and this is a security recommendation,
  not a styling one.** A `doGet` handler with `?action=approve&pr=…&t=<hmac>` running as the
  deployment owner **bypasses the Google Identity gate that protects every other route** — the
  token in the URL becomes the credential, in a mail body, in a mail archive, in a forwarded
  thread. If it is ever built it needs single-use tokens, short expiry and its own audit
  entries. It should not be adopted to save an approver one tap.
- **What is adopted instead:** design the approval *screen* first (mobile screen 5), and put
  Coupa's content model in the mail body — submitted by, total, every line with
  `qty × unit price`, and the vendor, above a deep link. The link lands on a page the approver
  is already authenticated for. Two large buttons, four decision facts above them, items and
  history below. This is where an approver actually ends up regardless of transport, and it is
  the whole win.
- **"Ask for changes" as a third verb.** `Rejected → Submitted` already exists in the matrix
  for the owner, so Oizom already *has* a revision loop — it is only labelled with the harshest
  available word. No matrix change; a name change plus the reason field.
- **Reject and Hold require a reason; Approve does not.** Confirmation on the positive action
  is friction with no safety payoff when the matrix already permits `Approved → Submitted`.
- **"Ask for an update", capped at one a day**, on the requester's own card. Ramp's cheapest
  idea and the direct answer to `PR-2026-0138` sitting held for six days with nobody to ask.

---

## Stack implications

**No framework is assumed, and no framework verdict is claimed.** The brief says the stack is
a joint decision with the dev team, so what follows is the bill, itemised, for them to price.
Both mockups are hand-written HTML and CSS with ~40 lines of demo-only JS; nothing in them
requires a build step, a component library or a runtime dependency.

But this direction is **State-tier-heavy**, and pretending otherwise would make it worthless.

### The bill

| Tier | Items |
|---|---|
| **CSS-tier** | One token set replacing two. Two radii, two shadows, six type sizes, 4px space scale. Contrast repairs (`--edge-strong` 3.55:1, amber pair 5.79:1, deletion of `.hq`). `overflow-x` wrappers on every table. Right-aligned tabular numerals. ≥44px touch targets, `:focus-visible`, `prefers-reduced-motion`. Deletion of `form.pr`, `.filters`, `.bar` and the `.vcard:hover` defect. |
| **DOM-tier** | The three-axis stamp, derived client-side from `status` + `paymentStatus` — **no schema change**. Always-visible field help. Native `<select>` replacing both comboboxes. Courier / tracking / received-date on a form (already in `EDITABLE_FIELDS`). Priority and age columns. Per-currency money strip. Queue bands rendered from `pipelineGroups()` + `aging()`, both already written and unit-tested. Ledger search / filter / sort controls. Removal of illegal statuses from admin controls. Three real empty/loading/error states per view. |
| **State-tier** | **Draft persistence** (localStorage, debounced write-on-input, rehydrate-after-render) — buys the mobile flow *and* audit #3. **Sub-routes** for `#/new/step/n` and `#/new/item/n`, replacing the `main.js` form guard. **URL-reflected filter and sort** on the ledger. **Focus restoration and scroll preservation** across re-render — without which the accessibility work in item 10 does not survive contact with a mutation. **Optimistic transitions** with rollback, so approving does not cost a full refetch and a double rebuild. |
| **Backend-tier** | **One new sheet column: `statusReason`** on `PRs`, written by `transition` for Hold / Reject / Ask-for-changes and included in the notification body. **One new read route: `history`**, returning the existing `Log` rows for a PR — no schema change, the data is already written on every create, update, transition and delete. **Mail template change** in `notify_` to carry line items (Coupa's content model). **`update` must refuse `status`** so the matrix cannot be bypassed (closes top-10 #7b). Optionally, a `remind` route — or reuse `notify_` directly. |

### The one honest headline

**The State-tier column is not optional decoration on this direction — it is the direction.**
The pushed item editor is the fix for audit finding #1, and it does not exist without drafts
and sub-routes. If dev-review prices that above what Oizom wants to spend, **Direction C
degrades into Direction A or B**, because what is left is a token cleanup and a nicer table.
That is the honest failure mode and it should be a deliberate decision, not a discovery
halfway through implementation.

### Where the render model bites

`state.js` emits twice per refresh, `main.js:57` reassigns `#app.innerHTML` on every emit, and
every mutation triggers a full refetch of every PR, item, vendor, project, type and
notification. Consequences for this direction specifically:

- Derived ranking, aging and the stamp decomposition all run **per render**, and there are two
  renders per mutation. At 8 requests this is free; at 800 it is not, and there is no
  pagination anywhere.
- Focus and scroll are destroyed on every mutation (S-01, S-02), so an approver clearing a
  queue is thrown to the top after every decision — which is exactly the workflow this
  direction is built around. **Fixing this is a prerequisite, not a nice-to-have.**
- The item editor's sub-route triggers a rebuild, which is why the draft must be
  debounced-on-input.

**The framework conversation, framed rather than answered.** Draft autosave, focus
restoration, sub-routing and optimistic updates are exactly the four things a rendering
library gives you for free, and they are exactly the four things on this bill. That is an
argument, not a conclusion — the counter-argument is that ~2,300 LOC with no dependencies is a
genuine asset for a small internal tool, and that targeted DOM patching for the queue list
plus a small draft module may cost less than a migration. **The dev team has the numbers; this
document has the requirement.** What must not happen is adopting the design and discovering
the state budget afterwards.

**Not requested:** Tailwind, a component library, an icon font, a webfont, a chart library,
Open Props, Tabler. Icons are inline SVG. Two `Intl.NumberFormat` locales cover all four
currencies.

---

## Risks

**1. The queue is empty and therefore looks broken.** With one approver and low volume, an
approver's "Needs your decision" band will often hold zero cards. An empty primary surface is
a worse first impression than a full table, however honest it is. Mitigation: the band renders
a real empty state with the next most useful thing, and the "Stuck" and "Moving" bands
surface work even when nothing needs a decision. **This is also the falsification condition —
see below.**

**2. The stamp is three times the status surface and could become noise.** Three cells on
every card and every row is a lot of chrome for eight requests. It survives only because the
cells are compact, fixed-position and mostly quiet (`Live` is grey, `Paid` is a check). If a
reviewer finds the ledger busier than the current table, the honest fallback is two cells —
stage and pay — with state as a row treatment.

**3. `Not recorded` will be the most common stage value for held requests, and it looks like a
bug.** Every request that has ever been held reads `Not recorded` until the history route
exists. That is truthful and it is also unattractive, and it makes the Backend-tier history
item a near-dependency rather than an enhancement.

**4. The draft is the largest new failure surface in the product.** Rehydrate-after-render is
subtle: get the ordering wrong and the user watches a form reset. Stale drafts across sessions
and devices produce "why is last week's request in my form". A device-local draft that
silently does not follow the user to a desktop is a support question waiting to be asked.

**5. Removing "Vendors" from the nav will be unpopular before it is understood.** Someone
uses that page today. The mitigation — vendor answers via a ledger filter — is better but not
obviously better on day one.

**6. Two surfaces may be one too few for admins.** Registry holds four object classes
(vendors, users, projects, item types). Collapsing four admin tabs plus a vendor view into one
destination could just relocate the F-78 problem (four tabs sharing one head whose primary
button silently changes meaning). This direction's mockups do not show Registry, which is a
real gap in the evidence.

**7. Real data is messier than eight rows.** Long vendor names, five-line requests and
purposes that run to two lines are the realistic case. The queue card is designed to wrap
rather than truncate, but a 40-line-item request would produce an absurd card — the item stack
needs a collapse threshold that this mockup does not demonstrate.

**8. Scope.** This is the most expensive of the three directions by a wide margin and the only
one that cannot be adopted view by view. Direction A is explicitly incrementally adoptable;
this is not, because the queue and the ledger only make sense together.

---

## What I am betting

**The bet.** That the most valuable question this tool can answer is *"what do I need to do
right now"*, not *"show me the requests"* — and that answering it well is worth a state layer.
Everything expensive here follows from that: the queue needs derived ranking, the pushed item
editor needs drafts, honest status needs three axes and eventually the audit log.

**This is the right call if all of these are true:**

- **Most sessions are task sessions, not browsing sessions.** Someone opens the tool because
  something is waiting, not to look around. If true, a ranked queue is strictly better than a
  table; if false, it is a lossy filter over one.
- **Requesters really do raise requests from a phone, away from a desk.** The single most
  expensive item on the bill exists for them. The product owner states this is true; the whole
  mobile budget rests on that statement.
- **The dev team accepts the State-tier bill,** whether by adding a small draft/routing module
  or by adopting a rendering library. Without it this direction is a reskin with ambitious
  language — the exact failure mode the brief warns about.
- **Being told the truth beats being told something tidy.** `Not recorded`, *"no conversion
  applied"*, *"no reason was recorded"* and a printed ranking rule are all this direction
  choosing honesty over polish. If Oizom would rather see a clean total and a single status
  chip, this is the wrong direction and it is wrong on purpose.

**What would prove me wrong — and it is measurable with data Oizom already has.**

> Count, over the trailing 30 days, how often each user's **"Needs you" band would have been
> non-empty at the moment they opened the app.** The `Log` sheet has every transition with a
> timestamp; this is a query, not an instrumentation project.
>
> **If that band is empty for most users on most opens, the queue is a worse home than the
> table and Direction A or B should win.** A ranked list of nothing is a worse landing page
> than an unranked list of something.

Two secondary falsifiers, cheaper still:

- **Run the Kissflow benchmark on the mobile flow.** *"Can an employee who has never used the
  system before complete a purchase request correctly in under fifteen minutes without calling
  the procurement team?"* Three staff, three phones, one afternoon. If the three-step flow does
  not beat the current form on that test, the draft was not worth buying.
- **Ask an approver to describe a request's state after five seconds on the ledger.** If they
  cannot say the stage, the state and the payment position from one glance at the stamp, the
  three-axis argument is correct in theory and has failed in execution — and the fix is fewer
  cells, not more explanation.

---

### Note on the dataset

Every request, vendor, person, amount, currency, item line, part number, tracking number and
quoted rejection reason in both mockups comes from `sample-data.md` unchanged, and every
derived figure reconciles against it: INR ₹3,56,840.00 committed across 4 requests, ₹2,52,500
of it unpaid, 7 requests in the money strip (the rejected one excluded), 3 unpaid across all
currencies, and every line total summing to its stated request total.

Five *raised* dates are **interpolated**, because `sample-data.md` states ages and event dates
but not creation dates for `PR-2026-0135`, `0136`, `0137`, `0138` and `0140`. They are chosen
to be arithmetically consistent with the waits the dataset does state (0141 waiting 3 days,
0138 held 6 days, 0140 approved 2026-07-21) against the fixed reference date of 2026-07-25.
`PR-2026-0142`'s PO date, 2026-07-02, is the one date reused in two roles — as both raised and
shipped — which is plausible for an advance-50% order but is an assumption, not data. No
amount, status, name or item was invented.

### Method note

Skills used: `frontend-design` for aesthetic direction (the docket / stamp concept and the
"spend your boldness in one place" discipline — the stamp is the one bold element and
everything around it is deliberately quiet); `dataviz` for the KPI and money treatment, whose
form heuristic is what killed the charts (at n=8 across four currencies, the right form is a
stat row and a table, not a plot); `mobile-app-ui-design` for thumb-zone placement, 44px
targets, the 8/4px grid and "selection over manual input" — while explicitly rejecting its
celebration, glassmorphism and peak-end guidance as wrong for a tool someone uses under time
pressure; `ui-ux-pro-max` for product-type grounding.

Two honest notes on that last one. Its `--design-system` lookup **misrouted** on this brief —
it read "enterprise" as a corporate marketing site and returned the *Enterprise Gateway*
pattern with an indigo palette and two Google Fonts, none of which is usable here. The
targeted domain queries returned the correct rows, and those are what this document cites:
the *E-signature / Document Workflow* product type (palette formula) and the *Data-Dense
Dashboard* style (density variables). No style theme skill — `enterprise`, `shadcn`,
`industrial-brutalist-ui` — was adopted: `enterprise` is dark glass panels, wrong for a
light-mode tool used on a phone in a factory; `industrial-brutalist-ui` would have been
novelty for its own sake on a tool where accessibility is already the weakest area; and
`shadcn` presumes a stack the brief says is not mine to choose.
