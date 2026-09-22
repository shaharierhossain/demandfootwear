/**
 * Demand Footwear — database seed script.
 *
 * Populates a fresh database with:
 *  - The real 7-category, 24-product BDT catalog — by actually executing
 *    ../../js/api.js (the same file the storefront demo uses) inside a
 *    tiny sandbox, so the catalog is defined in exactly ONE place in the
 *    whole project and can never drift between demo and database.
 *  - One admin account, created from ADMIN_SEED_EMAIL/NAME/PASSWORD in
 *    your .env — never a hardcoded password.
 *
 * Run once after your first migration:
 *   npm run prisma:seed
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const prisma = require("../src/services/prisma");

/** A minimal in-memory localStorage so api.js's read()/write() calls work outside a browser. */
function createMemoryStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

async function loadDemoCatalogViaApiJs() {
  const src = fs.readFileSync(path.join(__dirname, "../../js/api.js"), "utf8");
  const sandboxWindow = {};
  const sandboxStorage = createMemoryStorage();
  // api.js is a `(function (global) { ... })(window)` IIFE that expects
  // `window` and `localStorage` as free variables — supply both as
  // parameters to `Function` so it runs unmodified, seeding sandboxStorage
  // exactly the way it seeds a real browser's localStorage on first load.
  const run = new Function("window", "localStorage", src);
  run(sandboxWindow, sandboxStorage);

  const products = await sandboxWindow.DF.api.fetchProducts();
  const categories = await sandboxWindow.DF.api.fetchCategories();
  return { products, categories };
}

async function main() {
  const { categories, products } = await loadDemoCatalogViaApiJs();
  console.log(`Seeding ${categories.length} categories and ${products.length} products...`);

  const categoryIdMap = {};
  for (const c of categories) {
    const created = await prisma.category.upsert({
      where: { slug: c.id },
      update: { name: c.name, description: c.description, imageUrl: c.image },
      create: { slug: c.id, name: c.name, description: c.description, imageUrl: c.image },
    });
    categoryIdMap[c.id] = created.id;
  }

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku, name: p.name, brand: p.brand, description: p.description,
        price: p.price, discountPercent: p.discount || 0,
        categoryId: categoryIdMap[p.category], sizes: p.sizes, colors: p.colors,
        stock: p.stock, lowStockThreshold: p.lowStockThreshold || 8, tags: p.tags || [],
        rating: p.rating || 0, reviewCount: p.reviewCount || 0,
        status: (p.status || "active").toUpperCase(),
        images: { create: (p.images || []).map((url, i) => ({ url, sortOrder: i })) },
      },
    });
  }

  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword === "change-this-before-seeding") {
    console.warn("\n⚠️  Skipped admin account creation: set ADMIN_SEED_EMAIL and a real ADMIN_SEED_PASSWORD in backend/.env before seeding.");
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 12));
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { name: process.env.ADMIN_SEED_NAME || "Store Owner", email: adminEmail, passwordHash, role: "ADMIN" },
    });
    console.log(`\n✅ Admin account ready: ${adminEmail} (log in at /admin-login.html)`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
