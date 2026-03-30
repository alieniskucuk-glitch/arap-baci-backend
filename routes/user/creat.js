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

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const email = req.user?.email || null;

    const userRef = db.collection("users").doc(uid);

    let created = false;
    let profileCompleted = false;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      /* =========================
         USER VARSA
      ========================= */
      if (snap.exists) {
        const data = snap.data() || {};

        // email boşsa ve şimdi geldiyse yaz
        if (!data.email && email) {
          tx.update(userRef, { email });
        }

        profileCompleted = data.profileCompleted === true;
        return;
      }

      /* =========================
         USER YOKSA OLUŞTUR
      ========================= */
      tx.set(userRef, {
        uid,
        email,
        abCoin: 10,
        isPremium: false,
        profileCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      created = true;
      profileCompleted = false;
    });

    /* =========================
       RESPONSE
    ========================= */
    return res.json({
      success: true,
      created,
      profileCompleted,
      uid, // 🔥 EKLENDİ (frontend için net kimlik)
    });

  } catch (err) {
    console.error("CREAT ERROR:", err);
    return res.status(500).json({
      error: "Sunucu hatası",
    });
  }
});

export default router;