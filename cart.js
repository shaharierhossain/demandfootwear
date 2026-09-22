/* =========================================================================
   DEMAND FOOTWEAR — cart.js
   Cart data model (localStorage-backed in the demo):
   { productId, quantity, selectedSize, selectedColor }

   Pricing model localized for Bangladesh:
   - All prices are in Bangladeshi Taka (BDT) and treated as VAT-inclusive
     (standard local retail practice — the price shown is the price paid).
   - Delivery charge depends on delivery area (Inside Dhaka / Outside Dhaka),
     matching how most Bangladeshi couriers (Pathao, Sundarban, RedX,
     Steadfast) price last-mile delivery.
   ========================================================================= */

(function () {
  "use strict";
  const DELIVERY_INSIDE_DHAKA = 70;   // ৳ — inside Dhaka city
  const DELIVERY_OUTSIDE_DHAKA = 130; // ৳ — nationwide / outside Dhaka
  const VAT_RATE = 0.15;              // Bangladesh standard VAT (NBR) — already included in listed price
  const FREE_DELIVERY_THRESHOLD = 2500;

  function lineKey(item) { return [item.productId, item.selectedSize, item.selectedColor].join("::"); }

  function getCart() { return window.DF.api.getCart(); }
  function setCart(cart) { window.DF.api.saveCart(cart); window.DFupdateHeaderCounts?.(); }

  /** Adds a product to the cart, respecting available stock. */
  async function addToCart(productId, quantity, selectedSize, selectedColor) {
    const product = await window.DF.api.fetchProductById(productId);
    if (!product) { showToast("Product not found.", "error"); return false; }
    if (product.stock <= 0) { showToast("This product is currently out of stock.", "error"); return false; }

    const cart = getCart();
    const key = lineKey({ productId, selectedSize, selectedColor });
    const existing = cart.find(i => lineKey(i) === key);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + quantity > product.stock) {
      showToast(`Only ${product.stock} unit(s) of "${product.name}" available.`, "warn");
      quantity = Math.max(0, product.stock - currentQty);
      if (quantity === 0) return false;
    }

    if (existing) existing.quantity += quantity;
    else cart.push({ productId, quantity, selectedSize, selectedColor });

    setCart(cart);
    showToast(`Added "${product.name}" to your cart.`, "success");
    return true;
  }

  function removeFromCart(productId, selectedSize, selectedColor) {
    const key = [productId, selectedSize, selectedColor].join("::");
    const cart = getCart().filter(i => lineKey(i) !== key);
    setCart(cart);
    renderCartPage();
  }

  async function updateQuantity(productId, selectedSize, selectedColor, newQty) {
    const cart = getCart();
    const key = [productId, selectedSize, selectedColor].join("::");
    const item = cart.find(i => lineKey(i) === key);
    if (!item) return;
    const product = await window.DF.api.fetchProductById(productId);
    if (newQty < 1) { removeFromCart(productId, selectedSize, selectedColor); return; }
    if (product && newQty > product.stock) {
      showToast(`Only ${product.stock} unit(s) available.`, "warn");
      newQty = product.stock;
    }
    item.quantity = newQty;
    setCart(cart);
    renderCartPage();
  }

  async function getCartDetailed() {
    const cart = getCart();
    const products = await window.DF.api.fetchProducts();
    return cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, product };
    }).filter(i => i.product);
  }

  function finalPrice(p) { return Math.round(p.price * (1 - (p.discount || 0) / 100)); }
  const money = (n) => window.DFmoney(n);

  /**
   * @param {string} deliveryArea "inside" (Dhaka) or "outside" (nationwide). Defaults to "inside".
   */
  async function computeTotals(deliveryArea) {
    const detailed = await getCartDetailed();
    const subtotal = detailed.reduce((s, i) => s + finalPrice(i.product) * i.quantity, 0);
    const baseDelivery = deliveryArea === "outside" ? DELIVERY_OUTSIDE_DHAKA : DELIVERY_INSIDE_DHAKA;
    const delivery = subtotal === 0 ? 0 : (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : baseDelivery);
    // VAT is already included in the listed price — shown for the receipt only, not added to the total.
    const vat = Math.round(subtotal * VAT_RATE / (1 + VAT_RATE));
    const total = Math.round(subtotal + delivery);
    return { detailed, subtotal, delivery, vat, total };
  }

  /* ---- Rendering the cart page ---- */
  async function renderCartPage() {
    const root = document.getElementById("cartContent");
    if (!root) return;
    const { detailed, subtotal, delivery, vat, total } = await computeTotals();

    if (detailed.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="icon"><i class="bi bi-bag-x"></i></div>
          <h3>Your cart is empty</h3>
          <p>Looks like you haven't added anything yet.</p>
          <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
        </div>`;
      return;
    }

    const rows = detailed.map(i => `
      <div class="cart-row" data-key="${i.productId}::${i.selectedSize}::${i.selectedColor}">
        <div class="cart-thumb"><img src="${i.product.images[0]}" alt="${i.product.name}" onerror="onImgError(this,'${i.product.name}')"></div>
        <div>
          <div class="cart-item-title"><a href="product.html?id=${i.product.id}">${i.product.name}</a></div>
          <div class="cart-item-meta">Size ${i.selectedSize} &middot; ${i.selectedColor} &middot; ${money(finalPrice(i.product))} each</div>
          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button aria-label="Decrease quantity" data-act="dec">−</button>
              <span>${i.quantity}</span>
              <button aria-label="Increase quantity" data-act="inc">+</button>
            </div>
            <button class="cart-remove" data-act="remove">Remove</button>
          </div>
        </div>
        <div class="cart-item-total">${money(finalPrice(i.product) * i.quantity)}</div>
      </div>`).join("");

    root.innerHTML = `
      <div class="cart-layout">
        <div>
          <div class="card-surface">${rows}</div>
          <a href="shop.html" class="btn btn-ghost" style="margin-top:16px;"><i class="bi bi-arrow-left"></i>&nbsp; Continue Shopping</a>
        </div>
        <div class="card-surface">
          <h3>Order Summary</h3>
          <div class="summary-line"><span>Subtotal</span><span>${money(subtotal)}</span></div>
          <div class="summary-line"><span>Delivery Charge</span><span>${delivery === 0 ? "Free" : money(delivery)}</span></div>
          <div class="summary-line"><span class="muted">Includes VAT (15%)</span><span class="muted">${money(vat)}</span></div>
          <div class="summary-line total"><span>Grand Total</span><span>${money(total)}</span></div>
          <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:14px;">Proceed to Checkout</a>
          <p class="hint" style="margin-top:10px;">Free delivery inside Dhaka &amp; nationwide on orders over ${money(FREE_DELIVERY_THRESHOLD)}. Cash on Delivery available.</p>
        </div>
      </div>`;

    root.addEventListener("click", onCartRowClick);
  }

  function onCartRowClick(e) {
    const row = e.target.closest(".cart-row");
    if (!row) return;
    const [productId, selectedSize, selectedColor] = row.dataset.key.split("::");
    if (e.target.dataset.act === "remove") removeFromCart(productId, selectedSize, selectedColor);
    if (e.target.dataset.act === "inc" || e.target.dataset.act === "dec") {
      const span = row.querySelector(".qty-stepper span");
      let qty = parseInt(span.textContent, 10);
      qty = e.target.dataset.act === "inc" ? qty + 1 : qty - 1;
      updateQuantity(productId, selectedSize, selectedColor, qty);
    }
  }

  window.DFcart = { addToCart, removeFromCart, updateQuantity, getCartDetailed, computeTotals, finalPrice, renderCartPage, DELIVERY_INSIDE_DHAKA, DELIVERY_OUTSIDE_DHAKA, VAT_RATE, FREE_DELIVERY_THRESHOLD };

  document.addEventListener("DOMContentLoaded", renderCartPage);
})();
