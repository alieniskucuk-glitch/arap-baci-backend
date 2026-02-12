import express from "express";
import cors from "cors";
import falRoutes from "./routes/fal.js";
import horoscopeRoutes from "./routes/horoscope.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/", (_, res) => {
  res.send("🔮 Arap Bacı Backend OK");
});

app.use("/fal", falRoutes);
app.use("/daily-horoscope", horoscopeRoutes);

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("🔮 Arap Bacı backend çalışıyor:", PORT);
});
