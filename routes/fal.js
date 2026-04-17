import express from "express";
import multer from "multer";
import crypto from "crypto";

import { generateFal } from "../services/falService.js";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { decreaseCoin } from "../utils/coinManager.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =========================
   STORE
========================= */

const falStore = new Map();

/* =========================
   START (TEK AKIŞ)
========================= */

router.post(
  "/start",
  auth,
  upload.array("images", 5),
  coinCheck("FAL"),
  async (req, res) => {
    const id = crypto.randomUUID();

    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: "Fotoğraf gerekli" });
      }

      const uid = req.user.uid;
      const price = req.coinPrice;

      falStore.set(id, { status: "processing" });

      // 🔥 hemen response
      res.status(200).json({ falId: id });

      const full = await generateFal(req.files);

      if (!full) {
        throw new Error("Fal boş geldi");
      }

      await decreaseCoin(uid, price, "FAL", { falId: id });

      falStore.set(id, { status: "done", full });

    } catch (err) {
      console.error("FAL ERROR:", err);
      falStore.set(id, { status: "error" });
    }
  }
);

/* =========================
   POLLING
========================= */

router.get("/:id", (req, res) => {
  const f = falStore.get(req.params.id);

  if (!f) {
    return res.status(404).json({ error: "Bulunamadı" });
  }

  res.json(f);
});

export default router;