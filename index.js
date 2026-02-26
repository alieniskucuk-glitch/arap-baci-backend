import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import tarotRoutes from "./routes/tarot.js";
import falRoutes from "./routes/fal.js";
import horoscopeRoutes from "./routes/horoscope.js";
import elFalRoutes from "./routes/elFal.js"; // ✅ EKLENDİ
import ruyaRoutes from "./routes/ruya.js";
import ruhEsiRoutes from "./routes/ruhEsi.js";
import melekRoutes from "./routes/melek.js";   // 👈 EKLENDİ

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "5mb" }));

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

/* =========================
   WARMUP PING (COLD START FIX)
========================= */
app.get("/ping", (_, res) => {
  res.status(200).json({ ok: true });
});

/* =========================
   ROUTES
========================= */
app.use("/fal", falRoutes);
app.use("/daily-horoscope", horoscopeRoutes);
app.use("/el-fali", elFalRoutes); // ✅ EKLENDİ
app.use("/ruya", ruyaRoutes);
app.use("/ruh-esi", ruhEsiRoutes);
app.use("/melek", melekRoutes);   // 👈 EKLENDİ
app.use("/tarot", tarotRoutes);

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);

  // DEBUG (geçici kontrol için)
  console.log("ENV CHECK:");
  console.log("OPENAI:", !!process.env.OPENAI_API_KEY);
  console.log("FIREBASE_PROJECT_ID:", !!process.env.FIREBASE_PROJECT_ID);
  console.log("FIREBASE_CLIENT_EMAIL:", !!process.env.FIREBASE_CLIENT_EMAIL);
  console.log("FIREBASE_PRIVATE_KEY:", !!process.env.FIREBASE_PRIVATE_KEY);
});
