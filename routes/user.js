import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/refresh
========================= */

router.post("/refresh", auth, dailyReset, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const user = snap.data() || {};

    // 🔥 SAFE NUMBER PARSE (NaN koruması)
    const dailyCoin = Number.isFinite(Number(user.dailyCoin))
      ? Number(user.dailyCoin)
      : 0;

    const abCoin = Number.isFinite(Number(user.abCoin))
      ? Number(user.abCoin)
      : 0;

    const isPremium = user.isPremium === true;

    const totalCoin = dailyCoin + abCoin;

    return res.json({
      dailyCoin,
      abCoin,
      totalCoin,
      isPremium,
    });

  } catch (err) {
    console.error("USER REFRESH ERROR:", err);

    return res.status(500).json({
      error: "Refresh hatası",
    });
  }
});

export default router;