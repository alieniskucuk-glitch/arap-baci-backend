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
   POST /user/fullcreat
========================= */

router.post("/fullcreat", auth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || null;

    if (!uid) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const name = String(req.body?.name || "").trim();
    const lastname = String(req.body?.lastname || "").trim();
    const birthDate = String(req.body?.birthDate || "").trim();
    const gender = String(req.body?.gender || "").trim(); // ✅ FIX

    if (!name || !lastname || !birthDate) {
      return res.status(400).json({
        error: "name, lastname, birthDate zorunlu",
      });
    }

    const zodiac = getZodiacSign(birthDate);

    if (!zodiac) {
      return res.status(400).json({
        error: "Geçersiz birthDate formatı (YYYY-MM-DD)",
      });
    }

    const fullName = `${name} ${lastname}`.trim();

    const userRef = db.collection("users").doc(uid);

    let created = false;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (snap.exists) {
        return;
      }

      tx.set(userRef, {
        uid,
        email,

        // coin
        abCoin: 10,
        dailyCoin: 0,

        // flags
        isPremium: false,
        profileCompleted: true,

        // profile
        name,
        lastname,
        fullName,
        birthDate,
        gender, // ✅ FIX
        zodiac,

        // timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      created = true;
    });

    return res.json({
      success: true,
      created,
    });

  } catch (err) {
    console.error("FULL CREAT ERROR:", err);
    return res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;