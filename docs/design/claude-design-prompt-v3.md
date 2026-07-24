# Claude Design Prompt — Oizom Purchase Tool v3 UI

Copy everything below the line into Claude (claude.ai or Claude Code) to get UI design
mockups for the v3 purchase tool.

---

Design the UI for **Oizom Purchase Tool v3** — an internal purchasing dashboard for
Oizom (an environmental-monitoring hardware company, ~10 departments, ~50 users).
Produce high-fidelity HTML/CSS mockups (single self-contained HTML file per screen,
no frameworks, no external assets) that a developer will translate into a vanilla-JS
Vite SPA.

## Product context

Employees raise purchase requests (PRs) for parts, lab equipment, subscriptions, and
services. A PR flows through: Submitted → Approved → Ordered → In Transit → Received
(side states: Rejected, Cancelled, On Hold). The purchase team then fills in
procurement details (PO number, invoice, payment terms) and shipment tracking.
Google Sheets is the database; the dashboard is the primary UI. A Google Form also
feeds simple single-item requests into the same system.

## Users and roles

- **Requester** — creates PRs, edits own PRs while Submitted, views all.
- **Approver** — approves/rejects, edits any PR, fills procurement fields.
- **Admin** — everything + user management.
- **Viewer** — read-only.
- Shared department Google accounts are common, so every PR carries a free-text
  "requested by (name)" alongside the account email.

## Data model (what a PR looks like)

PR header: id (PR-2026-0042), created date, department, project, purpose, requester
email + name, vendor, total amount + currency (one currency per PR), status,
priority, approver email + name + date, payment status, payment term, PO no/date,
invoice no/date, quotation doc URL, courier, tracking number + link, expected date,
received date, notes.

Line items (1–10 per PR): description, part number, material type (Asset /
Inventory / Local Purchase / Subscription / Certification), qty, unit (pcs, L, kg…),
unit price, line total (qty × unit price, computed), purchase link, datasheet URL.
PR total = sum of line totals, always computed, never hand-entered.

Master data: vendor registry (searchable, auto-grows), dropdown lists for
departments, material types, priorities, couriers, payment terms, units, currencies.

## Screens to design

1. **Dashboard — Overview**: KPI tiles (total PRs, pending approval, unpaid with
   money totals, in transit, received %, total spend), monthly trend bar chart with
   metric switcher (count / spend / unpaid) and currency selector, top departments +
   top vendors mini spend bars. KPI tiles click through to the filtered table.
2. **Dashboard — Pipeline**: kanban-style columns (Awaiting approval / Ready to
   order / Ordered–In transit / On hold) with compact PR cards showing id, age in
   days, first item, vendor, amount, tracking.
3. **Dashboard — Table**: filterable PR list (department, status, payment, search),
   columns: id, date, dept, item summary ("Lightning module (+2 more)"), vendor,
   total, status chip.
4. **New / Edit PR form**: the key new screen. PR header fields + a **dynamic
   line-items editor** (add/remove rows: description, part no, material type, qty,
   unit, unit price, links) with a **live-computed total**. A "Procurement" section
   (payment, PO, invoice, tracking) visible only to approver/admin. Must degrade
   well on mobile (item rows stack).
5. **PR detail**: header summary with status chip and action buttons (Mark
   Approved / Rejected / Ordered…), items table with per-line totals and buy/doc
   links, procurement section (role-gated), tracking deep-link, audit-friendly
   "requested by X · email on date" lines.
6. **Reports**: spend by department / vendor / month / project / material type as
   horizontal bar lists (multi-currency amounts shown side by side, never summed
   across currencies), aging table, vendor performance table, CSV/print buttons.
7. **Admin**: user role management list; vendor registry table with inline edit.

## Existing design language (keep it)

- Light theme, white cards on a soft gray background, 1px subtle borders,
  8–12px radius.
- Accent/brand color used sparingly (buttons, active tabs, chart bars).
- Status chips: colored pill per state (Submitted amber, Approved blue, Ordered
  violet, In Transit cyan, Received green, Rejected/Cancelled red/gray, On Hold
  slate).
- Monospace font for PR ids and numbers; a clean sans (e.g. Inter) elsewhere.
- Dense but breathable tables; small uppercase muted column labels.
- Top nav: Oizom logo left; tabs Dashboard / Reports / New PR / Admin; live-sync
  chip ("● Live · 14:02 · 691 PRs") + refresh button right.

## Constraints

- Self-contained HTML/CSS per screen (inline styles or one <style> block); vanilla
  JS only where needed to demonstrate interactions (add item row, live total).
- No external fonts/CDNs in the mockup; system font stack acceptable.
- Must work at 1280px desktop and 390px mobile widths.
- Currency formatting: ₹1.2L / ₹2.4 Cr compact style for INR, $12.5K for USD.
- Multi-currency amounts are never summed — show "₹1.2L + $3.4K".

## Deliverable

One HTML file per screen (or one file with a screen switcher), plus a short note
per screen calling out the design decisions and any interaction states (hover,
empty, error, loading) you've included. Prioritize screen 4 (PR form with line
items) — it's the most novel and the hardest to get right.
