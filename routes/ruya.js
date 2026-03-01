import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import { ruyaYorumla } from "../services/ruyaService.js";

const router = express.Router();

/* =========================
   POST /ruya
   - Coin sadece service içinde düşer
========================= */

router.post(
  "/",
  auth,
  coinCheck("RUYA"),
  ruyaYorumla
);

export default router;