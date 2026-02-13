import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import falRoutes from "./routes/fal.js";
import elFalRoutes from "./routes/elFal.js";

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
app.use("/el-fali", elFalRoutes);

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
