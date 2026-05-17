import crypto from "crypto";
import openai from "../config/openai.js";
import { decreaseCoin } from "../utils/coinManager.js";
import { getTarotById } from "../utils/tarotDeck.js";
import { db, admin } from "../config/firebase.js";

/* =========================
   MEMORY SESSION STORE
========================= */

const sessionStore = new Map();
const SESSION_TTL = 1000 * 60 * 10;

function isExpired(session) {
  return Date.now() - session.createdAt > SESSION_TTL;
}

function sessionRef(uid, sessionId) {
  return db
    .collection("users")
    .doc(uid)
    .collection("history")
    .doc(sessionId);
}

async function existsSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  return snap.exists;
}

async function createSessionDoc(uid, sessionId, data) {
  await sessionRef(uid, sessionId).set(data, { merge: false });
}

async function getSessionDoc(uid, sessionId) {
  const snap = await sessionRef(uid, sessionId).get();
  if (!snap.exists) return null;
  return snap.data();
}

async function updateSessionDoc(uid, sessionId, patch) {
  if (!(await existsSessionDoc(uid, sessionId))) return;
  await sessionRef(uid, sessionId).set(patch, { merge: true });
}

async function markCompleted(uid, sessionId, patch = {}) {
  await updateSessionDoc(uid, sessionId, {
    durum: "tamamlandı",
    tamamlandı: Date.now(),
    tamamlandıSunucu:
      admin.firestore.FieldValue.serverTimestamp(),
    ...patch,
  });
}

async function markExpired(uid, sessionId) {
  await updateSessionDoc(uid, sessionId, {
    durum: "expired",
    expiredAt: Date.now(),
    expiredAtServer:
      admin.firestore.FieldValue.serverTimestamp(),
  });
}

/* =========================
   MEMORY CLEANUP
========================= */

setInterval(() => {
  const now = Date.now();

  for (const [id, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      sessionStore.delete(id);
    }
  }
}, 60000);

/* =========================
   HELPERS
========================= */

function resolveCardCount(mode) {
  switch (mode) {
    case "one":
      return 1;
    case "two":
      return 2;
    case "three":
      return 3;
    case "five":
      return 5;
    case "celtic":
      return 10;
    default:
      throw new Error("Geçersiz tarot mode");
  }
}

function pickCards(count) {
  const all = Array.from({ length: 78 }, (_, i) => i);

  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(0, count);
}

function toPicked(
  selectedCards,
  revealedCount
) {
  return (selectedCards || [])
    .slice(0, revealedCount)
    .map((id) => {
      const card = getTarotById(id);

      if (!card)
        throw new Error(
          `Kart bulunamadı: ${id}`
        );

      return {
        id,
        image: card.image,
      };
    });
}

/* =========================
   GPT
========================= */

async function generateInterpretation({
  mode,
  subType,
  question,
  selectedCards,
}) {
  const completion =
    await openai.chat.completions.create(
      {
        model: "gpt-4.1-mini",

        messages: [
          {
            role: "system",
            content:
              "Sen güçlü ve sezgisel bir tarot ustasısın.",
          },

          {
            role: "user",
            content: `
Mode:${mode}
Sub:${subType}
Question:${question}
Cards:${selectedCards.join(",")}
`,
          },
        ],

        temperature: 0.85,
      }
    );

  return (
    completion?.choices?.[0]
      ?.message?.content || ""
  ).trim();
}

/* =========================
   START
========================= */

export async function startTarot(
  uid,
  {
    mode,
    subType,
    question,
    coinPrice,
  }
) {
  if (!uid)
    throw new Error("UID gerekli");

  if (!coinPrice)
    throw new Error(
      "Coin price eksik"
    );

  const cardCount =
    resolveCardCount(mode);

  const selectedCards =
    pickCards(cardCount);

  const sessionId =
    crypto.randomUUID();

  const createdAt = Date.now();

  const interpretationPromise =
    generateInterpretation({
      mode,
      subType,
      question,
      selectedCards,
    }).catch((err) => {
      console.error(
        "GPT ERROR:",
        err
      );
      return null;
    });

  sessionStore.set(sessionId, {
    uid,
    mode,
    subType,
    question,
    selectedCards,
    revealed: [],
    interpretationPromise,
    cost: coinPrice,
    createdAt,
    processing: false,
    status: "active",
  });

  return {
    sessionId,
    cardCount,
  };
}

/* =========================
   REVEAL
========================= */

export async function revealTarot(
  uid,
  { sessionId }
) {
  let session =
    sessionStore.get(sessionId);

  if (!session) {
    const doc =
      await getSessionDoc(
        uid,
        sessionId
      );

    if (!doc)
      throw new Error(
        "Session yok"
      );

    session = {
      uid: doc.uid,
      mode: doc.mod,
      subType:
        doc.altTip || null,
      question:
        doc.soru || null,
      selectedCards:
        doc.seçilenKartlar ||
        [],
      revealed:
        doc.açıklığaKavuşmuş ||
        [],
      interpretationPromise:
        null,
      cost: doc.maliyet,
      createdAt:
        doc.oluşturulmaTarihi,
      processing:
        !!doc.işleme,
      status:
        doc.durum ||
        "active",
    };

    sessionStore.set(
      sessionId,
      session
    );
  }

  if (session.uid !== uid)
    throw new Error(
      "Yetkisiz"
    );

  if (isExpired(session)) {
    await markExpired(
      uid,
      sessionId
    );

    sessionStore.delete(
      sessionId
    );

    throw new Error(
      "Session süresi doldu"
    );
  }

  const nextIndex =
    session.revealed.length;

  const cardId =
    session.selectedCards[
      nextIndex
    ];

  session.revealed.push(
    cardId
  );

  const picked = toPicked(
    session.selectedCards,
    session.revealed.length
  );

  if (
    session.revealed.length ===
    session.selectedCards.length
  ) {
    const interpretation =
      await session.interpretationPromise;

    const remainingCoin =
      await decreaseCoin(
        uid,
        session.cost,
        "TAROT",
        {
          sessionId,
          mode:
            session.mode,
        }
      );

    if (
      !(await existsSessionDoc(
        uid,
        sessionId
      ))
    ) {
      await createSessionDoc(
        uid,
        sessionId,
        {
          uid,

          tip: "tarot",

          "kart resimleri":
            picked.map(
              (card) => ({
                id: card.id,
                resim:
                  card.image,
              })
            ),

          tamamlandı:
            Date.now(),

          tamamlandıSunucu:
            admin.firestore.FieldValue.serverTimestamp(),

          maliyet:
            session.cost,

          oluşturulmaTarihi:
            session.createdAt,

          oluşturulduSunucu:
            admin.firestore.FieldValue.serverTimestamp(),

          tercüme:
            interpretation,

          yorumlamaReadyAt:
            Date.now(),

          yorumlamaSunucudaHazır:
            admin.firestore.FieldValue.serverTimestamp(),

          mod:
            session.mode,

          işleme: false,

          soru:
            session.question ??
            null,

          kalanPara:
            remainingCoin,

          açıklığaKavuşmuş:
            session.revealed,

          seçilenKartlar:
            session.selectedCards,

          sessionId,

          durum:
            "tamamlandı",

          altTip:
            session.subType ??
            null,
        }
      );
    }

    await markCompleted(
      uid,
      sessionId,
      {
        kalanPara:
          remainingCoin,
      }
    );

    sessionStore.delete(
      sessionId
    );

    return {
      picked,
      interpretation,
      remainingCoin,
    };
  }

  return {
    picked,
    interpretation: null,
    remainingCoin: null,
  };
}