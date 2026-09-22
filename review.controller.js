const prisma = require("../services/prisma");

async function listReviews(req, res, next) {
  try {
    const where = req.query.productId ? { productId: req.query.productId } : {};
    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } }, product: { select: { name: true } } },
    });
    res.json(reviews);
  } catch (err) { next(err); }
}

module.exports = { listReviews };
