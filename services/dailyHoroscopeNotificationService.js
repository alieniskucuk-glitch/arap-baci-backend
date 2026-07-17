import cron from "node-cron";
import { getApps } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const TIME_ZONE = "Europe/Istanbul";
const OPENAI_MODEL =
  process.env.DAILY_HOROSCOPE_OPENAI_MODEL?.trim() || "gpt-5-mini";

const USERS_COLLECTION = "users";
const MESSAGES_COLLECTION = "dailyHoroscopeNotifications";
const JOBS_COLLECTION = "notificationJobs";

const ZODIACS = [
  "Koç",
  "Boğa",
  "İkizler",
  "Yengeç",
  "Aslan",
  "Başak",
  "Terazi",
  "Akrep",
  "Yay",
  "Oğlak",
  "Kova",
  "Balık",
];

const ZODIAC_VARIANTS = {
  Koç: ["Koç", "koç", "Koc", "koc", "Aries", "aries"],
  Boğa: ["Boğa", "boğa", "Boga", "boga", "Taurus", "taurus"],
  İkizler: [
    "İkizler",
    "ikizler",
    "Ikizler",
    "Gemini",
    "gemini",
  ],
  Yengeç: [
    "Yengeç",
    "yengeç",
    "Yengec",
    "yengec",
    "Cancer",
    "cancer",
  ],
  Aslan: ["Aslan", "aslan", "Leo", "leo"],
  Başak: [
    "Başak",
    "başak",
    "Basak",
    "basak",
    "Virgo",
    "virgo",
  ],
  Terazi: ["Terazi", "terazi", "Libra", "libra"],
  Akrep: ["Akrep", "akrep", "Scorpio", "scorpio"],
  Yay: ["Yay", "yay", "Sagittarius", "sagittarius"],
  Oğlak: [
    "Oğlak",
    "oğlak",
    "Oglak",
    "oglak",
    "Capricorn",
    "capricorn",
  ],
  Kova: ["Kova", "kova", "Aquarius", "aquarius"],
  Balık: [
    "Balık",
    "balık",
    "Balik",
    "balik",
    "Pisces",
    "pisces",
  ],
};

const FALLBACK_MESSAGES = {
  Koç: {
    title: "🔥 Koç, günün mesajı hazır",
    body:
      "Bugün enerjini doğru yere yöneltmen için yıldızların küçük bir notu var ✨",
  },
  Boğa: {
    title: "🌿 Boğa, gökyüzü seni çağırıyor",
    body:
      "Bugün kendine iyi gelecek adımları yıldızların mesajında bulabilirsin ✨",
  },
  İkizler: {
    title: "💫 İkizler, bugünün mesajı geldi",
    body:
      "Aklındaki hareketliliğe gökyüzünden sıcak bir yön gösterici var 🔮",
  },
  Yengeç: {
    title: "🌙 Yengeç, kalbine kulak ver",
    body:
      "Bugünün enerjisi duygularına dair küçük ama değerli bir şey söylüyor ✨",
  },
  Aslan: {
    title: "🦁 Aslan, bugün ışığın sende",
    body:
      "Yıldızlar enerjini nerede gösterebileceğine dair bir işaret bırakmış ✨",
  },
  Başak: {
    title: "✨ Başak, günün notu hazır",
    body:
      "Bugünün detaylarında sana iyi gelebilecek küçük bir mesaj saklı 🔮",
  },
  Terazi: {
    title: "⚖️ Terazi, bugünün dengesi",
    body:
      "Kalbinle aklın arasındaki denge için yıldızların sıcak bir önerisi var ✨",
  },
  Akrep: {
    title: "🦂 Akrep, sezgilerin konuşuyor",
    body:
      "Bugün iç sesine dair gökyüzünden dikkat çekici bir mesaj gelebilir 🔮",
  },
  Yay: {
    title: "🏹 Yay, yeni gün seni bekliyor",
    body:
      "Bugünün enerjisi sana farklı bir yol veya taze bir heves gösterebilir ✨",
  },
  Oğlak: {
    title: "⛰️ Oğlak, günün rotası hazır",
    body:
      "Emeklerini nereye yönelteceğine dair yıldızların küçük bir ipucu var 🔮",
  },
  Kova: {
    title: "💡 Kova, ilham kapıda",
    body:
      "Bugün sıra dışı düşüncelerine iyi gelecek bir gökyüzü mesajı var ✨",
  },
  Balık: {
    title: "🐟 Balık, sezgilerine güven",
    body:
      "Hayallerin ve hislerin için yıldızların yumuşak bir mesajı seni bekliyor 🔮",
  },
};

let schedulerStarted = false;
let scheduledTasks = [];

function requireFirebase() {
  if (getApps().length === 0) {
    throw new Error(
      "Firebase Admin başlatılmamış. Bildirim servisini Firebase initialize işleminden sonra başlat.",
    );
  }
}

function getDateInfo() {
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const values = {};

  for (const part of formatter.formatToParts(new Date())) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    displayDate: `${values.day}.${values.month}.${values.year}`,
    weekday: values.weekday,
  };
}

function getOutputText(responseData) {
  if (
    typeof responseData?.output_text === "string" &&
    responseData.output_text.trim()
  ) {
    return responseData.output_text.trim();
  }

  for (const outputItem of responseData?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (
        contentItem?.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text.trim();
      }
    }
  }

  throw new Error("OpenAI yanıtında metin çıktısı bulunamadı.");
}

function getResponseSchema() {
  return {
    type: "object",
    properties: {
      messages: {
        type: "array",
        minItems: 12,
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            zodiac: {
              type: "string",
              enum: ZODIACS,
            },
            title: {
              type: "string",
              minLength: 5,
              maxLength: 60,
            },
            body: {
              type: "string",
              minLength: 20,
              maxLength: 160,
            },
          },
          required: ["zodiac", "title", "body"],
          additionalProperties: false,
        },
      },
    },
    required: ["messages"],
    additionalProperties: false,
  };
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new Error("OpenAI messages alanı liste değil.");
  }

  const messageMap = new Map();

  for (const item of messages) {
    const zodiac = String(item?.zodiac || "").trim();
    const title = String(item?.title || "").trim();
    const body = String(item?.body || "").trim();

    if (
      ZODIACS.includes(zodiac) &&
      title &&
      body &&
      !messageMap.has(zodiac)
    ) {
      messageMap.set(zodiac, {
        zodiac,
        title: [...title].slice(0, 60).join(""),
        body: [...body].slice(0, 160).join(""),
      });
    }
  }

  if (messageMap.size !== ZODIACS.length) {
    throw new Error(
      `OpenAI 12 burcun tamamını döndürmedi. Gelen: ${messageMap.size}`,
    );
  }

  return ZODIACS.map((zodiac) => messageMap.get(zodiac));
}

async function generateMessagesWithOpenAI(dateInfo) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    45000,
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          model: OPENAI_MODEL,
          store: false,
          input: [
            {
              role: "system",
              content:
                "Arap Bacı uygulaması için Türkçe günlük burç bildirimleri yaz. " +
                "Her burç için sıcak, samimi, doğal ve diğerlerinden farklı bir başlık ile gövde üret. " +
                "Başlık en fazla 60, gövde en fazla 160 karakter olsun. " +
                "Her mesajda 1-3 uygun emoji kullan. " +
                "Kesin gelecek iddiası, korkutma, ölüm, hastalık, para garantisi, yapay zeka veya AI ifadeleri kullanma. " +
                "Her burç tam bir kez yer alsın.",
            },
            {
              role: "user",
              content:
                `Tarih: ${dateInfo.displayDate}\n` +
                `Gün: ${dateInfo.weekday}\n` +
                `Burçlar: ${ZODIACS.join(", ")}\n` +
                "12 burç için günlük bildirimleri üret.",
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "daily_horoscope_notifications",
              strict: true,
              schema: getResponseSchema(),
            },
          },
          max_output_tokens: 2500,
        }),
      },
    );

    const rawResponse = await response.text();

    if (!response.ok) {
      throw new Error(
        `OpenAI API ${response.status}: ${rawResponse.slice(0, 800)}`,
      );
    }

    const responseData = JSON.parse(rawResponse);
    const outputText = getOutputText(responseData);
    const parsedOutput = JSON.parse(outputText);

    return normalizeMessages(parsedOutput.messages);
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackMessages() {
  return ZODIACS.map((zodiac) => ({
    zodiac,
    title: FALLBACK_MESSAGES[zodiac].title,
    body: FALLBACK_MESSAGES[zodiac].body,
  }));
}

function extractTokens(userData) {
  const tokens = new Set();

  const singleTokenFields = [
    "fcmToken",
    "pushToken",
    "deviceToken",
    "notificationToken",
  ];

  const tokenArrayFields = [
    "fcmTokens",
    "pushTokens",
    "deviceTokens",
    "notificationTokens",
  ];

  for (const field of singleTokenFields) {
    const token = userData?.[field];

    if (typeof token === "string" && token.trim()) {
      tokens.add(token.trim());
    }
  }

  for (const field of tokenArrayFields) {
    const values = userData?.[field];

    if (!Array.isArray(values)) {
      continue;
    }

    for (const token of values) {
      if (typeof token === "string" && token.trim()) {
        tokens.add(token.trim());
      }
    }
  }

  return [...tokens];
}

async function getTokensForZodiac(zodiac) {
  const db = getFirestore();
  const variants = [
    ...new Set(ZODIAC_VARIANTS[zodiac] || [zodiac]),
  ];

  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("zodiac", "in", variants)
    .get();

  const tokens = new Set();

  for (const document of snapshot.docs) {
    for (const token of extractTokens(document.data())) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

function splitTokens(tokens, size = 500) {
  const chunks = [];

  for (let index = 0; index < tokens.length; index += size) {
    chunks.push(tokens.slice(index, index + size));
  }

  return chunks;
}

async function sendBatch(message) {
  const messaging = getMessaging();

  if (typeof messaging.sendEachForMulticast === "function") {
    return messaging.sendEachForMulticast(message);
  }

  if (typeof messaging.sendMulticast === "function") {
    return messaging.sendMulticast(message);
  }

  throw new Error(
    "Firebase Admin çoklu FCM gönderimini desteklemiyor.",
  );
}

async function sendNotificationToZodiac(
  message,
  dateKey,
  tokens,
) {
  if (tokens.length === 0) {
    return {
      zodiac: message.zodiac,
      tokenCount: 0,
      successCount: 0,
      failureCount: 0,
    };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const tokenChunk of splitTokens(tokens)) {
    const result = await sendBatch({
      tokens: tokenChunk,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: {
        type: "daily_horoscope",
        payload: "daily_horoscope",
        route: "/dailyHoroscope",
        zodiac: message.zodiac,
        date: dateKey,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "arap_baci_daily_reminders",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    });

    successCount += result.successCount || 0;
    failureCount += result.failureCount || 0;
  }

  return {
    zodiac: message.zodiac,
    tokenCount: tokens.length,
    successCount,
    failureCount,
  };
}

async function acquireJobLock(dateKey, force) {
  const db = getFirestore();
  const jobRef = db
    .collection(JOBS_COLLECTION)
    .doc(`daily_horoscope_${dateKey}`);

  const acquired = await db.runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      const data = snapshot.exists ? snapshot.data() : null;

      if (!force && data?.status === "completed") {
        return false;
      }

      transaction.set(
        jobRef,
        {
          type: "daily_horoscope",
          dateKey,
          status: "running",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      return true;
    },
  );

  return {
    acquired,
    jobRef,
  };
}

export async function runDailyHoroscopeNotifications({
  force = false,
} = {}) {
  requireFirebase();

  const dateInfo = getDateInfo();
  const lock = await acquireJobLock(
    dateInfo.dateKey,
    force,
  );

  if (!lock.acquired) {
    console.log(
      `[Günlük Burç] ${dateInfo.dateKey} daha önce tamamlandı.`,
    );

    return {
      success: true,
      skipped: true,
      dateKey: dateInfo.dateKey,
    };
  }

  try {
    let source = "openai";
    let messages;

    try {
      messages = await generateMessagesWithOpenAI(dateInfo);
    } catch (error) {
      source = "fallback";
      messages = getFallbackMessages();

      console.error(
        "[Günlük Burç] OpenAI üretim hatası, yedek mesajlar kullanılacak:",
        error,
      );
    }

    const db = getFirestore();

    await db
      .collection(MESSAGES_COLLECTION)
      .doc(dateInfo.dateKey)
      .set(
        {
          ...dateInfo,
          source,
          model:
            source === "openai"
              ? OPENAI_MODEL
              : null,
          messages,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        },
      );

    const usedTokens = new Set();
    const results = [];

    for (const message of messages) {
      const zodiacTokens = await getTokensForZodiac(
        message.zodiac,
      );

      const uniqueTokens = zodiacTokens.filter((token) => {
        if (usedTokens.has(token)) {
          return false;
        }

        usedTokens.add(token);
        return true;
      });

      const result = await sendNotificationToZodiac(
        message,
        dateInfo.dateKey,
        uniqueTokens,
      );

      results.push(result);

      console.log(
        `[Günlük Burç] ${message.zodiac}: ` +
          `${result.successCount} başarılı, ` +
          `${result.failureCount} başarısız`,
      );
    }

    const totals = results.reduce(
      (current, result) => ({
        tokenCount:
          current.tokenCount + result.tokenCount,
        successCount:
          current.successCount + result.successCount,
        failureCount:
          current.failureCount + result.failureCount,
      }),
      {
        tokenCount: 0,
        successCount: 0,
        failureCount: 0,
      },
    );

    await lock.jobRef.set(
      {
        status: "completed",
        source,
        model:
          source === "openai"
            ? OPENAI_MODEL
            : null,
        totals,
        results,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    return {
      success: true,
      skipped: false,
      dateKey: dateInfo.dateKey,
      source,
      totals,
    };
  } catch (error) {
    await lock.jobRef.set(
      {
        status: "failed",
        error: String(
          error?.stack ||
            error?.message ||
            error,
        ).slice(0, 5000),
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    throw error;
  }
}

export function startDailyHoroscopeNotificationService() {
  if (schedulerStarted) {
    console.log(
      "[Günlük Burç] Zamanlayıcı zaten çalışıyor.",
    );

    return scheduledTasks;
  }

  const weekdayTask = cron.schedule(
    "0 9 * * 1-5",
    async () => {
      try {
        await runDailyHoroscopeNotifications();
      } catch (error) {
        console.error(
          "[Günlük Burç] Hafta içi görev hatası:",
          error,
        );
      }
    },
    {
      timezone: TIME_ZONE,
    },
  );

  const weekendTask = cron.schedule(
    "0 11 * * 0,6",
    async () => {
      try {
        await runDailyHoroscopeNotifications();
      } catch (error) {
        console.error(
          "[Günlük Burç] Hafta sonu görev hatası:",
          error,
        );
      }
    },
    {
      timezone: TIME_ZONE,
    },
  );

  scheduledTasks = [
    weekdayTask,
    weekendTask,
  ];

  schedulerStarted = true;

  console.log(
    "[Günlük Burç] Zamanlayıcı başladı: " +
      "hafta içi 09:00, hafta sonu 11:00.",
  );

  return scheduledTasks;
}

export function stopDailyHoroscopeNotificationService() {
  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks = [];
  schedulerStarted = false;

  console.log(
    "[Günlük Burç] Zamanlayıcı durduruldu.",
  );
}
