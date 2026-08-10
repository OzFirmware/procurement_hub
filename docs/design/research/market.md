# Market & Pattern Teardown

**For:** Oizom Procurement Hub UI/UX overhaul · **Date:** 2026-07-25 · **Author:** market research
**Reads:** `docs/design/BRIEF.md` first. This document does not restate the brief.

---

## How to read this

Every claim is tagged:

- **[verified]** — I fetched the page and quote it. URL given.
- **[inference]** — my reading, not stated by a source. Treat as a hypothesis, not a fact.
- **[snippet]** — seen in a search result but the page could not be fetched. Weakest tier.

The cost column throughout uses three tiers, chosen because they map to the real
constraint in `BRIEF.md` §2 — full `innerHTML` re-render per view, with an explicit
guard in `main.js` so typing does not wipe the PR form:

| Tier | Meaning |
|---|---|
| **CSS** | Pure `styles.css` change. Nearly free at 264 lines of CSS. |
| **CSS+JS** | Needs a bit of view JS, but no new state model. |
| **State** | Needs per-field state kept outside the re-render — the expensive tier. |

That last tier is the one that kills patterns. Anything with inline-editable cells,
autosave-per-keystroke, drag-to-reorder, virtualised rows, or optimistic writes lands
there and should be assumed expensive until dev-review prices it.

---

## Patterns worth stealing

| # | Pattern | Source | Oizom view | Cost | Fits |
|---|---|---|---|---|---|
| 1 | Two independent status tracks — order status and payment status as separate, first-class columns | Shopify Admin [verified] | `dashboard.js`, `prDetail.js` | CSS | A B C |
| 2 | Status **tabs** above the table, with saved filters below them | Stripe Dashboard [verified] | `dashboard.js` | CSS+JS | A B |
| 3 | Fixed status **categories**, team-editable statuses inside them | Linear [verified] | `lib/status.js` + chips | CSS+JS | C |
| 4 | Explicit "Display" control — group-by / order-by / list-vs-board toggle | Linear [verified] | `dashboard.js` | CSS+JS | B C |
| 5 | Badge = colour **+** text **+** icon, never colour alone | Polaris [verified] | `ui.js` `chip()` | CSS | A B C |
| 6 | Labels **above** fields on mobile, never placeholder-as-label | Baymard [verified] | `prForm.js` | CSS | A B C |
| 7 | `inputmode`/`type` per field to summon the numeric keypad | Baymard [verified] | `prForm.js` | CSS | A B C |
| 8 | Latest status update first, plain language, full history below it | NN/g [verified] | `prDetail.js` | CSS+JS | A B C |
| 9 | Bottom sheet for *quick* actions only — not for the 8-field item editor | NN/g [verified] | `prForm.js` mobile | CSS+JS | B C |
| 10 | One-click approve/reject rendered inside Gmail | Google Gmail markup [verified] | new backend endpoint | State | C |
| 11 | Dense-dashboard token set: 36px row height, 12px card padding, 12–14px type, 8px grid gap | `ui-ux-pro-max` styles DB | `styles.css` | CSS | A B |
| 12 | Numeric cells right-aligned, using "the numeric style" | Polaris [verified] | `dashboard.js` | CSS | A B C |
| 13 | Hide bulk actions below 490px rather than shrinking them | Polaris index table [verified] | `dashboard.js` | CSS | A B |
| 14 | Row click → full detail page (not a modal) as the primary drill-in | Stripe Dashboard [verified] | already true — keep | — | A B C |
| 15a | Mobile item entry is a **card stack**, not a grid reflow | Airtable, Shopify [verified] | `prForm.js` | CSS | A B C |
| 15b | Mobile creation as a **multi-step wizard with a persisted draft** — the full Procurify/Stripe shape | Procurify mobile, Stripe [verified] | `prForm.js` + new draft store | **State** | **C only** |
| 16a | Item **field split**: qty + price on the face, the other four behind one "more" | Stripe invoice editor [verified] | `prForm.js` | CSS | A B C |
| 16b | The pushed per-item **editor screen** that split normally lives in | Stripe, Shopify, FreshBooks [verified] | needs draft persistence | **State** | **C only** |
| 17 | Collapsed item card shows a *verifiable* summary, never just "Item 3" | Baymard accordion research [verified] | `prForm.js` | CSS | A B C |
| 18 | Approval email carries every line (qty × unit price × supplier) above the buttons | Coupa [verified] | new mail template | State | B C |
| 19 | "Remind" button, capped at once a day | Ramp [verified] | `prDetail.js` | CSS+JS | A B C |
| 20 | "Request changes" as a third verb beside approve/reject | Ramp [verified] | `prDetail.js` | CSS+JS | B C |
| 21 | Mark **required** (not optional) when most fields are optional — on a visible label | IBM Carbon [verified] | `prForm.js` | CSS | A B C |
| 22 | Four named empty-state types with distinct copy and actions | GitLab Pajamas [verified] | all six views — **priced per view, not once** | CSS+JS | A B C |
| 23 | Visible delete icon per item; swipe only as an accelerator, with undo | Shopify + NN/g [verified] | `prForm.js` | CSS+JS | B C |
| 24 | Duplicate-item button (no reference product ships this on mobile — Oizom's edge) | gap in the market | `prForm.js` | CSS+JS | A B C |
| 25 | "Time in current status" derived and displayed next to the chip | NN/g status trackers [verified] | `dashboard.js`, `prDetail.js` | CSS+JS | A B C |
| 26 | Human-readable record ID in the first column | NN/g data tables [verified] | already true (`PR-nnnn`) — keep | — | A B C |

Rows 15 and 16 are split deliberately. The reference products deliver the good mobile
behaviour *inside* a pushed screen with an autosaved draft, and that container is the
expensive part, not the layout. Directions A and B can have the layout; only C can have
the container, and only if it buys draft persistence first. See §3.

---

## 1. Direct competitors

A note on sourcing before anything else. Marketing pages are useless here; help centres are
where flows are actually described. Of the eight products asked for, five yielded usable
documentation, three did not: **Coupa's own docs site served a browser-compatibility stub**
(worked around with a fetched 117-page customer training deck — product UI is reliable,
tenant config is not), **Zip's help centre returned 403 twice**, and **Airbase's help
centre now 301s to a Paylocity KB that returns empty**. Anything below sourced from those
three is flagged.

### Procurify — the clearest split between desktop form and mobile cart

Web creation is a header form plus five separate line-entry paths: "**+ Add New Item**",
"**Import order items**" (CSV), "**Supplier portal**" (punchout), "**Add from catalog**",
"**Item history**". Hard ceiling of "*50-75 line items per order request*". The requester
picks their own approver before submitting
([success.procurify.com](https://success.procurify.com/en/articles/9001559-how-to-submit-an-order-request)) [verified].

Mobile is a **different flow, not a reflow** — a six-tap wizard plus a cart: Request →
Order → "*Enter Request details and tap Next*" → "*Tap Add an item or Browse catalog*" →
"*Enter/confirm item details and tap Add to cart*" → "*Tap Submit request*"
([success.procurify.com mobile](https://success.procurify.com/en/articles/9001565-how-to-create-an-order-request-on-mobile)) [verified].
This is the single most relevant precedent in the whole survey for the brief's demand that
mobile PR creation be a real design, not a responsive fallback.

### Precoro — the best-documented status and approval model

Seven statuses, each defined: Draft, Pending, Approved, Completed, Rejected, **In Revision**
("*a reviewer… is editing the document, adding or removing items*"), **Canceled** ("*the
initiator/approver revoked the whole document after it was approved*")
([help.precoro.com track](https://help.precoro.com/how-to-track-a-purchase-requisition)) [verified].

Approval is the strongest in the set:

- **From email, verified**: approvers "*can either Approve or Reject the document directly
  from your email or follow the 'Open the document' link*".
- **Bulk approve, verified** — the only product where it is documented: "*tick the boxes on
  the left and press the Approve/Reject Selected button*".
- **Context on hover**: "*you will see the necessary actions listed in the document itself,
  when you hover over the Approve/Reject button*"
  ([help.precoro.com approve](https://help.precoro.com/how-to-approve-a-purchase-requisition-1)) [verified].

Creation offers catalog / manual / Excel bulk upload / bulk update, and enforces one
constraint Oizom already shares: "*It isn't possible to have different suppliers at the
document level and item level in a custom PR at the same time*"
([help.precoro.com create](https://help.precoro.com/how-to-create-a-purchase-requisition)) [verified].

### Ramp — the minimal status model, and conditional intake

**Only four request states**: "*Approved*", "*Rejected*", "*Pending approval*",
"*Archived*". Line items carry quantity, rate, total; "*Negative amounts are permitted*";
and there is a document-first shortcut — "*upload a contract or quote and Ramp will
auto-fill the Frequency, Start/end date, and Line items*"
([support.ramp.com](https://support.ramp.com/how-to-submit-procurement-requests)) [verified].

Ramp's stated intake philosophy is worth quoting verbatim because it is the opposite of the
enterprise norm: "*Use **conditional questions** to keep intake forms short. Instead of
asking every question to every employee, show questions based on previous answers.*"
Approvers get "*email notifications when requests need your approval*" and can "*Approve,
reject, or **request changes***"; requesters can "*hit 'Remind' once a day to send a
reminder to approvers*"
([Quick Start Guide](https://support.ramp.com/hc/en-us/articles/49355243914387-Ramp-Procurement-Quick-Start-Guide)) [verified].
Approval routing targets "*specific users, fixed groups… or **relative groups** (for
example, 'Department Manager')*", with "*Require any*" vs "*Require all*" per step
([Configuring Procurement Workflows](https://support.ramp.com/hc/en-us/articles/40754114270867-Configuring-Procurement-Workflows)) [verified].
Slack/Teams approval appears only in search summaries — **unverified**.

### Coupa — the cart model, and the best approval email in the survey

Source caveat: a customer's 2019 end-user training deck
([mhi.com quick_start_manual.pdf](https://www.mhi.com/company/procurement/coupa/quick_start_manual.pdf)) [verified,
but tenant-specific config should not be generalised].

Creation is a true shopping cart with four entry paths — punchout, free-form
("*Write a request*" modal), search, blanket PO. The cart screen is tabbed:
**General Info / Cart Items / Approvers / Comments / History**, with a line grid whose
toolbar carries Add Line / Clear Cart / View / Advanced / Search / Sort, and row actions
Edit Selected / Copy / Delete. Bulk line edit exists and confirms with a toast —
"*2 Lines Adjusted*". Footer offers **Save for Later** (drafts), Save, Submit for Approval.

Two things here are directly stealable:

1. **The approval email carries the decision inline.** The deck states there are "*two ways
   to approve or reject a requisition in Coupa: 1. Email: directly from your inbox
   2. To Do list: on your Coupa Homepage*". The email body shows Submitted By, Total, and
   each item line with qty × unit price and supplier, then **View Req / Reject / Approve**
   buttons — and a reply-to-act fallback: "*Click the approve button below or simply reply
   to this email with the word Approve*". Rejection requires a comment. Approvals also work
   "*on a mobile device*". [verified in deck]
2. **Approvers are shown as a horizontal avatar chain ending in "Approval Complete"**, and
   hovering an approver reveals "*an explanation of **why the approver was added***".
   Explaining *why* someone is in the chain is the good idea; the eleven-node chain it
   explains is the bad one.

Coupa's status vocabulary adds one genuinely novel state: **Pending Buyer Action** — raised
when "*Supplier, Shipping Address, Billing Information*" are missing, i.e. data
incompleteness modelled as a first-class node in the approval chain rather than a
validation error. The invoice track runs entirely separately ("Invoice Approval Toll
Gates": PO match → receipt match → service validation → *Invoice Approved for Payment*),
with its own states (On Hold, Approved, Void) and its own escalation — "*Invoice approvals
will be escalated to approver's manager after 14 days of no action*". The PO itself needs
no second approval: "*there is no additional action needed or separate approval on the PO*".

Note the thing that *looks* like bulk approve and isn't: the To Do list shows several
requests each with its own Approve button. That is a stacked inbox.

### Zoho Procurement — the longest status list, the weakest approval

Eight statuses: Draft, Awaiting Approval, Approved, Rejected, On Hold, Processed, Canceled,
**Recalled** ([zoho.com procurement help](https://www.zoho.com/us/procurement/help/my-requests/overview/)) [verified].
Approval is documented as web-only and two-click: Approvals → Transaction Type → open →
Approve → confirm in a pop-up. Four approval models are exposed (Simple, Hierarchical,
Multi-Level, Custom), and approvers may reverse a decision in either direction
([approvals doc](https://www.zoho.com/us/procurement/help/my-requests/approvals-for-my-requests/)) [verified].
**No email approval is documented anywhere in Zoho Procurement's help.**

### Pipefy — status *is* position, which is a different model entirely

A purchase request is a **card** moving through **phases** on a kanban pipe; there is no
separate status field. Approval routing is an automation firing "*When a card enters a
phase*", with conditions on fields — cost centre "*is equal to Human Resources*" assigns
that manager, amount thresholds ("*if the amount is less than $1,000*") route to an analyst
versus senior buyers
([help.pipefy.com](https://help.pipefy.com/en/articles/6291556-pipefy-for-purchasing-create-automated-approval-flows)) [verified].

Crucially, requester tracking is a **separate surface** that must be switched on: requests
are followed via the "*Tasks & Requests*" button showing "*the phase of the request, when
it was last updated, and even send messages to the buyer*" — but "*the pipe admin must
enable request tracking*" or the requester sees nothing
([help.pipefy.com tracking](https://help.pipefy.com/en/articles/6291976-pipefy-for-purchasing-how-to-track-the-status-of-submitted-requests)) [verified].
That is the board model's structural weakness: a board is an operator's view, and the
requester needs a different one.

### Airbase and Zip — unverified

Airbase's own KB is gone. The only fetchable description is one customer's public runbook
(Mattermost), which documents category-triggered routing — "*Choose the Primary and
Secondary purchase categories to trigger the correct workflow*" — payment method chosen
*inside* the request (one-time virtual card / recurring virtual card / purchase order), and
sequential milestones Department → Budget → IT → Legal → Finance
([handbook.mattermost.com](https://handbook.mattermost.com/operations/finance/airbase/how-to-submit-a-purchase-request)) [verified,
but one tenant's configuration].

Zip's help centre 403'd. Its marketing page claims "*adaptive workflows that route requests
through the right process and approvals based on information provided by requesters*" and
"*Zip AI guides requesters through the submission process*"
([zip.com/capabilities/intake-management](https://zip.com/capabilities/intake-management)) [verified as
marketing copy only]. **Zip's actual creation UI, approval surfaces and status
visualisation are unverified — do not cite Zip as a design precedent.**

### Cross-product summary

| | Line-item entry | Mobile creation | Approve from email | Bulk approve | Statuses |
|---|---|---|---|---|---|
| Procurify | 5 paths | **separate cart wizard** | not documented | not documented | not named in docs |
| Precoro | 4 paths | not documented | **yes** | **yes** | 7, each defined |
| Ramp | form + doc autofill | not documented | email notify + web | not documented | **4** |
| Coupa | cart + line grid | approvals only | **yes, with lines inline** | no (stacked inbox) | ~6 incl. Pending Buyer Action |
| Zoho Procurement | not documented | not documented | **no** | not documented | **8** |
| Pipefy | card fields | not documented | email inside card | n/a | phases, not statuses |

### So what for Oizom

**Steal four things.**

1. **Procurify's split.** Desktop = form with a line grid. Mobile = a *different flow* — a
   short header step, then add-item, then submit. This is the strongest external
   validation that the brief's demand ("a responsive reflow does not count") is what
   serious products actually do.
2. **Coupa's approval email content model.** Submitted-by, total, and every line with
   qty × unit price and supplier, rendered in the mail body, with the buttons beneath.
   Whatever the transport mechanism (see §4), that is the content spec.
3. **Ramp's four-state discipline and its "Remind" button.** Oizom has eight statuses for
   fewer than 50 users. Ramp serves far more with four. And "Remind" solves the real
   requester pain — not knowing whether to nag — with one button and one email.
4. **Coupa's "Pending Buyer Action" idea, translated.** Oizom's equivalent is a PR that is
   approved but missing PO number, invoice number or payment term — admin-only fields that
   currently have no visible "incomplete" signal at all. A derived "needs procurement
   detail" state (computed, not stored) would surface real work.

**Reject four things, firmly.**

1. **Catalogs and punchout.** Every one of these products organises creation around a
   catalogue. Oizom's requesters paste a purchase link. There is nothing to browse.
2. **Configurable approval routing.** Ramp's relative groups, Pipefy's phase automations,
   Zip's adaptive workflows, Airbase's five sequential milestones — all solve
   many-approvers-many-departments. Oizom has **one approver per PR** and a transition
   matrix already hardcoded in `lib/status.js`. A workflow builder here is a settings page
   with nothing to set.
3. **Bulk approve.** Verified only in Precoro. It costs a permanent checkbox column on the
   dashboard table to save clicks at a volume Oizom does not have.
4. **Zoho's two-click confirm dialog on approve.** A confirmation modal on the *positive*
   action is friction with no safety payoff — the action is reversible in Oizom's matrix
   (`Approved → Submitted` is a legal staff transition). Keep the confirm on Reject and
   Cancel, which `dashboard.js` already does, and drop it on Approve.

One caution on the CSV/Excel import paths that Procurify and Precoro both offer: they exist
because those products routinely see 50–75 line items. Oizom's typical PR is one to five.
The import path is solving a volume problem Oizom does not have.

---

## 2. Adjacent best-in-class

These are not procurement tools. They solve the *interaction* problems Oizom has, and
they solve them better than any procurement vendor does.

### Linear — status density and the "Display" control

Linear's central insight is that a status model should be **small and fixed at the
category level, flexible below it**. The docs state five fixed categories —
`Backlog > Todo > In Progress > Done > Canceled` — plus an automatic `Duplicate` and an
optional `Triage` inbox, and teams may add custom statuses *inside* a category, but
"*the categories themselves stay in a fixed order*"
([linear.app/docs/configuring-workflows](https://linear.app/docs/configuring-workflows)) [verified].

The second thing Linear does that Oizom does not is expose an explicit **Display**
control rather than burying view configuration. Users can "*Group issues by properties
such as status, assignee, project, priority, cycle, label, parent issue, team, customer,
release, and SLA status*" and "*Order issues within their groupings by … Status, Manual,
Priority, Last created, Last updated, Due date, and Link count*", plus a list/board
toggle on `Cmd/Ctrl B`
([linear.app/docs/display-options](https://linear.app/docs/display-options)) [verified].
Notably, the docs do **not** offer a density/compactness setting — density is a design
decision Linear made once, not a user preference [verified, by absence].

### Stripe Dashboard — financial tables and drill-in

Two transferable behaviours, both documented:

- **The row is a link to a page, not a modal.** "*Click a customer's name to see more
  details, including subscriptions, payments, payment methods, invoices, and quotes*"
  ([docs.stripe.com/dashboard/basics](https://docs.stripe.com/dashboard/basics)) [verified].
- **Keyboard help is discoverable, not hidden.** "*On your keyboard, press the question
  mark key (`?`) for a list of available keyboard shortcuts for common actions*"
  (same page) [verified].

Column customisation and status tabs are Stripe's answer to the "everyone wants a
different column" problem — you can "customize which columns display in your view using
Edit columns", and "a tab's column selections persist" across navigation
[snippet — search result text, the underlying help page was not fetched].

### Shopify Admin — order tracking, structurally the same object as a PR

This is the closest structural analogue in the whole survey. A Shopify order is a header
plus line items that moves through fulfilment while payment runs alongside. Shopify does
**not** model this as one status. It models four independent dimensions
([help.shopify.com order status](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status)) [verified]:

| Track | Values |
|---|---|
| Order status | Open, Archived, Canceled |
| Payment status | Pending, Authorized, Due, Expiring, Expired, Paid, Refunded, Partially refunded, Partially paid, Voided, Unpaid |
| Fulfillment status | Unfulfilled, In progress, On hold, Scheduled, Partially fulfilled, Fulfilled, Fulfillment not required |
| Return status | Return requested, Return in progress, Returned, Inspection complete |

The docs are explicit that payment is its own axis: "*The payment status of an order is
an important part of the information that determines what tasks you need to do for an
order*" [verified]. Shopify also gives *lifecycle-terminal* states their own home —
`Archived` is an order-status value, not a fulfilment value, so "done and filed" never
competes for the same slot as "delivered".

Polaris (Shopify's design system) backs the table side of this. The index table exists
"*to help merchants get an at-a-glance of the objects to perform actions or navigate to a
full-page representation of it*"; it recommends "*Numeric cells and titles should be right
aligned*" and "*Numeric cells should use the numeric style*"; and on small screens it
says to hide bulk actions rather than cram them — "*We only recommend hiding bulk actions
on screens smaller than 490px*"
([polaris-react.shopify.com/components/tables/index-table](https://polaris-react.shopify.com/components/tables/index-table)) [verified].

On colour semantics Polaris is blunt: "*red signifies critical errors*", "*green
represents success messages*", "*blue is used to draw attention to tips and offers*", and
the accessibility rule — "*Use color in conjunction with other discernible elements to
amplify the message*", with "use colour alone to convey meaning" listed as the
don't ([polaris-react.shopify.com/design/colors](https://polaris-react.shopify.com/design/colors)) [verified].

### So what for Oizom

Three things transfer directly, and one does not.

**Transfers — the parallel payment track.** Today `dashboard.js` renders seven columns
(`ID, Date, Dept, Item, Vendor, Amount, Status`) and `paymentStatus` appears nowhere in
that table; it lives only in `prDetail.js` and as an "Unpaid" KPI tile. Oizom's own
`PAYMENTS` vocabulary — `Unpaid / Paid / Partially Paid / FOC · Free` — is a genuine
second axis, exactly like Shopify's. Making it a real column (or a second badge in the
status cell) is a CSS-tier change with disproportionate value: the "which approved PRs
are still unpaid" question is currently answerable only via one KPI tile.

**Transfers — Polaris colour discipline.** `styles.css` lines 49–55 give `Approved` and
`Received` the *same* treatment (`--brand-soft` / `--brand`), and `Ordered` and
`In Transit` the same amber. Four of Oizom's eight statuses collapse into two visual
signals, and the signal is colour-only with no icon. That is the exact failure Polaris
names. Fixing it is pure CSS.

**Transfers — the Display control, but only in Direction C.** Linear's group-by is the
honest version of what Oizom's KPI-tiles-as-filters already gestures at. Today clicking
a tile is the *only* way to slice the table, and the slice vocabulary is fixed in
`KPI_FILTERS`. A real group-by (by department, by vendor, by status) would replace six
hardcoded tiles with one control. That is a CSS+JS change, but it is an
information-architecture change — it belongs in C, not A.

**Does not transfer — column customisation and saved views.** Stripe serves millions of
merchants with irreconcilable needs. Oizom has fewer than 50 users and one PR schema.
Per-user column config is a settings surface, a persistence question, and a support
burden in exchange for solving a problem Oizom does not have. Pick the seven right
columns and defend them.

---

## 3. The line-item entry problem

This is the sharpest problem in the brief, so state it precisely. The current item row
(`frontend/src/views/prForm.js`, `itemRowHtml`) is a nine-cell CSS grid:

| # | Field | Control | Required |
|---|---|---|---|
| 1 | `i_description` | text | yes (filters the row) |
| 2 | `i_partNo` | text — **Production dept only**, hidden input otherwise | no |
| 3 | `i_materialType` | select | yes |
| 4 | `i_qty` | number | yes |
| 5 | `i_unit` | select, defaults `pcs` | yes |
| 6 | `i_unitPrice` | number | no |
| 7 | `i_purchaseLink` | text (URL) | no |
| 8 | `i_datasheetDoc` | text (URL) | no |
| 9 | remove | button | — |

Below 900px this grid becomes `1fr 1fr`. Four of the eight fields are optional; three are
required plus description. **That asymmetry is the design lever** — the mobile form does
not need to show eight fields, it needs to show four and make the other four reachable.

### The spine: no product that ships this edits a multi-column row inline on a phone

Three independent products converge on the same mechanic — an explicit add-action opens a
**dedicated single-item editor**, then returns to a summary list. None of them uses a
bottom sheet.

- **Shopify draft orders (mobile app)** — "*Tap Add custom item*"; "*In the Add custom item
  screen, enter the item name, price, and quantity*"; confirm with "*Tap Save or ✓*";
  delete via "*the trash can icon next to the product*"
  ([help.shopify.com create-draft](https://help.shopify.com/en/manual/fulfillment/managing-orders/create-orders/create-draft)) [verified].
  The invoice screen itself stays a read-only summary list.
- **FreshBooks mobile (iOS and Android, identical wording)** — "*Tap on **Add a Line** to
  add your Items*"
  ([iOS](https://support.freshbooks.com/hc/en-us/articles/227484828-How-do-I-create-invoices-on-iOS),
  [Android](https://support.freshbooks.com/hc/en-us/articles/227483868-How-do-I-create-invoices-on-Android)) [verified].
  Neither page documents what appears after the tap — a gap, not a contradiction.
- **Stripe invoice editor — the most transferable of the three.** It splits the item editor
  into two tiers: "*Enter the **Quantity** and **Price** for your new item or product*",
  then "*(Optional) Click the **Item options** under each item to add a tax rate, coupon,
  or supply date*". Drafts persist: "*Whenever you exit the invoice editor, Stripe saves a
  draft*" ([docs.stripe.com/invoicing/dashboard](https://docs.stripe.com/invoicing/dashboard)) [verified].

**Airtable — the spreadsheet company's own mobile answer is a form.** Its mobile
interfaces support "*Edit or update field data*" and "*Add records through forms*", while
Timeline, Swimlanes, printing, CSV export and end-user filtering/grouping are all
unsupported on mobile
([support.airtable.com](https://support.airtable.com/docs/mobile-interfaces-in-airtable)) [verified].
If the grid company abandons the grid on a phone, the case for reflowing Oizom's is thin.

**The bottom-sheet idea has no evidential support.** Every product verified above uses a
pushed screen. Material 3, Apple HIG and the NN/g bottom-sheet page were checked; NN/g's
guidance (below) actively argues against sheets for this content, and no product was found
using one as a line-item editor. If a direction wants a sheet, it is an unvalidated
variant, not the industry pattern.

### What the evidence says, independent of any product

- **Labels above fields, not beside and not as placeholders.** Baymard ran "*18 mobile
  e-commerce sites … more than a thousand mobile checkout form fields*" and concluded
  "*the answer is: above, with one exception*" (landscape, where the keyboard eats
  18–33% of the viewport)
  ([baymard.com](https://baymard.com/blog/mobile-form-usability-label-position)) [verified].
  Every field in `itemRowHtml` today is placeholder-only — the label disappears the
  moment the user types. On a 9-column desktop grid a header row carries the labels; on
  a 2-column mobile reflow nothing does.
- **Wrong keyboard is the most common mobile form failure.** Baymard: invoking the numeric
  keypad gives "*up to 500% larger keys*" and "*greatly reduce[s] typos*", yet "*54% of
  mobile sites fail to invoke optimized touch keyboards*"
  ([baymard.com/blog/mobile-touch-keyboards](https://baymard.com/blog/mobile-touch-keyboards)) [snippet — summary text, page not fetched].
  `i_qty` and `i_unitPrice` are already `type="number"`, which is correct; the two URL
  fields are plain `text` and should be `type="url"` with `autocapitalize="off"` and
  `autocorrect="off"` — Baymard reports auto-correction and auto-capitalisation are
  "*neglected by 79% and 27% of mobile sites respectively*" [snippet].
- **Bottom sheets are for quick interactions, not for eight-field forms.** NN/g defines a
  bottom sheet as "*an overlay that is anchored to the bottom edge … that displays
  additional details or actions*" and warns: "*A sheet is inherently a transient UI
  element — it is meant to support quick interactions, and it should not be used for
  displaying complex content*", plus "*Do not use a bottom sheet to replace typical
  page-to-page user flows*" and "*Provide a clear Close button … rather than relying
  exclusively on the grab handle*"
  ([nngroup.com/articles/bottom-sheet](https://www.nngroup.com/articles/bottom-sheet/)) [verified].
  NN/g also debunks the reachability argument that usually justifies the pattern:
  bottom positioning "*doesn't improve mobile tap accessibility across varied grip
  styles*" [verified].

- **Progressive disclosure has a hard ceiling of two levels.** NN/g: "*Initially, show
  users only a few of the most important options*", "*Offer a larger set of specialized
  options upon request*", and the constraint — "*Designs that go beyond 2 disclosure levels
  typically have low usability because users often get lost when moving between the
  levels*"
  ([nngroup.com/articles/progressive-disclosure](https://www.nngroup.com/articles/progressive-disclosure/)) [verified].
  This is the single most binding rule on the design: list → item editor is level one;
  a "more fields" reveal *inside* that editor is level two; anything further is over.
- **A collapsed item card must be verifiable without opening it.** Baymard's accordion
  research found users "*reference both running order summary information and order review
  steps to double-check previous selections or entered data*", that heading-only collapsed
  rows force users to "*reopen completed steps*" which "*adds friction*", and that
  reopening to verify was "*particularly problematic on mobile*"
  ([baymard.com/blog/accordion-checkout-usability](https://baymard.com/blog/accordion-checkout-usability)) [verified].
- **The keyboard eats half the screen.** Baymard: "*the touch keyboard will take up close
  to 50% of the available screen space in portrait mode*" (70–80% landscape), and inline
  or placeholder labels produce "*false simplicity: visually simple but complicated to
  use*" ([baymard.com/blog/mobile-checkout](https://baymard.com/blog/mobile-checkout)) [verified].
- **Do not split one value across multiple mobile fields.** Baymard: "*on mobile … you
  should **avoid** splitting single input entities across multiple fields due to the
  interaction issues*"; observed subjects "*had a hard time navigating between such
  fields*" and "*found it unclear if they were all required*"
  ([baymard.com](https://baymard.com/blog/mobile-form-usability-single-input-fields)) [verified].
  Qty + unit is exactly such a pair — keep them on one line as one composite control, not
  two stacked fields.
- **Single-column forms beat multi-column.** Baymard: "*single-column layouts resulted in
  fewer skipped fields, misinterpreted fields, and errors compared to multicolumn
  layouts*" ([baymard.com/blog/avoid-multi-column-forms](https://baymard.com/blog/avoid-multi-column-forms)) [verified,
  but this is checkout research; extending it to a line-item grid is an extrapolation].
  IBM Carbon says the same thing prescriptively: "*Carbon generally recommends
  single-column forms, simply because multicolumn forms are more prone to
  misinterpretation*", and "*Top-aligned labels are Carbon's default … and the only label
  arrangement currently offered*"
  ([Carbon forms pattern](https://carbondesignsystem.com/patterns/forms-pattern/)) [verified via raw MDX].
- **Swipe-to-delete: accelerator only.** NN/g: "*Lack of signifiers makes it unclear where
  the contextual swipe can be used*"; "*Limit contextual swipe to destructive actions*";
  "*Burying key actions behind a contextual swipe prevents users from discovering them*";
  and either "*Ask for confirmation*" or "*support easy undo*"
  ([nngroup.com/articles/contextual-swipe](https://www.nngroup.com/articles/contextual-swipe/)) [verified].
  Shopify's visible trash icon is the discoverable counterpart.
- **Line-level OCR import is a shipped feature, but not a camera flow.** Zoho Expense
  Autoscan "*is capable of extracting data at a line item level*" — however the help page
  documents only five upload paths (computer/cloud upload, drag-and-drop, two browser
  extensions, email-to-account) and never a phone camera
  ([zoho.com/us/expense/kb/home/autoscan](https://www.zoho.com/us/expense/kb/home/autoscan/)) [verified].

The bottom-sheet correction is worth stating explicitly, because it is the pattern most
teams reach for first. NN/g's rule puts an eight-field editor over the line for a
transient sheet — **unless** it is the expandable variety that becomes full-screen modal,
which NN/g does describe ("*Some sheets … start[] nonmodal but becom[e] modal when
expanded to full screen*") [verified]. Any sheet proposal must be the full-height
expandable kind, must carry a Close button, and must not stack a second sheet on top for
the unit and material-type pickers — which is exactly what a naive eight-field editor
with two `<select>`s produces.

### So what for Oizom

There is a real tension here, and it should be surfaced rather than smoothed over.
**The evidence points at a pushed editor screen; the architecture points away from it.**
Shopify, FreshBooks and Stripe all navigate to a dedicated per-item screen. Oizom cannot
cheaply navigate anywhere mid-form: `main.js` re-renders whole views from `innerHTML`, and
a route change would discard a half-typed PR header. So the honest recommendation is the
architecture-compatible approximation of the pushed screen, not the pushed screen itself.

1. **Card per item, not a reflowed row.** Each item is a card in a vertical stack.
   Collapsed, it shows what Baymard's accordion research demands — enough to verify
   without opening: description, `qty × unit`, unit price, line total. Not "Item 3".
   CSS-tier: same DOM, different grid at the breakpoint, no conditional mounting, so the
   `main.js` guard is untouched.
2. **One in-card disclosure, and only one.** Part number, material type, purchase link and
   datasheet go behind a single "More details" reveal. Description, qty, unit and unit
   price stay on the face. That is Stripe's two-tier split, and it stays inside NN/g's
   two-level ceiling. Native `<details>`/`<summary>` does this with zero JS and keeps every
   input in the DOM, so `collectItems()` in `prForm.js` — which queries `[name=...]`
   regardless of visibility — needs no change at all. **CSS-tier.**
   [inference: no source prescribes `<details>`; the field split is Stripe-shaped, the
   implementation choice is from this codebase.]
3. **An explicit "Add item" button below the stack**, matching "*Tap Add custom item*" /
   "*Tap on Add a Line*". Not a ghost row that materialises on typing.
4. **Sticky running total pinned to the bottom edge.** Justified by Baymard's finding that
   users continuously "*reference … running order summary information*", not by a
   reachability argument. `position:sticky` footer; `i_lineTotal` already exists.
   CSS-tier.
5. **Visible delete icon per card; swipe as an optional accelerator with undo.** NN/g is
   explicit that swipe alone hides the action.
6. **Duplicate-item is the highest-value affordance nobody ships.** No researched product
   documents per-line duplication on mobile — Zoho clones whole invoices, not lines. Real
   Oizom items are near-identical (same material type, same unit, same supplier link,
   different part number), so copying eight values in one tap is a bigger win here than in
   any of the reference products. CSS+JS-tier, roughly ten lines. **This is the one place
   Oizom can beat the references rather than catch up to them.**
7. **Fix the two URL fields.** They are the worst things to type on a phone keyboard.
   `type="url"` with `autocapitalize="off"` / `autocorrect="off"` is free; better still,
   demote both below the disclosure and treat them as paste-only. [inference]

**A separate add-item route stays rejected — but say why in the rationale.** It is the
pattern with the best evidence and the worst architectural fit. Stripe makes it work by
autosaving drafts ("*Whenever you exit the invoice editor, Stripe saves a draft*"); Oizom
has no draft mechanism. Direction C may argue for one, but it must buy draft persistence
first. **State-tier.**

Be sceptical of bulk paste and OCR import. No source documents spreadsheet paste working
on mobile at all, and Zoho's line-level OCR has no documented camera path. Both are
desktop-side escape hatches at best. For a tool where a typical PR is one to five lines,
name them as futures in Direction C, not deliverables.

---

## 4. Approval UX

Oizom's approvers act fast and often from email. The brief's framing is right; the
feasibility is the part nobody has priced.

### What "approve from the inbox" actually requires here

Because Oizom is a Google Workspace shop, the relevant mechanism is Gmail's schema.org
markup, not a bespoke link. Google documents it: "*One-click actions allow users to
perform operations directly from the inbox without having to leave Gmail*", and the type
for this case is `ConfirmAction` — "*You may add a one-click confirm button to emails
requiring users to approve, confirm and acknowledge something*", noting the action "can
only be used once"
([developers.google.com/workspace/gmail/markup/reference/one-click-action](https://developers.google.com/workspace/gmail/markup/reference/one-click-action)) [verified].
It fires an HTTP request to your handler; "*After processing and recording the action
successfully, the service should return a response code 200 (OK)*" [snippet].

**The blocker, stated plainly.** Google requires registration before production use:
"*When you are ready to launch your marked up emails to your users, you will need to
register with Google*", and "*Emails must be authenticated via DKIM or SPF*" with the
sending TLD matching the `From:` TLD. The only exemption is self-to-self: "*All schemas
you send to yourself (from x@gmail.com to x@gmail.com) will be displayed in Google
products*"
([developers.google.com/workspace/gmail/markup/registering-with-google](https://developers.google.com/workspace/gmail/markup/registering-with-google)) [verified].
That exemption is per-*account*, not per-domain, so it does not cover approver@oizom.com
receiving mail from the Apps Script service account. **Gmail-native one-click approve is
a registration project, not a design decision.** [verified requirement + inference on
applicability]

**The fallback that is actually cheap.** Apps Script can serve a signed approve/reject
link. `doGet` receives query parameters — "*`e.parameter` — key/value pairs*" — and the
deployment can "*execute as the owner*" so the handler runs with sheet write access "*no
matter who accesses the web app*"
([developers.google.com/apps-script/guides/web](https://developers.google.com/apps-script/guides/web)) [verified].
So a mail can carry `?action=approve&pr=PR-1042&t=<hmac>` landing on a one-screen
confirmation page. This **bypasses the Google Identity gate** that protects the rest of
the app — the token becomes the credential. That is the trade-off the lead needs to see
before any direction draws an "Approve" button in an email mock: it is a security
decision (token expiry, single-use, audit trail), not a styling decision. **State-tier.**

### What good approval UX looks like when the click is cheap

The products that do this well converge on one answer: **put the decision facts in the mail
body, not behind the link.** Coupa's approval email carries submitted-by, total, and every
line with qty × unit price and supplier, above the View Req / Reject / Approve buttons, and
even accepts a text fallback — "*Click the approve button below or simply reply to this
email with the word Approve*" [verified, §1]. Precoro's approvers act "*directly from your
email*" [verified, §1]. Zoho Procurement, notably, documents no email approval at all and
requires a two-click web confirm — it is the counter-example, not the model.

Two smaller mechanics worth naming:

- **Rejection asymmetry.** Coupa requires a comment on reject and not on approve. Ramp
  offers a third verb — approvers can "*Approve, reject, or request changes*" [verified,
  §1] — which is more honest than forcing a rejection when the real message is "add the
  datasheet".
- **Explain the approver, not just the approval.** Coupa reveals "*an explanation of why the
  approver was added*" on hover [verified, §1]. Oizom has one approver, so the transferable
  version is the inverse: explain to the *requester* who is holding the PR and since when.
- **Requester-side nudge.** Ramp's "*Remind*", capped at once a day [verified, §1], is the
  cheapest possible fix for the most common procurement complaint — silence.

### So what for Oizom

- **Design the approval *screen* first, the email second.** The mobile PR-detail view is
  where approvers will actually land from any link, Gmail-native or not. Two large
  buttons, the four decision facts above them, items collapsed below. That is CSS-tier
  and it is the whole win.
- **Reject needs a reason; approve does not.** Oizom's status machine already allows
  `Rejected → Submitted` for the owner (`lib/status.js`), so rejection is a *revision
  request* in practice. A rejection with no reason makes that loop useless. One required
  textarea on reject only. CSS+JS-tier.
- **Bulk approve is not worth it at this scale.** Ramp offers it (select checkboxes,
  click Approve) [snippet]. With one approver and a low PR volume, checkbox columns cost
  a column of table width permanently to save a few clicks occasionally. Reject for A and
  B; Direction C may argue for it.
- **Add "Remind", not a notification system.** Ramp's once-a-day reminder button on the
  requester's own PR is a single mailto-or-backend-call and removes the "should I ping
  him on WhatsApp" problem entirely. CSS+JS-tier if the backend already sends mail.
- **Consider a third verb.** `Rejected → Submitted` already exists in `lib/status.js` for
  the owner, so Oizom *has* a revision loop — it is just labelled with the harshest
  available word. Ramp's "request changes" is the same transition with a name people can
  act on without feeling judged. CSS+JS-tier; no matrix change needed.
- **Approver context that Oizom uniquely has:** the vendor stats already computed in
  `lib/vendorStats.js`. "You've approved ₹4.2L with this vendor across 11 PRs; 2 unpaid"
  next to the approve button is a genuinely better decision aid than anything a generic
  procurement tool shows, and the data is already there. CSS+JS-tier.

---

## 5. Status and pipeline visualisation

Oizom's model, from `frontend/src/lib/status.js`:

```
STATUSES = Submitted, Approved, Rejected, Ordered, In Transit, Received, Cancelled, On Hold
```

Five of those are a linear pipeline — **Submitted → Approved → Ordered → In Transit →
Received**. Three are off-track: `Rejected`, `Cancelled`, `On Hold`. `On Hold` is
especially awkward because the transition table lets it return to *four* different
states (`Submitted`, `Approved`, `Ordered`, `Cancelled`) — it is a modal overlay on the
pipeline, not a position in it. Payment status runs alongside as a fourth vocabulary
(`Unpaid / Paid / Partially Paid / FOC · Free`).

### The four candidate visualisations, and where each breaks

| Form | Reads well at | Handles off-track states | Handles parallel payment track | Cost |
|---|---|---|---|---|
| **Chip / badge** | table row | yes, trivially — it is just another value | yes, as a second chip | CSS |
| **Stepper** | detail page | **badly** — `On Hold` and `Cancelled` have no slot | no — needs a second stepper | CSS |
| **Timeline** (event log) | detail page | yes — off-track states are just events | yes — payment events interleave | CSS+JS |
| **Pipeline board** (kanban) | full view | yes, as extra columns | no — a card lives in one column | CSS+JS |

The stepper is the pattern everyone draws first and it is the one that fits Oizom worst,
and there is now a citable reason rather than just an argument. **IBM Carbon names two
explicit avoid-cases for the progress indicator: when a process "*has fewer than three
steps*", and when "*the process may be completed in any order*"**
([carbondesignsystem.com progress-indicator](https://carbondesignsystem.com/components/progress-indicator/usage/)) [verified
via raw MDX]. Oizom's transition matrix permits `On Hold → Submitted | Approved | Ordered |
Cancelled` and `Rejected → Submitted`; it is emphatically not an in-order process. A
five-step stepper looks clean until a PR goes On Hold, at which point the component has to
represent "somewhere between step 2 and 3, paused, may go backwards", and honest
implementations degrade into a stepper plus a banner explaining that the stepper is wrong.

Carbon's five step states are still worth reusing as *vocabulary* even if the component is
rejected — Completed, Current, Not started, **Error** ("*A step may be in error when a user
has entered invalid or incomplete information*"), Disabled — and its layout note applies to
any vertical timeline: "*When possible, arrange the progress indicator vertically for easier
reading*" [verified].

Atlassian's progress-tracker and lozenge pages could not be read — both render as
JavaScript shells and returned navigation only. Do not treat Atlassian as a source in this
document.

Shopify's answer — four independent status dimensions rather than one composite
([help.shopify.com](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status)) [verified]
— is the strongest evidence available that the composite-single-status model is the wrong
shape for an order-like object. Coupa independently arrives at the same structure: its
invoice track is a separate flowchart of "Invoice Approval Toll Gates" with its own states
(On Hold, Approved, Void) and its own 14-day escalation, while the order side needs "*no
additional action or separate approval on the PO*" [verified, §1].

Status *vocabulary* is where competitors diverge most, and the spread is instructive:
Ramp ships four states, Precoro seven, Zoho Procurement eight, Coupa around six plus
Pending Buyer Action. Oizom has eight for under 50 users. Precoro is the useful model
because it defines each one in the help text — "*In Revision*" means "*a reviewer… is
editing the document*", "*Canceled*" means "*the initiator/approver revoked the whole
document after it was approved*" [verified, §1]. Oizom's eight statuses have hover hints in
the form but no definitions anywhere the requester will see them.

NN/g's 16 status-tracker guidelines are directly applicable and mostly cheap
([nngroup.com/articles/status-tracker-progress-update](https://www.nngroup.com/articles/status-tracker-progress-update/)) [verified]:

- "*Present the latest update prominently, so users can find it first.*"
- "*Show previous updates alongside current ones.*" — i.e. a tracker *and* a history, not
  one or the other.
- "*Backend codes and internal jargon, such as 'fulfilled' or 'label created', mean
  nothing to the user.*" — Oizom's `In Transit` and `Ordered` are fine; `FOC / Free` is
  the one payment value a new requester will not parse.
- "*When there are long periods with no update, users start to think perhaps something
  went wrong, they lose trust.*" — the argument for showing "Ordered 12 days ago" rather
  than a bare `Ordered` chip.

### So what for Oizom

**Row scale: two chips, never a stepper.** `dashboard.js` should carry a status chip and
a payment chip in the same cell (or adjacent cells). Chips already exist in `ui.js`; the
CSS at `styles.css:48–55` needs a real eight-value palette — currently `Approved` and
`Received` share `--brand-soft`, and `Ordered` and `In Transit` share amber, so half the
pipeline is visually indistinguishable. Add a small icon per status to satisfy Polaris's
colour-alone rule. **CSS-tier, high value.**

**Detail scale: a timeline, not a stepper.** `prDetail.js` should lead with the latest
event in plain language plus a relative date, then a reverse-chronological list of what
happened, with payment events interleaved. This is the NN/g "latest first + history
below" shape, it degrades gracefully for `On Hold` and `Rejected`, and it is the only
form that can show *when* something stalled. The backend already keeps a `Log`. **CSS+JS
if the log is exposed; CSS-only if the design settles for the timestamped fields already
on the PR record.**

**Pipeline board: Direction C only.** A kanban of PRs by status is a genuinely different
information architecture and would answer "what is stuck" better than a table does. It
also cannot show the payment track, needs drag-and-drop to justify itself (State-tier),
and duplicates the inline status dropdown that already exists on the dashboard. Worth
arguing for; not worth assuming.

**A note on age.** The single most useful derived field Oizom does not display is
*time in current status*. It converts a static chip into a signal — `Ordered · 12d` is
actionable; `Ordered` is not. `createdAt`/`updatedAt` already exist. CSS+JS-tier.

---

## 6. Reference templates and design systems

A blunt warning on sourcing: **most modern design-system sites are JavaScript shells and
cannot be read by a fetch.** Atlassian's lozenge and progress-tracker pages, Adobe
Spectrum's status light, Material 3's badges and Salesforce Lightning's badges all returned
navigation-only. The workaround that worked was fetching **raw `.mdx` from the design
system's GitHub repo** — that is how the Carbon material below was obtained, and it is
worth reusing.

### The four pages actually worth reading

| Topic | Source | Why |
|---|---|---|
| Form layout | [Carbon forms pattern](https://carbondesignsystem.com/patterns/forms-pattern/) | The most directly applicable page found for a requisition form |
| Progress indicators | [Carbon progress-indicator usage](https://carbondesignsystem.com/components/progress-indicator/usage/) | Five step states + two avoid-cases (see §5) |
| Data tables | [NN/g data tables](https://www.nngroup.com/articles/data-tables/) | The inline-vs-modal editing finding |
| Empty states | [GitLab Pajamas](https://design.gitlab.com/patterns/empty-states/) · [Carbon empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/) | Four named types, prescribed copy |

**Carbon on forms** [verified via raw MDX]:

- "*Carbon generally recommends single-column forms, simply because multicolumn forms are
  more prone to misinterpretation.*"
- "*Top-aligned labels are Carbon's default (vs. left-aligned labels) and the only label
  arrangement currently offered.*"
- **The required/optional flip, which most teams get backwards:** on simple forms, "mark
  **only** the optional field labels with *(optional)*"; on complex enterprise forms where
  most fields are optional, "mark **only** the required field labels with *(required)*".
- "*Inputs should be grouped to help users understand what is required of them in a logical
  way.*" Spacing: 32px between inputs on dedicated pages, 24–16px in contained forms.

**NN/g on editing table records** — the strongest single find in this section, and it
contradicts the obvious default ([nngroup.com/articles/data-tables](https://www.nngroup.com/articles/data-tables/)) [verified]:

- "*Edit in place (where the table row becomes editable). This solution works only if the
  table is narrow.*"
- Modals "*will cover adjacent records in the table and the user won't be able to reference
  or copy data from a similar record.*"
- Also: the first column "*should be a human-readable record identifier instead of a
  'mystery meat' automatically generated ID*"; "*Freeze header rows and header columns (if
  the table is larger than the screen)*"; "*Borders, zebra striping, and hover-triggered
  highlighting of a record can all help.*"

**GitLab Pajamas on empty states** [verified]: four named types — Blank content
("*Contains a method for creating content*"), Configuration required, Higher tier feature,
Empty search results — with prescribed copy for the last: title exactly "*No results
found*", description "*Edit your search and try again*". **Carbon** adds the avoid-list:
"*Multiple options in one empty state*", product jargon, dead-ends, and "*Flippant or
joking language, especially in error situations*" [verified].

**Polaris badge vocabulary** — the tone *names* are documented (Informational, Success,
Attention, Warning, Critical, Incomplete, Partially complete, Complete) with example labels
"Paid", "Refunded", "Fulfilled", but the page "*does not contain explicit guidance defining
what each tone communicates*"
([polaris badge](https://polaris-react.shopify.com/components/feedback-indicators/badge)) [verified —
the absence is the finding]. The vocabulary is still useful; the colour semantics come from
the Polaris colour page quoted in §2.

### Templates usable without a build step

This is the filter that matters, given a vanilla-JS + hand-written-CSS stack.

| Tool | Build step? | Evidence |
|---|---|---|
| **Tabler** | **No — best fit** | "*Fully compiled HTML templates*", "*Full source code (MIT license)*", Bootstrap-based, 100+ components ([tabler.io/admin-template](https://tabler.io/admin-template)) [verified] |
| **Pico CSS** | **No** | "*Link pico.css manually or via CDN for a dependency-free setup*" ([picocss.com/docs](https://picocss.com/docs)) [verified] |
| **Open Props** | **No** | "*No installation required*" via CDN; token-only, "*non-prescriptive*" and "*incrementally adoptable*" ([open-props.style](https://open-props.style/)) [verified] |
| **Shoelace** | No, **but sunset** | "*Works with CDNs*" — but also "*Shoelace Is Sunset with no active development*" ([shoelace.style](https://shoelace.style/)) [verified]. Do not adopt without a decision. |
| **Tailwind Plus Application UI** | Paid + build | Categories confirmed (Tables, Form Layouts, Empty States, Badges, Progress Bars, Drawers); markup requires paid access ([tailwindcss.com/plus](https://tailwindcss.com/plus/ui-blocks/application-ui)) [verified] |
| **Refine, Tremor** | **React-only** | Excluded on framework grounds |

**Open Props is the most interesting of these for Direction A.** The brief's core debt is
two competing token sets in one stylesheet. Open Props is a *token* library, not a
component library — adopting its scales (spacing, radius, shadow, type) gives a defensible
external answer to "which of the two systems wins" without importing a single component or
a build step.

### Galleries

- **Behance** — [procurement dashboard search](https://www.behance.net/search/projects?search=procurement%20dashboard)
  renders without login; 10,000+ results. Titles verified present: *Vendora | Hotel
  Procurement Dashboard*, *DOCO | Procurement Insights Dashboard*, *GNA Energy Executive
  Procurement Dashboard*, *GridFlow — MD Dashboard for Power Procurement Decisions*,
  *B2B Healthcare Procurement Platform — UX Case Study*. **Titles verified; designs not
  inspected.**
- **Mobbin** — 403, auth-walled. **Dribbble** — empty JavaScript shell. Neither verified;
  treat any reference as inspiration, not evidence.

### From the `ui-ux-pro-max` styles database

Not a web source; the plugin's own `styles.csv` / `products.csv`. Two entries matched the
product shape closely enough to be worth quoting:

- **Style: "Data-Dense Dashboard"** — recommended variables: `--grid-gap: 8px`,
  `--card-padding: 12px`, `--font-size-small: 12px`, `--table-row-height: 36px`,
  `--sidebar-width: 240px`, `--header-height: 56px`; technique notes: "minimal padding
  (8–12px)", sticky headers, `overflow: auto` for tables. Rated WCAG AA, "Excellent"
  performance, "Medium" complexity.
- **Product type: "E-signature / Document Workflow"** — keywords include `approval-chain`;
  recommended palette focus is "**Trust navy + signature green + pending amber + neutral
  grey**", dashboard style "Document Pipeline Dashboard". This is the closest product
  archetype in the database to a PR approval tool, and its palette formula is almost
  exactly what Oizom needs: one green for done/approved, one amber for pending/in-flight,
  navy for structure, grey for inert.

Both are lookups, not evidence. Treat the token numbers as a starting scale to argue
with, not a standard. [The database is a curated opinion set, not research.]

### So what for Oizom

**Do not adopt a component library. Adopt three pages and a token scale.**

The relevant fact about Oizom is 264 lines of CSS and no build step. Tabler is 100+
Bootstrap components — importing it to fix a two-token-set problem replaces one
inconsistency with a much larger dependency, and its Bootstrap class vocabulary would have
to be threaded through every `innerHTML` template in the app. **Read Tabler for its table,
form and badge markup; do not install it.**

What actually transfers:

1. **Carbon's required/optional flip, immediately.** `prForm.js` marks required fields with
   `*` in the placeholder (`"Item / description*"`, `"Qty*"`). Most PR fields are optional,
   so Carbon's rule says mark **required** — which is what Oizom does — but it must be a
   visible `(required)` on a visible label, not an asterisk inside a placeholder that
   disappears on first keystroke. CSS-tier.
2. **Carbon's single-column, top-label rule for the mobile item card.** This is the same
   conclusion Baymard reaches in §3 from user testing rather than from doctrine. Two
   independent sources agreeing is as strong as this document gets.
3. **NN/g's inline-vs-modal finding, as a constraint on Direction C.** Any direction
   proposing a modal line-item editor on desktop is proposing something NN/g says breaks
   cross-record comparison — which is exactly what an approver does when checking whether
   line 3 is priced like line 1. Inline editing is fine here *because* the table is narrow;
   that is NN/g's own condition.
4. **Open Props as the tiebreaker for Direction A.** Not as a dependency — as a published
   scale to copy values from, so "why 12px and not 14px" has an answer that is not "the
   admin.html mockup said so".
5. **GitLab's empty-state taxonomy for the six views.** Oizom's dashboard currently renders
   `"No PRs here yet."` in muted grey for every empty case, whether that is a new user with
   no PRs (blank content — needs a "Raise your first PR" action) or a KPI filter with no
   matches (empty search — needs "Edit your filter"). Two different states, one string.
   CSS+JS-tier, and it is the cheapest legibility win in the app.

**What is enterprise theatre here:** design-system governance. Oizom does not need a token
naming convention, a contribution model, or a component API. It needs one set of colours,
one type scale, one radius, one shadow, and the discipline to delete the other set. That is
a `styles.css` rewrite, not a design system.

---

## Anti-patterns — do not copy

**Sourcing caveat, stated up front.** G2, Capterra, TrustRadius, Gartner Peer Insights and
Trustpilot all returned HTTP 403 to every attempt, and Reddit was unreachable. The
end-user quotes below are therefore **second-hand via a vendor blog that quotes them**, or
from one review directory that did render. That is weaker than a primary review page and is
labelled as such. Several anti-patterns commonly asserted about this category — modal-in-
modal, "save draft" that doesn't save, form resets losing work, 20-column tables,
unreadable status codes — **could not be substantiated from any fetchable source** and are
excluded rather than asserted.

### What users actually say

- **Coupa** [second-hand: quoted by Stampli, attributed to Capterra/G2 —
  [stampli.com](https://www.stampli.com/blog/accounts-payable/coupa-reviews/), vendor-authored
  comparison content]: "*The interface is complex, and it took time to figure out how to
  click through many redundant pages*"; "*Coupa doesn't have the best user interface and
  isn't the easiest to use across the team*"; "*The mobile interface was not ideal. I
  preferred to use the web version for ease of use.*"
- **SAP Ariba** [Software Advice, rendered directly —
  [softwareadvice.com](https://www.softwareadvice.com/ecommerce/sap-ariba-profile/reviews/)]:
  "*Very slow operations and the UI/UX is difficult to understand, need to put a lot of time
  to learn, feels outdated*"; "*The user interface can feel overwhelming for beginners.*"
- **Zycus / Ivalua** [editorial summary, not user quotes —
  [selecthub.com](https://www.selecthub.com/procurement-software/zycus-vs-ivalua/)]: "*The
  depth of features creates a steep learning curve and slow user adoption*"; "*The interface
  can overwhelm new users and needs significant training to adopt.*"

### The structural failure, and a testable benchmark

The best-argued material on *why* requisition systems fail is the maverick-spend
literature, and it converges on one claim: people do not route around procurement tools
because they are non-compliant, but because the compliant path is slower than the
alternative.

- Kissflow: "*When your procurement process takes two weeks and requires four approvals for
  a $200 software subscription, the employee who needs it for a project due tomorrow is
  going to find another way*", and — naming three anti-patterns in one sentence —
  "*Procurement forms that require technical knowledge to complete, approval hierarchies
  that are not clearly documented, and systems that are difficult to use without training
  all raise the cost of compliance*"
  ([kissflow.com](https://kissflow.com/workflow/maverick-spend-control/)) [verified].
- **The benchmark worth adopting outright**, from the same page: "*can an employee who has
  never used the system before complete a purchase request correctly in under fifteen
  minutes without calling the procurement team for help? If not, the process has friction
  that is generating maverick spend.*" That is a usability test the design team can
  actually run against a mockup.
- Art of Procurement, citing a Hackett Group study: "*75 percent of procurement
  professionals named a lack of self-service or guided buying tools as one of the biggest
  causes of maverick purchases*", and "*if the 'product' we offer the business is slower
  than a corporate card and a web checkout, people will reach for the checkout every time*"
  ([artofprocurement.com](https://artofprocurement.com/blog/maverick-spend-why-its-usually-procurements-problem-not-the-buyers)) [verified].
- Coupa's own VP of Direct Materials, quoted by Acquis: "*People go rogue because they're
  trying to get their day done. They need a material or service, and they just spend*";
  "*Spend follows the path of least resistance*"; and "*Traditional ERP systems prioritize
  financial reporting over user experience, creating interfaces that feel punitive rather
  than helpful*"
  ([acquisconsulting.com](https://www.acquisconsulting.com/our-thinking/solving-maverick-spend-making-on-contract-purchasing-the-easy-choice/)) [verified].
- On punchout specifically, the named cause of confusion is inconsistency: "*Every
  supplier's catalog behaves differently*", plus "*Labs waste time checking multiple portals
  for status updates*" ([zageno](https://go.zageno.com/blog/lab-punchout-catalogs)) [verified].

**Why this matters at Oizom specifically:** the escape hatch here is not a corporate card,
it is the Google Sheet the app sits on top of. Anyone with edit access can bypass the UI
entirely. The tool's only defence is being faster than opening the sheet. [inference]

### The list

1. **The composite single status.** One `status` field carrying pipeline position,
   terminal outcome, *and* pause state is the root cause of the stepper problem in §5.
   Shopify separates four axes for exactly this reason [verified].
2. **Colour-only status encoding.** Polaris names it directly: do not "use color alone to
   convey meaning" [verified]. Oizom currently does, and with duplicate colours.
3. **Placeholder-as-label.** Every field in the item row. The label vanishes on first
   keystroke, which is worst precisely when the user is checking their work. Baymard's
   position is labels above the field [verified].
4. **Reflowing a 9-column grid to `1fr 1fr` and calling it mobile.** The brief already
   names this; the research adds why it fails — a 2-column reflow of unlabelled fields
   produces eight anonymous boxes.
5. **Bottom sheets holding complex forms, and bottom sheets stacked on bottom sheets.**
   NN/g: sheets are "transient", must not "replace typical page-to-page user flows", and
   must not stack [verified].
6. **Per-user column configuration and saved views.** Enterprise theatre at 50 users.
7. **Configurable multi-step approval chains.** Zip's entire pitch is "*dynamic selection
   of appropriate approvers using queues and user hierarchies*" via "*no-code
   configuration*" and a "*drag-and-drop interface*"
   ([zip.com/capabilities/workflow-engine](https://zip.com/capabilities/workflow-engine)) [verified].
   Oizom has **one** approver per PR. A workflow builder here would be a configuration
   surface with nothing to configure.
8. **Catalog / punchout / vendor-catalogue browsing.** Oizom's requesters paste a purchase
   link. There is no catalogue to browse.
9. **AI pre-fill of request forms.** Zip markets AI extraction of order-form data
   [snippet]. It is a real feature and a real backend project; at Oizom's volume the
   manual path is faster than the trust-building.
10. **Density as a user setting.** Linear's docs conspicuously do not offer one
    [verified by absence]. Pick a density; ship it.
11. **Redundant pages on the compliant path.** The single most transferable end-user
    complaint in the whole survey: "*many redundant pages*" [second-hand, Coupa]. Count the
    screens between "I need a sensor" and "submitted". Every one must earn its place.
12. **Modal editing of table rows.** NN/g: a modal "*will cover adjacent records… and the
    user won't be able to reference or copy data from a similar record*" [verified].
    Inline editing is acceptable here precisely because Oizom's table is narrow — that is
    NN/g's stated condition, not a loophole.
13. **Swipe as the only route to an action.** NN/g: "*Lack of signifiers makes it unclear
    where the contextual swipe can be used*" and burying actions behind it "*prevents users
    from discovering them*" [verified].
14. **A confirmation dialog on the positive action.** Zoho Procurement requires a pop-up
    confirm to approve [verified]. Confirm destructive and irreversible actions; do not
    confirm approvals that the status matrix already allows you to undo.
15. **CSV / Excel line-item import.** Present in Procurify and Precoro because those
    products routinely handle "*50-75 line items per order request*" [verified]. Oizom's
    typical PR is one to five. This is a solution to someone else's volume.

---

## What I could not verify

Listed so nobody treats absence of a caveat as confirmation.

**Blocked sources.** Coupa's own docs site (browser-compatibility stub), Zip's help centre
(403 ×2), Airbase's help centre (301 → empty Paylocity KB), G2 / Capterra / TrustRadius /
Gartner Peer Insights / Trustpilot (403 across the board), Reddit (unreachable), Mobbin
(403), Dribbble (empty JS shell), Wave help centre (403).

**JavaScript shells that returned navigation only.** Atlassian lozenge and progress
tracker, Adobe Spectrum status light, Material 3 badges and bottom sheets, Salesforce
Lightning badges, Apple HIG sheets. IBM Carbon was recovered only by fetching raw `.mdx`
from GitHub.

**Specific claims that remain unverified — do not repeat them as fact:**

- Stripe's saved views / edit-columns behaviour — search-snippet only.
- Ramp approve-from-Slack/Teams — appears in search summaries; both fetched Ramp pages
  lacked it.
- Airbase's routing and approval channels — one customer's runbook only.
- Zip's request-creation UI, approval surfaces, and status visualisation — entirely
  unverified. Zip appears in this document only as a negative example.
- Vyapar's "+ Add Item" button and Wave's mobile duplicate flow — search prose only.
- Whether any Indian SMB invoicing app (Vyapar, myBillBook, Khatabook) uses a
  phone-camera-driven line-item flow. Their public pages are marketing; help docs describing
  mobile line entry were not found. **This was the highest-relevance lead in the brief and
  it did not pay off** — if someone on the team has these apps installed, twenty minutes of
  hands-on beats another hour of searching.
- Baymard's sticky-CTA claim, and the "70% of Zycus users report interface bugs" figure
  that appeared in a search snippet — both discarded as unsourced.

**Anti-patterns commonly asserted about this category but not substantiated here:**
modal-in-modal, "save draft" that doesn't save, form resets losing work, 20-column tables,
unreadable status codes, mandatory cost-centre pickers. Plausible; unevidenced. They live in
the review sites and Reddit threads that were blocked.
