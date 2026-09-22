# Going Live: Demand Footwear Deployment Guide

This walks you from "demo on my laptop" to "real store taking real Cash-on-Delivery orders" using the accounts you already have. It assumes a Postgres-compatible host (Railway, Render, Supabase, Neon — the steps are nearly identical on all of them) and any Node-friendly host for the API (Railway and Render both do this in one place).

---

## Overview of what you're deploying

| Piece | What it is | Where it lives |
|---|---|---|
| Front-end | The HTML/CSS/JS storefront + admin dashboard you already have | Any static host (Netlify, Vercel, Cloudflare Pages, or your existing hosting) |
| Backend API | `/backend` — Node/Express/Prisma | A Node host (Railway/Render/Fly/your own VPS) |
| Database | PostgreSQL | Your existing Railway/Render/Supabase Postgres instance |

---

## Step 1 — Create the database

1. In your hosting provider, create a **PostgreSQL** database (not MySQL, unless you edit `backend/prisma/schema.prisma`'s `provider` line to `"mysql"`).
2. Copy its connection string — it looks like:
   `postgresql://user:password@host:5432/dbname`
3. You'll paste this into `backend/.env` as `DATABASE_URL` in Step 3.

## Step 2 — Deploy the backend

1. Push the `backend/` folder to its own Git repository (or a subfolder of your existing one — most Node hosts let you set a "root directory").
2. In your host, create a new **Web Service** from that repo.
   - Build command: `npm install && npx prisma generate`
   - Start command: `npm start`
3. Set these environment variables in your host's dashboard (copy every key from `backend/.env.example`):

   | Variable | What to put |
   |---|---|
   | `DATABASE_URL` | Your Step 1 connection string |
   | `JWT_SECRET` | A long random string — generate one with `openssl rand -base64 48` |
   | `CLIENT_ORIGIN` | Your storefront's real URL, e.g. `https://demandfootwear.com` (comma-separate if you also serve from `www.`) |
   | `NODE_ENV` | `production` |
   | `ADMIN_SEED_EMAIL` / `ADMIN_SEED_NAME` / `ADMIN_SEED_PASSWORD` | Your real admin login — pick a strong password |
   | `BCRYPT_SALT_ROUNDS` | `12` |
   | `ADMIN_SESSION_COOKIE_NAME` | `df_session` (or leave default) |

4. Deploy. Once it's running, run the database migration and seed **once** (most hosts give you a "Shell" or "Run command" button; otherwise run these from your own machine with `DATABASE_URL` pointed at the live database):
   ```bash
   cd backend
   npx prisma migrate deploy
   npm run prisma:seed
   ```
   This creates all the tables and loads your real 24-product BDT catalog plus your admin account.
5. Note your backend's public URL, e.g. `https://demand-footwear-api.up.railway.app`.

## Step 3 — Point the front-end at the real backend

Open `js/config.js` and change one line:

```js
window.DF_CONFIG = {
  API_BASE_URL: "https://demand-footwear-api.up.railway.app", // <-- your backend URL from Step 2
  ENABLED_PAYMENT_METHODS: ["cod"], // COD-only for launch — see Step 5
};
```

That's it — no other file needs to change. Every page now talks to your real database instead of `localStorage`.

## Step 4 — Deploy the front-end

Upload the front-end folder (everything except `/backend`) to your static host exactly as it is — it's still plain HTML/CSS/JS, no build step. If you followed the earlier GitHub/Cloudflare Pages guide, just commit this change and push; it redeploys automatically.

**Test before announcing launch:**
- Browse the shop — products should load (now from your real database).
- Log into `/admin-login.html` with your `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`.
- Place a real test order with Cash on Delivery, using your own email/phone.
- Confirm it appears under Admin → Orders, and that the product's stock decreased under Admin → Inventory.
- Try to buy more of an item than is in stock — it should be rejected.

## Step 5 — Launching with COD only, adding online payments later

`js/config.js`'s `ENABLED_PAYMENT_METHODS: ["cod"]` is what keeps bKash/Nagad/Rocket/Card greyed out as "Coming Soon" right now — this lets you launch immediately without waiting on a payment gateway approval, since Cash on Delivery needs no merchant account.

When you're ready to add online payments (you already have a trade license, so you're most of the way there):

1. Apply for a merchant account with a licensed aggregator — **SSLCommerz** or **ShurjoPay** are the most common choices in Bangladesh and both give you bKash + Nagad + Rocket + cards through a single integration, rather than three separate merchant applications.
2. Once approved, you (or I, in a follow-up) wire the aggregator's server-side SDK into `backend/src/controllers/order.controller.js` — this is a contained change; nothing else in the app needs to move.
3. Add each method to the array once it's live, e.g. `ENABLED_PAYMENT_METHODS: ["cod", "bkash", "nagad"]` — they'll automatically stop showing "Coming Soon" and become selectable.

## Step 6 — Ongoing operations checklist

- **Backups:** most managed Postgres hosts offer automatic daily backups — turn this on.
- **Domain + HTTPS:** point your domain at the front-end host; most (Netlify/Vercel/Cloudflare Pages) issue free HTTPS certificates automatically.
- **Monitoring:** check your Node host's logs periodically for errors (500s usually mean something the validation layer didn't catch — send them my way).
- **Admin password:** rotate `ADMIN_SEED_PASSWORD` immediately if it's ever shared, and create separate `STAFF`-role accounts (via a database tool or a future "invite staff" admin feature) instead of sharing the owner login.
- **Product photos:** replace the Unsplash placeholder URLs with your real product photography — see README section 5.

## Known scope limits of this launch build

These are deliberate MVP simplifications, not bugs — flagging them so nothing surprises you:

- **Cart and wishlist stay in the browser** (not synced to your account across devices) even in live mode. This is normal for a v1 launch; it can be moved server-side later if you want "add to cart on phone, check out on laptop."
- **Guest checkout orders aren't linked to an account** even if the guest later registers with the same email — they'll see future orders in Order History, but not past guest orders. Encourage sign-in before checkout if this matters to you early on.
- **Per-size/per-color stock isn't tracked separately** — stock is one number per product (matching your admin Inventory screen exactly). If a shoe sells out in size 42 but you have plenty of 44 left, the product will still show as available until *total* stock hits zero. This is fine for a small catalog; ask if you later want size-level stock.
- **Product images are still remote URLs**, not an upload button in the admin panel yet — see README section 5 for how to swap them.
