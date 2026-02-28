import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/refresh
   - App açılınca çağrılır
   - Güncel coin ve premium state döner
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

    const dailyCoin = Number(user.dailyCoin ?? 0);
    const abCoin = Number(user.abCoin ?? 0);
    const isPremium = Boolean(user.isPremium);

    return res.json({
      dailyCoin,
      abCoin,
      totalCoin: dailyCoin + abCoin, // 🔥 frontend için kolaylık
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