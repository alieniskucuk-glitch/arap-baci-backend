import express from "express";
import auth from "../middleware/auth.js";
import { startTarot, revealTarot } from "../services/tarotService.js";

const router = express.Router();

router.post("/start", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;   // ✅ DOĞRU

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

router.post("/reveal", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;   // ✅ DOĞRU

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