const router = require("express").Router();
const ctrl = require("../controllers/review.controller");

router.get("/", ctrl.listReviews);

module.exports = router;
