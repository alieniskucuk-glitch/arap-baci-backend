import express from "express";
import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/creat
========================= */

router.post("/creat", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || null;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const userRef = db.collection("users").doc(uid);

    let created = false;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      // ✅ varsa hiçbir şey yapma
      if (snap.exists) {
        return;
      }

      // ✅ yoksa oluştur
      tx.set(userRef, {
        uid,
        email,
        abCoin: 10,
        dailyCoin: 0,
        isPremium: false,
        profileCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      created = true;
    });

    return res.json({
      success: true,
      created, // debug için: true = yeni user, false = zaten vardı
    });

  } catch (err) {
    console.error("CREAT ERROR:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;