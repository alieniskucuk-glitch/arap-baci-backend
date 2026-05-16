import express from "express";
import admin from "firebase-admin";

import auth from "../middleware/auth.js";
import { db } from "../config/firebase.js";

const router = express.Router();

/* ================= REWARD ================= */

router.post("/", auth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userRef = db.collection("users").doc(uid);

    await userRef.update({
      abCoin: admin.firestore.FieldValue.increment(1),
    });

    return res.json({
      success: true,
      reward: 1,
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: "REWARD_FAILED",
    });
  }
});

export default router;