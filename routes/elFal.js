import express from "express";
import multer from "multer";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import { elFal } from "../services/elFalService.js";

const router = express.Router();

/* =========================
   MULTER CONFIG
========================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

/* =========================
   POST /el-fal
========================= */

router.post(
  "/",
  auth,
  oad.single("image"),
  coinCheck("EL_FALI"),
  elFal
);

/* =========================
   ERROR HANDLER
========================= */

router.use((err, req, res, next) => {
  console.error("EL FAL ROUTE ERROR:", err);

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