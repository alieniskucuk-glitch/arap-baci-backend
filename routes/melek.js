import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import {
  startMelek,
  revealMelek
} from "../services/melekService.js";

const router = express.Router();

/* =========================
   POST /melek/start
   - Sadece kontrol
========================= */

router.post(
  "/start",

  auth,

  coinCheck("MELEK"),

  async (req, res) => {
    try {

      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401)
          .json({
            error:
              "Token gerekli"
          });
      }

      const result =
        await startMelek(
          uid,
          {
            ...req.body,

            coinPrice:
              req.coinPrice,

            user: {
              name:
                req.user.name,

              zodiac:
                req.user.zodiac,

              gender:
                req.user.gender,
            }
          }
        );

      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "MELEK START ERROR:",
        err
      );

      return res.status(400)
        .json({
          error:
            err.message ||
            "Start hata",
        });
    }
  }
);

/* =========================
   POST /melek/reveal
   - Coin burada düşecek
========================= */

router.post(
  "/reveal",

  auth,

  async (req, res) => {
    try {

      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401)
          .json({
            error:
              "Token gerekli"
          });
      }

      const result =
        await revealMelek(
          uid,

          {
            ...req.body,

            user: {
              name:
                req.user.name,

              zodiac:
                req.user.zodiac,

              gender:
                req.user.gender,
            }
          }
        );

      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "MELEK REVEAL ERROR:",
        err
      );

      return res.status(400)
        .json({
          error:
            err.message ||
            "Reveal hata",
        });
    }
  }
);

export default router;