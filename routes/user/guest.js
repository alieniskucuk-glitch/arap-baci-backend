const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

router.post("/start", async (req, res) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "TOKEN_MISSING",
        message: "Token bulunamadı",
      });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    const uid = decoded.uid;
    const provider =
      decoded.firebase && decoded.firebase.sign_in_provider
        ? decoded.firebase.sign_in_provider
        : "";

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: "UID_MISSING",
        message: "Kullanıcı doğrulanamadı",
      });
    }

    if (provider !== "anonymous") {
      return res.status(403).json({
        success: false,
        error: "NOT_GUEST",
        message: "Bu işlem sadece misafir kullanıcı içindir",
      });
    }

    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);

    let responseData = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      const now = admin.firestore.FieldValue.serverTimestamp();

      if (!snap.exists) {
        tx.set(userRef, {
          uid,
          isGuest: true,
          abCoin: 5,
          dailyCoin: 0,
          profileCompleted: true,
          guestBonusGiven: true,
          createdAt: now,
          updatedAt: now,
        });

        responseData = {
          isGuest: true,
          abCoin: 5,
          dailyCoin: 0,
          profileCompleted: true,
          bonusGivenNow: true,
        };

        return;
      }

      const data = snap.data() || {};
      const guestBonusGiven = data.guestBonusGiven === true;

      if (guestBonusGiven) {
        tx.set(
          userRef,
          {
            isGuest: true,
            profileCompleted: true,
            updatedAt: now,
          },
          {
            merge: true,
          },
        );

        responseData = {
          isGuest: true,
          abCoin: Number(data.abCoin || 0),
          dailyCoin: Number(data.dailyCoin || 0),
          profileCompleted: true,
          bonusGivenNow: false,
        };

        return;
      }

      tx.set(
        userRef,
        {
          uid,
          isGuest: true,
          abCoin: 5,
          dailyCoin: 0,
          profileCompleted: true,
          guestBonusGiven: true,
          updatedAt: now,
        },
        {
          merge: true,
        },
      );

      responseData = {
        isGuest: true,
        abCoin: 5,
        dailyCoin: 0,
        profileCompleted: true,
        bonusGivenNow: true,
      };
    });

    return res.status(200).json({
      success: true,
      user: responseData,
    });
  } catch (error) {
    console.error("GUEST_START_ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "GUEST_START_FAILED",
      message: "Misafir girişi başlatılamadı",
    });
  }
});

module.exports = router;