const router = require("express").Router();
const ctrl = require("../controllers/order.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

// Order creation is allowed for guests or logged-in customers (requireAuth
// omitted here); if you require accounts to check out, add requireAuth.
router.post("/", ctrl.createOrder);

router.get("/", requireAuth, requireRole("ADMIN", "STAFF"), ctrl.listOrders);
router.get("/mine", requireAuth, ctrl.listMyOrders);
// Deliberately public: guest checkout (no account) is fully supported, so a
// customer must be able to view their own order confirmation without being
// signed in. The order number acts as an unguessable access token.
router.get("/:id", ctrl.getOrder);
router.patch("/:id/status", requireAuth, requireRole("ADMIN", "STAFF"), ctrl.updateOrderStatus);
router.patch("/:id/payment-status", requireAuth, requireRole("ADMIN", "STAFF"), ctrl.updatePaymentStatus);

module.exports = router;
