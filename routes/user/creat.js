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

    // ✅ SADECE AUTH'TAN GELİR
    const email = req.user?.email || null;

    const userRef = db.collection("users").doc(uid);

    let created = false;
    let profileCompleted = false;
    let name = "";
    let zodiac = "";

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      /* =========================
         USER VARSA
      ========================= */
      if (snap.exists) {
        const data = snap.data() || {};

        profileCompleted = data.profileCompleted === true;
        name = typeof data.name === "string" ? data.name : "";
        zodiac = typeof data.zodiac === "string" ? data.zodiac : "";

        return;
      }

      /* =========================
         USER YOKSA OLUŞTUR
      ========================= */
      tx.set(userRef, {
        uid,
        email,

        abCoin: 10,
        dailyCoin: 0,

        isPremium: false,
        profileCompleted: false,

        name: "",
        zodiac: "",

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      created = true;
      profileCompleted = false;
      name = "";
      zodiac = "";
    });

    /* =========================
       RESPONSE (HER ZAMAN NET)
    ========================= */
    return res.json({
      success: true,
      created,
      profileCompleted,
      name,
      zodiac,
    });

  } catch (err) {
    console.error("CREAT ERROR:", err);
    return res.status(500).json({
      error: "Sunucu hatası",
    });
  }
});

export default router;