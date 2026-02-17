import express from "express";
import multer from "multer";
import sharp from "sharp";
import { elFal } from "../services/elFalService.js";
import auth from "../middleware/auth.js";
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
  upload.single("image"),       // 🔥 1️⃣ Önce multer
  coinCheck("EL_FALI"),         // 🔥 2️⃣ Sonra coin kontrol
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Görsel gerekli" });
      }

      // 🔥 Sharp güvenli kullanım
      const optimizedBuffer = await sharp(req.file.buffer)
        .rotate() // EXIF orientation fix
        .resize({ width: 1200 })
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer();

      req.file.buffer = optimizedBuffer;

      next();
    } catch (err) {
      console.error("SHARP ERROR:", err);
      return res.status(500).json({ error: "Görsel işlenemedi" });
    }
  },
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
