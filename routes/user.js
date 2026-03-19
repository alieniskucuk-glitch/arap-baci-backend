import express from "express";
import auth from "../middleware/auth.js";
import { db, admin } from "../config/firebase.js";

const router = express.Router();

/* =========================
   POST /user/refresh
   (LOGIN + SOCIAL CREATE)
========================= */

router.post("/refresh", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    // 🔥 EMAIL FIX (TOKEN'DAN)
    const decoded = await admin.auth().getUser(uid);
    const email = decoded.email || null;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    // 🔥 USER YOKSA OLUŞTUR
    if (!snap.exists) {
      await userRef.set({
        uid,
        email,
        abCoin: 10,
        dailyCoin: 0,
        isPremium: false,
        profileCompleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const user = (await userRef.get()).data();

    return res.json(user);
  } catch (e) {
    console.error("REFRESH ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   POST /user/update
   (PROFILE COMPLETE + REGISTER + EDIT)
========================= */

router.post("/update", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    // 🔥 EMAIL FIX
    const decoded = await admin.auth().getUser(uid);
    const email = decoded.email || null;

    const {
      name,
      firstName,
      lastName,
      fullName,
      birthDate,
      zodiac,
      gender,
    } = req.body;

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    const now = admin.firestore.FieldValue.serverTimestamp();

    /* =========================
       USER YOK → EMAIL REGISTER
    ========================= */

    if (!snap.exists) {
      const parsedName = name ? name.split(" ") : [];

      const _firstName = firstName || parsedName[0] || "";
      const _lastName =
        lastName || parsedName.slice(1).join(" ") || "";

      const _fullName =
        fullName || `${_firstName} ${_lastName}`.trim();

      await userRef.set({
        uid,
        email,

        abCoin: 10,
        dailyCoin: 0,

        isPremium: false,
        profileCompleted: true,

        name: _firstName,
        lastname: _lastName,
        fullname: _fullName,

        birthDate: birthDate ? new Date(birthDate) : null,
        zodiac: zodiac || null,
        gender: gender || null,

        createdAt: now,
        updatedAt: now,
      });

      return res.json({ success: true });
    }

    /* =========================
       USER VAR → UPDATE / COMPLETE
    ========================= */

    const updateData = {
      updatedAt: now,
    };

    if (firstName || name) {
      const parsedName = name ? name.split(" ") : [];

      updateData.name = firstName || parsedName[0] || "";
      updateData.lastname =
        lastName || parsedName.slice(1).join(" ") || "";
      updateData.fullname =
        fullName ||
        `${updateData.name} ${updateData.lastname}`.trim();
    }

    if (birthDate) {
      updateData.birthDate = new Date(birthDate);
    }

    if (zodiac) {
      updateData.zodiac = zodiac;
    }

    if (gender) {
      updateData.gender = gender;
    }

    // 🔥 PROFILE COMPLETE FIX (lastName eklendi)
    if (
      (firstName || name) &&
      lastName &&
      birthDate &&
      zodiac
    ) {
      updateData.profileCompleted = true;
    }

    await userRef.update(updateData);

    return res.json({ success: true });
  } catch (e) {
    console.error("UPDATE ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;