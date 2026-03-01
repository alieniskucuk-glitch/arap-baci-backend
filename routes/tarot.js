import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import { startTarot, revealTarot } from "../services/tarotService.js";

const router = express.Router();

/* =========================
   POST /tarot/start
   - Sadece kontrol
========================= */

router.post(
  "/start",
  auth,
   coinCheck("TAROT"),
  async (req, res) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await startTarot(uid, {
        ...req.body,
        coinPrice: req.coinPrice,
      });

      res.json(data);

    } catch (e) {
      console.error("TAROT START ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

/* =========================
   POST /tarot/reveal
   - Coin düşme service içinde
========================= */

router.post(
  "/reveal",
  auth,
  async (req, res) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await revealTarot(uid, req.body);
      res.json(data);

    } catch (e) {
      console.error("TAROT REVEAL ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

export default router;