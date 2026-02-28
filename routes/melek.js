import express from "express";

import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import coinCheck from "../middleware/coinCheck.js";

import { startMelek, revealMelek } from "../services/melekService.js";

const router = express.Router();

/* =========================
   POST /melek/start
   - Sadece kontrol
========================= */

router.post(
  "/start",
  auth,
  dailyReset,
  coinCheck("MELEK"), // SADECE KONTROL
  async (req, res) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      // coinPrice'ı service'e iletelim
      const result = await startMelek(uid, {
        ...req.body,
        coinPrice: req.coinPrice,
      });

      return res.json(result);

    } catch (err) {
      console.error("MELEK START ERROR:", err);
      return res.status(400).json({
        error: err.message || "Start hata",
      });
    }
  }
);

/* =========================
   POST /melek/reveal
   - Coin burada düşecek (serviste)
========================= */

router.post(
  "/reveal",
  auth,
  dailyReset,
  async (req, res) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const result = await revealMelek(uid, req.body);

      return res.json(result);

    } catch (err) {
      console.error("MELEK REVEAL ERROR:", err);
      return res.status(400).json({
        error: err.message || "Reveal hata",
      });
    }
  }
);

export default router;