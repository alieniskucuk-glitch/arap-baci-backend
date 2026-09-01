import { PRICING } from "../utils/pricing.js";
import { db } from "../config/firebase.js";

export default function coinCheck(type) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return res.status(401).json({
          error: "Token gerekli"
        });
      }

      let price = null;

      /* =========================
         FİYAT HESAPLAMA
      ========================= */

      if (
        [
          "FAL",
          "RUYA",
          "EL_FALI",
          "GIZLI_FAL",
          "MISTIK_YIL"
        ].includes(type)
      ) {
        price = PRICING[type];
      }

      else if (type === "TAROT") {
        const config = PRICING.TAROT;
        const mode =
          String(
            req.body?.mode || ""
          ).toLowerCase();

        if (
          ![
            "one",
            "two",
            "three",
            "