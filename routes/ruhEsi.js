import express from "express";
import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { ruhEsi } from "../services/ruhEsiService.js";

const router = express.Router();

router.post("/", auth, coinCheck("UYUM"), ruhEsi);

export default router;
