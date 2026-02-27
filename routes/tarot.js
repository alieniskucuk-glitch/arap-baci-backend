import express from "express";
import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js"; // ✅ EKLENDİ
import { startTarot, revealTarot } from "../services/tarotService.js";

const router = express.Router();

// ✅ START → auth + coinCheck
router.post("/start", auth, coinCheck("TAROT"), async (req, res) => {
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
});

// REVEAL → sadece auth (coin düşme zaten service içinde)
router.post("/reveal", auth, async (req, res) => {
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
});

export default router;