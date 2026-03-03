import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import {
  startTarot,
  generateTarotInterpretation,
  revealTarot,
  finalizeTarot,
  saveTarot,
} from "../services/tarotService.js";

const router = express.Router();

/* =========================
   POST /tarot/start
   - Coin kontrol var
   - GPT YOK
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
   POST /tarot/generate
   - GPT BURADA ÇALIŞIR
   - Coin YOK
========================= */

router.post(
  "/generate",
  auth,
  async (req, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await generateTarotInterpretation(uid, req.body);
      res.json(data);
    } catch (e) {
      console.error("TAROT GENERATE ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

/* =========================
   POST /tarot/reveal
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
   POST /tarot/finalize
========================= */

router.post(
  "/finalize",
  auth,
  async (req, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await finalizeTarot(uid, req.body);
      res.json(data);
    } catch (e) {
      console.error("TAROT FINALIZE ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

/* =========================
   POST /tarot/save
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

      await saveTarot(uid, req.body);
      res.json({ success: true });
    } catch (e) {
      console.error("TAROT SAVE ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

export default router;