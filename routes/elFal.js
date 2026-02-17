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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB üst limit
});

/* =========================
   ROUTE
========================= */

router.post(
  "/",
  auth,
  coinCheck("EL_FALI"),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Görsel gerekli" });
      }

      // 🔥 1MB'a optimize et
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 1200 }) // aşırı büyükleri küçült
        .jpeg({ quality: 75 })   // kalite düşür
        .toBuffer();

      req.file.buffer = optimizedBuffer;

      next();
    } catch (err) {
      return res.status(500).json({ error: "Görsel işlenemedi" });
    }
  },
  elFal
);

/* =========================
   ERROR HANDLER
========================= */

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Fotoğraf çok büyük. Maksimum 15MB yükleyebilirsiniz."
    });
  }

  return res.status(500).json({
    error: "Dosya yükleme hatası."
  });
});

export default router;
