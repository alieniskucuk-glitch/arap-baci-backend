import express from "express";

import auth from "../middleware/auth.js";

import {
  getSymbolAnalytics,
  getMysticYearAnalytics,
  interpretMysticYear,
  getMysticMonthAnalytics,
  interpretMysticMonth,
} from "../services/symbolAnalyticsService.js";

const router =
  express.Router();

/* =========================
   ERROR RESPONSE
========================= */

function errorResponse(
  res,
  error,
  fallbackMessage
) {
  console.error(
    "SYMBOL ANALYTICS ERROR:",
    error
  );

  const statusCode =
    Number.isInteger(
      error?.statusCode
    ) &&
    error.statusCode >= 400
      ? error.statusCode
      : 500;

  return res
    .status(
      statusCode
    )
    .json({
      success:
        false,

      error:
        error?.message ||
        fallbackMessage,

      code:
        error?.code ||
        "SYMBOL_ANALYTICS_ERROR",
    });
}

/* =========================
   SYMBOL MAP
   GET /symbol-analytics/summary
========================= */

router.get(
  "/summary",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const uid =
        req.user?.uid;

      const result =
        await getSymbolAnalytics(
          uid
        );

      return res.json(
        result
      );
    } catch (
      error
    ) {
      return errorResponse(
        res,
        error,
        "Sembol Haritası alınamadı"
      );
    }
  }
);

/* =========================
   MYSTIC YEAR STATS
   GET /symbol-analytics/year?year=2026
========================= */

router.get(
  "/year",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const uid =
        req.user?.uid;

      const result =
        await getMysticYearAnalytics(
          uid,
          req.query?.year
        );

      return res.json(
        result
      );
    } catch (
      error
    ) {
      return errorResponse(
        res,
        error,
        "Mistik Yılım verileri alınamadı"
      );
    }
  }
);

/* =========================
   MYSTIC YEAR INTERPRET
   POST /symbol-analytics/year/interpret

   BODY:
   {
     "year": 2026
   }

   İlk üretim = 2 coin
   Cache varsa tekrar coin yok
========================= */

router.post(
  "/year/interpret",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const uid =
        req.user?.uid;

      const result =
        await interpretMysticYear(
          uid,
          req.body?.year
        );

      return res.json(
        result
      );
    } catch (
      error
    ) {
      return errorResponse(
        res,
        error,
        "Mistik Yılım yorumu oluşturulamadı"
      );
    }
  }
);

/* =========================
   MYSTIC MONTH STATS
   GET /symbol-analytics/month?year=2026&month=9
========================= */

router.get(
  "/month",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const uid =
        req.user?.uid;

      const result =
        await getMysticMonthAnalytics(
          uid,
          req.query?.year,
          req.query?.month
        );

      return res.json(
        result
      );
    } catch (
      error
    ) {
      return errorResponse(
        res,
        error,
        "Mistik Ayım verileri alınamadı"
      );
    }
  }
);

/* =========================
   MYSTIC MONTH INTERPRET
   POST /symbol-analytics/month/interpret

   BODY:
   {
     "year": 2026,
     "month": 9
   }

   İlk üretim = 2 coin
   Cache varsa tekrar coin yok
========================= */

router.post(
  "/month/interpret",

  auth,

  async (
    req,
    res
  ) => {
    try {
      const uid =
        req.user?.uid;

      const result =
        await interpretMysticMonth(
          uid,
          req.body?.year,
          req.body?.month
        );

      return res.json(
        result
      );
    } catch (
      error
    ) {
      return errorResponse(
        res,
        error,
        "Mistik Ayım yorumu oluşturulamadı"
      );
    }
  }
);

export default router;
