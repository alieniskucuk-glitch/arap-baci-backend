import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import { db } from "../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/refresh
   - App açılınca çağrılır
========================= */
router.post("/refresh", auth, dailyReset, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const snap = await db.collection("users").doc(uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const user = snap.data();

    return res.json({
      dailyCoin: user.dailyCoin || 0,
      abCoin: user.abCoin || 0,
      isPremium: user.isPremium || false,
    });
  } catch (err) {
    console.error("USER REFRESH ERROR:", err);
    return res.status(500).json({ error: "Refresh hatası" });
  }
});

export default router;