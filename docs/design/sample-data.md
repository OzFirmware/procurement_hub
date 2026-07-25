# Shared Sample Dataset — use this in every mockup

All three design directions must render **this** data. Same content, different
design. That is what makes the three mockups comparable side by side: any
difference the reviewer sees is a design difference, not a data difference.

Do not invent your own sample rows. Do not use `Lorem ipsum`, "Vendor A",
"Item 1", or `$1,234.00`. If a direction needs an extra field to demonstrate an
idea, add it and say so in `rationale.md` under `## Stack implications` — an
invented field usually implies a backend change.

## Real dropdown values (from `apps-script/lists.gs:10`)

| List | Values |
|---|---|
| departments | Admin, Device Management, Environment, Marketing, Production, Projects, QC, R&D, Sales, Support |
| materialTypes | Asset, Inventory, Local Purchase, Subscription, Certification |
| priorities | Critical, High, Medium, Low |
| couriers | BlueDart, DHL, FedEx, DTDC, India Post, Amazon, Porter, Delhivery, Other |
| paymentTerms | Advance 100%, Advance 50%, Net 15, Net 30, On Delivery, Milestone |
| units | pcs, L, kg, m, set, box, license |
| paymentStatus | Unpaid, Paid, Partially Paid, FOC / Free |
| currency | Any ISO 4217 code. In practice: INR, USD, EUR, GBP |

## Status model (from `apps-script/prs.gs:21`)

Statuses: `Submitted`, `Approved`, `Ordered`, `In Transit`, `Received`,
`On Hold`, `Rejected`, `Cancelled`.

The flow is **not** a clean linear stepper, and any design that draws it as one
is lying about the system. The real transition graph:

```
Submitted ──▶ Approved ──▶ Ordered ──▶ In Transit ──▶ Received  (terminal)
    │             │            │            │
    ├──▶ Rejected ┤            │            │
    ├──▶ Cancelled│            │            │
    └──▶ On Hold ◀┴────────────┴────────────┘
              │
              └──▶ back to Submitted / Approved / Ordered / Cancelled

Rejected ──▶ Submitted (resubmit)  ──▶ Approved
Received, Cancelled = terminal, no transitions out
```

`On Hold` can be entered from almost anywhere and exited back into the main
flow. `Rejected` is recoverable. Handling these gracefully — rather than only
the happy path — is a real design problem worth solving.

`paymentStatus` runs as a **parallel track** to `status`. A PR can be
`In Transit` and `Paid`, or `Received` and `Unpaid`. Two independent axes.

## The dataset

### Vendors

| Name | Country | Website | Notes |
|---|---|---|---|
| Sensirion AG | Switzerland | sensirion.com | PM and RH/T sensor modules |
| Alphasense Ltd | UK | alphasense.com | Electrochemical gas sensors, B4 series |
| Element14 India | India | element14.com | General electronics distributor |
| Mouser Electronics | USA | mouser.com | Components, USD, long lead times |
| Ganesh Enterprise | India | — | Local hardware and fabrication, Ahmedabad |
| Precision Sheet Metal Works | India | — | Enclosure fabrication |
| Robu.in | India | robu.in | Fast local prototyping parts |
| NABL Calibration Services | India | — | Certification and calibration |
| Amazon Business | India | amazon.in | Miscellaneous, fast |
| DigiKey | USA | digikey.com | Components, USD |

### Purchase requests

**PR-2026-0142** — `In Transit`, `Paid`, Critical, R&D
Project: Polludrone Gen-5 · Purpose: PM sensor evaluation batch for Gen-5 board bring-up
Requester: Ankit Shah · Approver: Meera Patel · Vendor: Sensirion AG
Total: **€4,820.00** · Terms: Advance 50% · PO: PO-2026-0311 (2026-07-02)
Courier: DHL · AWB 7845 2291 0033 · Expected 2026-07-29

| # | Description | Part no. | Type | Qty | Unit | Unit price | Line total |
|---|---|---|---|---|---|---|---|
| 1 | SPS30 particulate matter sensor module | SPS30-2M | Inventory | 40 | pcs | 92.00 | 3,680.00 |
| 2 | SHT45 humidity and temperature sensor | SHT45-AD1B | Inventory | 60 | pcs | 14.50 | 870.00 |
| 3 | Sensor evaluation kit, SEK-SVM41 | SEK-SVM41 | Asset | 1 | set | 270.00 | 270.00 |

**PR-2026-0141** — `Submitted`, `Unpaid`, High, Production
Project: Dustroid batch 12 · Purpose: Enclosure fabrication for Q3 production run
Requester: Rakesh Chauhan · Approver: — (awaiting) · Vendor: Precision Sheet Metal Works
Total: **₹1,84,500.00** · Terms: Net 30
*Waiting 3 days for approval. This is the row that should scream at an approver.*

| # | Description | Part no. | Type | Qty | Unit | Unit price | Line total |
|---|---|---|---|---|---|---|---|
| 1 | Powder-coated aluminium enclosure, IP65, 300×200×120 | OZ-ENC-D12 | Inventory | 150 | pcs | 1,050.00 | 1,57,500.00 |
| 2 | Stainless mounting bracket, pole clamp | OZ-BRK-04 | Inventory | 150 | pcs | 180.00 | 27,000.00 |

**PR-2026-0140** — `Approved`, `Unpaid`, Medium, QC
Project: Calibration lab · Purpose: Annual NABL calibration for reference analysers
Requester: Priya Nair · Approver: Meera Patel · Approved 2026-07-21
Vendor: NABL Calibration Services · Total: **₹68,000.00** · Terms: On Delivery

| # | Description | Part no. | Type | Qty | Unit | Unit price | Line total |
|---|---|---|---|---|---|---|---|
| 1 | NABL calibration — reference PM analyser | — | Certification | 2 | pcs | 22,000.00 | 44,000.00 |
| 2 | NABL calibration — gas analyser, NO2/SO2 | — | Certification | 1 | pcs | 24,000.00 | 24,000.00 |

**PR-2026-0139** — `Received`, `Paid`, Low, Support
Project: Field service · Purpose: Replacement gas sensors for customer site, Pune
Requester: Devendra Joshi · Approver: Meera Patel · Vendor: Alphasense Ltd
Total: **£1,240.00** · Received 2026-07-18 · Courier: FedEx

| # | Description | Part no. | Type | Qty | Unit | Unit price | Line total |
|---|---|---|---|---|---|---|---|
| 1 | NO2-B43F electrochemical sensor | NO2-B43F | Inventory | 8 | pcs | 78.00 | 624.00 |
| 2 | SO2-B4 electrochemical sensor | SO2-B4 | Inventory | 8 | pcs | 77.00 | 616.00 |

**PR-2026-0138** — `On Hold`, `Unpaid`, High, R&D
Project: Odosense v2 · Purpose: LTE modules — held, vendor confirming stock
Requester: Ankit Shah · Vendor: Mouser Electronics · Total: **$2,310.00**
*Held 6 days. On Hold with no visible reason is a real friction point today.*

**PR-2026-0137** — `Rejected`, `Unpaid`, Medium, Marketing
Project: Trade show · Purpose: Booth display units for IFAT India
Requester: Sneha Desai · Vendor: Ganesh Enterprise · Total: **₹42,700.00**
Rejected 2026-07-15 — *"Use existing booth hardware from last cycle. Resubmit only for the LED panel."*

**PR-2026-0136** — `Ordered`, `Partially Paid`, Critical, Device Management
Project: Fleet retrofit · Purpose: Solar panels and charge controllers for 30 field units
Requester: Rakesh Chauhan · Vendor: Robu.in · Total: **₹95,400.00** · Terms: Advance 50%

**PR-2026-0135** — `Received`, `Paid`, Low, Admin
Project: Office · Purpose: Lab consumables and ESD supplies
Requester: Priya Nair · Vendor: Amazon Business · Total: **₹8,940.00**

### People

| Name | Email | Role |
|---|---|---|
| Meera Patel | meera@oizom.com | approver |
| Kevin Andani | kevin@oizom.com | admin |
| Ankit Shah | ankit@oizom.com | requester |
| Rakesh Chauhan | rakesh@oizom.com | requester |
| Priya Nair | priya@oizom.com | requester |
| Devendra Joshi | devendra@oizom.com | requester |
| Sneha Desai | sneha@oizom.com | requester |

### Dashboard figures

Derived from the eight PRs above — keep them consistent if you show KPIs:

- Open PRs (not Received / Rejected / Cancelled): **5**
- Awaiting approval: **1** (PR-2026-0141, 3 days old)
- On hold: **1** (PR-2026-0138, 6 days)
- In transit: **1** (PR-2026-0142, expected 2026-07-29)
- Received this month: **2**
- Multi-currency is normal: INR, USD, EUR, GBP all appear. **Any KPI that sums a
  total across currencies is wrong** unless it states a conversion basis. How a
  design handles mixed-currency totals honestly is a real test of it.

## Notes for mockup authors

- Indian number formatting (`₹1,84,500.00` — lakh grouping) is correct for INR
  and is what users expect. Getting this wrong reads as sloppy to the audience.
- Long vendor names, long purposes, and 3+ line items are the realistic case,
  not the exception. Design for the messy row, not the tidy one.
- Today's date for the mockups is **2026-07-25**.
