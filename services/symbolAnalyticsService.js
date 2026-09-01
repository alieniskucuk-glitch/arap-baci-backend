import crypto from "crypto";

import openai from "../config/openai.js";
import { db, admin } from "../config/firebase.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { PRICING } from "../utils/pricing.js";

const configuredMysticYearCost =
  Number(
    PRICING?.MISTIK_YIL
  );

const MYSTIC_YEAR_COST =
  Number.isFinite(
    configuredMysticYearCost
  ) &&
  configuredMysticYearCost > 0
    ? configuredMysticYearCost
    : 2;

const MYSTIC_YEAR_COLLECTION =
  "mysticYears";

const LOCK_TTL_MS =
  5 * 60 * 1000;

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/* =========================
   ERROR
========================= */

class ServiceError extends Error {
  constructor(
    message,
    statusCode = 400,
    code = "BAD_REQUEST"
  ) {
    super(message);

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}

/* =========================
   BASIC HELPERS
========================= */

const text = (value) =>
  String(
    value ?? ""
  ).trim();

const userRef = (uid) =>
  db
    .collection("users")
    .doc(uid);

const historyRef = (uid) =>
  userRef(uid)
    .collection("history");

const yearRef = (
  uid,
  year
) =>
  userRef(uid)
    .collection(
      MYSTIC_YEAR_COLLECTION
    )
    .doc(
      String(year)
    );

/* =========================
   NORMALIZE ID
========================= */

function slug(value) {
  return text(value)
    .replace(
      /[Çç]/g,
      "c"
    )
    .replace(
      /[Ğğ]/g,
      "g"
    )
    .replace(
      /[İIıi]/g,
      "i"
    )
    .replace(
      /[Öö]/g,
      "o"
    )
    .replace(
      /[Şş]/g,
      "s"
    )
    .replace(
      /[Üü]/g,
      "u"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}

/* =========================
   DATE
========================= */

function asDate(value) {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  if (
    typeof value?.toDate ===
    "function"
  ) {
    return value.toDate();
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function recordDate(
  data = {}
) {
  const candidates = [
    data.createdAt,
    data.createdAtServer,
    data.completedAt,
    data.completedAtServer,
    data.createdAtMs,
    data.completedAtMs,
  ];

  for (
    const value
    of candidates
  ) {
    const date =
      asDate(value);

    if (date) {
      return date;
    }
  }

  return null;
}

function istanbulParts(
  date
) {
  if (!date) {
    return null;
  }

  const raw =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/Istanbul",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const parts =
    Object.fromEntries(
      raw
        .filter(
          (item) =>
            item.type !==
            "literal"
        )
        .map(
          (item) => [
            item.type,
            item.value,
          ]
        )
    );

  return {
    year:
      Number(
        parts.year
      ),

    month:
      Number(
        parts.month
      ),

    day:
      Number(
        parts.day
      ),
  };
}

function parseYear(
  value
) {
  const currentYear =
    istanbulParts(
      new Date()
    )?.year ??
    new Date()
      .getFullYear();

  const year =
    Number(
      value ??
      currentYear
    );

  if (
    !Number.isInteger(
      year
    ) ||
    year < 2000 ||
    year > currentYear
  ) {
    throw new ServiceError(
      "Geçersiz yıl",
      400,
      "INVALID_YEAR"
    );
  }

  return year;
}

/* =========================
   HISTORY VALIDATION
========================= */

function validHistory(
  data = {}
) {
  const status =
    text(
      data.status
    ).toLowerCase();

  const invalidStatuses = [
    "processing",
    "started",
    "expired",
    "error",
    "failed",
  ];

  return !invalidStatuses
    .includes(
      status
    );
}

/* =========================
   FORTUNE TYPE
========================= */

function fortuneType(
  data = {}
) {
  const raw =
    text(
      data.type ??
      data.fortuneType
    ).toLowerCase();

  const aliases = {
    fal:
      "kahve",

    coffee:
      "kahve",

    dream:
      "ruya",

    ruya_yorumu:
      "ruya",

    el:
      "el_fali",

    elfal:
      "el_fali",

    palm:
      "el_fali",

    uyum:
      "ruh_esi",

    ruhesi:
      "ruh_esi",

    secret_fortune:
      "gizli_fal",
  };

  return (
    (
      aliases[raw] ??
      raw
    ) ||
    "diger"
  );
}

/* =========================
   SYMBOLS
========================= */

function symbolsOf(
  data = {}
) {
  const values = [
    ...(
      Array.isArray(
        data.symbols
      )
        ? data.symbols
        : []
    ),

    data.sharedSymbol,

    data
      .secretFortuneResult
      ?.sharedSymbol,
  ].filter(Boolean);

  const result = [];

  const seen =
    new Set();

  for (
    const value
    of values
  ) {
    const name =
      typeof value ===
      "string"
        ? text(value)
        : text(
            value?.name ??
            value?.title ??
            value?.symbol ??
            value?.label
          );

    const id =
      slug(
        typeof value ===
        "object"
          ? value?.id ??
            name
          : name
      );

    if (
      !id ||
      !name ||
      seen.has(id)
    ) {
      continue;
    }

    seen.add(id);

    result.push({
      id,

      name,

      meaning:
        typeof value ===
        "object"
          ? text(
              value?.meaning ??
              value?.message ??
              value?.description
            )
          : "",
    });
  }

  return result;
}

/* =========================
   THEMES
========================= */

function themesOf(
  data = {}
) {
  const values = [
    ...(
      Array.isArray(
        data.themes
      )
        ? data.themes
        : []
    ),

    data.primaryTheme,

    data.sharedTheme,

    data
      .secretFortuneResult
      ?.sharedTheme,
  ].filter(Boolean);

  const result = [];

  const seen =
    new Set();

  for (
    const value
    of values
  ) {
    const name =
      typeof value ===
      "object"
        ? text(
            value?.name ??
            value?.title ??
            value?.label
          )
        : text(value);

    const id =
      slug(name);

    if (
      !id ||
      seen.has(id)
    ) {
      continue;
    }

    seen.add(id);

    result.push({
      id,
      name,
    });
  }

  return result;
}

/* =========================
   TAROT CARD
========================= */

function cardOf(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const rawId =
    typeof value ===
    "object"
      ? value?.id ??
        value?.cardId ??
        value?.tarotId
      : value;

  const numeric =
    /^\d+$/.test(
      text(rawId)
    )
      ? Number(rawId)
      : null;

  if (
    numeric !== null
  ) {
    try {
      const card =
        getTarotById(
          numeric
        );

      if (card) {
        return {
          id:
            String(
              card.id ??
              numeric
            ),

          name:
            text(
              (
                typeof value ===
                "object"
                  ? value?.title ??
                    value?.name
                  : ""
              ) ||
              card.title ||
              card.name ||
              `Kart ${numeric}`
            ),

          image:
            text(
              (
                typeof value ===
                "object"
                  ? value?.image
                  : ""
              ) ||
              card.image
            ),
        };
      }
    } catch (_) {}
  }

  const name =
    typeof value ===
    "object"
      ? text(
          value?.title ??
          value?.name ??
          value?.cardName ??
          value?.label
        )
      : text(value);

  if (!name) {
    return null;
  }

  return {
    id:
      text(rawId) ||
      slug(name),

    name,

    image:
      typeof value ===
      "object"
        ? text(
            value?.image
          )
        : "",
  };
}

/* =========================
   TAROT CARDS
========================= */

function tarotCardsOf(
  data = {}
) {
  const groups = [
    data.cards,

    data.picked,

    data.tarotCards,

    data.selectedCards,

    data.creatorCards,

    data.inviteeCards,

    data
      .secretFortuneResult
      ?.creatorCards,

    data
      .secretFortuneResult
      ?.inviteeCards,
  ];

  const result = [];

  const seen =
    new Set();

  for (
    const group
    of groups
  ) {
    const values =
      Array.isArray(
        group
      )
        ? group
        : group == null
          ? []
          : [group];

    for (
      const value
      of values
    ) {
      const card =
        cardOf(
          value
        );

      if (!card) {
        continue;
      }

      const key =
        text(
          card.id
        ) ||
        slug(
          card.name
        );

      if (
        !key ||
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push(
        card
      );
    }
  }

  return result;
}

/* =========================
   MAP HELPERS
========================= */

function mapEntry(
  map,
  key,
  create
) {
  if (
    !map.has(key)
  ) {
    map.set(
      key,
      create()
    );
  }

  return map.get(
    key
  );
}

function sorted(
  map
) {
  return [
    ...map.values(),
  ].sort(
    (
      a,
      b
    ) =>
      b.count -
        a.count ||
      text(
        a.name
      ).localeCompare(
        text(
          b.name
        ),
        "tr"
      )
  );
}

/* =========================
   AGGREGATE
========================= */

function aggregate(
  records,
  year = null
) {
  const symbolMap =
    new Map();

  const themeMap =
    new Map();

  const primaryMap =
    new Map();

  const cardMap =
    new Map();

  const typeMap =
    new Map();

  const availableYears =
    new Set();

  const months =
    MONTHS.map(
      (
        name,
        index
      ) => ({
        month:
          index + 1,

        name,

        fortuneCount:
          0,

        symbolCount:
          0,

        themeCount:
          0,

        tarotCardCount:
          0,
      })
    );

  let totalFortunes =
    0;

  let recordsWithInsights =
    0;

  let firstFortuneAt =
    null;

  let lastFortuneAt =
    null;

  for (
    const record
    of records
  ) {
    const {
      data,
      date,
    } = record;

    if (
      !validHistory(
        data
      )
    ) {
      continue;
    }

    const parts =
      date
        ? istanbulParts(
            date
          )
        : null;

    if (
      parts?.year
    ) {
      availableYears.add(
        parts.year
      );
    }

    if (
      year !== null &&
      parts?.year !== year
    ) {
      continue;
    }

    if (
      year !== null &&
      !parts
    ) {
      continue;
    }

    totalFortunes++;

    if (
      date &&
      (
        !firstFortuneAt ||
        date <
          firstFortuneAt
      )
    ) {
      firstFortuneAt =
        date;
    }

    if (
      date &&
      (
        !lastFortuneAt ||
        date >
          lastFortuneAt
      )
    ) {
      lastFortuneAt =
        date;
    }

    const type =
      fortuneType(
        data
      );

    mapEntry(
      typeMap,
      type,
      () => ({
        id: type,
        name: type,
        count: 0,
      })
    ).count++;

    const symbols =
      symbolsOf(
        data
      );

    const themes =
      themesOf(
        data
      );

    const cards =
      tarotCardsOf(
        data
      );

    const primaryTheme =
      text(
        data.primaryTheme
      );

    if (
      symbols.length ||
      themes.length ||
      cards.length ||
      primaryTheme
    ) {
      recordsWithInsights++;
    }

    /* =========================
       SYMBOL AGGREGATE
    ========================= */

    for (
      const symbol
      of symbols
    ) {
      const entry =
        mapEntry(
          symbolMap,
          symbol.id,
          () => ({
            id:
              symbol.id,

            name:
              symbol.name,

            meaning:
              symbol.meaning,

            count:
              0,

            fortuneTypes:
              new Set(),

            firstSeenAt:
              null,

            lastSeenAt:
              null,
          })
        );

      entry.count++;

      entry.name =
        symbol.name ||
        entry.name;

      if (
        symbol.meaning
      ) {
        entry.meaning =
          symbol.meaning;
      }

      entry
        .fortuneTypes
        .add(
          type
        );

      if (
        date &&
        (
          !entry.firstSeenAt ||
          date <
            entry.firstSeenAt
        )
      ) {
        entry.firstSeenAt =
          date;
      }

      if (
        date &&
        (
          !entry.lastSeenAt ||
          date >
            entry.lastSeenAt
        )
      ) {
        entry.lastSeenAt =
          date;
      }
    }

    /* =========================
       THEMES
    ========================= */

    for (
      const theme
      of themes
    ) {
      mapEntry(
        themeMap,
        theme.id,
        () => ({
          id:
            theme.id,

          name:
            theme.name,

          count:
            0,
        })
      ).count++;
    }

    /* =========================
       PRIMARY THEME
    ========================= */

    const primaryId =
      slug(
        primaryTheme
      );

    if (
      primaryId
    ) {
      mapEntry(
        primaryMap,
        primaryId,
        () => ({
          id:
            primaryId,

          name:
            primaryTheme,

          count:
            0,
        })
      ).count++;
    }

    /* =========================
       TAROT
    ========================= */

    for (
      const card
      of cards
    ) {
      const key =
        text(
          card.id
        ) ||
        slug(
          card.name
        );

      const entry =
        mapEntry(
          cardMap,
          key,
          () => ({
            ...card,
            count:
              0,
          })
        );

      entry.count++;

      if (
        !entry.image &&
        card.image
      ) {
        entry.image =
          card.image;
      }
    }

    /* =========================
       MONTH
    ========================= */

    if (
      year !== null &&
      parts?.month >= 1 &&
      parts?.month <= 12
    ) {
      const month =
        months[
          parts.month - 1
        ];

      month.fortuneCount++;

      month.symbolCount +=
        symbols.length;

      month.themeCount +=
        themes.length;

      month.tarotCardCount +=
        cards.length;
    }
  }

  /* =========================
     RESULT LISTS
  ========================= */

  const symbols =
    sorted(
      symbolMap
    ).map(
      (symbol) => ({
        ...symbol,

        fortuneTypes: [
          ...symbol
            .fortuneTypes,
        ].sort(),

        firstSeenAt:
          symbol
            .firstSeenAt
            ?.toISOString() ??
          null,

        lastSeenAt:
          symbol
            .lastSeenAt
            ?.toISOString() ??
          null,
      })
    );

  const themes =
    sorted(
      themeMap
    );

  const primaryThemes =
    sorted(
      primaryMap
    );

  const tarotCards =
    sorted(
      cardMap
    );

  const fortuneTypes =
    sorted(
      typeMap
    );

  const busiestMonth =
    year !== null &&
    totalFortunes
      ? months.reduce(
          (
            current,
            next
          ) =>
            next.fortuneCount >
            current.fortuneCount
              ? next
              : current
        )
      : null;

  return {
    year,

    totalFortunes,

    recordsWithInsights,

    firstFortuneAt:
      firstFortuneAt
        ?.toISOString() ??
      null,

    lastFortuneAt:
      lastFortuneAt
        ?.toISOString() ??
      null,

    availableYears: [
      ...availableYears,
    ].sort(
      (
        a,
        b
      ) =>
        b - a
    ),

    symbols,

    themes,

    primaryThemes,

    tarotCards,

    fortuneTypes,

    topSymbol:
      symbols[0] ??
      null,

    topTheme:
      primaryThemes[0] ??
      themes[0] ??
      null,

    topTarotCard:
      tarotCards[0] ??
      null,

    months:
      year === null
        ? []
        : months,

    busiestMonth,
  };
}

/* =========================
   LOAD HISTORY
========================= */

async function loadHistory(
  uid
) {
  const snapshot =
    await historyRef(
      uid
    ).get();

  return snapshot
    .docs
    .map(
      (doc) => {
        const data =
          doc.data() ||
          {};

        return {
          id:
            doc.id,

          data,

          date:
            recordDate(
              data
            ),
        };
      }
    );
}

/* =========================
   SAVED YEAR
========================= */

async function savedInterpretation(
  uid,
  year
) {
  const snapshot =
    await yearRef(
      uid,
      year
    ).get();

  if (
    !snapshot.exists
  ) {
    return null;
  }

  const data =
    snapshot.data() ||
    {};

  const interpretation =
    text(
      data.interpretation
    );

  if (
    !interpretation
  ) {
    return null;
  }

  return {
    year,

    interpretation,

    cost:
      Number(
        data.cost
      ) ||
      MYSTIC_YEAR_COST,

    remainingCoin:
      data.remainingCoin ??
      null,

    createdAtMs:
      Number(
        data.createdAtMs
      ) ||
      null,

    sourceHistoryCount:
      Number(
        data.sourceHistoryCount
      ) ||
      0,

    cached:
      true,
  };
}

/* =========================
   GENERATION LOCK
========================= */

async function acquireLock(
  uid,
  year
) {
  const ref =
    yearRef(
      uid,
      year
    );

  const lockId =
    crypto.randomUUID();

  const now =
    Date.now();

  let cached =
    null;

  await db.runTransaction(
    async (tx) => {
      const snapshot =
        await tx.get(
          ref
        );

      const data =
        snapshot.exists
          ? snapshot.data() ||
            {}
          : {};

      const interpretation =
        text(
          data.interpretation
        );

      if (
        interpretation
      ) {
        cached = {
          year,

          interpretation,

          cost:
            Number(
              data.cost
            ) ||
            MYSTIC_YEAR_COST,

          remainingCoin:
            data.remainingCoin ??
            null,

          createdAtMs:
            Number(
              data.createdAtMs
            ) ||
            null,

          sourceHistoryCount:
            Number(
              data.sourceHistoryCount
            ) ||
            0,

          cached:
            true,
        };

        return;
      }

      const activeLock =
        text(
          data.generationStatus
        ) ===
          "generating" &&
        now -
          (
            Number(
              data.generationStartedAtMs
            ) ||
            0
          ) <
          LOCK_TTL_MS;

      if (
        activeLock
      ) {
        throw new ServiceError(
          "Mistik Yılım yorumu hazırlanıyor",
          409,
          "MYSTIC_YEAR_BUSY"
        );
      }

      tx.set(
        ref,
        {
          year,

          generationStatus:
            "generating",

          generationLockId:
            lockId,

          generationStartedAtMs:
            now,

          generationStartedAt:
            admin
              .firestore
              .FieldValue
              .serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );
    }
  );

  return {
    lockId,
    cached,
  };
}

/* =========================
   RELEASE LOCK
========================= */

async function releaseLock(
  uid,
  year,
  lockId,
  message
) {
  try {
    const ref =
      yearRef(
        uid,
        year
      );

    await db.runTransaction(
      async (tx) => {
        const snapshot =
          await tx.get(
            ref
          );

        if (
          !snapshot.exists
        ) {
          return;
        }

        const data =
          snapshot.data() ||
          {};

        if (
          data.generationLockId !==
          lockId
        ) {
          return;
        }

        tx.set(
          ref,
          {
            generationStatus:
              "error",

            generationLockId:
              null,

            generationStartedAtMs:
              null,

            generationStartedAt:
              null,

            lastError:
              text(message) ||
              "Yorum üretilemedi",

            lastErrorAt:
              admin
                .firestore
                .FieldValue
                .serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );
      }
    );
  } catch (
    error
  ) {
    console.error(
      "MYSTIC YEAR LOCK RELEASE ERROR:",
      error
    );
  }
}

/* =========================
   COIN HELPERS
========================= */

function coinAmount(
  value
) {
  const amount =
    Number(value);

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    return 0;
  }

  return Math.floor(
    amount
  );
}

function coinBalance(
  user = {}
) {
  const dailyCoin =
    coinAmount(
      user.dailyCoin
    );

  const abCoin =
    coinAmount(
      user.abCoin
    );

  return {
    dailyCoin,
    abCoin,
    totalCoin:
      dailyCoin +
      abCoin,
  };
}

function ensureEnoughCoin(
  user = {}
) {
  const balance =
    coinBalance(
      user
    );

  if (
    balance.totalCoin <
    MYSTIC_YEAR_COST
  ) {
    throw new ServiceError(
      "Yetersiz coin",
      400,
      "INSUFFICIENT_COIN"
    );
  }

  return balance;
}

/* =========================
   ATOMIC COIN + SAVE
========================= */

async function chargeAndSaveMysticYear({
  uid,
  year,
  lockId,
  interpretation,
  analytics,
}) {
  const uRef =
    userRef(
      uid
    );

  const yRef =
    yearRef(
      uid,
      year
    );

  const createdAtMs =
    Date.now();

  const chargeId =
    crypto.randomUUID();

  let transactionResult =
    null;

  await db.runTransaction(
    async (tx) => {
      /*
       * Kullanıcı coinleri ile Mistik Yılım sonucu
       * AYNI Firestore transaction içinde yazılır.
       *
       * Böylece:
       * - coin düşüp yorumun kaydolmaması
       * - yorum kaydolup coin düşmemesi
       * durumları oluşmaz.
       */

      const userSnapshot =
        await tx.get(
          uRef
        );

      const yearSnapshot =
        await tx.get(
          yRef
        );

      if (
        !userSnapshot.exists
      ) {
        throw new ServiceError(
          "Kullanıcı bulunamadı",
          404,
          "USER_NOT_FOUND"
        );
      }

      const currentYearData =
        yearSnapshot.exists
          ? yearSnapshot.data() ||
            {}
          : {};

      const alreadySaved =
        text(
          currentYearData
            .interpretation
        );

      /*
       * Aynı anda ikinci istek geldiyse ve
       * ilk istek sonucu zaten tamamladıysa
       * tekrar coin alma.
       */
      if (
        alreadySaved
      ) {
        transactionResult = {
          success:
            true,

          year,

          interpretation:
            alreadySaved,

          cost:
            Number(
              currentYearData.cost
            ) ||
            MYSTIC_YEAR_COST,

          remainingCoin:
            currentYearData
              .remainingCoin ??
            null,

          sourceHistoryCount:
            Number(
              currentYearData
                .sourceHistoryCount
            ) ||
            0,

          createdAtMs:
            Number(
              currentYearData
                .createdAtMs
            ) ||
            null,

          cached:
            true,

          charged:
            false,
        };

        return;
      }

      /*
       * Bu sonucu kaydetmeye çalışan işlem,
       * aktif generation lock'un sahibi olmalı.
       */
      if (
        currentYearData
          .generationLockId !==
        lockId
      ) {
        throw new ServiceError(
          "Mistik Yılım oturumu değişti, tekrar deneyin",
          409,
          "MYSTIC_YEAR_LOCK_CHANGED"
        );
      }

      const user =
        userSnapshot.data() ||
        {};

      const balance =
        coinBalance(
          user
        );

      if (
        balance.totalCoin <
        MYSTIC_YEAR_COST
      ) {
        throw new ServiceError(
          "Yetersiz coin",
          400,
          "INSUFFICIENT_COIN"
        );
      }

      /*
       * Mevcut sistemle aynı coin havuzları:
       * önce günlük coin, yetmezse AB coin.
       */
      const dailyUsed =
        Math.min(
          balance.dailyCoin,
          MYSTIC_YEAR_COST
        );

      const abUsed =
        MYSTIC_YEAR_COST -
        dailyUsed;

      const newDailyCoin =
        balance.dailyCoin -
        dailyUsed;

      const newAbCoin =
        balance.abCoin -
        abUsed;

      const remainingCoin =
        newDailyCoin +
        newAbCoin;

      tx.update(
        uRef,
        {
          dailyCoin:
            newDailyCoin,

          abCoin:
            newAbCoin,
        }
      );

      tx.set(
        yRef,
        {
          year,

          interpretation,

          cost:
            MYSTIC_YEAR_COST,

          remainingCoin,

          sourceHistoryCount:
            analytics
              .totalFortunes,

          topSymbol:
            analytics
              .topSymbol,

          topTheme:
            analytics
              .topTheme,

          topTarotCard:
            analytics
              .topTarotCard,

          busiestMonth:
            analytics
              .busiestMonth,

          createdAtMs,

          createdAt:
            admin
              .firestore
              .FieldValue
              .serverTimestamp(),

          generationStatus:
            "completed",

          generationLockId:
            null,

          generationStartedAtMs:
            null,

          generationStartedAt:
            null,

          lastError:
            null,

          chargeId,

          chargedAtMs:
            createdAtMs,

          chargedAt:
            admin
              .firestore
              .FieldValue
              .serverTimestamp(),

          version:
            1,
        },
        {
          merge:
            true,
        }
      );

      transactionResult = {
        success:
          true,

        year,

        interpretation,

        cost:
          MYSTIC_YEAR_COST,

        remainingCoin,

        sourceHistoryCount:
          analytics
            .totalFortunes,

        createdAtMs,

        cached:
          false,

        charged:
          true,
      };
    }
  );

  if (
    !transactionResult
  ) {
    throw new ServiceError(
      "Mistik Yılım kaydedilemedi",
      500,
      "MYSTIC_YEAR_SAVE_FAILED"
    );
  }

  return transactionResult;
}

/* =========================
   GENERATE YEAR COMMENT
========================= */

async function generateInterpretation(
  analytics,
  user = {}
) {
  const promptData = {
    year:
      analytics.year,

    totalFortunes:
      analytics.totalFortunes,

    topSymbols:
      analytics
        .symbols
        .slice(
          0,
          12
        ),

    topThemes:
      analytics
        .themes
        .slice(
          0,
          10
        ),

    topPrimaryThemes:
      analytics
        .primaryThemes
        .slice(
          0,
          8
        ),

    topTarotCards:
      analytics
        .tarotCards
        .slice(
          0,
          10
        ),

    fortuneTypes:
      analytics
        .fortuneTypes,

    months:
      analytics.months,

    busiestMonth:
      analytics.busiestMonth,
  };

  const prompt = `
Sen Arap Bacı uygulamasındaki deneyimli bir fal yorumcususun.

Kullanıcının ${analytics.year} yılı boyunca oluşan gerçek fal geçmişi özetini yorumla.

Yalnızca verilen bilgilere dayan.

Veride olmayan sembol, kart, olay veya kesin gelecek iddiası uydurma.

KULLANICI:

İsim:
${text(user.name)}

Burç:
${text(user.zodiac)}

Cinsiyet:
${text(user.gender)}

Burcu yalnızca arka planda kişiselleştirme için kullan.

Burç adını veya astrolojiden yararlandığını söyleme.

YILLIK ÖZET:

${JSON.stringify(
  promptData,
  null,
  2
)}

KURALLAR:

- Türkçe yaz.
- Başlık kullanma.
- 5-7 doğal paragraf yaz.
- Tekrar eden sembol ve temaların yıl boyunca oluşturduğu ortak hikâyeyi açıkla.
- Tarot kartları varsa ortak yönlerini değerlendir.
- Aylık değişim belirginse anlat.
- En yoğun ayı doğal biçimde değerlendir.
- Aynı düşünceyi farklı cümlelerle tekrar etme.
- Kesin olacak veya kesin yaşayacaksın gibi ifadeler kullanma.
- "yapay zeka", "algoritma", "veri seti" gibi teknik ifadeler kullanma.
- "canım", "güzelim", "auran", "enerjini hissettim" gibi klişe ifadeler kullanma.
- Kullanıcıyı övme.
- Genel kişilik analizi yapma.
- Son paragrafta yılın ana mesajını kısa ve güçlü biçimde toparla.
- Yaklaşık 500-750 kelime yaz.
`.trim();

  const response =
    await openai
      .responses
      .create({
        model:
          "gpt-4.1-mini",

        input:
          prompt,

        max_output_tokens:
          1400,
      });

  const result =
    text(
      response.output_text
    );

  if (!result) {
    throw new ServiceError(
      "Mistik Yılım yorumu üretilemedi",
      500,
      "INTERPRETATION_FAILED"
    );
  }

  return result;
}

/* =========================
   SYMBOL MAP
========================= */

export async function getSymbolAnalytics(
  uid
) {
  if (!uid) {
    throw new ServiceError(
      "UID gerekli",
      401,
      "AUTH_REQUIRED"
    );
  }

  const records =
    await loadHistory(
      uid
    );

  const analytics =
    aggregate(
      records
    );

  return {
    success:
      true,

    mode:
      "lifetime",

    ...analytics,
  };
}

/* =========================
   MYSTIC YEAR STATS
========================= */

export async function getMysticYearAnalytics(
  uid,
  requestedYear
) {
  if (!uid) {
    throw new ServiceError(
      "UID gerekli",
      401,
      "AUTH_REQUIRED"
    );
  }

  const year =
    parseYear(
      requestedYear
    );

  const records =
    await loadHistory(
      uid
    );

  const analytics =
    aggregate(
      records,
      year
    );

  const saved =
    await savedInterpretation(
      uid,
      year
    );

  return {
    success:
      true,

    mode:
      "year",

    ...analytics,

    mysticYearCost:
      MYSTIC_YEAR_COST,

    hasInterpretation:
      !!saved,

    interpretation:
      saved
        ?.interpretation ??
      null,

    interpretationCreatedAtMs:
      saved
        ?.createdAtMs ??
      null,

    interpretationCached:
      !!saved,
  };
}

/* =========================
   INTERPRET MYSTIC YEAR
========================= */

export async function interpretMysticYear(
  uid,
  requestedYear
) {
  if (!uid) {
    throw new ServiceError(
      "UID gerekli",
      401,
      "AUTH_REQUIRED"
    );
  }

  const year =
    parseYear(
      requestedYear
    );

  /* =========================
     CACHE CHECK
  ========================= */

  const existing =
    await savedInterpretation(
      uid,
      year
    );

  if (
    existing
  ) {
    return {
      success:
        true,

      ...existing,

      charged:
        false,
    };
  }

  /* =========================
     HISTORY
  ========================= */

  const records =
    await loadHistory(
      uid
    );

  const analytics =
    aggregate(
      records,
      year
    );

  if (
    !analytics.totalFortunes
  ) {
    throw new ServiceError(
      "Bu yıl için yorumlanacak fal geçmişi bulunamadı",
      400,
      "NO_YEAR_DATA"
    );
  }

  /* =========================
     LOCK
  ========================= */

  const {
    lockId,
    cached,
  } =
    await acquireLock(
      uid,
      year
    );

  if (
    cached
  ) {
    return {
      success:
        true,

      ...cached,

      charged:
        false,
    };
  }

  try {
    /* =========================
       USER + PRE COIN CHECK
    ========================= */

    const userSnapshot =
      await userRef(
        uid
      ).get();

    if (
      !userSnapshot.exists
    ) {
      throw new ServiceError(
        "Kullanıcı bulunamadı",
        404,
        "USER_NOT_FOUND"
      );
    }

    const user =
      userSnapshot.data() ||
      {};

    /*
     * OpenAI çağrısından önce coin kontrolü.
     * Bu sadece ön kontroldür.
     * Asıl coin kontrolü ve düşümü aşağıdaki
     * Firestore transaction içinde tekrar yapılır.
     */
    ensureEnoughCoin(
      user
    );

    /* =========================
       COMMENT
    ========================= */

    const interpretation =
      await generateInterpretation(
        analytics,
        user
      );

    /* =========================
       ATOMIC:
       COIN + RESULT SAVE
    ========================= */

    return await chargeAndSaveMysticYear({
      uid,
      year,
      lockId,
      interpretation,
      analytics,
    });
  } catch (
    error
  ) {
    await releaseLock(
      uid,
      year,
      lockId,
      error?.message
    );

    throw error;
  }
}

export {
  MYSTIC_YEAR_COST,
  ServiceError,
};