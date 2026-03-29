import { admin, db } from "../config/firebase.js";

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const idToken = authHeader.replace("Bearer ", "");

    // 🔥 HARD VERIFY (revoked check)
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    const uid = decoded.uid;

    /* =========================
       FIRESTORE USER
    ========================= */

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    const userData = userDoc.exists ? userDoc.data() : null;

    req.user = {
      uid,
      exists: userDoc.exists,
      name: userData?.name ?? "",
      zodiac: userData?.zodiac ?? null,
      isPremium: userData?.isPremium === true,
      dailyCoin:
        typeof userData?.dailyCoin === "number" ? userData.dailyCoin : 0,
      abCoin:
        typeof userData?.abCoin === "number" ? userData.abCoin : 0,
    };

    next();
  } catch (err) {
    console.error("VERIFY ERROR:", err);

    return res.status(401).json({
      error: "Geçersiz token",
      detail: err.message,
    });
  }
}