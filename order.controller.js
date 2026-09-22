const prisma = require("../services/prisma");

// Prices are stored/returned in Bangladeshi Taka (BDT) as whole-Taka integers
// (no paisa), matching standard local retail display. Listed prices are
// VAT-inclusive (NBR standard rate), so VAT is extracted for the receipt/
// ledger rather than added on top of the customer-facing total. Delivery
// pricing follows the common local courier pattern of Inside Dhaka vs
// Outside Dhaka (nationwide) rather than speed-tiered shipping.
const VAT_RATE = 0.15;
const DELIVERY_INSIDE_DHAKA = 70;
const DELIVERY_OUTSIDE_DHAKA = 130;
const FREE_DELIVERY_THRESHOLD = 2500;

/**
 * The front-end refers to orders by their human-friendly `orderNumber`
 * (e.g. "DF-LM3X9K2") rather than the raw database id, so every lookup
 * below accepts either and resolves to the real id first.
 */
async function resolveOrderId(idOrNumber) {
  const row = await prisma.order.findFirst({ where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] }, select: { id: true } });
  return row ? row.id : null;
}

async function listOrders(req, res, next) {
  try {
    const { status, from, to } = req.query;
    const where = {
      AND: [
        status ? { status } : {},
        from ? { createdAt: { gte: new Date(from) } } : {},
        to ? { createdAt: { lte: new Date(to) } } : {},
      ],
    };
    const orders = await prisma.order.findMany({ where, include: { items: true, payment: true }, orderBy: { createdAt: "desc" } });
    res.json(orders);
  } catch (err) { next(err); }
}

// A signed-in customer's own order history — deliberately NOT admin-gated,
// but scoped strictly to req.user.id so no customer can see another's orders.
async function listMyOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({ where: { userId: req.user.id }, include: { items: true, payment: true }, orderBy: { createdAt: "desc" } });
    res.json(orders);
  } catch (err) { next(err); }
}

async function getOrder(req, res, next) {
  try {
    const id = await resolveOrderId(req.params.id);
    if (!id) return res.status(404).json({ error: "Order not found." });
    const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true } }, payment: true } });
    res.json(order);
  } catch (err) { next(err); }
}

/**
 * SECURITY-CRITICAL: this endpoint NEVER trusts prices, discounts, or
 * totals sent by the client. It re-reads each product's authoritative
 * price from the database and recomputes every total server-side, then
 * decrements stock atomically inside the same transaction — this is the
 * behavior the browser-only prototype cannot guarantee.
 */
async function createOrder(req, res, next) {
  const { customerName, email, phone, address, deliveryMethod, paymentMethod, paymentReference, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Order must contain at least one item." });

  try {
    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData = [];

      for (const line of items) {
        // Row-lock the product for the duration of this transaction so two
        // simultaneous orders can never both succeed against the last unit.
        const rows = await tx.$queryRaw`SELECT id, name, price, "discountPercent", stock FROM "Product" WHERE id = ${line.productId} FOR UPDATE`;
        const product = rows[0];
        if (!product) throw Object.assign(new Error(`Product ${line.productId} not found.`), { status: 404 });
        if (product.stock < line.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${product.name}.`), { status: 409 });
        }
        const unitPrice = Math.round(Number(product.price) * (1 - product.discountPercent / 100));
        subtotal += unitPrice * line.quantity;
        orderItemsData.push({ productId: product.id, size: line.size, color: line.color, quantity: line.quantity, unitPrice });

        const newQty = product.stock - line.quantity;
        await tx.product.update({ where: { id: product.id }, data: { stock: newQty } });
        await tx.inventoryTransaction.create({
          data: { productId: product.id, previousQty: product.stock, adjustment: -line.quantity, newQty, reason: "Order placed", performedBy: req.user?.id || "system" },
        });
      }

      // deliveryMethod is expected to be "inside" (Dhaka) or "outside" (nationwide).
      const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : (deliveryMethod === "outside" ? DELIVERY_OUTSIDE_DHAKA : DELIVERY_INSIDE_DHAKA);
      // VAT is already included in the unit price shown to the customer —
      // extracted here for bookkeeping/receipts only, never added on top.
      const tax = Math.round(subtotal * VAT_RATE / (1 + VAT_RATE));
      const total = Math.round(subtotal + deliveryFee);
      const orderNumber = "DF-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

      return tx.order.create({
        data: {
          orderNumber, userId: req.user?.id || null, customerName, email, phone,
          addressLine1: address.line1, city: address.city, state: address.state, zip: address.zip, country: address.country,
          deliveryMethod, subtotal, deliveryFee, tax, total, status: "PENDING",
          items: { create: orderItemsData },
          // method is expected to be one of: "bkash" | "nagad" | "rocket" | "card" | "cod"
          payment: { create: { method: paymentMethod, status: paymentMethod === "cod" ? "CASH_ON_DELIVERY" : "PENDING", providerRef: paymentReference || null } },
        },
        include: { items: true, payment: true },
      });
    });

    res.status(201).json(order);
  } catch (err) { next(err); }
}

async function updateOrderStatus(req, res, next) {
  try {
    const id = await resolveOrderId(req.params.id);
    if (!id) return res.status(404).json({ error: "Order not found." });
    const order = await prisma.order.update({ where: { id }, data: { status: req.body.status } });
    res.json(order);
  } catch (err) { next(err); }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const id = await resolveOrderId(req.params.id);
    if (!id) return res.status(404).json({ error: "Order not found." });
    const payment = await prisma.payment.update({ where: { orderId: id }, data: { status: req.body.paymentStatus } });
    res.json(payment);
  } catch (err) { next(err); }
}

module.exports = { listOrders, listMyOrders, getOrder, createOrder, updateOrderStatus, updatePaymentStatus };
