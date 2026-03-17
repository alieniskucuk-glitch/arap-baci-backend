import express from "express";
import auth from "../middleware/auth.js";
import dailyReset from "../middleware/dailyReset.js";
import { db, admin } from "../config/firebase.js";

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

    const dailyCoin =
      typeof user.dailyCoin === "number" && Number.isFinite(user.dailyCoin)
        ? user.dailyCoin
        : 0;

    const abCoin =
      typeof user.abCoin === "number" && Number.isFinite(user.abCoin)
        ? user.abCoin
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

/* =========================
   POST /user/update
========================= */

router.post("/update", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const {
      firstName,
      lastName,
      fullName,
      email,
      birthDate,
      gender,
      zodiac,
      profileCompleted,
    } = req.body || {};

    const updateData = {};

    if (typeof firstName === "string") {
      updateData.firstName = firstName.trim();
    }

    if (typeof lastName === "string") {
      updateData.lastName = lastName.trim();
    }

    if (typeof fullName === "string") {
      updateData.fullName = fullName.trim();
    }

    if (typeof email === "string") {
      updateData.email = email.trim();
    }

    if (typeof gender === "string") {
      updateData.gender = gender.trim();
    }

    if (typeof zodiac === "string") {
      updateData.zodiac = zodiac.trim();
    }

    if (typeof profileCompleted === "boolean") {
      updateData.profileCompleted = profileCompleted;
    }

    if (typeof birthDate === "string" && birthDate.trim().isNotEmpty) {
      const parsedDate = new Date(birthDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData.birthDate = admin.firestore.Timestamp.fromDate(parsedDate);
      }
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("users").doc(uid).set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Profil güncellendi",
    });
  } catch (err) {
    console.error("USER UPDATE ERROR:", err);

    return res.status(500).json({
      error: "Profil güncelleme hatası",
    });
  }
});

export default router;