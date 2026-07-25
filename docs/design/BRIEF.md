# UI/UX Overhaul — Design Team Brief

**Branch:** `design/ux-overhaul` · **Date:** 2026-07-25 · **Status:** exploration

Every agent working on this engagement reads this file first. It is the shared
context. Do not re-derive what is written here.

---

## 1. What the product is

Oizom Procurement Hub — an internal tool for raising, approving, and tracking
purchase requests (PRs) at Oizom, a hardware company building air-quality
monitoring devices.

A PR is one header row plus one or more line items. Someone raises it, one
approver approves or rejects it, then it moves through ordering, payment,
shipping, and receipt. A Google Sheet is the source of truth; the web app is a
stateless view over it.

**Roles** (`requester` → `approver` → `admin`, ranked):

| Role | Can do |
|---|---|
| requester | Raise PRs, see PRs, track their own |
| approver | All of the above + approve/reject, move status |
| admin | All of the above + manage users, vendors, dropdown lists |

Access is gated to `@oizom.com` Google accounts.

## 2. Current state — what exists today

**Stack:** Vite + vanilla JS ES modules. No framework, no CSS framework, no
runtime dependencies. Hand-written CSS in a single file. Deployed as static
files to GitHub Pages. Backend is Google Apps Script bound to the sheet.

**Size:** ~2,320 LOC total across `frontend/src/`, of which 264 lines is CSS.
This is a small surface. A redesign is genuinely tractable.

**Views** (`frontend/src/views/`):

| File | Route | What it does |
|---|---|---|
| `dashboard.js` | `#/` | KPI tiles + filterable PR table + reports |
| `prForm.js` | `#/new` | Raise a PR — header fields + repeating line items |
| `prDetail.js` | `#/pr/<id>` | One PR: fields, items, people, status actions |
| `vendors.js` | `#/vendors` | Vendor cards with spend/performance stats |
| `admin.js` | `#/admin` | User management, roles, dropdown lists |
| `adminVendors.js` | — | Vendor registry admin |

**Supporting:** `main.js` (router + topbar/nav/notifications/profile),
`state.js` (store), `ui.js` (esc/toast helpers), `api.js` (20 lines, all backend
calls), `auth.js` (70 lines, Google Identity Services token handling),
`lib/` (currency, metrics, reports, status, vendorStats — pure logic, no UI).

**Rendering model:** every view is a function that receives a DOM node and sets
`innerHTML`. Full re-render on state change. No virtual DOM, no components.
Note the comment in `main.js` around line 112 — re-render during typing would
wipe the PR form, so there is an explicit guard. Any design that increases form
complexity must account for this.

## 3. The known design debt

This is documented so nobody spends time rediscovering it. Find more, but start
from here.

**Two design systems are stacked in `frontend/src/styles.css`.**

- Lines 2–6: the original token set — `--brand:#0E7B5B`, `--line:#DEE7E1`,
  fonts Space Grotesk (display) / IBM Plex Mono / Inter (body).
- Line 97 onward: a Material-3 token block, commented "from admin.html mockup" —
  `--adm-secondary:#006e16`, `--adm-outline:#c3c7cc`, `--adm-primary:#132535`.

They coexist rather than replace. Consequences:

- **Two greens** (`#0E7B5B` and `#006e16`) used as the primary accent in
  different parts of the same app.
- **Two card treatments** — `.card` (12px radius, `--line` border, no shadow)
  and `.dash .card` (16px radius, `--adm-outline` border, shadow). Same
  component, styled twice.
- **Two table treatments** — `.tbl` and `.dash .tbl` / `.adm-tbl`, with
  different padding scales (9px vs 14px vs 24px).
- Line 208, `.vcard:hover{border-color:var(--disp)}` — `--disp` holds a
  *font-family* value (`'Space Grotesk',sans-serif`), which is not a valid
  colour. This does not make the declaration ignored: an invalid `var()`
  substitution is "invalid at computed-value time", so `border-color` resets to
  its initial value, `currentcolor`. `.vcard` inherits `color:var(--ink)`, so
  hovering a vendor card snaps the border from pale `#DEE7E1` to near-black
  `#14241C`. Worse than dead — visibly wrong.

**Correction to an earlier draft of this brief:** it claimed that line 25 using
`var(--adm-green-bg)` 72 lines before its declaration was a bug. It is not.
Custom properties resolve through the cascade, not source order. The audit
caught this; it is recorded here so no direction repeats the mistake.

**Responsiveness is a fallback, not a design.** Only three media queries exist.
The PR form's line-item row is a 9-column CSS grid that collapses to `1fr 1fr`
below 900px. That is damage control, not a mobile experience.

## 4. Who uses it and how

Confirmed with the product owner:

- **Both desktop and mobile are real.** Not desktop-first with a mobile
  afterthought.
- **Mobile matters most for requesters** — staff raising PRs away from a desk.
  The line-item entry flow on a phone is the sharpest unsolved problem.
- Desktop remains the primary surface for approval, reporting, and admin.

Every direction must show a real mobile design for PR creation. A responsive
reflow of the desktop layout does not count as answering this.

## 5. Constraints

**Hard — non-negotiable:**

1. **Write only inside `docs/design/`.** `frontend/src/` is read-only for this
   engagement, for every agent, including the most exploratory direction. This
   is an exploration branch; implementation is a separate, later decision.
2. **Never run `git push`.** Origin is a public repository. Never switch or
   create branches.
3. **Mockups must be self-contained single HTML files** — inline CSS and JS, no
   CDN links, no build step. They have to open in a browser directly.
4. **Use realistic data.** Real Oizom-flavoured content: sensor components,
   PCB parts, calibration equipment, Indian and international vendors, INR and
   USD amounts. Never `Lorem ipsum`, never "Vendor A / Vendor B".

**Soft — argue if you disagree:**

5. The stack is vanilla JS + Vite with hand-written CSS. **The design team does
   not decide the stack.** If a direction needs Tailwind, a component library,
   or a framework, say so explicitly in `rationale.md` under a
   `## Stack implications` heading and justify it. A dev-feasibility review
   prices every such request afterwards, and the product owner decides jointly
   with the dev side. Do not quietly assume a framework in a mockup.
6. Oizom brand: the logo is `frontend/public/oizom-logo.png`, green is the
   established accent. Deviating from green is allowed if argued.

## 6. Deliverable structure

```
docs/design/
  BRIEF.md                      ← this file
  research/
    market.md                   ← competitor + pattern teardown
    audit.md                    ← current-state friction inventory
  direction-a-unify/
    mockup-desktop.html
    mockup-mobile.html
    rationale.md
  direction-b-bento/            ← same three files
  direction-c-swing/            ← same three files
  dev-review.md                 ← stack cost per direction
  SYNTHESIS.md                  ← comparison + recommendation (lead)
```

**Every `rationale.md` contains:**

- `## Direction` — the idea in two sentences. What is this design's point of view?
- `## What it fixes` — mapped to specific findings in `research/audit.md`.
- `## Design tokens` — colour, type, spacing, radius, elevation. Concrete values.
- `## Mobile strategy` — specifically how PR line-item entry works on a phone.
- `## Stack implications` — what this needs beyond vanilla CSS, and why it is worth it.
- `## Risks` — what could go wrong, what is hardest to build, what might not survive contact with real data.

## 7. The three directions

| Direction | Remit | Risk posture |
|---|---|---|
| **A — Unify** | Resolve the two token sets into one coherent system. Same information architecture, dramatically more disciplined execution. Should be adoptable incrementally, view by view. | Low |
| **B — Bento** | Restructure around a modular grid of blocks. The dashboard already has KPI tiles and cards — push that into a real compositional system with clear hierarchy and scannability. | Medium |
| **C — Big swing** | Free rein. Question the information architecture itself, not just the surface. Is a table the right primary view? Should the form be a wizard? Is "dashboard / vendors / admin" the right shape? Argue for something better. | High |

Directions must be genuinely distinct. If A and B converge on the same design,
one of them has failed.
