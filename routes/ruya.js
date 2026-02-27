import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";   // ← EKLENDİ
import coinCheck from "../middleware/coinCheck.js";
import { ruyaYorumla } from "../services/ruyaService.js";

const router = express.Router();

router.post(
  "/",
  auth,
  dailyReset,          // ← SADECE BUNU EKLEDİK
  coinCheck("RUYA"),
  ruyaYorumla
);

export default router;