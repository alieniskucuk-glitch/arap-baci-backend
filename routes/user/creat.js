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

    // 🔥 EMAIL FIX (token yerine Firebase Admin'den çek)
    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email || null;

    const userRef = db.collection("users").doc(uid);

    let created = false;
    let profileCompleted = false;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      // ✅ varsa: sadece profileCompleted al
      if (snap.exists) {
        const data = snap.data() || {};
        profileCompleted = data.profileCompleted === true;
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
      profileCompleted = false;
    });

    return res.json({
      success: true,
      created,
      profileCompleted,
    });

  } catch (err) {
    console.error("CREAT ERROR:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;