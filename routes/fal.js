import express from "express";
import multer from "multer";
import crypto from "crypto";

import {
  generateFal,
  generateFalPrediction,
  generateFalInsights,
} from "../services/falService.js";

import auth from "../middleware/auth.js";
import coinCheck from "../middleware/coinCheck.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { admin, db } from "../config/firebase.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =========================
   STORE
========================= */

const falStore = new Map();

function safeDiagnosticCode(error) {
  return String(
    error?.code ||
    error?.status ||
    error?.name ||
    "UNKNOWN"
  );
}

// This collection is written only by the backend and has no client endpoint.
// It contains no fortune text, user identifier, question/options or raw AI
// response; its sole purpose is to trace an analysis outcome by falId.
async function recordPollAnalysisTrace(falId, analysis) {
  try {
    await db.collection("fortunePollAnalysis").doc(falId).set({
      falId,
      status: analysis.status,
      hasDilemma: analysis.hasDilemma === true,
      dilemmaState: analysis.dilemmaState || null,
      errorCode: analysis.errorCode || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("FORTUNE_POLL_ANALYSIS_TRACE_ERROR", {
      falId,
      errorName: error?.name || "UnknownError",
      errorCode: safeDiagnosticCode(error),
    });
  }
}

/* =========================
   START (TEK AKIŞ)
========================= */

router.post(
  "/start",
  auth,
  upload.array("images", 5),
  coinCheck("FAL"),
  async (req, res) => {
    const id = crypto.randomUUID();

    try {
      if (!req.files?.length) {
        return res.status(400).json({
          error: "Fotoğraf gerekli"
        });
      }

      const uid = req.user.uid;
      const price = req.coinPrice;

      falStore.set(id, {
        status: "processing",
      });

      // 🔥 hemen response
      res.status(200).json({
        falId: id,
      });

      const full = await generateFal(
        req.files,
        {
          name: req.user.name,
          zodiac: req.user.zodiac,
          gender: req.user.gender,
        }
      );

      if (!full) {
        throw new Error(
          "Fal boş geldi"
        );
      }

      await decreaseCoin(
        uid,
        price,
        "FAL",
        {
          falId: id,
        }
      );

      /* =========================
         KEHANET KASASI
      ========================= */

      let prediction = null;
      let checkAfterDays = null;

      try {
        const predictionData =
          await generateFalPrediction(
            full
          );

        prediction =
          predictionData?.prediction ||
          null;

        checkAfterDays =
          predictionData
            ?.checkAfterDays ||
          null;

      } catch (
        predictionError
      ) {
        console.error(
          "FAL PREDICTION ERROR:",
          predictionError
        );
      }

      /* =========================
         SEMBOL HARİTASI
         +
         MİSTİK YIL

         Mevcut fal/prediction
         akışından bağımsız.
      ========================= */

      let insights = {
        symbols: [],
        themes: [],
        primaryTheme: null,
        dilemma: {
          hasDilemma: false,
          question: null,
          option1: null,
          option2: null,
        },
      };

      try {
        insights =
          await generateFalInsights(
            full,
            { falId: id }
          );

      } catch (
        insightsError
      ) {
        console.error("FAL_INSIGHTS_UNEXPECTED_ERROR", {
          falId: id,
          errorName: insightsError?.name || "UnknownError",
          errorCode: safeDiagnosticCode(insightsError),
        });
        insights.pollAnalysis = {
          status: "ANALYSIS_ERROR",
          hasDilemma: false,
          dilemmaState: "ERROR",
          errorCode: safeDiagnosticCode(insightsError),
        };
      }

      // Anket taslağı, istemcinin değiştiremeyeceği özel backend kaydıdır.
      // Fal metni burada saklanmaz veya herkese açık bir veriye taşınmaz.
      if (insights?.dilemma?.hasDilemma === true) {
        try {
          await db.collection("fortunePollDrafts").doc(id).set({
            ownerUid: uid,
            falId: id,
            question: insights.dilemma.question,
            option1: insights.dilemma.option1,
            option2: insights.dilemma.option2,
            status: "available",
            createdAt: new Date(),
          });
          await recordPollAnalysisTrace(id, {
            status: "DRAFT_CREATED",
            hasDilemma: true,
            dilemmaState: insights.pollAnalysis?.dilemmaState,
          });
        } catch (draftError) {
          const errorCode = safeDiagnosticCode(draftError);
          await recordPollAnalysisTrace(id, {
            status: "DRAFT_WRITE_FAILED",
            hasDilemma: true,
            dilemmaState: insights.pollAnalysis?.dilemmaState,
            errorCode,
          });
          console.error("FORTUNE_POLL_DRAFT_WRITE_ERROR", {
            falId: id,
            errorName: draftError?.name || "UnknownError",
            errorCode,
          });
          throw draftError;
        }
      } else {
        await recordPollAnalysisTrace(
          id,
          insights?.pollAnalysis || {
            status: "ANALYSIS_COMPLETE",
            hasDilemma: false,
            dilemmaState: "NO_ELIGIBLE_TOPIC",
          }
        );
      }

      /* =========================
         STORE RESULT
      ========================= */

      falStore.set(id, {
        status: "done",

        full,

        prediction,

        checkAfterDays,

        symbols:
          insights?.symbols || [],

        themes:
          insights?.themes || [],

        primaryTheme:
          insights?.primaryTheme ||
          null,

        dilemma:
          insights?.dilemma || {
            hasDilemma: false,
            question: null,
            option1: null,
            option2: null,
          },
      });

    } catch (err) {
      console.error(
        "FAL ERROR:",
        err
      );

      falStore.set(id, {
        status: "error",
      });
    }
  }
);

/* =========================
   POLLING
========================= */

router.get(
  "/:id",
  (req, res) => {
    const f =
      falStore.get(
        req.params.id
      );

    if (!f) {
      return res
        .status(404)
        .json({
          error:
            "Bulunamadı",
        });
    }

    res.json(f);
  }
);

export default router;
