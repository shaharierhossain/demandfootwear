const prisma = require("../services/prisma");

async function listInventory(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true, sku: true, stock: true, lowStockThreshold: true, status: true, updatedAt: true, category: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(products);
  } catch (err) { next(err); }
}

/**
 * Adjust stock for a product. Uses `SELECT ... FOR UPDATE` to take a real
 * row lock inside the transaction, so two concurrent requests (e.g. an
 * admin restock and a customer checkout happening at the same instant)
 * are serialized by the database rather than racing each other — this is
 * the concurrency-safety a browser-only localStorage demo cannot provide.
 */
async function adjustInventory(req, res, next) {
  const { productId } = req.params;
  const { delta, reason } = req.body;
  const performedBy = req.user?.id || "system";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`SELECT id, stock FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      const current = rows[0];
      if (!current) throw Object.assign(new Error("Product not found."), { status: 404 });

      const nextQty = current.stock + Number(delta);
      if (nextQty < 0) throw Object.assign(new Error("Insufficient stock for this adjustment."), { status: 409 });

      const updated = await tx.product.update({ where: { id: productId }, data: { stock: nextQty } });
      await tx.inventoryTransaction.create({
        data: { productId, previousQty: current.stock, adjustment: Number(delta), newQty: nextQty, reason: reason || "Manual adjustment", performedBy },
      });
      return updated;
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function getInventoryLog(req, res, next) {
  try {
    const where = req.query.productId ? { productId: req.query.productId } : {};
    const log = await prisma.inventoryTransaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, sku: true } } } });
    res.json(log);
  } catch (err) { next(err); }
}

module.exports = { listInventory, adjustInventory, getInventoryLog };
