import express from "express";
import multer from "multer";
import { elFal } from "../services/elFalService.js";
import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/",
  auth,
  coinCheck("EL_FALI"),
  upload.single("image"),
  elFal
);

export default router;
