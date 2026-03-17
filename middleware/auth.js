import { admin, db } from "../config/firebase.js";

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const idToken = authHeader.replace("Bearer ", "");

    const decoded = await admin.auth().verifyIdToken(idToken);

    const uid = decoded.uid;

    /* =========================
       FIRESTORE USER
    ========================= */

    const userRef = db.collection("users").doc(uid);
    let userDoc = await userRef.get();

    // 🔥 USER YOKSA OLUŞTUR (BACKEND REGISTER LOGIC)
    if (!userDoc.exists) {
      const newUser = {
        uid,
        name: decoded.name || "",
        email: decoded.email || "",
        abCoin: 0,
        dailyCoin: 0,
        isPremium: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);

      userDoc = { exists: true, data: () => newUser };
    }

    const userData = userDoc.data();

    req.user = {
      uid,
      name: userData?.name ?? "",
      zodiac: userData?.zodiac ?? "",
      isPremium: userData?.isPremium === true,
      dailyCoin:
        typeof userData?.dailyCoin === "number" ? userData.dailyCoin : 0,
      abCoin: typeof userData?.abCoin === "number" ? userData.abCoin : 0,
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