import express from "express";
import auth from "../../middleware/auth.js";
import { db } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/mock-premium
========================= */

router.post("/mock-premium", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    await db.collection("users").doc(uid).set(
      {
        isPremium: true,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      isPremium: true,
    });
  } catch (err) {
    console.error("MOCK PREMIUM ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;