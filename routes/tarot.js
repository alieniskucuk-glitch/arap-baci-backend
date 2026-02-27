import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";   // ← EKLENDİ
import coinCheck from "../middleware/coinCheck.js";
import { startTarot, revealTarot } from "../services/tarotService.js";

const router = express.Router();

// START → auth + dailyReset + coinCheck
router.post(
  "/start",
  auth,
  dailyReset,                 // ← EKLENDİ
  coinCheck("TAROT"),
  async (req, res) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const data = await startTarot(uid, req.body);
      res.json(data);
    } catch (e) {
      console.error("TAROT START ERROR:", e);
      res.status(400).json({ error: e.message });
    }
  }
);

// REVEAL → auth + dailyReset
router.post(
  "/reveal",
  auth,
  dailyReset,                 // ← EKLENDİ
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