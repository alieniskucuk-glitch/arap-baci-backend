import express from "express";

import auth from "../middleware/auth.js";
import {
  getActiveSevenDay,
  getSevenDayDeck,
  revealSevenDay,
  startSevenDay,
} from "../services/yediGunlukKehanetService.js";

const router = express.Router();

function sendError(res, error, fallback) {
  console.error("7 GÜNLÜK KEHANET ERROR:", error);
  return res.status(error.status || 500).json({
    error: error.message || fallback,
    code: error.code || "SEVEN_DAY_ERROR",
  });
}

router.get("/active", auth, async (req, res) => {
  try {
    return res.json(await getActiveSevenDay(req.user.uid));
  } catch (error) {
    return sendError(res, error, "Aktif seri yüklenemedi");
  }
});

router.get("/deck/:deckType", auth, (req, res) => {
  try {
    return res.json(getSevenDayDeck(req.params.deckType));
  } catch (error) {
    return sendError(res, error, "Deste yüklenemedi");
  }
});

router.post("/start", auth, async (req, res) => {
  try {
    return res.json(await startSevenDay(req.user.uid, req.body));
  } catch (error) {
    return sendError(res, error, "Seri oluşturulamadı");
  }
});

router.post("/reveal", auth, async (req, res) => {
  try {
    return res.json(await revealSevenDay(req.user.uid, req.body));
  } catch (error) {
    return sendError(res, error, "Kart açılamadı");
  }
});

export default router;
