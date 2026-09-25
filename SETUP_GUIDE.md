# PureGasly — MERN Phase 4 Setup Guide

## What's new in this phase

- **Inventory management is real now** — Owners (and Employees with the
  `manage_inventory` permission) can add products (e.g. "LPG Tank Refill",
  brand, size in kg, price, stock), edit price/stock inline, and remove
  products — all scoped to their own store.
- A new access-control middleware (`middleware/storeAccess.js`) that grants
  a route to the store Owner OR an Employee with a specific permission — this
  is the pattern future features (Orders, Riders) will reuse.

## Everything from previous phases still applies
See the earlier sections below for prerequisites, running the servers, and
the demo seed accounts — those haven't changed.

## 1. Prerequisites

- Node.js 18+ (`node -v` to check)
- MongoDB — either:
  - **Local install**: https://www.mongodb.com/try/download/community, or
  - **MongoDB Atlas** (free cloud tier): https://www.mongodb.com/cloud/atlas

## 2. Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb://127.0.0.1:27017/puregasly
JWT_SECRET=<any long random string>
```

Start the API:
```bash
npm run dev
```

### Seed accounts (optional but recommended)

```bash
npm run seed:admin
npm run seed:demo
```

| Role  | Email                     | Password        | Notes                        |
|-------|----------------------------|------------------|-------------------------------|
| Admin | admin@puregasly.com        | ChangeThisPassword123 | Seeded only, no public signup |
| Owner | demo.owner@puregasly.com   | OwnerDemo123     | Already has a store called "Demo LPG Depot" |

## 3. Frontend setup

```bash
cd client
npm install
npm run dev
```
Open the printed local URL (typically `http://localhost:5173`). Both servers
need to be running together.

## 4. Test the new inventory feature

- Log in as the demo Owner → click **Manage Inventory** on the dashboard.
- Add a product, e.g. name "LPG Tank Refill", brand "Petron Gasul", size 11,
  price 950, stock 20.
- Change the price or stock directly in the table and click **Save** — reload
  the page to confirm it persisted in MongoDB.
- Click **Remove** to delete a product.
- Go to **Manage Employees**, create an employee **without** checking
  "Manage Inventory," log in as them, and confirm the Inventory card doesn't
  appear on their dashboard and `/inventory` redirects them away if visited
  directly. Then check the box for an existing employee and confirm the card
  appears after they log in again.

## 5. What's next (Phase 5 candidates)

- **Orders flow**: Customer places an order against a store's inventory;
  Owner/Employee with `manage_orders` sees and updates order status. This
  will reuse the same `requireStoreAccess('manage_orders')` middleware
  pattern used for inventory.
- **Rider assignment**: Owner/Employee with `manage_riders` assigns a rider
  to a confirmed order.
- Admin vendor-approval workflow for new Owner/store registrations.
- Deployment: MongoDB Atlas + Render (backend) + Vercel (frontend) — ask
  when you're ready and we'll walk through it.

## Troubleshooting

- **"MongoDB connection error"** — check `MONGODB_URI` in `server/.env` and
  that MongoDB is actually running.
- **"You do not have permission to do that" on Manage Inventory** — the
  logged-in employee doesn't have `manage_inventory` checked; have the owner
  grant it from Manage Employees.
- **React page loads but API calls fail** — make sure the backend is running
  at the same time as the frontend.
