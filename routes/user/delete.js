import express from "express";
import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/delete
========================= */

router.post("/delete", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({
        error: "Token gerekli",
      });
    }

    /* =========================
       USERS DOC
    ========================= */

    await db
      .collection("users")
      .doc(uid)
      .delete();

    /* =========================
       BAĞLI KOLEKSİYONLAR
    ========================= */

    const collections = [
      "falHistory",
      "tarotHistory",
      "dreamHistory",
      "melekHistory",
      "elFalHistory",
      "uyumHistory",
      "sessions",
    ];

    for (const collectionName of collections) {
      const snap = await db
        .collection(collectionName)
        .where("uid", "==", uid)
        .get();

      const batch = db.batch();

      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    }

    /* =========================
       FIREBASE AUTH
    ========================= */

    await admin.auth().deleteUser(uid);

    return res.json({
      success: true,
      message: "Hesap silindi",
    });

  } catch (e) {

    console.error(
      "DELETE ACCOUNT ERROR:",
      e,
    );

    return res.status(500).json({
      error: "Hesap silinemedi",
    });
  }
});

export default router;