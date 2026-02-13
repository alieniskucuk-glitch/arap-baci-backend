import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import falRoutes from "./routes/fal.js";
import horoscopeRoutes from "./routes/horoscope.js";

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
   ROUTES
========================= */
app.use("/fal", falRoutes);
app.use("/daily-horoscope", horoscopeRoutes);

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
