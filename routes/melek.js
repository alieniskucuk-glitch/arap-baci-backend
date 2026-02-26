import express from "express";
import auth from "../middleware/auth.js";
import { startMelek, revealMelek } from "../services/melekService.js";

const router = express.Router();

router.post("/start", auth, async (req, res) => {
  try {
    const data = await startMelek(req.uid, req.body);
    res.json(data);
  } catch (e) {
    console.error("MELEK START ERROR:", e);
    res.status(400).json({ error: e.message });
  }
});

router.post("/reveal", auth, async (req, res) => {
  try {
    const data = await revealMelek(req.uid, req.body);
    res.json(data);
  } catch (e) {
    console.error("MELEK REVEAL ERROR:", e);
    res.status(400).json({ error: e.message });
  }
});

export default router;