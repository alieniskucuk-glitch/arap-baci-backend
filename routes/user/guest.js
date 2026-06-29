import express from "express";
import admin from "firebase-admin";

const router = express.Router();

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

function cleanGuestDeviceId(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);
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

    const guestDeviceId = cleanGuestDeviceId(req.body?.guestDeviceId);

    if (!guestDeviceId) {
      return res.status(400).json({
        success: false,
        error: "GUEST_DEVICE_ID_MISSING",
        message: "Misafir cihaz bilgisi bulunamadı",
      });
    }

    const db = admin.firestore();

    const userRef = db.collection("users").doc(uid);
    const guestDeviceRef = db.collection("guest_devices").doc(guestDeviceId);

    let responseData = null;

    await db.runTransaction(async (tx) => {
      const now = admin.firestore.FieldValue.serverTimestamp();

      const userSnap = await tx.get(userRef);
      const guestDeviceSnap = await tx.get(guestDeviceRef);

      if (!guestDeviceSnap.exists) {
        tx.set(userRef, {
          uid,
          isGuest: true,
          guestDeviceId,
          abCoin: 5,
          dailyCoin: 0,
          profileCompleted: true,
          guestBonusGiven: true,
          createdAt: now,
          updatedAt: now,
        });

        tx.set(guestDeviceRef, {
          guestDeviceId,
          uid,
          firstUid: uid,
          bonusGiven: true,
          abCoin: 5,
          dailyCoin: 0,
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

      const guestDeviceData = guestDeviceSnap.data() || {};
      const previousUid = String(
        guestDeviceData.uid || guestDeviceData.firstUid || ""
      );

      let previousUserSnap = null;

      if (previousUid && previousUid !== uid) {
        previousUserSnap = await tx.get(
          db.collection("users").doc(previousUid)
        );
      }

      const currentData = userSnap.exists ? userSnap.data() || {} : {};
      const previousData =
        previousUserSnap && previousUserSnap.exists
          ? previousUserSnap.data() || {}
          : {};

      const sourceData = userSnap.exists ? currentData : previousData;

      const currentAbCoin = Number(sourceData.abCoin || 0);
      const currentDailyCoin = Number(sourceData.dailyCoin || 0);

      const safeAbCoin = Number.isFinite(currentAbCoin) ? currentAbCoin : 0;
      const safeDailyCoin = Number.isFinite(currentDailyCoin)
        ? currentDailyCoin
        : 0;

      const userPayload = {
        uid,
        isGuest: true,
        guestDeviceId,
        abCoin: safeAbCoin,
        dailyCoin: safeDailyCoin,
        profileCompleted: true,
        guestBonusGiven: true,
        updatedAt: now,
      };

      if (!userSnap.exists) {
        userPayload.createdAt = now;
      }

      tx.set(userRef, userPayload, {
        merge: true,
      });

      tx.set(
        guestDeviceRef,
        {
          guestDeviceId,
          uid,
          bonusGiven: true,
          abCoin: safeAbCoin,
          dailyCoin: safeDailyCoin,
          updatedAt: now,
        },
        {
          merge: true,
        }
      );

      responseData = {
        isGuest: true,
        abCoin: safeAbCoin,
        dailyCoin: safeDailyCoin,
        profileCompleted: true,
        bonusGivenNow: false,
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

export default router;