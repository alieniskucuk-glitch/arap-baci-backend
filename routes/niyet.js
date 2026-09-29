import express from "express";

import auth from "../middleware/auth.js";
import { revealNiyet } from "../services/niyetService.js";

const router = express.Router();

router.post("/reveal", auth, async (req, res) => {
  try {
    const result = await revealNiyet(req.user.uid, {
      requestId: req.body?.requestId,
      animal: req.body?.animal,
      gender: req.user.gender,
    });

    return res.json(result);
  } catch (error) {
    console.error("NİYET REVEAL ERROR:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Niyet falı oluşturulamadı",
      code: error.code || "NIYET_ERROR",
    });
  }
});

export default router;
