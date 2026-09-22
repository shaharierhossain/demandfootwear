/* =========================================================================
   DEMAND FOOTWEAR — config.js
   ---------------------------------------------------------------------
   ONE setting controls whether the whole site runs in DEMO mode
   (localStorage, no server) or LIVE mode (real backend + database).

   To go live once your backend (see /backend) is deployed:
     1. Deploy the backend and note its public URL, e.g.
        https://api.demandfootwear.com
     2. Set API_BASE_URL below to that URL (no trailing slash).
     3. Set backend/.env's CLIENT_ORIGIN to this storefront's URL so the
        browser is allowed to call it (CORS).
     4. Re-upload/redeploy the front-end.

   Leave API_BASE_URL as "" to keep running the offline demo — nothing
   else in the codebase needs to change either way; js/api.js reads this
   value and switches its own implementation automatically.
   ========================================================================= */
window.DF_CONFIG = {
  // Example: "https://api.demandfootwear.com" or "http://localhost:4000"
  API_BASE_URL: "",

  // Payment methods available at checkout. Start with just "cod" (Cash on
  // Delivery) so the store can launch immediately without waiting on a
  // payment gateway merchant approval. Add "bkash", "nagad", "rocket",
  // "card" here as each is wired up to a real aggregator (see README).
  ENABLED_PAYMENT_METHODS: ["cod"],
};
