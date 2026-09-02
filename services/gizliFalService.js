import crypto from "crypto";
import openai from "../config/openai.js";
import { db, admin } from "../config/firebase.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";

const COLLECTION = "secretFortunes";

/* =========================
   HELPERS
========================= */

function ref(sessionId) {
  return db
    .collection(COLLECTION)
    .doc(sessionId);
}

function safeProfile(user = {}) {
  return {
    name:
      String(
        user?.name || ""
      ).trim(),

    zodiac:
      String(
        user?.zodiac || ""
      ).trim(),

    gender:
      String(
        user?.gender || ""
      ).trim(),
  };
}

function normalizeCode(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      ""
    );
}

function validateSelection(
  selection
) {
  if (!Array.isArray(selection)) {
    throw new Error(
      "Geçersiz kart seçimi"
    );
  }

  if (
    selection.length !== 3
  ) {
    throw new Error(
      "Tam olarak 3 kart seçmelisin"
    );
  }

  const normalized =
    [...selection];

  if (
    normalized.some(
      (cardId) =>
        typeof cardId !==
          "number" ||
        !Number.isInteger(cardId)
    )
  ) {
    throw new Error(
      "Geçersiz kart seçimi"
    );
  }

  if (
    new Set(normalized).size !== 3
  ) {
    throw new Error(
      "Aynı kart birden fazla seçilemez"
    );
  }

  for (const cardId of normalized) {
    if (!getTarotById(cardId)) {
      throw new Error(
        `Kart bulunamadı: ${cardId}`
      );
    }
  }

  return normalized;
}

function cardsFromSelection(
  selection
) {
  return selection.map(
    (cardId) => {
      const card =
        getTarotById(cardId);

      if (!card) {
        throw new Error(
          `Kart bulunamadı: ${cardId}`
        );
      }

      return {
        id:
          cardId,

        name:
          String(
            card.title ||
            card.name ||
            ""
          ).trim(),

        image:
          String(
            card.image || ""
          ).trim(),
      };
    }
  );
}

async function createInviteCode() {
  for (
    let i = 0;
    i < 8;
    i++
  ) {
    const code =
      crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase();

    const snap =
      await db
        .collection(
          COLLECTION
        )
        .where(
          "inviteCode",
          "==",
          code
        )
        .limit(1)
        .get();

    if (snap.empty) {
      return code;
    }
  }

  throw new Error(
    "Davet kodu üretilemedi"
  );
}

function ensureParticipant(
  data,
  uid
) {
  if (
    data.creatorUid !== uid &&
    data.inviteeUid !== uid
  ) {
    throw new Error(
      "Bu Gizli Fal oturumuna erişimin yok"
    );
  }
}

function statusResponse(
  data,
  uid,
  sessionId
) {
  const creator =
    data.creatorUid === uid;

  const invitee =
    data.inviteeUid === uid;

  const out = {
    sessionId,

    status:
      data.status ||
      "waiting_partner",

    joined:
      !!data.inviteeUid,

    mySelected:
      creator
        ? !!data.creatorSelection
        : invitee
          ? !!data.inviteeSelection
          : false,

    partnerSelected:
      creator
        ? !!data.inviteeSelection
        : invitee
          ? !!data.creatorSelection
          : false,

    completed:
      data.status ===
      "completed",
  };

  if (creator) {
    out.inviteCode =
      data.inviteCode;
  }

  if (
    data.status ===
    "completed"
  ) {
    out.result =
      data.result || null;
  }

  return out;
}

/* =========================
   AI RESULT
========================= */

async function generateResult(
  data
) {
  const creatorCards =
    cardsFromSelection(
      data.creatorSelection
    );

  const inviteeCards =
    cardsFromSelection(
      data.inviteeSelection
    );

  const request =
    openai
      .chat
      .completions
      .create({
        model:
          "gpt-4.1-mini",

        messages: [
          {
            role:
              "system",

            content: `
Sen Arap Bacı uygulamasındaki
İki Kişilik Gizli Fal yorumcususun.

İki kişi seçimlerini
birbirinden gizli yaptı.

İkisi de tamamladıktan sonra
ortak sonuç açılır.

Kurallar:

- Seçimlerde olmayan detayları uydurma.
- İki seçimi birlikte yorumla.
- Ortak bir kart adı ve kısa kart mesajı üret.
- Ortak bir sembol ve anlamı üret.
- Ortak bir tema üret.
- 1. kişinin enerjisini ayrı yorumla.
- 2. kişinin enerjisini ayrı yorumla.
- Son olarak iki kişi arasındaki ortak dinamiği detaylı yorumla.
- Sonucu gereksiz biçimde olumluya çevirme.
- Klişe hitaplar kullanma.
- Kullanıcıları övme.
- Teknik analiz sürecinden bahsetme.
- Markdown veya ek açıklama yazma.

SADECE JSON döndür:

{
  "sharedCard": {
    "name": "Ortak kart adı",
    "message": "Kısa ortak kart mesajı"
  },
  "sharedSymbol": {
    "name": "Ortak sembol",
    "meaning": "Sembolün ortak anlamı"
  },
  "sharedTheme": "Ortak tema",
  "creatorInterpretation": "1. kişinin seçtiği 3 karta dayalı yorumu",
  "inviteeInterpretation": "2. kişinin seçtiği 3 karta dayalı yorumu",
  "jointInterpretation": "İki kişi arasındaki ortak ve detaylı fal yorumu"
}
`.trim(),
          },

          {
            role:
              "user",

            content: `
1. KİŞİ:

İsim:
${data.creator?.name || ""}

Burç:
${data.creator?.zodiac || ""}

Cinsiyet:
${data.creator?.gender || ""}

Gizli Seçim:
${JSON.stringify(
  creatorCards
)}


2. KİŞİ:

İsim:
${data.invitee?.name || ""}

Burç:
${data.invitee?.zodiac || ""}

Cinsiyet:
${data.invitee?.gender || ""}

Gizli Seçim:
${JSON.stringify(
  inviteeCards
)}
`.trim(),
          },
        ],

        temperature:
          0.8,
      });

  const timeout =
    new Promise(
      (
        _,
        reject
      ) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Gizli Fal yorum timeout"
              )
            ),
          30000
        );
      }
    );

  const completion =
    await Promise.race([
      request,
      timeout,
    ]);

  const raw =
    String(
      completion
        ?.choices?.[0]
        ?.message?.content ||
      ""
    )
      .replace(
        /```json/gi,
        ""
      )
      .replace(
        /```/g,
        ""
      )
      .trim();

  if (!raw) {
    throw new Error(
      "Gizli Fal yorumu boş geldi"
    );
  }

  const parsed =
    JSON.parse(raw);

  const result = {
    sharedCard: {
      name:
        String(
          parsed
            ?.sharedCard
            ?.name || ""
        ).trim(),

      message:
        String(
          parsed
            ?.sharedCard
            ?.message ||
          ""
        ).trim(),
    },

    sharedSymbol: {
      name:
        String(
          parsed
            ?.sharedSymbol
            ?.name || ""
        ).trim(),

      meaning:
        String(
          parsed
            ?.sharedSymbol
            ?.meaning ||
          ""
        ).trim(),
    },

    sharedTheme:
      String(
        parsed
          ?.sharedTheme ||
        ""
      ).trim(),

    creatorInterpretation:
      String(
        parsed
          ?.creatorInterpretation ||
        parsed
          ?.creatorEnergy ||
        ""
      ).trim(),

    inviteeInterpretation:
      String(
        parsed
          ?.inviteeInterpretation ||
        parsed
          ?.inviteeEnergy ||
        ""
      ).trim(),

    creatorCards,

    inviteeCards,

    jointInterpretation:
      String(
        parsed
          ?.jointInterpretation ||
        ""
      ).trim(),
  };

  if (
    !result
      .sharedCard
      .name ||

    !result
      .sharedCard
      .message ||

    !result
      .sharedSymbol
      .name ||

    !result
      .sharedSymbol
      .meaning ||

    !result
      .sharedTheme ||

    !result
      .creatorInterpretation ||

    !result
      .inviteeInterpretation ||

    !result
      .jointInterpretation
  ) {
    throw new Error(
      "Geçersiz Gizli Fal cevabı"
    );
  }

  result.creatorEnergy =
    result.creatorInterpretation;

  result.inviteeEnergy =
    result.inviteeInterpretation;

  return result;
}

/* =========================
   HISTORY
========================= */

async function saveHistory(
  sessionId,
  data,
  result,
  remainingCoin
) {
  const batch =
    db.batch();

  const createdAt =
    admin
      .firestore
      .FieldValue
      .serverTimestamp();

  const common = {
    type:
      "gizli_fal",

    sessionId,

    result:
      result
        .jointInterpretation,

    secretFortuneResult:
      result,

    sharedCard:
      result.sharedCard,

    sharedSymbol:
      result.sharedSymbol,

    sharedTheme:
      result.sharedTheme,

    creatorCards:
      result.creatorCards,

    inviteeCards:
      result.inviteeCards,

    status:
      "completed",

    createdAt,

    completedAtMs:
      Date.now(),
  };

  const creatorHistory =
    db
      .collection("users")
      .doc(
        data.creatorUid
      )
      .collection(
        "history"
      )
      .doc(sessionId);

  const inviteeHistory =
    db
      .collection("users")
      .doc(
        data.inviteeUid
      )
      .collection(
        "history"
      )
      .doc(sessionId);

  batch.set(
    creatorHistory,
    {
      ...common,

      role:
        "creator",

      partnerUid:
        data.inviteeUid,

      partnerName:
        data.invitee
          ?.name ||
        "",

      cost:
        data.cost,

      remainingCoin,
    },
    {
      merge: false
    }
  );

  batch.set(
    inviteeHistory,
    {
      ...common,

      role:
        "invitee",

      partnerUid:
        data.creatorUid,

      partnerName:
        data.creator
          ?.name ||
        "",

      cost:
        0,
    },
    {
      merge: false
    }
  );

  await batch.commit();
}

/* =========================
   FINALIZE
========================= */

async function finalizeSession(
  sessionId
) {
  const session =
    ref(sessionId);

  const snap =
    await session.get();

  if (!snap.exists) {
    throw new Error(
      "Gizli Fal oturumu bulunamadı"
    );
  }

  const data =
    snap.data() || {};

  if (
    data.status ===
    "completed"
  ) {
    return (
      data.result ||
      null
    );
  }

  if (
    !data.creatorUid ||
    !data.inviteeUid ||
    !data.creatorSelection ||
    !data.inviteeSelection
  ) {
    throw new Error(
      "İki kişinin seçimi tamamlanmadı"
    );
  }

  let result;

  try {
    result =
      await generateResult(
        data
      );

  } catch (err) {

    await session.set(
      {
        status:
          "active",

        finalizing:
          false,

        finalizingAt:
          null,

        lastError:
          "Yorum üretilemedi",
      },
      {
        merge: true
      }
    );

    throw err;
  }

  let remainingCoin;

  try {
    remainingCoin =
      await decreaseCoin(
        data.creatorUid,
        data.cost,
        "GIZLI_FAL",
        {
          sessionId,

          inviteeUid:
            data.inviteeUid,
        }
      );

  } catch (err) {

    await session.set(
      {
        status:
          "active",

        finalizing:
          false,

        finalizingAt:
          null,

        lastError:
          err.message ||
          "Coin düşülemedi",
      },
      {
        merge: true
      }
    );

    throw err;
  }

  await session.set(
    {
      status:
        "completed",

      result,

      remainingCoin,

      finalizing:
        false,

      finalizingAt:
        null,

      lastError:
        null,

      completedAt:
        admin
          .firestore
          .FieldValue
          .serverTimestamp(),

      completedAtMs:
        Date.now(),
    },
    {
      merge: true
    }
  );

  try {
    await saveHistory(
      sessionId,
      data,
      result,
      remainingCoin
    );

  } catch (err) {

    console.error(
      "GIZLI FAL HISTORY ERROR:",
      err
    );
  }

  return result;
}

/* =========================
   CREATE
========================= */

export async function createSecretFortune(
  uid,
  {
    coinPrice,
    user
  }
) {
  if (!uid) {
    throw new Error(
      "UID gerekli"
    );
  }

  const cost =
    Number(
      coinPrice
    );

  if (
    !Number.isFinite(
      cost
    ) ||
    cost <= 0
  ) {
    throw new Error(
      "Coin fiyatı gerekli"
    );
  }

  const sessionId =
    crypto.randomUUID();

  const inviteCode =
    await createInviteCode();

  await ref(
    sessionId
  ).set({
    sessionId,

    inviteCode,

    creatorUid:
      uid,

    creator:
      safeProfile(
        user
      ),

    inviteeUid:
      null,

    invitee:
      null,

    creatorSelection:
      null,

    inviteeSelection:
      null,

    cost,

    status:
      "waiting_partner",

    finalizing:
      false,

    createdAt:
      admin
        .firestore
        .FieldValue
        .serverTimestamp(),

    createdAtMs:
      Date.now(),
  });

  return {
    sessionId,

    inviteCode,

    status:
      "waiting_partner",
  };
}

/* =========================
   JOIN
========================= */

export async function joinSecretFortune(
  uid,
  {
    code,
    user
  }
) {
  if (!uid) {
    throw new Error(
      "UID gerekli"
    );
  }

  const inviteCode =
    normalizeCode(
      code
    );

  if (!inviteCode) {
    throw new Error(
      "Davet kodu gerekli"
    );
  }

  const query =
    await db
      .collection(
        COLLECTION
      )
      .where(
        "inviteCode",
        "==",
        inviteCode
      )
      .limit(1)
      .get();

  if (query.empty) {
    throw new Error(
      "Davet kodu bulunamadı"
    );
  }

  const doc =
    query.docs[0];

  const sessionId =
    doc.id;

  await db.runTransaction(
    async (tx) => {

      const snap =
        await tx.get(
          doc.ref
        );

      if (!snap.exists) {
        throw new Error(
          "Gizli Fal oturumu bulunamadı"
        );
      }

      const data =
        snap.data() ||
        {};

      if (
        data.status ===
        "completed"
      ) {
        throw new Error(
          "Bu Gizli Fal tamamlandı"
        );
      }

      if (
        data.creatorUid ===
        uid
      ) {
        throw new Error(
          "Kendi davet kodunla katılamazsın"
        );
      }

      if (
        data.inviteeUid &&
        data.inviteeUid !==
          uid
      ) {
        throw new Error(
          "Bu davete başka bir kişi katılmış"
        );
      }

      tx.set(
        doc.ref,
        {
          inviteeUid:
            uid,

          invitee:
            safeProfile(
              user
            ),

          status:
            "active",

          joinedAt:
            admin
              .firestore
              .FieldValue
              .serverTimestamp(),
        },
        {
          merge: true
        }
      );
    }
  );

  return {
    sessionId,

    status:
      "active",
  };
}

/* =========================
   SELECT
========================= */

export async function submitSecretSelection(
  uid,
  {
    sessionId,
    selection
  }
) {
  if (!uid) {
    throw new Error(
      "UID gerekli"
    );
  }

  if (!sessionId) {
    throw new Error(
      "Session ID gerekli"
    );
  }

  const safeSelection =
    validateSelection(
      selection
    );

  const session =
    ref(sessionId);

  let shouldFinalize =
    false;

  await db.runTransaction(
    async (tx) => {

      const snap =
        await tx.get(
          session
        );

      if (!snap.exists) {
        throw new Error(
          "Gizli Fal oturumu bulunamadı"
        );
      }

      const data =
        snap.data() ||
        {};

      ensureParticipant(
        data,
        uid
      );

      if (
        data.status ===
        "completed"
      ) {
        throw new Error(
          "Bu Gizli Fal tamamlandı"
        );
      }

      const creator =
        data.creatorUid ===
        uid;

      const patch =
        creator
          ? {
              creatorSelection:
                safeSelection,

              creatorSelectedAt:
                admin
                  .firestore
                  .FieldValue
                  .serverTimestamp(),
            }

          : {
              inviteeSelection:
                safeSelection,

              inviteeSelectedAt:
                admin
                  .firestore
                  .FieldValue
                  .serverTimestamp(),
            };

      const creatorSelection =
        creator
          ? safeSelection
          : data
              .creatorSelection;

      const inviteeSelection =
        creator
          ? data
              .inviteeSelection
          : safeSelection;

      if (
        data.inviteeUid &&
        creatorSelection &&
        inviteeSelection &&
        !data.finalizing
      ) {
        shouldFinalize =
          true;

        patch.status =
          "finalizing";

        patch.finalizing =
          true;

        patch.finalizingAt =
          admin
            .firestore
            .FieldValue
            .serverTimestamp();
      }

      tx.set(
        session,
        patch,
        {
          merge: true
        }
      );
    }
  );

  if (
    shouldFinalize
  ) {
    await finalizeSession(
      sessionId
    );
  }

  const latest =
    await session.get();

  if (!latest.exists) {
    throw new Error(
      "Gizli Fal oturumu bulunamadı"
    );
  }

  return statusResponse(
    latest.data() || {},
    uid,
    sessionId
  );
}

/* =========================
   STATUS
========================= */

export async function getSecretFortuneStatus(
  uid,
  sessionId
) {
  if (!uid) {
    throw new Error(
      "UID gerekli"
    );
  }

  if (!sessionId) {
    throw new Error(
      "Session ID gerekli"
    );
  }

  const snap =
    await ref(
      sessionId
    ).get();

  if (!snap.exists) {
    throw new Error(
      "Gizli Fal oturumu bulunamadı"
    );
  }

  const data =
    snap.data() || {};

  ensureParticipant(
    data,
    uid
  );

  return statusResponse(
    data,
    uid,
    sessionId
  );
}
