import { admin } from "../config/firebase.js";

export default async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token gerekli" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Geçersiz token" });
  }
}
