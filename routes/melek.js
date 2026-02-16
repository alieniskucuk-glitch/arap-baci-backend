import express from "express";
import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { startMelek } from "../services/melekService.js";

const router = express.Router();

router.post("/start", auth, coinCheck("MELEK"), async (req, res) => {
  try {
    const result = await startMelek(req.user.uid, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Melek işlemi başarısız" });
  }
});

export default router;
