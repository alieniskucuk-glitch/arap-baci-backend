import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import auth from "./middleware/auth.js";
import dailyReset from "./middleware/dailyReset.js";

import tarotRoutes from "./routes/tarot.js";
import falRoutes from "./routes/fal.js";
import horoscopeRoutes from "./routes/horoscope.js";
import elFalRoutes from "./routes/elFal.js";
import ruyaRoutes from "./routes/ruya.js";
import ruhEsiRoutes from "./routes/ruhEsi.js";
import melekRoutes from "./routes/melek.js";
import userRoutes from "./routes/user.js";

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

app.get("/ping", (_, res) => {
  res.status(200).json({ ok: true });
});

/* =========================
   ROUTES
========================= */

// 🔐 Sadece coin harcayan modüller korunuyor
app.use("/fal", auth, dailyReset, falRoutes);
app.use("/el-fali", auth, dailyReset, elFalRoutes);
app.use("/ruya", auth, dailyReset, ruyaRoutes);
app.use("/ruh-esi", auth, dailyReset, ruhEsiRoutes);
app.use("/melek", auth, dailyReset, melekRoutes);
app.use("/tarot", auth, dailyReset, tarotRoutes);
app.use("/user", auth, dailyReset, userRoutes);

// 🌙 İstersen bunu public bırak
app.use("/daily-horoscope", horoscopeRoutes);

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});