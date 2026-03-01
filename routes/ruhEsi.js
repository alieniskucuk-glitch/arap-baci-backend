import express from "express";
import multer from "multer";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import { ruhEsi } from "../services/ruhEsiService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =========================
   POST /uyum
   - Coin sadece service içinde düşecek
========================= */

router.post(
  "/",
  auth,
   upload.fields([
    { name: "p1Hand", maxCount: 1 },
    { name: "p2Hand", maxCount: 1 },
  ]),
  coinCheck("UYUM"),
  ruhEsi
);

export default router;