const prisma = require("../services/prisma");

async function listProducts(req, res, next) {
  try {
    const { category, brand, q, minPrice, maxPrice, sort, page = 1, pageSize = 12 } = req.query;
    const where = {
      AND: [
        category ? { category: { slug: category } } : {},
        brand ? { brand } : {},
        q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] } : {},
        minPrice ? { price: { gte: Number(minPrice) } } : {},
        maxPrice ? { price: { lte: Number(maxPrice) } } : {},
      ],
    };
    const orderBy = { newest: { createdAt: "desc" }, "price-asc": { price: "asc" }, "price-desc": { price: "desc" }, rating: { rating: "desc" } }[sort] || { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy, include: { images: true, category: true },
        skip: (Number(page) - 1) * Number(pageSize), take: Number(pageSize),
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (err) { next(err); }
}

async function getProduct(req, res, next) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { images: true, category: true, reviews: { include: { user: { select: { name: true } } } } },
    });
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json(product);
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    // req.body has already passed validation middleware — see routes/product.routes.js
    const { name, sku, categoryId, brand, description, price, discountPercent, lowStockThreshold, sizes = [], colors = [], stock = 0, images = [], tags = [] } = req.body;
    const product = await prisma.product.create({
      data: {
        name, sku, categoryId, brand, description,
        price, discountPercent: discountPercent || 0, lowStockThreshold: lowStockThreshold || 8,
        sizes, colors, stock, tags,
        images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
      },
      include: { images: true },
    });
    res.status(201).json(product);
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    // Images are replaced wholesale for simplicity — delete + recreate rather
    // than diffing. Fine at this catalog size; revisit if it ever gets large.
    const { images, ...rest } = req.body;
    const data = { ...rest };
    if (images) {
      await prisma.productImage.deleteMany({ where: { productId: req.params.id } });
      data.images = { create: images.map((url, i) => ({ url, sortOrder: i })) };
    }
    const product = await prisma.product.update({ where: { id: req.params.id }, data, include: { images: true } });
    res.json(product);
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
