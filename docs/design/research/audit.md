# Current-State Friction Inventory — Oizom Procurement Hub

**Branch:** `design/ux-overhaul` · **Date:** 2026-07-25 · **Author:** UX audit
**Scope:** `frontend/` as of `898b344`. Backend (`apps-script/`) read only to
establish what data the UI already has.

This document is a diagnosis, not a prescription. It proposes no solutions
deliberately — three directions will propose cures independently and must not be
anchored. Read `BRIEF.md` first; this extends it and, in two places, corrects it.

---

## How to read this

Every finding carries four things:

| Field | Meaning |
|---|---|
| **Evidence** | `file:line`. Every claim is checkable. |
| **Hurts** | requester / approver / admin — who actually eats the cost |
| **Severity** | critical / high / medium / low |
| **Class** | **broken** = it does not work as written. **suboptimal** = it works and is bad. |

The distinction matters because they need different cures. A **broken** finding
is a bug a direction can fix by accident. A **suboptimal** finding is a design
decision that has to be re-made on purpose.

Findings are numbered `F-nn` and referenced from the top 10 so a direction's
`rationale.md` can cite them precisely.

---

## Severity-ranked top 10

The ten findings that, if fixed, deliver the most user value. Each direction
should be judged on how many of these it addresses and how honestly.

| # | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| 1 | **The line-item grid has no mobile design.** 9 columns collapse to `1fr 1fr` and the label row is `display:none`, leaving 4–5 rows of unlabelled controls. Two of them are `<select>`s with no placeholder and no visible name — and `i_materialType` renders blank-and-`required`, so a phone user faces a mandatory dropdown they cannot identify. This is the flow BRIEF §4 names as the sharpest unsolved problem. | `styles.css:197,201,203`; `prForm.js:57,59,165–175` | requester | **critical** | suboptimal |
| 2 | **All 14 field hints are unreachable on touch.** Help text lives in `.hq::after` shown only on `:hover`, and the `?` trigger itself is white on `#c3c7cc` — **1.70:1**, effectively invisible. Every explanation of what "Zoho no", "Type", or "Priority" means is dead on the requester's primary device. | `styles.css:248–253`; `prForm.js:19–40` | requester | **critical** | suboptimal |
| 3 | **Token expiry silently reloads the page and destroys the open form.** Google ID tokens last ~1 hour; there is no refresh loop while the app is open. The next action throws `SIGNED_OUT` and calls `location.reload()` with no warning, no confirmation, no draft persistence, and no `beforeunload`. A requester mid-way through a 6-item PR loses everything. | `state.js:32–35`; `auth.js:13,41–57` | requester | **critical** | suboptimal |
| 4 | **Every cold load shows a false empty state.** `render()` runs synchronously before `store.refresh()` resolves, against `prs: []`. New users and users on slow connections see "Total PRs 0" and "No PRs here yet." — the UI asserts emptiness rather than admitting it is loading. `s.loading` exists and drives only the spin class on one icon. | `main.js:133–137`; `state.js:4`; `dashboard.js:98`; `vendors.js:74` | all | **high** | suboptimal |
| 5 | **The dashboard has no search, no sort, no filter, and no pagination.** Six KPI tiles are the entire filtering vocabulary. Finding `PR-2026-0141` means scrolling every row. `.filters` is fully styled in two places and never rendered by any view. | `dashboard.js:75–100`; `styles.css:63–64,184` | approver, admin | **high** | suboptimal |
| 6 | **A just-created PR renders "not found."** On success the hash is set before `store.refresh()` resolves, so `prDetailView` runs against the pre-create list. Because `s.prs.length` is non-zero the "(still syncing…)" hedge is suppressed, and the user sees a bald *"PR PR-2026-0143 not found"* for a full Apps Script round-trip immediately after being told it was created. | `prForm.js:297–301`; `prDetail.js:32` | requester | **high** | **broken** |
| 7 | **The UI misrepresents the status model in three separate ways.** The real graph (`prs.gs:21`) is non-linear: `On Hold` is enterable from almost anywhere, `Rejected` is recoverable, and `paymentStatus` is a parallel axis. Yet: (a) the approver's dashboard dropdown is hardcoded to `['Submitted','Approved','Rejected']`, so an approver cannot put a PR on hold from the list even though the matrix permits it; (b) the admin's dropdown offers all 8 statuses regardless of legality and, when the matrix refuses, **silently falls back to a raw field write** — `Received → Ordered` succeeds with no warning and no stamp bookkeeping; (c) the table's single Status column never shows `paymentStatus`, so `Received/Unpaid` and `Received/Paid` are visually identical. | `dashboard.js:9,69,128–131,97`; `status.js:6–15`; `prs.gs:21–30` | approver, admin | **high** | (a),(c) suboptimal; (b) **broken** |
| 8 | **Courier and tracking are unreachable.** `courier`, `trackingNo`, `trackingLink` are backend-editable and rendered on PR detail with a five-carrier deep-link table — but **no screen in the app writes them**. `FALLBACK.couriers` and `COURIER_URLS` are dead support code for a field only the spreadsheet can fill. The "In transit — trackable shipments" KPI points at a capability that does not exist in the UI. | `prs.gs:12–14`; `prDetail.js:7–15,98–100`; `prForm.js:12`; `dashboard.js:51` | all | **high** | **broken** |
| 9 | **Every mutation costs a full-dataset refetch and two whole-page `innerHTML` rebuilds.** `store.refresh()` emits once on `loading:true` and again on resolve; each emit rebuilds `#app` end to end. Scroll position collapses to top, `document.activeElement` is destroyed, and the refetch pulls every PR, every item, every vendor, project, type and notification — with no pagination anywhere. An approver clearing a queue is thrown back to the top of the list after each decision. | `state.js:16–38`; `main.js:57,126–131` | approver, admin | **high** | suboptimal |
| 10 | **The accessibility floor is at zero.** The entire app contains **one** ARIA attribute (`aria-label` on the toast close button). No `role`, no `tabindex`, no `aria-live`, no `aria-expanded`. KPI tiles, table rows, vendor cards and combobox options are click-handled `<div>`/`<tr>` — unreachable by keyboard. `admin.js` contains zero `<label>` elements. Both PR-form comboboxes use `<div class="pd-field">`, so Vendor and Currency have no programmatic name. Toasts are the only error channel and are never announced. | `ui.js:18`; `dashboard.js:83,92`; `vendors.js:41`; `prForm.js:125,130,219–221`; `admin.js:134–136,156–157` | all | **high** | suboptimal |

**Just off the list**, in order: the fake pager (`admin.js:170–177`, **broken**); the
"Total spend" tile showing only the largest single currency while reading as a
total (`dashboard.js:53`); "New PR" being reachable only from the dashboard
(`main.js:14–20`); no client-side route guard, so `#/admin` as a requester
renders a raw backend error string as the whole page (`main.js:108`;
`admin.js:67`); and the two contradictory primary buttons
(`.btn.primary` `#0E7B5B` at `prForm.js:115` vs `.adm-addbtn` `#006e16` at
`adminVendors.js:133`).

---

## Corrections to BRIEF §3

Two of the five debt items in the brief are misstated. Repeating them would let a
direction claim credit for fixing a non-bug, and would understate a real one.

**`--adm-green-bg` used at line 25, declared at line 97 — this is NOT broken.**
CSS custom properties resolve at computed-value time through the cascade, not in
source order. Both declarations sit on `:root`, so `.avatar-txt` receives
`#daeddb` correctly. File it as a **maintenance hazard** (`styles.css:25,98`), not
a defect. Severity: **low**, class **suboptimal**.

**`.vcard:hover{border-color:var(--disp)}` does considerably more than nothing.**
`--disp` is `'Space Grotesk',sans-serif`. Substituting a font-family into
`border-color` makes the declaration *invalid at computed-value time*, which per
the CSS Variables spec sets a non-inherited property to its **initial** value —
for `border-color` that is `currentcolor`, inherited here from `body`'s
`--ink: #14241C`. So hovering a vendor card does not lose the border; it swaps a
`#DEE7E1` hairline for a near-black one. `styles.css:208`. Severity **medium**,
class **broken**.

> This is the one claim in this document derived from spec reasoning rather than
> observation. It is worth a 30-second browser check before a direction cites it.

**Media-query count.** The brief says three; the file contains four `@media`
at-rules — `print` (`:88`), `max-width:700px` (`:168`), and two separate
`max-width:900px` blocks (`:201`, `:203`) that could be one. Three of them are
non-print. The brief's substance is right; the count is loose.

---

## 1. Per-view friction walkthrough

### 1.1 Global chrome — topbar, notifications, profile

Present on every view, so its friction is paid on every view.

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-01 | Nav exposes only Dashboard / Vendors / Admin. **"New PR" — the tool's reason to exist — is a button on the dashboard only.** From PR detail, Vendors, or Admin there is no path to raise a PR without first navigating home. | `main.js:14–20,46–48`; `dashboard.js:21–24` | requester | high | suboptimal |
| F-02 | `minRole` is enforced on *nav visibility* only, never on the view itself. `view.fn(...)` runs unconditionally. A requester typing `#/admin` gets `adminView`, which calls `usersList`, gets rejected, and renders the raw backend string *"Your role (requester) cannot perform usersList"* as the entire page body. | `main.js:46–48,108`; `admin.js:63–68`; `Code.gs:31–33` | requester | high | **broken** |
| F-03 | Notification panel and profile menu are `hidden` toggles with **no Escape key, no outside-click close, no focus management, no `aria-expanded`**. Both stay open until their own trigger is clicked again. | `main.js:91–106` | all | medium | suboptimal |
| F-04 | Opening the bell marks **everything** read immediately and irreversibly. No per-item read state, no mark-unread, no "N new since last visit". A glance destroys the unread signal. | `main.js:92–100`; `notifications.gs:64–72` | all | medium | suboptimal |
| F-05 | Notification timestamps are `String(n.ts).slice(0,16).replace('T',' ')` — raw UTC, unlabelled as UTC, never relative. A user in IST reads a time 5h30m behind their wall clock with nothing saying so. | `main.js:73` | all | medium | suboptimal |
| F-06 | Notification list is capped at 30 server-side with no "see all" and no way to reach older items. | `notifications.gs:49–61`; `main.js:70–74` | all | low | suboptimal |
| F-07 | The profile menu is nested *inside* its own trigger, and the handler only excludes `#btnOut`. Clicking your own email address inside the open menu closes it. | `main.js:77–84,104–106` | all | low | **broken** |
| F-08 | Material Symbols are ligature text loaded from a remote font. Until it arrives, users see the literal words **refresh, notifications, delete, add, person_add, storefront, category, shield_person, chevron_left, chevron_right, close, check_circle, error** rendered as body text. On a cold mobile connection this is seconds of visibly broken UI. | `index.html:9`; `main.js:62,66`; `admin.js:44,49,54,59,163,173,175`; `ui.js:13` | all | medium | suboptimal |
| F-09 | The refresh button is the only recovery affordance in the app, is icon-only, and lives in a dark bar between the nav and the bell — the lowest-salience position for the highest-stakes control when data has failed to load. | `main.js:61–63` | all | medium | suboptimal |
| F-10 | The auth gate renders **only at boot** when there is no token. There is no re-authentication path mid-session; expiry is handled by `location.reload()`. See top-10 #3. | `main.js:137`; `state.js:32–35` | all | critical | suboptimal |

### 1.2 Dashboard (`#/`)

The journey: land → (maybe) pick a tab → scan six tiles → click a tile to filter →
scroll a table → click a row. There is no other verb on this screen.

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-11 | No search, sort, filter, or pagination. See top-10 #5. | `dashboard.js:75–100` | approver, admin | high | suboptimal |
| F-12 | The table has **no `overflow-x:auto` wrapper**, unlike every admin table. Seven columns force horizontal scroll on the whole document instead of within the card. Same component, one hardened, one not. | `dashboard.js:89` vs `admin.js:139,235`, `adminVendors.js:40` | all | high | suboptimal |
| F-13 | The Status column renders **two different affordances in the same column**: a `<select>` for admins/approvers, a static chip for requesters. For an admin, *every row* becomes a dropdown — the visually loudest element in the table is a control one mis-click from changing state. | `dashboard.js:66–73,97` | admin | high | suboptimal |
| F-14 | Only `Rejected` and `Cancelled` confirm. `Ordered`, `In Transit` and `Received` apply instantly, with no undo and no confirmation, from a dropdown inside a clickable row. | `dashboard.js:114–140` | approver, admin | high | suboptimal |
| F-15 | Admin status dropdown offers all 8 statuses irrespective of the transition matrix, then silently bypasses it via `update` when `canTransition` refuses. Illegal moves succeed without approver/receipt stamp handling. See top-10 #7(b). | `dashboard.js:69,128–131`; `status.js:6–15` | admin | high | **broken** |
| F-16 | Approver dropdown is hardcoded to the approval loop, so an approver cannot reach `On Hold` from the list even though `Submitted → On Hold` is permitted. The most common real-world "I need more information" action is unavailable where the work happens. | `dashboard.js:9,69`; `status.js:7` | approver | high | suboptimal |
| F-17 | `paymentStatus` — a parallel axis per `sample-data.md` — is absent from the table entirely. `Received/Unpaid` is indistinguishable from `Received/Paid`. It surfaces only as one KPI count and one PR-detail field. | `dashboard.js:89–98`; `prDetail.js:63` | approver, admin | high | suboptimal |
| F-18 | The "Total spend" tile shows only `spendTotals[0]` as its headline and relegates every other currency to a `+ …` sub-line. With INR, USD, EUR and GBP all in play, the biggest number on the dashboard reads as a total and is not one. | `dashboard.js:53`; `metrics.js:4–13` | approver, admin | high | suboptimal |
| F-19 | Tiles use **inconsistent denominators**. `receivedPct` divides by *all* PRs including Cancelled and Rejected; `spendTotals` and `unpaid` exclude them. Two tiles side by side describe different populations without saying so. | `metrics.js:16–27` | approver, admin | medium | suboptimal |
| F-20 | Amounts use `fmtCompact` here (`₹1.2L`) but `fmtMoney` on detail (`₹1,20,000`). Below the lakh boundary compact prints in full, above it rounds to one decimal — so `₹98,000` and `₹1.2L` sit in the same column and cannot be compared or checked. | `dashboard.js:96`; `prDetail.js:83–89`; `currency.js:46–55` | approver, admin | medium | suboptimal |
| F-21 | The Item column shows first description + `(+N more)` only. `qtySummary()` is computed for every PR in `decoratePrs` and displayed **nowhere**. | `dashboard.js:95`; `items.js:28–32,40` | all | low | suboptimal |
| F-22 | Row click navigates, but there is no visible hit target, no cursor affordance beyond `cursor:pointer`, no chevron, and no `<a>`. Nothing tells a first-time user the rows are clickable until they hover. | `dashboard.js:92,111`; `styles.css:61–62` | all | medium | suboptimal |
| F-23 | The `mine` tab is the default for everyone including approvers, whose actual job lives in a queue of *other people's* Submitted PRs. An approver lands on a screen about themselves and must click to reach their work. | `dashboard.js:11,38–45` | approver | high | suboptimal |
| F-24 | Nothing on this screen conveys **age**. `sample-data.md` calls out PR-2026-0141 waiting 3 days and PR-2026-0138 held 6 days as the rows that should scream. The table shows only creation date; `aging()` exists, tested, unused. | `dashboard.js:89–98`; `reports.js:26–31` | approver | high | suboptimal |
| F-25 | No reports section exists, despite BRIEF §2 describing this view as "KPI tiles + filterable PR table + reports". `spendBy`, `spendByMonth`, `spendByMaterialType`, `statusCounts`, `aging`, `vendorPerformance`, `toCSV`, `monthlyTrend`, `pipelineGroups`, `currenciesOf` are all implemented, all unit-tested, and imported by nothing. `.bar/.fill/.lbl/.val` chart CSS is likewise dead. **Diagnosis only: the capability exists and is unsurfaced; no new endpoint is needed to reach it.** | `reports.js` (whole file); `metrics.js:63–100`; `styles.css:84–87`; `tests/reports.test.js` | approver, admin | medium | suboptimal |
| F-26 | Tab and tile selection live in a module-scope `UI` object that survives navigation but not reload, and is never reflected in the URL. An approver cannot bookmark or share "pending approvals". | `dashboard.js:11,102–110` | approver, admin | medium | suboptimal |

### 1.3 PR form (`#/new`, `#/new/<id>`)

The most important journey in the product and the one with the most friction.

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-27 | Line-item grid has no mobile design. See top-10 #1. | `styles.css:197–203`; `prForm.js:165–176` | requester | critical | suboptimal |
| F-28 | Even on desktop the grid is hostile between ~900px and ~1200px: `1.2fr` columns hold **Purchase link** and **Datasheet / doc URL**, i.e. two full URLs in inputs of roughly 120–140px, while Qty gets a fixed `70px` and Unit `80px`. | `styles.css:197` | requester | high | suboptimal |
| F-29 | **Silent dead ends when department lists are empty.** If the requester's department has no projects, no item types, or no vendors, the corresponding controls render as empty-but-`required` selects or a combobox that answers "No match" forever. The real reason is known only to the backend, which returns it *after* submission. A brand-new user cannot self-diagnose. | `prForm.js:88–101,123,57,221`; `prs.gs:119–136` | requester | high | suboptimal |
| F-30 | The user's **department is never displayed on the form**, yet it silently scopes projects, vendors and item types and is stamped onto the PR from the account. The single variable controlling three dropdowns is invisible. | `prForm.js:87`; `prs.gs:153–155` | requester | high | suboptimal |
| F-31 | If `me.department` is unset the form still renders fully and submission fails with *"Your department is not set — ask an admin…"*. No pre-flight check; the user fills the whole form first. | `prForm.js:87`; `prs.gs:119` | requester | high | suboptimal |
| F-32 | **No draft persistence, no exit warning.** `Cancel` is a plain `<a href="#/">` — one tap discards everything. Browser back does the same. Combined with F-10 (token expiry reload) this is the app's largest data-loss surface. | `prForm.js:114`; `main.js:129` | requester | critical | suboptimal |
| F-33 | Submit lives in `.adm-head` outside the form, and the header is **not sticky**. On a 6-item PR the only submit control is scrolled off the top of the page. | `prForm.js:113–117`; `styles.css:103` | requester | high | suboptimal |
| F-34 | Remove-item on the last remaining row is a no-op: the guard returns silently, the button is never disabled, no message appears. The control lies about its availability. | `prForm.js:200–202` | requester | medium | **broken** |
| F-35 | The remove button is `.btn danger` — solid red, full weight — repeated once per row. On a 5-item PR the five loudest elements on screen are all destructive, competing directly with the single primary Submit. | `prForm.js:63`; `styles.css:46` | requester | medium | suboptimal |
| F-36 | **No per-row line total.** The only money feedback is one `#liveTotal` span styled as muted body text next to "+ Add item". A pricing error on row 3 of 6 is invisible. | `prForm.js:177–180,189–197` | requester | high | suboptimal |
| F-37 | Both comboboxes commit on `blur` via a 120 ms `setTimeout`, snapping unrecognised text back to the last committed value with no message. Typing a vendor name that nearly matches silently reverts. | `prForm.js:235–245` | requester | high | suboptimal |
| F-38 | `input.onfocus` calls `input.select()`. On mobile, tapping a filled Vendor or Currency field selects its whole contents, so the first keystroke erases the committed value. | `prForm.js:224` | requester | high | suboptimal |
| F-39 | The combobox has **no keyboard interaction at all** — no arrow keys, no Enter to select, no Escape to close. Options are `<div>`s bound to `mousedown`. | `prForm.js:212–246,219–221` | all | high | suboptimal |
| F-40 | `.curList` is absolutely positioned below its input with `max-height:230px`. On a phone with the soft keyboard raised, a field in the lower half of the form opens its list underneath the keyboard. | `styles.css:258–259`; `prForm.js:128,133` | requester | high | suboptimal |
| F-41 | Tooltip edge-anchoring (`edge` → `.hq.r`) is passed by hand per field, assuming a fixed column order. But `.pd-grid` is `auto-fit minmax(180px,1fr)`, so which field sits in the last column changes with viewport width. The manual anchoring is correct at one width and wrong at most others. | `prForm.js:39–40,135,172–173`; `styles.css:233,254` | requester | medium | **broken** |
| F-42 | Editing an existing PR **rewrites all item rows wholesale** (`writeItemsForPr_` deletes then re-appends). The UI gives no indication that item numbering and identity are not preserved. | `prForm.js:293`; `items.gs:57–69`; `prs.gs:186–195` | requester | medium | suboptimal |
| F-43 | `paymentTerm` is collected in the admin-only Procurement block, but `create` hardcodes `pr.paymentTerm = ''` with the comment *"lives on the vendor record now"*. The form asks for a field the create path throws away and the vendor record already owns. | `prForm.js:156`; `prs.gs:157`; `adminVendors.js:128–130` | admin | medium | **broken** |
| F-44 | The form is the **only** view exempted from re-render, so while it is open the notification badge, refresh spinner and any newly added project/vendor/type are frozen. The guard is necessary given `innerHTML` rendering; the cost is an interface that quietly stops being live. | `main.js:112–131` | requester | medium | suboptimal |
| F-45 | Validation is entirely native `required` with no `:invalid` styling anywhere in the stylesheet, so an invalid field looks identical to a valid one until the browser balloon appears. Server-side rules (qty > 0, unit non-empty, type must belong to the department) are not mirrored client-side and surface only as toasts after a round trip. | `prForm.js:57–59,123`; `prs.gs:137–148`; `styles.css` (no `:invalid` rule) | requester | high | suboptimal |
| F-46 | Header fields and item fields are visually indistinguishable — both are `.pd-form` inside identical `.card`s. Nothing signals that the top block is *the request* and the bottom block is *repeating rows*. | `prForm.js:118–182` | requester | medium | suboptimal |

### 1.4 PR detail (`#/pr/<id>`)

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-47 | Just-created PRs render "not found". See top-10 #6. | `prDetail.js:32`; `prForm.js:297–301` | requester | high | **broken** |
| F-48 | Status actions render as an undifferentiated row of `Mark X` buttons. `nextStates()` correctly returns the legal set, but nothing distinguishes the expected next step from the exceptional ones, and the buttons are ordered by object-key order in the matrix, not by likelihood. | `prDetail.js:49`; `status.js:6–15,23–25` | approver, admin | high | suboptimal |
| F-49 | **Rejecting captures no reason.** The transition writes approver, timestamp and status; there is no reason field in the UI, in `PR_HEADERS`, or in the notification, which says only *"Your PR X was rejected by Y."* `sample-data.md` treats the rejection reason as essential content. | `prDetail.js:129–138`; `prs.gs:1–5,214,221–225` | requester | high | suboptimal |
| F-50 | **`On Hold` captures no reason either**, and nothing displays how long a PR has been held. `sample-data.md` names this explicitly: *"On Hold with no visible reason is a real friction point today."* | `prDetail.js:49`; `prs.gs:21–30` | all | high | suboptimal |
| F-51 | Courier / tracking / received-date are rendered but unwritable. See top-10 #8. | `prDetail.js:92–104` | all | high | **broken** |
| F-52 | **Notes are filed under "Delivery."** A free-text field the requester wrote for the approver sits in the shipping card, below Expected and Received dates. | `prDetail.js:101` | approver | medium | suboptimal |
| F-53 | Currency is never labelled anywhere on this view. It is inferable only from the symbol prefixed to each amount, and `fmtMoney` falls back to `CODE + ' '` for anything outside the 11 known symbols — so a CHF PR reads `CHF 4,820` with no field confirming the currency. | `prDetail.js:83–89`; `currency.js:1,39–44` | all | medium | suboptimal |
| F-54 | There is **no history or audit trail**. The backend writes a full `Log` sheet on every create, update, transition and delete, with before→after diffs. None of it is exposed. Who changed what and when is invisible in the product. | `prs.gs:75–77,196–200`; no consuming UI | approver, admin | high | suboptimal |
| F-55 | The delete card is styled `.pd-danger` with three `!important` overrides fighting `.dash .card`, and its guard is a single native `confirm()` with no type-to-confirm on a genuinely irreversible action that also deletes all item rows. | `prDetail.js:119–126,141–150`; `styles.css:241`; `prs.gs:230–238` | admin | medium | suboptimal |
| F-56 | The "not found" state renders a bare `.card` **outside** any `.dash` wrapper, so it silently picks up the legacy card treatment (12px radius, `--line` border, no shadow) while every other card on the same route is 16px/`--adm-outline`/shadowed. | `prDetail.js:32`; `styles.css:42,181` | all | low | suboptimal |
| F-57 | Line items are a plain `.tbl` with 7–8 columns and no `overflow-x` wrapper — the same unhardened pattern as the dashboard (F-12). | `prDetail.js:76–88` | all | medium | suboptimal |

### 1.5 Vendors (`#/vendors`, `#/vendors/<name>`)

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-58 | `.vcard:hover` turns the border near-black. See "Corrections to BRIEF §3". | `styles.css:208` | all | medium | **broken** |
| F-59 | No search, no filter, no sort control on the card grid — one alphabetical wall of cards. With ten vendors it is fine; the registry is designed to grow. | `vendors.js:62–76` | all | medium | suboptimal |
| F-60 | Vendor logos are fetched from `google.com/s2/favicons` per card. The `onerror="this.remove()"` fallback is sound, but every render fires N third-party requests, and the referrer leaks which vendors Oizom buys from. | `vendors.js:13–21` | all | medium | suboptimal |
| F-61 | Every card renders four stats of equal weight — Purchase reqs, Total spend, Unpaid, Last order — with no hierarchy. Unpaid, the only actionable one, is distinguished solely by turning a number red. | `vendors.js:50–55`; `styles.css:219–222` | all | medium | suboptimal |
| F-62 | "Total spend" on a card shows the top currency plus a bare `+` when others exist — less honest than the dashboard's `+ …` and easily read as an exact figure. | `vendors.js:37–39` | all | medium | suboptimal |
| F-63 | Vendor ↔ PR joining is a raw case-insensitive **name string**. Renaming a vendor in Admin orphans its entire purchase history from the card stats, silently. Nothing in the UI warns of this at rename time. | `vendorStats.js:6–9`; `adminVendors.js:182–184` | admin | high | suboptimal |
| F-64 | The detail view's "Edit in Admin" link goes to `#/admin` generically — it lands on whichever tab was last open and does not select the vendor. | `vendors.js:112`; `admin.js:17` | admin | low | suboptimal |
| F-65 | Chips are capped at 3 with `+N more` and no way to expand. A vendor mapped to five departments shows two of them. | `vendors.js:23–32` | all | low | suboptimal |
| F-66 | Card labels say "Purchase reqs"; the detail view says "Purchase requests". Same metric, two names, one screen apart. | `vendors.js:51` vs `:117` | all | low | suboptimal |

### 1.6 Admin — Users, Projects, Item Types (`#/admin`)

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-67 | **The pager is fake.** "Page 1 of 1" is hardcoded, both chevrons are permanently `disabled`, and "Showing N of N active members" uses the same number twice while the table also lists role-less *Pending* users — so the label contradicts its own contents. Decorative chrome implying functionality that does not exist. | `admin.js:170–177` | admin | high | **broken** |
| F-68 | `USERS` is fetched **once per page load** and thereafter mutated only by `userSet` responses. The topbar refresh button does not touch it. Two admins working simultaneously see divergent tables with no staleness indicator and no way to reload short of F5. | `admin.js:15,64–68,190–191` | admin | high | **broken** |
| F-69 | "Remove user" actually writes `role: ''`, which the same file renders as **Pending**. So a user "removed" with a confirm that says *"This action is permanent"* reappears in the table one row up. The copy is false and the mental model is wrong. | `admin.js:201–205,119–120,158–160` | admin | high | **broken** |
| F-70 | Role and department changes fire on `change` with **no confirmation and no undo**, then trigger a full `adminView` re-render that destroys focus. Demoting the wrong person is one mis-scroll on a `<select>`. | `admin.js:197–200,188–195` | admin | high | suboptimal |
| F-71 | The "Last admin protection active" banner is permanent, system-voiced, and consumes the top of the table forever. The protection is real (`users.gs:42–48`); the banner conveys nothing after the first read and never reflects state. | `admin.js:125–130` | admin | medium | suboptimal |
| F-72 | Role reference cards sit **below** the table, so the explanation of what a role means is off-screen at the moment the admin is choosing one. | `admin.js:179–184` | admin | medium | suboptimal |
| F-73 | The add-user row toggles `showAdd`, re-renders the whole view, then focuses the first input. Any error mid-flow resets `showAdd = false`, discarding a partially typed email with no recovery. | `admin.js:100–107,192` | admin | medium | suboptimal |
| F-74 | The add-user form performs **no client-side validation** — not even that the email contains `@oizom.com`, despite that being a hard access requirement. | `admin.js:206–212` | admin | medium | suboptimal |
| F-75 | The avatar palette contains `'#d1e5f7'` and `'#d1e5f9'` — two colours two hex digits apart, almost certainly a typo. The hash distributes across 4 slots but produces 3 perceptually distinct colours, weakening the identity cue it exists to provide. | `admin.js:12,33–37` | admin | low | **broken** |
| F-76 | Deleting a project or item type is a single `confirm()` with **no usage check**. Nothing tells the admin that 14 live PRs reference the type they are about to remove, which would render those PRs uneditable (the form's `opts()` re-adds the stored value, but new items cannot select it). | `admin.js:275–280`; `prForm.js:44–48` | admin, requester | high | suboptimal |
| F-77 | The department list is derived by union of `lists.departments` and whatever appears in `PROJECTS` — there is no department registry in the UI. A typo'd department in a project row silently becomes a selectable department everywhere. | `admin.js:216–220`; `adminVendors.js:16–20` | admin | medium | suboptimal |
| F-78 | Four tabs share one `.adm-head` whose title, description and button all swap. The primary button changes meaning entirely (Add User → Add Project → Add Item Type → Add Vendor) while staying in the same position with the same colour. | `admin.js:40–61,74–92` | admin | medium | suboptimal |

### 1.7 Admin → Vendors (`adminVendors.js`)

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| F-79 | `VENDORS` is seeded from the store once and thereafter only replaced by mutation responses. It never re-syncs, so the Admin vendor list drifts from the `#/vendors` view rendering the same data. Same defect shape as F-68. | `adminVendors.js:6,11–14` | admin | high | **broken** |
| F-80 | The vendor editor **is not a route**. It is `SELECTED` module state, so it has no URL, cannot be linked or bookmarked, and browser back exits the whole Admin view rather than closing the editor. | `adminVendors.js:7,29–31,151–155` | admin | high | suboptimal |
| F-81 | `SELECTED` is not reset when the view is entered — only on tab click. Navigating away from Admin with a vendor open and returning re-opens that editor unexpectedly. | `admin.js:94–99`; `adminVendors.js:188` | admin | medium | suboptimal |
| F-82 | Renaming a vendor writes `updates.name` and reassigns `SELECTED`, with **no warning that the PR↔vendor join is by name** (F-63). The confirm text for *removal* explains the consequence; the far more damaging rename says nothing. | `adminVendors.js:177–185` vs `:157` | admin | high | suboptimal |
| F-83 | Department chips toggle a CSS class only. Nothing marks the form dirty; a user who toggles three departments and closes with `Cancel` or `×` loses the change with no prompt. | `adminVendors.js:175,170–174` | admin | medium | suboptimal |
| F-84 | Account number, IFSC and SWIFT render as plain always-visible text inputs with no masking, no reveal toggle, and no access note — on a screen that also renders inside a full-page `innerHTML` rebuild on every refresh. `vendors.js:81–82` documents the deliberate decision to hide these from the read-only view; the editor gives them no treatment at all. | `adminVendors.js:121–127`; `vendors.js:81–82` | admin | medium | suboptimal |
| F-85 | The form mixes `.adm-addbtn` (submit) with `.btn` (cancel) — two different button systems, different radius, size, weight and colour, 12px apart. | `adminVendors.js:132–135` | admin | medium | suboptimal |
| F-86 | Adding a vendor immediately creates an empty registry record, then opens the editor. Abandoning at that point leaves a name-only vendor in the registry, already selectable in PR forms for any department later mapped to it. | `adminVendors.js:161–167` | admin | medium | suboptimal |
| F-87 | The editor shows only INR spend (`spendTotals.find(c === 'INR')`), hardcoded — so a USD-only vendor like Mouser or DigiKey reads **₹0** in its own admin panel. | `adminVendors.js:66,83` | admin | high | **broken** |

---

## 2. Design-token drift

BRIEF §3 identifies two stacked systems. This completes the inventory. All line
references are `frontend/src/styles.css` unless stated.

### 2.1 Colour — the same role expressed many ways

**Greens (primary accent): five distinct values, no rule for which applies where.**

| Value | Token / selector | Line | Where it lands |
|---|---|---|---|
| `#0E7B5B` | `--brand` | 2–3 | `.btn.primary`, links, `.chip.Approved`, `.chip.Received`, `.toast .t-ico`, `.bar .fill`, `.kpi.go .v`, `.kpi.clickable:hover` |
| `#006e16` | `--adm-secondary` | 97 | `.adm-addbtn`, `.adm-tab.active`, `.dash .kpi.sel`, `.dash .kpi.clickable:hover` |
| `#306f37` | `--adm-green` | 98 | `.avatar-txt`, `.adm-pill`, `.adm-chip.on`, `.adm-banner-left` |
| `#3ECF9A` | literal | 13 | `.topbar .logo b` |
| `#1e7d3f` | literal | 216 | `.vc-badge.dom` |

The consequence is directly visible: `.kpi.clickable:hover` borders go `--brand`
while `.dash .kpi.clickable:hover` — the *same tiles*, since every dashboard is
inside `.dash` — go `--adm-secondary`. Two green systems race on one element.
Likewise `.btn.primary` (`#0E7B5B`) and `.adm-addbtn` (`#006e16`) are both
"the primary button" and appear on the same screens.

**Reds: six values across two systems.**

| Value | Token / selector | Line |
|---|---|---|
| `#B3362B` | `--red` | 4 |
| `#FAE6E3` | `--red-soft` | 4 |
| `#ba1a1a` | `--adm-error` | 99 |
| `#ffdad6` | `--adm-error-bg` | 99 |
| `#c62828` | literal — `.nbadge`, `.vc-bad` | 29, 222 |
| `#f0c4c4` / `#fdf7f7` | literal — `.pd-danger` border/background | 241 |

**Ambers: two parallel pairs.** `--amber #B25E09` / `--amber-soft #FBEEDC`
(line 4) versus the literal `#a05a00` on `#fff4e0` in `.adm-pill.pend` (line 144).
Same semantic (warning / pending), no shared token.

**Blues: four.** `--blue #2A5FAA` / `--blue-soft #E4ECF8` (line 5);
`.vc-badge.for` `#3d4db7` on `#eef1ff` (line 217); `--adm-primary #132535`
(line 97) doing duty as both a text colour and a focus colour; and the JS avatar
palette (`admin.js:12`).

**Surfaces: `--panel` and `--adm-lowest` are the identical value `#FFFFFF`,
declared 95 lines apart** (lines 2, 98). Beyond them: `--bg #F4F7F5`,
`--adm-low #f5f3f3`, `--adm-surface #fbf9f8`, `--grey-soft #ECF0ED`, and the
literal `#f4f4f5` in `.vc-badge.mix` (218) — five near-white greys with no
documented ordering.

**Borders: two incompatible tokens plus four hardcoded alphas.**
`--line #DEE7E1` is green-tinted and very light; `--adm-outline #c3c7cc` is
neutral and much darker. They are not interchangeable, yet both are used for card
edges, input edges and table rules depending on which system a selector came from.
Hardcoded derivations that should be token references:
`rgba(48,111,55,.2)` (115), `rgba(48,111,55,.3)` (164),
`rgba(195,199,204,.5)` (170 — literally `--adm-outline` at 50%),
`rgba(255,218,214,.2)` (146 — `--adm-error-bg` at 20%).

**Text: `#5c6f7e` appears three times and exists in no token set** — it is the
stroke colour baked into the chevron SVG data-URI, duplicated verbatim at lines
137, 194 and 256. Changing the input chevron colour requires three edits inside
URL-encoded SVG. Plus `#555` (218) and `#cfe0d7` (15) as literals.

### 2.2 Same component styled twice

| Component | Treatment A | Treatment B | Divergence |
|---|---|---|---|
| Card | `.card` — 12px radius, `--line`, 16px padding, no shadow (42) | `.dash .card` — 16px radius, `--adm-outline`, 0 padding, shadow (181–182) | Radius, border token, padding, elevation. B wins everywhere; A survives only in loading/error cards (`admin.js:66–67`, `prDetail.js:32`), so the legacy card is visible **only when something has gone wrong**. |
| KPI tile | `.kpi` — 12px, `--line`, 14px pad, no shadow (69) | `.dash .kpi` — 16px, `--adm-outline`, 16px pad, shadow (175–176) | Same four axes. |
| Table | `.tbl` — 8/10 head, 9/10 cell (57–58) | `.dash .tbl` — 16px head, 14/16 cell (186–188) | `.adm-tbl` is a **third**: 16/24 head, 24px cell (124–126). Three padding scales for one component. |
| Heading | `.card h2` — Space Grotesk 16px (43) | `.dash .card>h2` — Inter 16px 600 (183) | B explicitly overrides the display face back to body face. |
| Button | `.btn` — 9px radius, `--line`, 8/14 pad, 13px (44) | `.adm-addbtn` — 12px radius, `--adm-secondary`, 12/24 pad, 12px 500, shadow (106–108) | Radius, colour, padding, size, weight, elevation — every axis. |
| Input | `.filters input` — 9px, white, `--line` (64) | `.dash input` — 8px, `--adm-surface`, `--adm-outline` (191–192) | `.adm-input` is a **third** (120–121). |
| Avatar | `.avatar-txt` — `--adm-green-bg` / `--adm-green` (25) | `.adm-avatar` — JS hash palette / `--adm-primary` (131–132, `admin.js:12`) | The same person is green in the topbar and pastel-blue in the users table. |
| Micro-label | `.tbl th` 11px/.04em (57) · `.adm-tbl th` 11px/.05em (124) · `.adm-sec` 11px/.05em (154) · `.vc-l` 10px/.4px (221) · `.ithead span` 10px/.4px (200) | — | Five near-identical uppercase labels; `.4px` at 10px **is** `.04em`, so the same value is expressed in two units. |

### 2.3 Broken or dead declarations

| ID | Declaration | Line | Diagnosis | Class |
|---|---|---|---|---|
| T-01 | `.vcard:hover{border-color:var(--disp)}` | 208 | Font-family substituted into a colour property → invalid at computed-value time → initial value `currentcolor` → resolves to `--ink #14241C`. Hover produces a near-black border, not no border. | **broken** |
| T-02 | `form.pr{...}`, `form.pr label{...}`, `form.pr .full{...}` and the `form.pr` half of the line-64 selector | 64–67 | No element in the app carries `class="pr"`. The PR form is `<form id="prForm">` with no class. Entirely dead — including the grid definition and the `.full` span helper. | dead |
| T-03 | `.filters` and `.dash .card .filters` | 63, 184 | Fully styled filter bar, including its dashboard-specific header treatment. No view renders it. This is the visual design for the missing dashboard filtering (F-11) sitting unused in the stylesheet. | dead |
| T-04 | `.bar`, `.bar .fill`, `.bar .lbl`, `.bar .val` | 84–87 | Horizontal bar-chart primitives for the reports view that was never built (F-25). | dead |
| T-05 | `.chip.In.Transit` | 53 | Matches only because `chip()` interpolates `"In Transit"` into `class=` and the browser splits it into two classes, `In` and `Transit`. Works by accident. The sibling `[data-s="In Transit"]` on the same line is the intentional mechanism; `"On Hold"` has no class-based rule at all, only the attribute one (55). Half the status styling uses one mechanism, half the other. | **broken** (fragile) |
| T-06 | `--adm-green-bg` used at line 25, declared at line 97 | 25, 98 | **Works.** Custom properties resolve through the cascade, not source order. Maintenance hazard only — see Corrections. | suboptimal |
| T-07 | `@media print` hides `.topbar, .filters, .btn, .auth-gate` | 88 | `.filters` never renders; `.adm-addbtn`, `.adm-del`, `.adm-tabs`, `.npanel`, `.pmenu`, `.toast`, `.status-sel` are all missed. Printing a PR detail — a plausible need — emits the tab bar and the admin delete button. | **broken** (incomplete) |
| T-08 | `.status-sel` styled with `--line` and 8px radius | 60 | Sits exclusively inside `.dash .tbl`, where every sibling control uses `--adm-outline` and `--adm-surface`. The one control that never got migrated. | suboptimal |
| T-09 | `.pd-form label` sets `text-transform:uppercase` + 10px + 600 on the label *container*, forcing three separate undo rules | 242, 244, 261, 264 | `.pd-form input,select,textarea`, `.curOpt` and `.curEmpty` each re-declare `text-transform:none;letter-spacing:0;font-weight:400` to escape an inherited label style. Any new control inside `.pd-form` inherits uppercase 10px text until someone notices. | suboptimal |
| T-10 | `.dash select,.dash input` does not match `textarea` | 191, 245 | Because the selector lists element names rather than a class, `.pd-form textarea` had to hand-copy the entire input treatment. The duplication is caused purely by selector shape. | suboptimal |
| T-11 | `AVATAR_BGS = ['#d1e5f7','#8cfb85','#d1e5f9','#e4e2e1']` | `admin.js:12` | `#d1e5f7` and `#d1e5f9` differ by two hex digits — indistinguishable. Four slots, three perceived colours. | **broken** |
| T-12 | `.hq{background:var(--adm-outline)}` | 249 | A border token used as a fill, producing white-on-`#c3c7cc` at **1.70:1** for the help affordance (top-10 #2). | **broken** |

### 2.4 Scale drift

**Radius — eleven values:** `4px` (152), `5px` (85), `6px` (215, 224), `8px`
(15+ rules), `9px` (44, 60, 64), `10px` (21), `12px` (14+ rules), `16px` (80, 117,
175, 181), `50%` (24, 248), `999px` (17, 48), `9999px` (29, 131, 142). `999px` and
`9999px` are the same intent written two ways; `8px` vs `9px` and `12px` vs `16px`
are same-role collisions between the two systems.

**Type — sixteen sizes in CSS plus five more inline in JS:** 9, 10, 11, 11.5, 12,
12.5, 13, 13.5, 14, 15, 16, 17, 18, 20, 22, 32 px in `styles.css`; 12, 18, 20, 24
px hardcoded in `main.js:62,66`, `admin.js:44,49,54,59,173,175`,
`dashboard.js:22,93`, `vendors.js:133`, `adminVendors.js:75`. The half-pixel steps
(11.5, 12.5, 13.5) indicate a scale that was nudged by eye rather than derived.
No ratio governs it; 13 → 14 → 15 → 16 → 17 are all in use as distinct sizes.

**Spacing — 35 distinct padding declarations**, including four different card
paddings (`12px`, `14px`, `16px`, `24px`), three table cell paddings
(`9px 10px`, `14px 16px`, `24px`) and both `2px 8px` and `2px 9px` for chips
(165, 48). Gap values in use: `4, 6, 8, 10, 12, 14, 16, 20, 24, 32`. No base unit
is respected — 9px, 10px and 14px all coexist with an otherwise 4px-ish rhythm.

**Elevation — six shadows, three different rgba bases:**
`0 4px 20px -2px rgba(21,39,53,.15)` (26, 31) ·
`0 4px 20px -2px rgba(21,39,53,.08)` (108, 118, 176, 182) ·
`0 8px 24px rgba(15,31,24,.14)` (72) ·
`0 8px 24px -4px rgba(21,39,53,.18)` (259) ·
`0 0 0 2px rgba(19,37,53,.2)` (139, 196, 246) ·
`0 0 0 1px var(--adm-secondary)` (180).

**Motion — four durations and one `transition:all`:** `.12s` (252), `.15s` (128,
145 — the latter being `transition:all`), `.2s` (17, 109), plus the `.18s` toast
keyframe (72) and a 1s spin (20).

**Font family — the display face is effectively abandoned.** `--disp` (Space
Grotesk) survives on `.topbar .logo`, `.auth-box h1`, `.kpi .v` and `.card h2` —
but `.card h2` is overridden back to Inter inside `.dash` (183), and no `<h1>` in
the app uses it (`.adm-head h1` at 104 sets no family). Meanwhile `'Inter',
sans-serif` is hardcoded three times (101, 174, 183) instead of `var(--body)`, and
`var(--mono)` is applied through **inline style attributes** in seven places
(`dashboard.js:93`, `prDetail.js:43,46`, `prForm.js:106,110`, `vendors.js:133`)
rather than a class.

**Net effect for a redesign:** because every view wraps its content in `.dash` or
`.adm`, the base `.card` / `.kpi` / `.tbl` rules are dead weight in normal
operation and surface only in error and loading states — which is precisely where
a visual inconsistency is least welcome and most likely to be read as a second
failure.

---

## 3. Responsiveness

### 3.1 What responsive coverage actually exists

| Rule | Line | Covers |
|---|---|---|
| `@media print` | 88 | Incomplete — see T-07 |
| `@media (max-width:700px)` → `.adm-grid2{grid-template-columns:1fr}` | 168 | The vendor editor's paired fields only |
| `@media (max-width:900px)` → `.ithead{display:none}` | 201 | Hides the item-row column labels |
| `@media (max-width:900px)` → `.itemrow{grid-template-columns:1fr 1fr}` | 203 | Collapses the item row |

Three non-print rules, all touching two components. **Four of the six views have
zero responsive rules written for them.** Everything else survives on intrinsic
flex/grid behaviour: `auto-fit minmax()` on `.kpis` (68), `.vgrid` (206),
`.pd-grid` (233), `.adm-stats` (156), `.adm-roles` (169), `.vd-info` (227), and
`flex-wrap:wrap` on `.filters` (63), `.adm-head` (103), `.adm-addrow` (119),
`.adm-foot` (147), `.pd-people` (235), `.vc-chips` (223), `.adm-chips` (160),
`.pd-danger` (241).

Note the pattern: **`auto-fit` and `flex-wrap` degrade gracefully, so nothing
looks catastrophically broken — it looks merely unconsidered.** The failures below
are the places where neither mechanism is present.

Breakpoint figures below are derived from declared paddings, font sizes and
intrinsic content; they indicate the mechanism and rough threshold, not measured
values.

### 3.2 Below 768px

| ID | What breaks | Evidence | Sev |
|---|---|---|---|
| R-01 | **`.topbar` cannot wrap or scroll.** `display:flex`, no `flex-wrap`, no `overflow-x`, `position:sticky`. Its children are: logo image (26px) + "Procurement" (17px display type) + `nav` with `flex:1` + three icon buttons (~36px each) + profile name + 32px avatar. Intrinsic width for an admin (3 nav links) is roughly 420–480px before the profile name. Below that the flex line overflows the viewport; because `nav` is the only `flex:1` child it absorbs the compression first, then the profile name and avatar push past the right edge. The notification bell and sign-out are the first things to leave the screen. | `styles.css:11–24`; `main.js:58–85` | **high** |
| R-02 | **`.adm-tabs` cannot wrap or scroll.** `display:flex;gap:8px`, `border-bottom` — no `flex-wrap`, no `overflow-x:auto`. Four tabs (Users & Roles / Projects / Item Types / Vendors) at 14px with `10px 16px` padding have an intrinsic width in the low 400s. Below that the tab row overflows its card, and the `border-bottom` that visually anchors it does not follow. | `styles.css:110–113`; `admin.js:83–88` | **high** |
| R-03 | **Dashboard and PR-detail tables overflow the document**, because unlike `.adm-tbl` they have no `overflow-x:auto` wrapper. Seven columns of `14px 16px` padding cannot fit a phone; the result is body-level horizontal scrolling that also drags the sticky topbar. | `dashboard.js:89`; `prDetail.js:76`; `vendors.js:129` vs `admin.js:139,235` | **high** |
| R-04 | **`.adm-tbl td{padding:24px}` is never reduced.** Inside its `overflow-x` wrapper the users table stays desktop-sized on a phone: a five-column row with 48px of horizontal padding per cell plus a 40px avatar. The wrapper prevents document overflow but produces a strip of content requiring sustained sideways scrolling to read one user. | `styles.css:126`; `admin.js:139–169` | medium |
| R-05 | **`.adm-head h1` stays at 32px/40px** with no scale-down, alongside a `max-width:672px` description paragraph. On a 360px screen the page title consumes a disproportionate share of the first viewport across Dashboard, Vendors, Admin, PR detail and PR form. | `styles.css:103–105` | medium |
| R-06 | **`.hq::after` is a fixed 230px tooltip triggered on `:hover` only** — on touch there is no hover, so it never appears; where it does appear it is hand-anchored to a column position that `auto-fit` has already moved (F-41). | `styles.css:248–254` | **high** |
| R-07 | **`.npanel` is a fixed 320px** anchored `right:0` on a bell that R-01 has already pushed off-screen. If the bell is unreachable the panel is unreachable. | `styles.css:31–32` | medium |
| R-08 | **`.toast` is `min-width:280px` at `top:18px;right:18px`** — 316px of committed horizontal space. It also overlays the sticky topbar's right side, i.e. the refresh and notification controls, for 4–6 seconds. | `styles.css:72` | medium |
| R-09 | **`.curList` opens downward only**, absolutely positioned with `max-height:230px`. With a soft keyboard raised, any combobox in the lower half of the form opens its list behind the keyboard. There is no upward-flip and no scroll-into-view. | `styles.css:258–259`; `prForm.js:224` | **high** |
| R-10 | **No touch-target sizing anywhere.** `.adm-pager button` is `padding:4px` around an 18px glyph (~26px); `.adm-del` and `.iconbtn` are `padding:8px` around 20–24px glyphs (~36–40px); `.status-sel` is `padding:4px 6px` at 12px type (~24px tall); `.hq` is a 15px circle. Several primary controls fall below the 44px comfortable minimum, and `.hq` is under a third of it. | `styles.css:152,145,17,60,248` | **high** |

### 3.3 Below 400px — the PR form specifically

This is the flow BRIEF §4 names as the sharpest unsolved problem, so it gets its
own walkthrough.

At ≤900px `.itemrow` becomes `grid-template-columns:1fr 1fr` and `.ithead` is
hidden. For a Production user (`showZoho` true) the row contains nine children;
for everyone else, eight. In a two-column grid that is **four to five stacked
rows of controls per line item**, in DOM order:

| Cell | Control | Identifiable on mobile? |
|---|---|---|
| 1 | `i_description` | Yes — placeholder "Item / description*" |
| 2 | `i_partNo` (Production only) | Yes — placeholder "Zoho no" |
| 3 | `i_materialType` `<select>` | **No.** No label, no placeholder, and `opts(..., true)` prepends a blank option — so it renders empty, is `required`, and nothing on screen says what it is |
| 4 | `i_qty` | Yes — placeholder "Qty*" |
| 5 | `i_unit` `<select>` | **No.** No label, no blank option; defaults to `pcs`, so it reads as a mystery dropdown showing "pcs" |
| 6 | `i_unitPrice` | Yes — placeholder "Unit price" |
| 7 | `i_purchaseLink` | Yes, but a URL in a half-width field |
| 8 | `i_datasheetDoc` | Yes, same problem |
| 9 | `.rmItem` (`×`) | Occupies a full grid cell — a half-width solid red button |

Evidence: `prForm.js:50–65,165–176`; `styles.css:197–203`.

Compounding failures at this width:

| ID | What breaks | Evidence | Sev |
|---|---|---|---|
| R-11 | **Two of the eight controls have no visible name and no hint reachable by touch**, one of which blocks submission (`required` + blank). The user cannot determine what to enter without a desktop. | `prForm.js:57,59`; `styles.css:201,248–253` | **critical** |
| R-12 | **The `×` button occupies 50% of a row.** Repeated per item, the destructive control is the largest and reddest element in the item list. | `prForm.js:63`; `styles.css:203` | **high** |
| R-13 | **Submit is off-screen.** It lives in the non-sticky `.adm-head` at the top of the document. After entering three items on a phone the user must scroll the full form height back up to find it, past the fields they just filled. | `prForm.js:113–117` | **high** |
| R-14 | **The live total is a plain muted `<span>`** beside "+ Add item", mid-document. On a phone it is off-screen for most of the entry session, so there is no persistent sense of what the request costs. | `prForm.js:177–180` | **high** |
| R-15 | **`.pd-grid` (`auto-fit minmax(180px,1fr)`) drops to one column** — correct behaviour, but it means the eight header fields become an eight-item vertical scroll ahead of the items, with no grouping, no progressive disclosure and no step structure. Everything is always visible. | `styles.css:233`; `prForm.js:122–142` | medium |
| R-16 | **`.vgrid` is `minmax(280px,1fr)`.** At a 320px viewport the container is ~284px after `.main`'s 18px side padding — within tolerance by 4px. Any increase in page padding, or a 300px-class device, forces vendor cards to overflow. There is no fallback below 280px. | `styles.css:41,206` | low |
| R-17 | **`.adm-addrow` inputs are `min-width:220px` with `flex:1`.** Inside a wrapping flex row on a ~324px content width, each control claims a full line, so the add-user row becomes four stacked full-width elements with no heading distinguishing it from the table below. | `styles.css:119–121`; `admin.js:132–138` | medium |

### 3.4 What holds up

Worth recording so directions do not "fix" working behaviour: `.kpis`,
`.adm-stats`, `.adm-roles`, `.vd-info` and `.pd-grid` all use `auto-fit minmax()`
and reflow correctly. `.adm-head`, `.pd-people`, `.pd-danger`, `.adm-foot` and all
chip rows wrap correctly. `.adm-grid2` has the only purpose-written breakpoint in
the file (168) and it works. The failures are concentrated in exactly three
places: **the topbar, every table, and the item grid.**

---

## 4. Information hierarchy

The test applied: *is the most important thing on this screen also the most
visually prominent thing?*

| ID | View | Most important thing | What is actually most prominent | Evidence | Hurts | Sev |
|---|---|---|---|---|---|---|
| H-01 | Dashboard (approver) | The queue of PRs awaiting **their** decision, oldest first | A 32px "Dashboard" heading, then six equal-weight tiles about the approver's *own* requests, on a tab that defaults to `mine` | `dashboard.js:16–19,11,38–45` | approver | **high** |
| H-02 | Dashboard | Which rows are stale or urgent | Nothing. Priority (`Critical`/`High`) is stored on every PR and rendered **nowhere** in the table; age is not shown; `.chip` styling encodes status only | `dashboard.js:89–98`; `prs.gs:1–5` | approver | **high** |
| H-03 | Dashboard | The filtered result set | The six tiles above it. The tiles are the filter UI, but the `.card h2` that names the current filter (`"Pending approval · 3"`) is a 16px heading below them — the state of the filter is easier to lose than to read | `dashboard.js:82–88` | all | medium |
| H-04 | Dashboard (admin) | Reading the table | Every Status cell is a `<select>` with a chevron — 8 dropdowns per screen out-shouting the data they sit beside | `dashboard.js:66–73` | admin | **high** |
| H-05 | PR form | The line items — the substance of the request | Three visually identical `.card`s of equal weight. "General information" comes first and is larger; "Requested items" is last | `prForm.js:118–182` | requester | **high** |
| H-06 | PR form | The running total | An unstyled muted `<span>` beside a secondary button, mid-page | `prForm.js:179` | requester | **high** |
| H-07 | PR form | Submit | Correctly primary — but placed in a non-sticky header above the fold it will scroll off (R-13) | `prForm.js:115` | requester | high |
| H-08 | PR form | Removing an item (rare) | `.btn danger`, solid red, once per row — the loudest repeated element on the page | `prForm.js:63` | requester | medium |
| H-09 | PR detail | The decision (approve / reject) and what it costs | The PR **ID** in 32px mono is the largest element; the total sits in `.pd-total`, right-aligned, 16px, at the foot of the second card, below the item table | `prDetail.js:46,89` | approver | **high** |
| H-10 | PR detail | Why this purchase is needed | `Purpose` is the fourth of six equal-weight `.pd-f` fields in an `auto-fit` grid, indistinguishable from `Priority` and `Payment status` | `prDetail.js:57–64` | approver | **high** |
| H-11 | PR detail | Current state and what happens next | `chip(p.status)` is an 11.5px pill beside the ID; the action buttons that define "next" are a flat undifferentiated row (F-48) | `prDetail.js:46,49` | approver | high |
| H-12 | PR detail (admin) | Everything except deleting | The delete card is the visual terminus of the page, with its own red background and border — permanently present, competing with nothing | `prDetail.js:119–126` | admin | medium |
| H-13 | Vendors | Which vendors need attention (unpaid, stale) | Every card is identical; four stats carry equal weight; the only differentiator is `.vc-bad` turning one number red | `vendors.js:50–55` | all | medium |
| H-14 | Vendors detail | Purchase history | Sits below a full "Details" card of contact and banking metadata that is reference material, not the reason to open the page | `vendors.js:123–140` | all | medium |
| H-15 | Admin → Users | The user rows | A permanent green banner (F-71) sits above them, and three static role-reference cards sit below (F-72). The table — the only interactive content — is sandwiched between two blocks of unchanging prose | `admin.js:125–130,179–184` | admin | medium |
| H-16 | Admin → Vendors editor | Departments and identity | 24 form fields in flat vertical order with `.adm-sec` micro-headings at 11px. Banking, contact and identity all read at the same weight; the department chips that actually gate PR-form visibility are one unlabelled chip row | `adminVendors.js:80–131` | admin | medium |
| H-17 | All views | — | **Every view opens with the same `.adm-head` block: 32px title + descriptive paragraph + one button.** The paragraph is static help text that never changes. Roughly the top 100px of every screen is chrome that conveys nothing after first use | `styles.css:103–105`; `dashboard.js:16–24`; `vendors.js:66–70`; `admin.js:76–81` | all | **high** |

### 4.1 Where the design makes the user hunt

- **For a specific PR:** no search anywhere in the app. The only route to
  `PR-2026-0141` is scrolling the dashboard table or receiving a notification
  deep-link. (`dashboard.js:75–100`; `main.js:101–102`)
- **For why a PR is on hold or rejected:** nowhere. Not captured (F-49, F-50).
- **For what changed and who changed it:** nowhere in the UI; a complete `Log`
  sheet exists server-side (F-54).
- **For a vendor's non-INR spend:** the vendor card shows the top currency and a
  bare `+`; the admin editor shows INR only and prints ₹0 for USD-only vendors
  (F-62, F-87).
- **For the meaning of a form field:** hover-only tooltips, invisible trigger,
  unreachable on touch (top-10 #2).
- **For raising a PR from anywhere but the dashboard:** navigate home first
  (F-01).
- **For which department scopes the form's three dropdowns:** never displayed
  (F-30).

---

## 5. Interaction and state

### 5.1 The render model and what it costs

`store.refresh()` sets `loading:true` and **emits**, then resolves and **emits
again** (`state.js:16–38`). Each emit runs the subscriber at `main.js:126–131`,
which calls `render()`, which assigns `app.innerHTML` (`main.js:57`). So **one
refresh rebuilds the entire document twice**, and a refresh follows every
mutation — status change, user role edit, vendor save, project add, PR create.

| ID | Damage | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-01 | **Scroll position collapses.** Replacing `#app`'s contents empties the document, the browser clamps `scrollTop` to the new (zero) height, and the rebuilt content restores height afterwards. An approver working down a long table returns to the top after every decision. | `main.js:57,126–131` | approver, admin | **high** | suboptimal |
| S-02 | **Focus is destroyed.** `document.activeElement` is removed from the DOM, so focus falls back to `<body>`. Keyboard and screen-reader users lose their place on every mutation; there is no focus restoration anywhere in the codebase. | `main.js:57`; only `admin.js:105` ever calls `.focus()` | all | **high** | suboptimal |
| S-03 | **The PR form must be exempted from the render loop entirely** to avoid wiping input — which is the correct local fix and the clearest signal that the rendering model does not support forms. The cost is that the form is the one screen where the notification badge, refresh spinner and dropdown data all silently stop updating. | `main.js:112–131` | requester | medium | suboptimal |
| S-04 | **Every mutation refetches the whole dataset** — all PRs, all items, all vendors, projects, material types and notifications — through a single `list` action against Apps Script. There is no pagination, no delta, no caching. Cost grows linearly with the sheet on every single interaction. | `state.js:20–30`; `prs.gs:102–113` | all | **high** | suboptimal |
| S-05 | Admin state (`USERS`, `PROJECTS`, `MTYPES`, `TAB`, `showAdd`) and vendor state (`VENDORS`, `SELECTED`) are **module-level globals outside the store**, seeded once and never re-synced. They survive navigation and sign-out-less role changes, and they diverge from the store's copy of the same data. | `admin.js:14–17`; `adminVendors.js:6–7` | admin | **high** | **broken** |

### 5.2 Loading states

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-06 | **There is no loading state.** `s.loading` exists and drives exactly one thing: a CSS spin class on the refresh icon. Every view renders its empty state against empty data instead (top-10 #4). | `state.js:4,17`; `main.js:62` | all | **high** | suboptimal |
| S-07 | The only two places that acknowledge loading are `prDetail.js:32` — `"(still syncing…)"`, suppressed exactly when it is most needed (F-47) — and `admin.js:66` — `"Loading users…"` as raw text in a bare card. Two views, two different mechanisms, four views with none. | `prDetail.js:32`; `admin.js:66` | all | medium | suboptimal |
| S-08 | No skeleton, no shimmer, no progress indicator, no disabled overlay during any mutation. Feedback for a status change is: the `<select>` disables, then 1–3 seconds of Apps Script latency with no visible activity, then the page rebuilds twice. | `dashboard.js:123–139` | approver, admin | **high** | suboptimal |
| S-09 | Submitting a PR sets the button to `"Saving…"` — the single best in-flight affordance in the app — but it is in the header, which may be scrolled off-screen at the moment of submission (R-13). | `prForm.js:286` | requester | medium | suboptimal |

### 5.3 Empty states

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-10 | `"No PRs here yet."` is a muted `<td colspan="7">` — no illustration, no explanation, and **no call to action** on the one screen from which a PR can be raised. | `dashboard.js:98` | requester | medium | suboptimal |
| S-11 | Empty states double as loading states and as error states, so the same string means three different things: "you have none", "we haven't loaded yet", and "the fetch failed". | `dashboard.js:98`; `vendors.js:74`; `state.js:36` | all | **high** | suboptimal |
| S-12 | Quality is inconsistent: `"Nothing listed yet — add the first one."` (`admin.js:249`) is actionable; `"No items."` (`prDetail.js:87`), `"Nothing yet."` (`main.js:74`) and `"No match"` (`prForm.js:221`) are dead ends. `"No match"` in particular is what a requester sees when their department has **no vendors mapped at all** (F-29) — the message describes the search, not the cause. | as cited | requester | **high** | suboptimal |

### 5.4 Error states

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-13 | **`state.err` is never rendered in any view.** The comment at `main.js:116–118` states this outright. A toast is the entire error surface, and it auto-dismisses after 6 seconds. | `main.js:116–123`; `state.js:36` | all | **high** | suboptimal |
| S-14 | **Only one toast can exist.** `toast()` removes all existing toasts first, so a success message silently destroys an unread error, and two concurrent failures show only the second. | `ui.js:9` | all | **high** | **broken** |
| S-15 | Errors auto-dismiss on a 6s timer with no pause-on-hover and no history. Backend validation messages are long — *"Item \"SPS30 particulate matter sensor module\": select an item type for R&D"* — and can time out before they are read. | `ui.js:22`; `prs.gs:137–148` | requester | **high** | suboptimal |
| S-16 | **Errors are not attached to the field that caused them.** Server-side item validation identifies the offending item by description, but the message appears in a corner toast while the form stays visually unchanged. On a 6-item PR the user must map prose back to a row themselves. | `prForm.js:302–305`; `prs.gs:137–148` | requester | **high** | suboptimal |
| S-17 | No retry affordance on any failure. The only recovery is the unlabelled icon button in the topbar (F-09), or reload. | `main.js:61–63` | all | **high** | suboptimal |
| S-18 | Transport errors surface raw: `'HTTP ' + res.status` becomes the toast body, so a user sees **"HTTP 500"**. `'APP_URL not configured — edit src/config.js'` instructs an end user to edit source code. | `api.js:7,16` | all | medium | suboptimal |
| S-19 | A `SIGNED_OUT` error on the **first** load of a session is not reloaded (correctly — `hadSession` guards the loop) but is also not handled: it falls through to a toast reading "SIGNED_OUT", with the app sitting behind it showing a false empty dashboard. | `state.js:31–37` | all | **high** | **broken** |

### 5.5 Optimistic updates and confirmation

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-20 | **Exactly one optimistic update exists in the app** — marking notifications read (`main.js:95–99`), which is the lowest-stakes action available. Everything with real cost waits for a full round trip plus a full refetch. | `main.js:95–99` | all | medium | suboptimal |
| S-21 | **All six confirmations are native `confirm()`** — unstyled, blocking, suppressible by the browser, and unable to show context (what the PR is, what it costs, who raised it). | `dashboard.js:119`; `prDetail.js:131,142`; `admin.js:202,277`; `adminVendors.js:157` | all | medium | suboptimal |
| S-22 | Confirmation coverage is **inconsistent by severity, not by risk**: `Rejected` and `Cancelled` confirm; `Ordered`, `In Transit` and `Received` do not; role changes and department changes do not; permanent PR deletion gets the same single-click `confirm()` as removing a project from a list. | `dashboard.js:119`; `admin.js:197–200`; `prDetail.js:142` | approver, admin | **high** | suboptimal |
| S-23 | **No undo anywhere in the product.** Combined with S-22, a mis-scrolled `<select>` on a touchpad silently transitions a PR with no recovery path other than transitioning it back — which the matrix may not permit (`Received` is terminal). | `dashboard.js:112–140`; `status.js:13–14` | approver, admin | **high** | suboptimal |
| S-24 | Rollback on failure is partial: the dashboard `<select>` resets its value and re-enables (`dashboard.js:136–138`), but PR-detail action buttons only re-enable — leaving the page asserting a state the server rejected until the next refresh. | `prDetail.js:137,149` | approver, admin | medium | suboptimal |
| S-25 | The vendor editor has **no dirty-state tracking**. Toggling department chips mutates the DOM only; `Cancel` and `×` discard silently with no prompt (F-83). | `adminVendors.js:170–175` | admin | medium | suboptimal |
| S-26 | **No form-abandonment protection anywhere** — no `beforeunload`, no draft storage, no route-change guard. The PR form is the highest-value casualty (F-32). | `prForm.js` (absent) | requester | **critical** | suboptimal |

### 5.6 Keyboard access

| ID | Finding | Evidence | Hurts | Sev | Class |
|---|---|---|---|---|---|
| S-27 | **Zero `tabindex` and zero `role` attributes exist in the codebase.** Every click-handled non-interactive element is therefore unreachable and unactivatable by keyboard: KPI tiles (`dashboard.js:83`), table rows (`dashboard.js:92`, `vendors.js:132`, `adminVendors.js:46`), vendor cards (`vendors.js:41`), combobox options (`prForm.js:219`), notification items (`main.js:71`), and the profile trigger (`main.js:77`). | as cited | all | **high** | suboptimal |
| S-28 | The custom combobox supports **no keyboard interaction at all** — no ↑/↓, no Enter, no Escape, no `aria-activedescendant`. It is a mouse-and-touch-only control for two required-path fields. | `prForm.js:212–246` | all | **high** | suboptimal |
| S-29 | **Escape closes nothing** — not the notification panel, not the profile menu, not the combobox lists, not the vendor editor. There is no `keydown` listener anywhere in `frontend/src/`. | `main.js:91–106`; `prForm.js:212–246` | all | **high** | suboptimal |
| S-30 | No skip link, no landmarks, no focus trap on the two menu overlays, and no focus restoration after any of them close. | `main.js:57–86` | all | high | suboptimal |

---

## 6. Accessibility

Measured against WCAG 2.1 AA. Contrast ratios below are computed from the actual
declared token values.

### 6.1 Colour contrast — what passes

Recording this explicitly, because the palette is **mostly compliant** and a
direction should not "fix" what is not broken. All of the following clear 4.5:1:

`--mut #5E7066` on white (**5.27**), on `--bg` (**4.89**), on `--grey-soft`
(**4.58**) · `--brand #0E7B5B` on white (**5.25**), on `--brand-soft` (**4.53**) ·
`--red` on `--red-soft` (**5.03**) · `--blue` on `--blue-soft` (**5.32**) ·
`--adm-on-var #43474c` on white (**9.36**), on `--adm-low` (**8.46**) ·
`--adm-secondary` on white (**6.48**) · `--adm-primary` on white (**15.63**) ·
`--adm-green` on `--adm-green-bg` (**4.96**) · `.adm-pill.pend` (**4.87**) ·
`.vc-badge.dom` (**4.63**), `.for` (**6.34**), `.mix` (**6.78**) ·
`.nbadge` white on `#c62828` (**5.62**) · topbar nav `#cfe0d7` on `--dark`
(**12.44**) · logo `#3ECF9A` on `--dark` (**8.62**) · all three button fills
(`.adm-addbtn` **6.48**, `.btn.primary` **5.25**, `.btn.danger` **6.04**).

### 6.2 Colour contrast — failures

| ID | Element | Foreground / background | Ratio | Required | Evidence | Sev | Class |
|---|---|---|---|---|---|---|---|
| A-01 | **`.hq` help trigger** — the `?` glyph | `#FFFFFF` on `--adm-outline #c3c7cc` | **1.70:1** | 4.5:1 (10px bold text) | `styles.css:248–249` | **critical** | **broken** |
| A-02 | **All input, select and textarea borders** | `--adm-outline #c3c7cc` on `--adm-surface #fbf9f8` | **1.62:1** | 3:1 — WCAG **1.4.11 Non-text Contrast** applies to form-control boundaries | `styles.css:120,135,191,245` | **high** | **broken** |
| A-03 | **Secondary button border** (`.btn`, the Cancel / Edit / Add-item control) | `--line #DEE7E1` on `--panel #FFFFFF` | **1.26:1** | 3:1 (1.4.11) | `styles.css:44` | **high** | **broken** |
| A-04 | **`.chip.Ordered` and `.chip[data-s="In Transit"]`** | `--amber #B25E09` on `--amber-soft #FBEEDC` | **4.08:1** | 4.5:1 — the chip is 11.5px bold, well under the 18.66px large-text threshold | `styles.css:52–53` | **high** | **broken** |
| A-05 | **Focus halo** — `box-shadow:0 0 0 2px rgba(19,37,53,.2)` composites to `#d0d3d7` | vs white **1.50:1**, vs `--adm-surface` **1.43:1** | needs 3:1 (1.4.11 / 2.4.11) | `styles.css:139,196,246` | see A-06 | **high** | **broken** |
| A-06 | Because `outline:none` accompanies A-05, the **entire visible focus indicator** for inputs and selects is the border shifting `#c3c7cc → #132535`. That change is a strong **9.20:1** contrast against the old border, so focus *is* perceivable — but it rests on a 1px edge with a sub-threshold halo, and it disappears wherever a border is visually crowded. | `styles.css:139,196,246` | — | — | as cited | medium | suboptimal |
| A-07 | Table row separators use `--line` at **1.26:1** and `--adm-outline` at **1.70:1** against their backgrounds. Arguably decorative under 1.4.11, but at these values dense multi-column tables (F-12) read as an undifferentiated block. | `styles.css:57–58,126,188` | — | — | as cited | medium | suboptimal |

### 6.3 Focus visibility

| ID | Finding | Evidence | Sev | Class |
|---|---|---|---|---|
| A-08 | **`:focus-visible` appears nowhere in the stylesheet.** Three `:focus` rules exist, all of which set `outline:none` and substitute a custom treatment. | `styles.css:139,196,246` | **high** | suboptimal |
| A-09 | **`.adm-input` has no `:focus` rule at all**, so text inputs in Admin and the vendor editor keep the browser default ring while every `<select>` beside them gets the custom border+halo. Focus looks materially different for two adjacent controls in the same row. | `styles.css:120–121` vs `:135–139`; `admin.js:134,232`; `adminVendors.js:24` | medium | suboptimal |
| A-10 | Buttons, tabs, links and pager controls have **no focus styling whatsoever** and rely entirely on browser defaults — which differ per browser and are frequently invisible against `--dark` in the topbar and against the green `.adm-addbtn`. | `styles.css:44,106,111,152,17` | **high** | suboptimal |
| A-11 | Focus is destroyed on every re-render with no restoration (S-02), so even correct focus styling would not survive a mutation. | `main.js:57` | **high** | suboptimal |

### 6.4 Semantic markup and ARIA

| ID | Finding | Evidence | Sev | Class |
|---|---|---|---|---|
| A-12 | **The entire application contains one ARIA attribute**: `aria-label="Dismiss"` on the toast close button. No `role`, no `aria-live`, no `aria-expanded`, no `aria-controls`, no `aria-describedby`, no `aria-current`, no `aria-sort`, no `aria-required`, no `aria-invalid`. | `ui.js:18`; grep across `frontend/src/` | **high** | suboptimal |
| A-13 | **Toasts are not announced.** No `aria-live` region exists, so screen-reader users receive **no error feedback at all** — and toasts are the only error channel (S-13). Errors are silently invisible to them. | `ui.js:8–23`; `main.js:120–123` | **high** | **broken** |
| A-14 | **Clickable `<div>` and `<tr>` elements carry no role and no keyboard handler** — KPI tiles, vendor cards, table rows, combobox options, notification items. They are announced as static text and cannot be activated. | `dashboard.js:83,92`; `vendors.js:41,132`; `prForm.js:219`; `main.js:71` | **high** | suboptimal |
| A-15 | **The combobox is not a combobox to assistive technology.** It is an `<input>` plus a sibling `<div>` of `<div>`s. No `role="combobox"`, no `aria-expanded`, no `role="listbox"`/`option`, no `aria-activedescendant`. A screen-reader user typing in it gets a plain text field that appears to accept free text but silently reverts on blur (F-37). | `prForm.js:126–133,212–246` | **high** | **broken** |
| A-16 | **`admin.js` contains zero `<label>` elements.** `#newEmail` has only a placeholder; `#newRole`, `#newDept`, `#mpDept` and every `.roleSel` / `.deptSel` in the users table have **no accessible name at all** — a screen reader announces a list of unnamed comboboxes, one per user row. | `admin.js:134–136,156–157,229–232` | **high** | **broken** |
| A-17 | **The PR form's Vendor and Currency fields have no programmatic label**, because they use `<div class="pd-field">` rather than `<label>` while every other field on the form uses implicit label wrapping. | `prForm.js:125,130` vs `:123,124,135` | **high** | **broken** |
| A-18 | **All item-row controls are unlabelled.** `.ithead` is a row of `<span>`s — visual-only, not `<th>`, not `for=`-associated, and `display:none` below 900px. `i_materialType` and `i_unit` have no placeholder either, so they have no accessible name from any source. | `prForm.js:57,59,165–175`; `styles.css:201` | **high** | **broken** |
| A-19 | **`.status-sel` has no label**, so the dashboard presents up to N unnamed selects; their only context is the row they sit in, which is not programmatically associated. | `dashboard.js:71` | **high** | **broken** |
| A-20 | **Help text is CSS-generated content** in `.hq::after` from a `data-tip` attribute. Generated content is not reliably exposed, is not associated via `aria-describedby`, and is hover-gated. The field help is invisible to screen readers as well as to touch users. | `styles.css:250–253`; `prForm.js:39–40` | **high** | **broken** |
| A-21 | **Tables have no `<caption>`, no `scope` on `<th>`, and no `aria-sort`.** Row-header association is inferred, and the ID column — the only cell that identifies the row — is a plain `<td>`. | `dashboard.js:89–98`; `prDetail.js:76–88`; `admin.js:140–168` | high | suboptimal |
| A-22 | **The notification panel and profile menu are `hidden` toggles with no `aria-expanded` on their triggers** and no `role="menu"`/`dialog`. Their open state is invisible to assistive technology. | `main.js:64–84,92–106` | high | suboptimal |
| A-23 | **Material Symbols ligature text is read literally.** Icon-only buttons contain the strings `refresh`, `notifications`, `delete`, `add`, `close`, `chevron_left`, `chevron_right`, `shield_person`, `check_circle`, `error` as text nodes. A screen reader announces "delete" for the remove button — accidentally serviceable — and "shield_person" and "chevron_left" for others, which is not. `title` is present on some but is not a reliable accessible name. | `main.js:62,66`; `admin.js:163,173,175`; `adminVendors.js:53,77`; `ui.js:13` | high | suboptimal |
| A-24 | **No form-level error summary and no `aria-invalid`.** Native `required` validation is the only client-side mechanism, and no `:invalid` styling exists (F-45), so an invalid field is visually and programmatically identical to a valid one until the browser balloon fires. | `prForm.js:57–58,123`; `styles.css` (no `:invalid`) | high | suboptimal |
| A-25 | **No document landmarks.** `main.js:57` emits `<div class="topbar">` and `<div class="main">` — no `<header>`, `<nav>` wrapper semantics beyond the bare `<nav>` at line 60, no `<main>`, no `<h1>` on the topbar level. Heading order also breaks: views open with `<h1>` inside `.adm-head` and use `<h2>` for cards, but `prDetail.js:32` and `admin.js:66` render text with no heading at all. | `main.js:57–86`; `prDetail.js:32` | medium | suboptimal |
| A-26 | **`prefers-reduced-motion` is not honoured.** The refresh spinner animates indefinitely at 1s, and the toast slide-in runs unconditionally. | `styles.css:19–20,72,78` | low | suboptimal |
| A-27 | **Status is conveyed by colour plus text**, which is correct — but **priority is conveyed by nothing at all** in list views (H-02), and `.vc-bad` uses colour alone to mark unpaid vendors. | `vendors.js:53`; `styles.css:222` | medium | suboptimal |
| A-28 | The page has no `lang`-scoped content issues, and `index.html:5` sets a correct viewport meta with no `user-scalable=no` — **pinch zoom is not blocked.** Recorded as a pass. | `index.html:2,5` | — | pass |

---

## 7. Content and microcopy

### 7.1 Where the interface speaks in database columns

| ID | Interface says | It means | Evidence | Hurts | Sev |
|---|---|---|---|---|---|
| C-01 | **"Zoho no"** | The part number in Zoho Inventory, which links this line to Production stock | `prForm.js:55,167`; `prDetail.js:77` | requester | medium |
| C-02 | **"Type"** | Item category, for departmental reporting. The same concept is called **"Item type"** in the admin add-row, **"Item Types"** on the admin tab, **"Type"** in the PR form and PR detail, and **`materialType`** in every payload. Four names, one field. | `prForm.js:169`; `prDetail.js:77`; `admin.js:27,53,86` | requester, admin | medium |
| C-03 | **"Type"** (again, on the vendor editor) | Domestic vs International — a *different* concept sharing the identical label two views away | `adminVendors.js:106`; `vendors.js` badge | admin | medium |
| C-04 | **"Dept"** | Department. Abbreviated in the table header only. | `dashboard.js:90`; `vendors.js:130` | all | low |
| C-05 | **"Line total"**, **"Unit price"**, **"PO reference"**, **"Invoice / order #"**, **"Quotation / PI"**, **"Payment term"** | Procurement jargon presented without explanation. Defensible for staff-only blocks; `Line total` and `Unit price` appear in the requester-facing item table too. | `prDetail.js:77,111–114` | requester | low |
| C-06 | **"Status (admin override)"**, **"Requester email (admin override)"** | Internal permission vocabulary surfaced as a field label | `prForm.js:140–141` | admin | low |
| C-07 | **"SIGNED_OUT"** | An enum leaking into a user-visible toast when the first refresh of a session fails (S-19) | `state.js:31–37`; `api.js:9` | all | medium |
| C-08 | **"HTTP 500"** | The entire error message for any transport failure | `api.js:16` | all | medium |
| C-09 | **"APP_URL not configured — edit src/config.js"** | An end user is told to edit source code | `api.js:7` | all | low |
| C-10 | **"Your role (requester) cannot perform usersList"** | Route names surfaced to users. Rendered as the whole page body, not a toast (F-02). | `Code.gs:32`; `admin.js:67` | requester | medium |
| C-11 | **"Cannot move PR-2026-0141 from Received to Ordered as admin"** | The state machine describing itself. Accurate; not language a user thinks in. | `prs.gs:211` | approver, admin | medium |
| C-12 | **"Role \"viewer\" is no longer supported — ask an admin to update your role"** | Good message, but it is thrown for *every* action and only ever appears as a 6-second toast over a false-empty dashboard | `Code.gs:29`; `main.js:120–123` | all | medium |

### 7.2 Labels and buttons

| ID | Finding | Evidence | Hurts | Sev |
|---|---|---|---|---|
| C-13 | **"Mark Approved" / "Mark Rejected" / "Mark Received"** — the verb is `Mark`, an inventory-clerk framing, for what is an approval decision with notification and audit consequences. The domain verbs are *approve*, *reject*, *hold*. | `prDetail.js:49` | approver | medium |
| C-14 | **"Purchase reqs"** (vendor card) vs **"Purchase requests"** (vendor detail) vs **"Total PRs"** / **"All PRs"** (dashboard) vs **"PRs"** (breadcrumb). Four renderings of the core noun. | `vendors.js:51,117`; `dashboard.js:48`; `prDetail.js:43` | all | low |
| C-15 | **"Remove user"** with confirm *"This action is permanent."* — it writes `role: ''`, which the same table then renders as **Pending**. The copy is factually false and teaches the wrong model (F-69). | `admin.js:201–205,158–160` | admin | **high** |
| C-16 | **"Showing 12 of 12 active members"** — one number used twice (so the phrasing implies filtering that does not exist), and "active" is wrong because the table also lists Pending users. | `admin.js:171` | admin | medium |
| C-17 | **"Page 1 of 1"** with permanently disabled chevrons — copy asserting a capability that does not exist (F-67). | `admin.js:172–176` | admin | **high** |
| C-18 | **"Last admin protection active. System ensures at least one active Administrator remains."** — system-voiced, passive, permanent, and never reflects state. The underlying protection is real (`users.gs:42–48`). | `admin.js:128` | admin | medium |
| C-19 | **"Changes are audited and logged for security compliance."** — true (`prs.gs:75–77`), but the audit log is not viewable anywhere in the product (F-54), so the copy advertises a feature the UI does not deliver. | `admin.js:43` | admin | medium |
| C-20 | The `+ Add item` button is a `.btn` (secondary, `--line` border at 1.26:1 contrast) while the per-row remove is `.btn danger` (solid red). The constructive action is the quietest control in the block and the destructive one is the loudest. | `prForm.js:63,178` | requester | medium |
| C-21 | **"Item / description*"** — a slash-joined double label used as a placeholder, doing the work a real label should do. Asterisks mark required fields with no legend explaining the convention. | `prForm.js:53,58` | requester | low |
| C-22 | **"Search vendors…"** placeholder persists as the field's only content when a department has no vendors mapped, so the empty-and-broken state looks identical to the empty-and-ready state (F-29, S-12). | `prForm.js:126,221` | requester | **high** |
| C-23 | Two different words for the same navigation action: **"← All vendors"** (vendor detail) and **"Cancel"** (PR form) and **"Close"** (`×`, vendor editor) and **"Cancel"** (vendor editor, beside the `×`). The vendor editor offers two controls that do the same thing with different labels. | `vendors.js:113`; `prForm.js:114`; `adminVendors.js:77,134` | all | low |
| C-24 | **Field hint copy is genuinely good** — specific, Oizom-flavoured, and it explains *why* rather than *what* ("Critical = must-have immediately, expedite even at extra cost"). It is the strongest writing in the product and it is invisible on touch and to screen readers (top-10 #2, A-20). Recorded as a finding because the content asset already exists; only its delivery fails. | `prForm.js:19–36` | requester | **high** |

### 7.3 Empty-state and notification copy

| ID | Finding | Evidence | Sev |
|---|---|---|---|
| C-25 | `"No PRs here yet."` — no CTA on the only screen that can create one; also serves as the loading and error state (S-11). | `dashboard.js:98` | medium |
| C-26 | `"Nothing yet."` (notifications), `"No items."` (PR detail), `"No match"` (combobox) — three dead ends with no next step. | `main.js:74`; `prDetail.js:87`; `prForm.js:221` | medium |
| C-27 | `"Nothing listed yet — add the first one."` and `"No vendors yet — an admin can add them in Admin → Vendors."` are the two good empty states: they name the next action and who can take it. The inconsistency is the finding. | `admin.js:249`; `vendors.js:74` | low |
| C-28 | Notification text is a single prose string with no structure — *"Ankit Shah raised PR-2026-0143 (R&D): SPS30 particulate matter sensor module (+2 more) — total 4820 EUR"*. Amount is unformatted (`4820`, not `€4,820.00`), so the notification contradicts the currency formatting used everywhere else in the product. | `prs.gs:162–165`; `currency.js:41–44` | medium |
| C-29 | Approval and rejection notifications carry **no reason and no amount** — *"Your PR PR-2026-0137 was rejected by Meera Patel."* is the entire message, and the reason is not captured anywhere (F-49). | `prs.gs:221–225` | **high** |
| C-30 | `"Data refreshed"` is the success toast for a manual refresh — the same toast weight and treatment as `"PR-2026-0143 created"`. All toasts are titled either **"Success"** or **"Error"**, so the generic title carries no information and the message must do all the work in 12.5px muted text. | `main.js:89`; `ui.js:13–17` | medium |

---

## Appendix A — Index of "broken" findings

Things that do not work as written. A direction may fix these incidentally; they
should be called out separately from design decisions.

| ID | One line | Evidence |
|---|---|---|
| F-02 | No client-side route guard — `#/admin` as a requester renders a raw backend error as the page | `main.js:108`; `admin.js:67` |
| F-07 | Clicking your own email inside the open profile menu closes it | `main.js:104–106` |
| F-15 | Admin status dropdown silently bypasses the transition matrix via a raw field write | `dashboard.js:128–131` |
| F-34 | Remove-item on the last row is a silent no-op with the button still enabled | `prForm.js:200–202` |
| F-41 | Tooltip edge-anchoring assumes a fixed column order under an `auto-fit` grid | `prForm.js:39–40`; `styles.css:233` |
| F-43 | PR form collects `paymentTerm`; `create` hardcodes it to `''` | `prForm.js:156`; `prs.gs:157` |
| F-47 | A just-created PR renders "not found" for a full round trip | `prForm.js:297–301`; `prDetail.js:32` |
| F-51 | Courier / tracking rendered and backend-editable but writable from no screen | `prDetail.js:98`; `prs.gs:12–14` |
| F-58 / T-01 | `.vcard:hover` resolves to `currentcolor` → near-black border, not "nothing" | `styles.css:208` |
| F-67 / C-17 | The admin pager is decorative; "Page 1 of 1", both chevrons permanently disabled | `admin.js:170–177` |
| F-68 | `USERS` fetched once per page load, never re-synced by refresh | `admin.js:64–68` |
| F-69 / C-15 | "Remove user" writes `role:''`, user reappears as Pending; confirm copy is false | `admin.js:201–205` |
| F-75 / T-11 | Avatar palette contains two indistinguishable colours (`#d1e5f7` / `#d1e5f9`) | `admin.js:12` |
| F-79 | `VENDORS` seeded once, drifts from the store's copy of the same data | `adminVendors.js:6,11–14` |
| F-87 | Vendor admin panel shows INR spend only — USD-only vendors read ₹0 | `adminVendors.js:66,83` |
| S-05 | Six module-level globals hold state outside the store and never re-sync | `admin.js:14–17`; `adminVendors.js:6–7` |
| S-14 | Only one toast can exist; a success message destroys an unread error | `ui.js:9` |
| S-19 | First-load `SIGNED_OUT` surfaces as a raw-enum toast over a false-empty app | `state.js:31–37` |
| T-02 | `form.pr` ruleset (4 declarations) matches nothing | `styles.css:64–67` |
| T-05 | `.chip.In.Transit` matches only via accidental class splitting; `On Hold` needs an attribute selector instead | `styles.css:53,55` |
| T-07 | `@media print` misses `.adm-addbtn`, `.adm-del`, `.adm-tabs`, `.npanel`, `.pmenu`, `.toast` | `styles.css:88` |
| A-01 / T-12 | Help trigger is white on `#c3c7cc` — 1.70:1 | `styles.css:248–249` |
| A-02 | All form-control borders 1.62:1 — fails WCAG 1.4.11 | `styles.css:120,135,191,245` |
| A-03 | `.btn` border 1.26:1 — fails WCAG 1.4.11 | `styles.css:44` |
| A-04 | Ordered / In Transit chips 4.08:1 at 11.5px bold — fails WCAG 1.4.3 | `styles.css:52–53` |
| A-05 | Focus halo composites to 1.50:1 alongside `outline:none` | `styles.css:139,196,246` |
| A-13 | No `aria-live`; screen-reader users get no error feedback at all | `ui.js:8–23` |
| A-15 – A-20 | Combobox has no combobox semantics; admin has zero `<label>`s; item rows, `.status-sel`, Vendor and Currency all lack accessible names | as cited |

## Appendix B — Capability that exists and is not surfaced

Relevant to costing the three directions: these are **free** in backend terms —
the data and logic already exist and are unit-tested. Stated as diagnosis only.

| Capability | Where it lives | Surfaced? |
|---|---|---|
| Spend by department / month / material type, status counts, PR aging, vendor performance, CSV export (formula-injection hardened) | `lib/reports.js`; `tests/reports.test.js` | No UI imports it |
| Monthly trend, pipeline groups, currency enumeration | `metrics.js:63–100` | No UI imports it |
| Per-PR quantity summary | `items.js:28–32`, computed in `decoratePrs` | Computed on every PR, displayed nowhere |
| Full audit log with before→after diffs on every create / update / transition / delete | `prs.gs:75–77,196–200` | No route reads it |
| `updatedAt` on every PR | `prs.gs:1–5,197` | Never displayed |
| `priority` (Critical / High / Medium / Low) on every PR | `prs.gs:1–5`; `prForm.js:135` | Captured and shown on detail only; absent from every list view |
| Courier deep-links for 5 carriers + 17track fallback | `prDetail.js:7–15` | Renders, but no screen writes the tracking number |
| Departmental approver routing with all-approver fallback | `notifications.gs:41–46` | Works; invisible in UI — a requester cannot see who must approve |

## Appendix C — Method and limits

Read in full: `frontend/index.html`, `frontend/src/{main,state,ui,api,auth,config}.js`,
`frontend/src/styles.css`, all six files in `views/`, all seven in `lib/`.
Read for data availability: `apps-script/{Code,prs,items,notifications}.gs`, plus
targeted reads of `users.gs`, `vendors.gs`. Contrast ratios computed from declared
token values using the WCAG 2.1 relative-luminance formula.

**Not done, and therefore not claimed:** no browser was opened, no device was
tested, and no screen reader was run. Every responsiveness threshold in §3 is
derived from declared paddings, font sizes and intrinsic content width — the
mechanism is stated in each case so it can be checked, but the pixel figures are
estimates. T-01 (`.vcard:hover`) is derived from the CSS Variables specification
rather than observation and is the single claim most worth verifying in a browser
before a direction cites it.
