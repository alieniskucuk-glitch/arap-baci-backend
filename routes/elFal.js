import express from "express";
import multer from "multer";
import { elFal } from "../services/elFalService.js";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";   // ← EKLENDİ
import coinCheck from "../middleware/coinCheck.js";

const router = express.Router();

/* =========================
   MULTER CONFIG
========================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

/* =========================
   ROUTE
========================= */

router.post(
  "/",
  auth,
  dailyReset,               // ← EKLENDİ (KRİTİK)
  upload.single("image"),
  coinCheck("EL_FALI"),
  elFal
);

/* =========================
   ERROR HANDLER
========================= */

router.use((err, req, res, next) => {
  console.error("UPLOAD ERROR:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Fotoğraf çok büyük. Maksimum 15MB yükleyebilirsiniz.",
    });
  }

  return res.status(500).json({
    error: "Dosya yükleme hatası.",
  });
});

export default router;