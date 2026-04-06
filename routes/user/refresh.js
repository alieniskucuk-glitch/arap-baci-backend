import express from "express";
import auth from "../../middleware/auth.js";
import dailyReset from "../../middleware/dailyReset.js";

const router = express.Router();

/* =========================
   POST /user/refresh
========================= */

router.post("/refresh", auth, dailyReset, async (req, res) => {
  return res.json({
    success: true,
  });
});

export default router;