# SAIPEI POS

Import, inventory and point-of-sale system for **SAIPEI FOODS LIMITED**.

One system covering the whole business flow in the purchase order: from the
order placed with a supplier in China, through clearing at Mombasa, into the
warehouse as bales, and out again as a sale at the till.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4, lucide-react |
| Language | TypeScript 7 |
| Database | Microsoft SQL Server |
| ORM | Prisma 7 with the `@prisma/adapter-mssql` driver adapter |
| Auth | Signed httpOnly session cookie (jose), bcrypt password hashes |

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env` and fill in the connection string:

```
DATABASE_URL="sqlserver://HOST:1433;database=SAIPEI_POS;user=USER;password=PASSWORD;encrypt=true;trustServerCertificate=true"
AUTH_SECRET="a long random string"
```

Create the schema and seed the reference data:

```bash
npm run db:push
npm run db:seed
```

Then start the app:

```bash
npm run dev
```

Sign in at <http://localhost:3000> as `admin` / `Admin@2026`.

> The seeded passwords are for development only. Change them before the system
> is used for real trading.

### Seeded sign-ins

| Username | Role | What they can do |
| --- | --- | --- |
| `admin` | Administrator | Everything, including users and settings |
| `wmusili` | Director | Oversight, approvals and full financial visibility |
| `accounts` | Accountant | Finance, purchasing, imports and reporting |
| `store` | Store Keeper | Goods receiving, stock movements and stock takes |
| `cashier` | Cashier | The POS till and customer receipts |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:push` | Push the schema **and apply the filtered indexes** |
| `npm run db:seed` | Seed permissions, roles, users and reference data |
| `npm run db:studio` | Open Prisma Studio |

## Modules

| Module | Screens |
| --- | --- |
| **Dashboard** | Overview, sales, stock, import status, debtors, profitability |
| **Sales & POS** | Till, sales, credit sales, customers, payments, returns, receipts |
| **Warehousing & Inventory** | Goods receiving, stock, products, bales, transfers, adjustments, stock take, valuation |
| **Import & Clearing** | Import orders, shipments, clearing, customs & taxes, documents, landed cost, reconciliation |
| **Purchasing** | Suppliers, purchase orders, supplier invoices, payments, returns, approvals |
| **Finance & Expenses** | Expenses, cash management, reconciliation, profit & loss |
| **Reports & Analytics** | Sales, purchase, stock, import, expense and profit reports |
| **Administration** | Users, roles & permissions, approvals, audit trail, settings, integrations |

## How the money works

A few decisions are worth knowing before changing the code.

**Landed cost.** A goods receipt spreads the container's charges (offloading,
transport, warehouse) across its bales *by value*, then across each bale's
estimated pieces. The resulting unit cost is blended into the product's cost
price as a **weighted average**, so the cost of a product reflects everything
paid to get it onto the shelf.

**Cost of sales is captured at the moment of sale.** Each `SaleLine` stores the
`unitCost` that applied when it was sold, so later cost changes never rewrite
the profit history.

**Prices are VAT-inclusive.** Tax is backed out of the net line amount rather
than added on top.

**The till never trusts the client.** `completeSale` re-reads prices and stock
inside the transaction, merges duplicate lines, checks the credit limit, and
writes the sale, stock movements and receipt atomically.

**Document references** are allocated from counters in the `Setting` table
inside the same transaction as the document, so two tills cannot be handed the
same number. They read `SAL-2026-0001`, `GRN-2026-0004`, `LPO-2026-0012`.

## SQL Server notes

The Prisma SQL Server connector has four constraints this schema works around.
They are all invisible until something fails at push or insert time:

1. **No native enums.** All 19 enums are `NVarChar(30)` columns; the values live
   in `src/lib/enums.ts` as the single source of truth.
2. **No multiple cascade paths.** Every relation is `NoAction` except
   document-line compositions, which keep `onDelete: Cascade`.
3. **One NULL per unique index.** Nullable unique columns (`Product.barcode`,
   `MpesaTransaction.checkoutRequestId`, `ImportOrder.purchaseOrderId`) are
   enforced by filtered indexes in `prisma/indexes.sql`.
4. **The connection URL lives in `prisma.config.ts`**, not `schema.prisma`, and
   the runtime client connects through a driver adapter.

Because of (3), always use `npm run db:push` — it chains the index script —
rather than a bare `prisma db push`.

## M-PESA

The till takes M-PESA two ways:

- **By hand** — the cashier types the code from the customer's confirmation SMS.
  This works with no configuration.
- **STK push** — the customer gets a prompt on their phone. This needs Daraja
  credentials in the environment; `src/lib/mpesa.ts` sends the prompt and
  `/api/mpesa/callback` records the outcome.

The Buy Goods till is `5606927`. Credentials are read from the environment and
never stored in the database, so they cannot be read back out through the
application.

## Brand

The palette is sampled from the supplied logo and is the authoritative source
for the brand colours:

| Token | Value | Used for |
| --- | --- | --- |
| `--saipei-red` | `#ED3225` | Sales emphasis, destructive actions, amounts payable |
| `--saipei-green` | `#82C144` | Primary actions, success, availability |
| `--saipei-dark-green` | `#1E5A2C` | Navigation, headers, structure |

All of them live as design tokens in `src/app/globals.css`. Components read the
tokens — no brand colour is hard-coded in a component. Status is never
communicated by colour alone: every badge carries an icon and a label so it
still reads in greyscale and for colour-blind users.

The logo in `public/logo.png` is the supplied artwork cropped to its bounding
box (margins only, no resampling). `src/components/ui/logo.tsx` derives width
from height using the intrinsic ratio, so it is never stretched or recoloured.
