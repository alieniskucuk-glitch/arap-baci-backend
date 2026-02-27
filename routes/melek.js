import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";   // ← EKLENDİ
import coinCheck from "../middleware/coinCheck.js";
import { startMelek, revealMelek } from "../services/melekService.js";

const router = express.Router();

/* =========================
   POST /melek/start
========================= */
router.post(
  "/start",
  auth,
  dailyReset,                 // ← EKLENDİ
  coinCheck("MELEK"),
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.user_id || req.user?.id;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const result = await startMelek(uid, req.body);
      return res.json(result);
    } catch (err) {
      console.error("MELEK START ERROR:", err);
      return res.status(400).json({ error: err.message || "Start hata" });
    }
  }
);

/* =========================
   POST /melek/reveal
========================= */
router.post(
  "/reveal",
  auth,
  dailyReset,                 // ← EKLENDİ
  async (req, res) => {
    try {
      const uid = req.user?.uid || req.user?.user_id || req.user?.id;

      if (!uid) {
        return res.status(401).json({ error: "Token gerekli" });
      }

      const result = await revealMelek(uid, req.body);
      return res.json(result);
    } catch (err) {
      console.error("MELEK REVEAL ERROR:", err);
      return res.status(400).json({ error: err.message || "Reveal hata" });
    }
  }
);

export default router;