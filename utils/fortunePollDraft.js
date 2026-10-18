import { db, admin } from "../config/firebase.js";
import { parseFalDilemma } from "./falDilemma.js";

// Drafts are private server-side records.  The caller can only later claim a
// draft that belongs to the same authenticated user and source history record.
export async function persistFortunePollDraft({ uid, falId, dilemma }) {
  const ownerUid = String(uid || "").trim();
  const sourceFalId = String(falId || "").trim();
  const parsed = parseFalDilemma(dilemma);

  if (!ownerUid || !sourceFalId || !parsed.hasDilemma) return null;

  const ref = db.collection("fortunePollDrafts").doc(sourceFalId);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return;

    tx.set(ref, {
      ownerUid,
      falId: sourceFalId,
      question: parsed.question,
      option1: "Evet",
      option2: "Hayır",
      status: "available",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return sourceFalId;
}
