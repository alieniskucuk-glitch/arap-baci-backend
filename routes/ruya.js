import express from "express";
import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { ruyaYorumla } from "../services/ruyaService.js";

const router = express.Router();

router.post(
  "/",
  auth,
  coinCheck("RUYA"),
  ruyaYorumla
);

export default router;
