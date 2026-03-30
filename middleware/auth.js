import { admin, db } from "../config/firebase.js";

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    // 🔥 DAHA SAĞLAM PARSE
    const idToken = authHeader.replace("Bearer ", "").trim();

    if (!idToken) {
      return res.status(401).json({ error: "Token boş" });
    }

    /* =========================
       TOKEN VERIFY (REVOKED CHECK)
    ========================= */

    const decoded = await admin.auth().verifyIdToken(idToken, true);

    const uid = decoded.uid;
    const email = decoded.email || null;

    /* =========================
       USER DOC
    ========================= */

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    const userData = userDoc.exists ? userDoc.data() : {};

    /* =========================
       SAFE DEFAULTS
    ========================= */

    req.user = {
      uid,
      email,

      exists: userDoc.exists,

      name: typeof userData?.name === "string" ? userData.name : "",
      zodiac:
        typeof userData?.zodiac === "string" ? userData.zodiac : null,

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
    });
  }
}