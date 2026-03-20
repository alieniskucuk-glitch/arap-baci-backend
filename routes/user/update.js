import express from "express";
import auth from "../../middleware/auth.js";
import { db, admin } from "../../config/firebase.js";

const router = express.Router();

/* =========================
   ZODIAC HELPER
========================= */

function getZodiacSign(birthDate) {
  if (!birthDate || typeof birthDate !== "string") return null;

  const parts = birthDate.split("-");
  if (parts.length !== 3) return null;

  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Koç";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Boğa";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "İkizler";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Yengeç";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Aslan";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Başak";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Terazi";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Akrep";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Yay";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Oğlak";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Kova";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Balık";

  return null;
}

/* =========================
   SAFE STRING
========================= */

function clean(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

/* =========================
   POST /user/update
========================= */

router.post("/update", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const name = clean(req.body?.name);
    const lastname = clean(req.body?.lastname);
    const birthDate = clean(req.body?.birthDate);
    const gender = clean(req.body?.gender);
    const email = clean(req.body?.email);

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const current = snap.data() || {};

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    /* ========= NAME ========= */

    if (name) updateData.name = name;
    if (lastname) updateData.lastname = lastname;

    if (name || lastname) {
      const finalName = name || current.name || "";
      const finalLast = lastname || current.lastname || "";
      updateData.fullName = `${finalName} ${finalLast}`.trim();
    }

    /* ========= BIRTHDATE ========= */

    if (birthDate) {
      const zodiac = getZodiacSign(birthDate);

      if (!zodiac) {
        return res.status(400).json({
          error: "Geçersiz birthDate formatı (YYYY-MM-DD)",
        });
      }

      updateData.birthDate = birthDate;
      updateData.zodiac = zodiac;
    }

    /* ========= OTHER ========= */

    if (gender) updateData.gender = gender;
    if (email) updateData.email = email;

    /* ========= PROFILE CHECK ========= */

    const finalProfile = {
      name: name || current.name,
      lastname: lastname || current.lastname,
      gender: gender || current.gender,
      birthDate: birthDate || current.birthDate,
    };

    const isComplete =
      !!finalProfile.name &&
      !!finalProfile.lastname &&
      !!finalProfile.gender &&
      !!finalProfile.birthDate;

    if (isComplete) {
      updateData.profileCompleted = true;
    }

    await userRef.update(updateData);

    return res.json({
      success: true,
      profileCompleted: isComplete,
    });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;