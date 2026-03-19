import express from "express";
import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   ZODIAC
========================= */

function getZodiacSign(birthDate) {
  if (!birthDate) return null;

  const [y, m, d] = birthDate.split("-").map(Number);

  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return "Koç";
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return "Boğa";
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return "İkizler";
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return "Yengeç";
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return "Aslan";
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return "Başak";
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return "Terazi";
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return "Akrep";
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return "Yay";
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return "Oğlak";
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return "Kova";
  if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) return "Balık";

  return null;
}

/* =========================
   POST /user/edit
========================= */

router.post("/edit", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const {
      name,
      lastname,
      birthDate,
      email,
      password,
    } = req.body || {};

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const updateData = {};

    /* ========= NAME ========= */
    if (name) updateData.name = String(name).trim();
    if (lastname) updateData.lastname = String(lastname).trim();

    if (name || lastname) {
      const n = updateData.name || snap.data().name || "";
      const l = updateData.lastname || snap.data().lastname || "";
      updateData.fullName = `${n} ${l}`.trim();
    }

    /* ========= BIRTHDATE ========= */
    if (birthDate) {
      const zodiac = getZodiacSign(birthDate);

      if (!zodiac) {
        return res.status(400).json({ error: "Geçersiz birthDate" });
      }

      updateData.birthDate = birthDate;
      updateData.zodiac = zodiac;
    }

    /* ========= EMAIL ========= */
    if (email) {
      await admin.auth().updateUser(uid, {
        email: String(email).trim(),
      });

      updateData.email = String(email).trim();
    }

    /* ========= PASSWORD ========= */
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({
          error: "Şifre en az 6 karakter olmalı",
        });
      }

      await admin.auth().updateUser(uid, {
        password: String(password),
      });
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await userRef.update(updateData);

    return res.json({
      success: true,
      data: updateData,
    });
  } catch (err) {
    console.error("EDIT ERROR:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;