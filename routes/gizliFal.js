import express from "express";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";

import {
  createSecretFortune,
  joinSecretFortune,
  submitSecretSelection,
  getSecretFortuneStatus,
} from "../services/gizliFalService.js";

const router = express.Router();

/* =========================
   CREATE
========================= */

router.post(
  "/create",
  auth,
  coinCheck("GIZLI_FAL"),
  async (req, res) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: "Token gerekli",
        });
      }

      const data =
        await createSecretFortune(
          uid,
          {
            coinPrice:
              req.coinPrice,

            user: {
              name:
                req.user.name,

              zodiac:
                req.user.zodiac,

              gender:
                req.user.gender,
            },
          }
        );

      return res
        .status(200)
        .json(data);

    } catch (err) {
      console.error(
        "GIZLI FAL CREATE ERROR:",
        err
      );

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Gizli Fal oluşturulamadı",
        });
    }
  }
);

/* =========================
   JOIN
========================= */

router.post(
  "/join",
  auth,
  async (req, res) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: "Token gerekli",
        });
      }

      const data =
        await joinSecretFortune(
          uid,
          {
            code:
              req.body?.code,

            user: {
              name:
                req.user.name,

              zodiac:
                req.user.zodiac,

              gender:
                req.user.gender,
            },
          }
        );

      return res
        .status(200)
        .json(data);

    } catch (err) {
      console.error(
        "GIZLI FAL JOIN ERROR:",
        err
      );

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Gizli Fal davetine katılınamadı",
        });
    }
  }
);

/* =========================
   SELECT
========================= */

router.post(
  "/select",
  auth,
  async (req, res) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: "Token gerekli",
        });
      }

      const data =
        await submitSecretSelection(
          uid,
          {
            sessionId:
              req.body?.sessionId,

            selection:
              req.body?.selection,
          }
        );

      return res
        .status(200)
        .json(data);

    } catch (err) {
      console.error(
        "GIZLI FAL SELECT ERROR:",
        err
      );

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Gizli seçim kaydedilemedi",
        });
    }
  }
);

/* =========================
   STATUS
========================= */

router.get(
  "/:sessionId",
  auth,
  async (req, res) => {
    try {
      const uid =
        req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: "Token gerekli",
        });
      }

      const data =
        await getSecretFortuneStatus(
          uid,
          req.params.sessionId
        );

      return res
        .status(200)
        .json(data);

    } catch (err) {
      console.error(
        "GIZLI FAL STATUS ERROR:",
        err
      );

      return res
        .status(400)
        .json({
          error:
            err.message ||
            "Gizli Fal durumu alınamadı",
        });
    }
  }
);

export default router;