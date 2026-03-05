import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import {
  startTarot,
  revealTarot,
  saveTarot,
} from "../services/tarotService.js";

const router = express.Router();

/* =========================
   POST /tarot/start
   - Coin kontrol var
   - GPT artık burada arka planda başlar
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
   - Son kartta GPT sonucu döner
   - Coin burada düşer
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

/* =========================
   POST /tarot/save   ✅ EKLENDİ
   - History'e kayıt
   - Coin düşmez
========================= */

router.post(
  "/save",
  auth,
  async (req, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await saveTarot(uid, req.body);
      return res.json(data);
    } catch (e) {
      console.error("TAROT SAVE ERROR:", e);
      return res.status(400).json({ error: e.message });
    }
  }
);

export default router;