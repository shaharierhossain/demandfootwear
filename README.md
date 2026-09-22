# Demand Footwear — "Step Into Your Demand."

A complete, modern e-commerce site for a footwear & accessories brand: a full customer storefront and an admin dashboard for products, inventory, orders, customers, and sales — built with plain HTML5, CSS3, and vanilla JavaScript (ES6+), backed by a real Node.js/Express/Prisma/PostgreSQL API.

> **This project runs in two modes, controlled by one setting in `js/config.js`:**
> - **Demo mode** (default): no backend needed — data lives in your browser's `localStorage`. Great for trying the UI or developing offline.
> - **Live mode**: set `API_BASE_URL` to your deployed backend and the exact same front-end code talks to a real PostgreSQL database — real products, real orders, real stock, real customer accounts. **See [DEPLOYMENT.md](./DEPLOYMENT.md) for the step-by-step guide to going live**, including a Cash-on-Delivery-only launch path that needs no payment gateway approval to start selling.
>
> Nothing about the storefront's HTML/CSS or the admin dashboard changes between modes — `js/api.js` is the only file that knows which mode is active.

---

## 0. Localized for the Bangladesh market 🇧🇩

This build is adapted for Bangladeshi e-commerce conventions:

- **Currency:** All prices, order totals, and reports are in **Bangladeshi Taka (৳ BDT)**, formatted with local (lakh-style) digit grouping. Product prices are calibrated to realistic local footwear retail rates rather than a literal FX conversion.
- **VAT:** Listed prices are treated as **VAT-inclusive** at the standard 15% NBR rate — the price shown is the price paid. VAT is broken out separately only for receipts/bookkeeping, never added on top at checkout (standard local retail practice).
- **Delivery:** Charges follow the common local courier pattern — **Inside Dhaka (৳70)** vs **Outside Dhaka / Nationwide (৳130)** — instead of speed-tiered shipping, with free delivery over ৳2,500.
- **Payment channels:** Checkout supports **bKash, Nagad, and Rocket** (Mobile Financial Services / MFS, with mobile-number capture), local bank **debit/credit cards**, and **Cash on Delivery (COD)**. On a fresh launch, only COD is enabled by default (see `js/config.js` → `ENABLED_PAYMENT_METHODS`) so you can start selling before a payment aggregator merchant account is approved — the others show as "Coming Soon" until you flip them on.
- **Addressing:** Shipping forms use District/City fields matching Bangladeshi addressing conventions; demo customers and orders are spread across Dhaka, Chattogram, Sylhet, Rajshahi, and Khulna.
- **Backend:** `.env.example` and the order controller reference Bangladeshi payment aggregators (SSLCommerz, ShurjoPay) and direct MFS merchant credentials (bKash/Nagad/Rocket) instead of generic international gateways.

---

## 1. Features

**Storefront:** home, shop with filters/search/sort/pagination, product details with gallery & reviews, cart, wishlist, checkout, order confirmation, customer account (login/register/order history), about, contact, FAQ, privacy, terms.

**Admin dashboard:** login-gated SPA with sidebar navigation, sales analytics (Chart.js), product management (CRUD, duplicate, images, sizes/colors/pricing/stock), category management, inventory management (stock adjustments with logged history, low/out-of-stock reports), order management (status + payment status updates, printable detail), customer management, sales reports with CSV export, and store settings.

**Reset demo data:** Settings → "Reset Demo Data" restores the original sample catalog, orders, and customers (demo mode only — hidden in live mode, where it's replaced by a run-mode indicator).

## 2. Technologies used

- HTML5, CSS3 (custom design system, no framework build step), Vanilla JavaScript ES6+
- [Bootstrap Icons](https://icons.getbootstrap.com/) (CDN)
- [Google Fonts](https://fonts.google.com/) — Fraunces (display) + Inter (body)
- [Chart.js](https://www.chartjs.org/) (CDN) for dashboard analytics
- `localStorage` as the database in demo mode; a real PostgreSQL database in live mode
- Backend: Node.js, Express, Prisma ORM, PostgreSQL, JWT (HTTP-only cookies) + bcrypt

## 3. File structure

```
demand-footwear/
├── index.html, shop.html, product.html, cart.html, wishlist.html,
│   checkout.html, order-confirmation.html, account.html,
│   about.html, contact.html, faq.html, privacy.html, terms.html
├── admin-login.html, admin.html
├── css/style.css
├── js/
│   ├── config.js       # ⚑ ONE setting switches demo ⇄ live mode (see section 6)
│   ├── api.js           # data layer — localStorage (demo) or real API calls (live)
│   ├── app.js             # shared header/footer/toasts/modals
│   ├── products.js         # product rendering, shop filters, PDP logic
│   ├── cart.js               # cart logic & totals
│   ├── wishlist.js             # wishlist logic
│   ├── checkout.js               # checkout validation + order creation
│   ├── account.js                  # customer login/register/orders
│   ├── admin.js                      # admin dashboard routing & CRUD
│   └── inventory.js                    # inventory section of the admin dashboard
├── images/ (products/, categories/, logo/)
├── backend/                       # Node/Express/Prisma API — see section 7
├── DEPLOYMENT.md                  # step-by-step guide to going live
└── README.md
```

## 4. Running in demo mode (no backend needed)

No build step required.

1. Download/clone the project folder.
2. Open `index.html` directly in a browser, **or** serve it locally for the most reliable experience (recommended, since some browsers restrict certain features on `file://`):
   ```bash
   npx serve .
   # or
   python3 -m http.server 5500
   ```
3. Browse the storefront. Cart/wishlist/orders persist in your browser's `localStorage`.
4. Visit `admin-login.html` to reach the dashboard. **Demo credentials:** `admin` / `demand2026` (demo mode only — in live mode you sign in with the real admin account created by the seed script; see `DEPLOYMENT.md`).

## 5. Replacing product images

Demo products use royalty-free Unsplash photo URLs (`js/api.js`, `img()` helper) with an automatic SVG fallback (`onImgError`) if a URL fails to load.

**To use your own photos:**
- **Quick swap (still remote):** edit the `images: [...]` array for each product in `js/api.js`, or use the Admin → Products → Edit form's "Product Images" field (one URL per line).
- **Local files:** place images in `images/products/your-file.jpg` and reference them as relative paths, e.g. `images: ["images/products/urban-runner-1.jpg"]`.
- **Production:** upload through the backend to a cloud image service (Cloudinary, AWS S3 + CloudFront, Bunny CDN, etc.) rather than committing large binaries to your web server or git repo. Validate file type and size server-side before accepting an upload (see `backend/.env.example` for `IMAGE_STORAGE_PROVIDER`).

## 6. Demo ⇄ Live mode — how it actually works

`js/config.js` is the single switch:

```js
window.DF_CONFIG = {
  API_BASE_URL: "",              // "" = demo mode. Set to your backend's URL for live mode.
  ENABLED_PAYMENT_METHODS: ["cod"], // which checkout options are selectable
};
```

`js/api.js` reads this at load time and exposes `window.DF.api` as either:
- **`demoApi`** — reads/writes `localStorage` (unchanged from earlier versions of this project), or
- **`liveApi`** — makes real, credentialed `fetch()` calls to your backend, translating between the front-end's simple data shapes (e.g. `category: "sneakers"`, `discount: 15`) and the database's shapes (e.g. `categoryId`, `discountPercent`) automatically.

Every other file (`products.js`, `cart.js`, `admin.js`, `checkout.js`, …) only ever calls `window.DF.api.*` — none of them know or care which mode is active, so there is nothing else to rewrite when you go live. **See `DEPLOYMENT.md` for the full step-by-step guide** to deploying the backend and flipping this switch.

A few behaviors worth knowing:
- **Cart and wishlist stay client-side (`localStorage`) in both modes** — this is a deliberate scope choice for v1, not a bug (see `DEPLOYMENT.md` → Known scope limits).
- **Sessions use HTTP-only cookies**, not tokens in JavaScript — `js/api.js` never sees or stores your password or session token directly; the browser sends the cookie automatically on each request via `credentials: "include"`.
- **A 401 response automatically clears any stale cached session** and, on admin pages, redirects to `admin-login.html`.

## 7. Backend architecture (`/backend`)

```
backend/
├── src/
│   ├── server.js         # starts the HTTP server
│   ├── app.js             # Express app, middleware, route mounting
│   ├── config/             # (add environment/config loaders here)
│   ├── controllers/          # product, category, inventory, order, customer, auth, review
│   ├── routes/                 # REST endpoints per resource
│   ├── middleware/               # auth.middleware.js (JWT + role checks)
│   ├── services/                  # prisma.js (DB client singleton)
│   ├── utils/                      # (add shared helpers here)
│   └── validations/                 # express-validator rule sets
├── prisma/
│   ├── schema.prisma                # Users, Products, ProductImages, Categories, Orders,
│   │                                 # OrderItems, Payments, Addresses, Reviews, WishlistItems,
│   │                                 # InventoryTransactions (stock is a single field on Product —
│   │                                 # matches the admin Inventory screen; see DEPLOYMENT.md)
│   └── seed.js                       # loads the real BDT catalog + creates your admin account
├── package.json
└── .env.example
```

### Setting it up

```bash
cd backend
npm install
cp .env.example .env        # fill in your real DATABASE_URL, JWT_SECRET, etc.
npx prisma migrate dev --name init
npm run prisma:seed         # loads the 24-product catalog + your admin account
npm run dev                 # starts on http://localhost:4000
```

For a full production deployment (managed database, real hosting, going live with COD), see **`DEPLOYMENT.md`**.

### REST endpoints

```
GET    /api/products                       List/search/filter products
GET    /api/products/:id                   Product detail
POST   /api/products                       Create product (admin/staff)
PUT    /api/products/:id                   Update product (admin/staff)
DELETE /api/products/:id                   Delete product (admin)

GET    /api/categories
POST   /api/categories                     (admin)
PUT    /api/categories/:id                 (admin)
DELETE /api/categories/:id                 (admin)

GET    /api/inventory                      (admin/staff)
GET    /api/inventory/log                  (admin/staff)
PATCH  /api/inventory/:productId           Adjust stock — runs in a DB transaction with a row lock (admin/staff)

GET    /api/orders                         All orders (admin/staff)
GET    /api/orders/mine                    The signed-in customer's own orders
GET    /api/orders/:id                     Order detail — public by order number (supports guest checkout)
POST   /api/orders                         Create order — server recomputes price/stock/totals; guests allowed
PATCH  /api/orders/:id/status              (admin/staff)
PATCH  /api/orders/:id/payment-status      (admin/staff)

GET    /api/customers                      (admin/staff)
GET    /api/customers/:id                  (admin/staff)

GET    /api/reviews                        Public; optional ?productId= filter

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me                        Current session (used by the front-end's session cache)
```

## 8. Security & limitations

In **demo mode**, data lives in `localStorage`, which cannot be secure on its own — a browser can never be trusted with authority over money, stock, or access control. In **live mode**, the `backend/` API is what actually enforces these protections:

- **Never trust the client for price, discount, tax, or total.** `backend/src/controllers/order.controller.js` re-reads each product's price from the database and recomputes every total server-side before creating an order — it never uses numbers submitted by the browser. (Confirmed by test: the browser sends only `items: [{productId, size, color, quantity}]` — no prices.)
- **Stock adjustments use a real row lock** (`SELECT ... FOR UPDATE` inside a transaction), so two simultaneous checkouts can never both succeed against the last unit of stock. The demo's `localStorage` version has no such protection and is not safe for concurrent/multi-tab use.
- **Passwords are hashed with bcrypt server-side** and sessions are HTTP-only, secure cookies (`backend/src/controllers/auth.controller.js`) — never a token sitting in `localStorage` or JavaScript-readable storage. The demo's `admin`/`demand2026` gate and "any email logs in" flow only exist for the offline demo and are automatically bypassed in live mode.
- **Admin and staff routes are protected server-side** via `requireAuth`/`requireRole` (`backend/src/middleware/auth.middleware.js`) — hiding a button in the UI is never the actual security boundary.
- **No real payment processing occurs yet.** The live launch path starts with Cash on Delivery only (`ENABLED_PAYMENT_METHODS: ["cod"]`), which needs no payment gateway integration. When you add bKash/Nagad/Rocket/card, route them through a licensed local aggregator (SSLCommerz, ShurjoPay, AamarPay) with card/MFS data handled entirely by the gateway's hosted fields/SDK — your servers should never see raw card numbers or MFS PINs.
- **Input is validated server-side** (`express-validator` in `backend/src/validations/`), and sensitive endpoints are rate-limited (login: 10 attempts / 15 min).
- **Use HTTPS everywhere** in production, and keep all secrets in environment variables (`backend/.env`, which is git-ignored) — never commit `.env` or hardcode credentials.

## 9. Customizing branding

- Colors, type, spacing: edit the CSS custom properties at the top of `css/style.css` (`:root { --df-black, --df-beige, --df-accent, ... }`).
- Store name/tagline: Admin → Settings, or edit the `<title>`/hero copy directly in the HTML files.
- Logo mark: the "DF" monogram is inline HTML/CSS (`.brand .mark`) — replace with an `<img>` tag pointing to `images/logo/your-logo.svg` if you have one.

## 10. Deployment

**See `DEPLOYMENT.md` for the full step-by-step guide** — database setup, backend hosting, environment variables, seeding, going live with Cash on Delivery, and adding online payments later.

Quick summary:
- **Front-end:** any static host works (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3+CloudFront, or your own web server) — it's plain HTML/CSS/JS with no build step. Only `js/config.js` changes between demo and live.
- **Backend:** deploy `backend/` to a Node-friendly host (Render, Railway, Fly.io, a VPS) with a managed PostgreSQL database, run `npx prisma migrate deploy` then `npm run prisma:seed` once, and point `js/config.js`'s `API_BASE_URL` at it.

## 11. Future improvements

- Real image upload (multer + cloud storage) in the admin product form, replacing remote URLs.
- Online payment integration (SSLCommerz/ShurjoPay/AamarPay, or direct bKash/Nagad/Rocket merchant APIs) once your gateway merchant account is approved — then add each method to `ENABLED_PAYMENT_METHODS`.
- Per-size/per-color stock tracking (currently one stock number per product, matching the admin Inventory screen).
- Server-synced cart and wishlist (currently client-side `localStorage` in both modes) for a consistent cross-device experience.
- Linking guest-checkout orders to an account retroactively if the guest later registers with the same email.
- A "Manage Staff" admin screen for creating additional `STAFF`-role accounts without touching the database directly.
- Automated tests (unit tests for cart/pricing logic, integration tests for the API).
- Pagination/infinite scroll on the admin order/customer tables for larger catalogs.
- Internationalization (multi-currency, multi-language) if expanding beyond Bangladesh.

---

*Demo data, reviews, and customer records throughout this project are fictional and generated solely for demonstration purposes.*
