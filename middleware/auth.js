import { admin } from "../config/firebase.js";

export default async function auth(req, res, next) {
  try {
    console.log("AUTH HEADER:", req.headers.authorization);

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      console.log("TOKEN FORMAT HATALI");
      return res.status(401).json({ error: "Token gerekli" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    console.log("TOKEN LENGTH:", idToken?.length);

    const decoded = await admin.auth().verifyIdToken(idToken);

    console.log("TOKEN VERIFIED UID:", decoded.uid);

    req.user = { uid: decoded.uid };
    next();

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return res.status(401).json({ 
      error: "Geçersiz token",
      detail: err.message 
    });
  }
}
