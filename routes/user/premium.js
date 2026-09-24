import express from "express";

import auth from "../../middleware/auth.js";

const router = express.Router();

// Kept for older clients, but premium can no longer be granted without a
// verified App Store or Google Play purchase.
router.post("/premium", auth, async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: "Premium satın alma doğrulaması gerekli",
    verifyEndpoint: "/premium/verify",
  });
});

export default router;
