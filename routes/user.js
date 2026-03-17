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

    if (typeof birthDate === "string" && birthDate.trim().length > 0) {
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

/* =========================
   POST /user/mock-premium
========================= */

router.post("/mock-premium", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const userRef = db.collection("users").doc(uid);

    const now = new Date();
    const start = admin.firestore.Timestamp.fromDate(now);

    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);
    const end = admin.firestore.Timestamp.fromDate(endDate);

    await userRef.set(
      {
        isPremium: true,
        premiumStartedAt: start,
        premiumEndsAt: end,
        premiumStatus: "active",
        premiumAutoRenew: true,
        premiumPlanId: "monthly_premium_v1",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      message: "Premium aktif edildi",
    });
  } catch (err) {
    console.error("MOCK PREMIUM ERROR:", err);

    return res.status(500).json({
      error: "Premium aktivasyon hatası",
    });
  }
});

export default router;