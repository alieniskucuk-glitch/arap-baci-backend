import {
  classifyCommunityText,
  validateCommunityText,
} from "../utils/fortunePollContent.js";

const TIME_ZONE = "Europe/Istanbul";
const FREE_DAILY_VOTE_LIMIT = 2;

function pollError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function timestampToMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Number.NaN;
}

function trimRequired(value, field) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw pollError("INVALID_POLL", `${field} zorunludur`);
  }
  return normalized;
}

function validatePublicText(value, field, options) {
  try {
    return validateCommunityText(value, field, options);
  } catch (error) {
    if (error?.code === "UNSAFE_CONTENT") throw error;
    throw pollError("INVALID_CONTENT", `${field} geçersiz`, 400);
  }
}

function sentenceCount(value) {
  const normalized = value.trim();
  if (!normalized) return 0;
  return (normalized.match(/[.!?]+/g) || []).length || 1;
}

export function getIstanbulDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isPremiumActive(user, nowMs = Date.now()) {
  return (
    user?.isPremium === true &&
    Number.isFinite(timestampToMillis(user?.premiumUntil)) &&
    timestampToMillis(user.premiumUntil) > nowMs
  );
}

export function validatePollInput(input, nowMs = Date.now()) {
  const alias = validatePublicText(input?.alias, "Rumuz", { maxLength: 40 });
  const question = validatePublicText(input?.question, "Soru", { maxLength: 320 });
  const sourceHistoryId = trimRequired(input?.sourceHistoryId, "Kaynak fal");
  const rawOptions = Array.isArray(input?.options) ? input.options : [];

  if (rawOptions.length !== 2) {
    throw pollError("INVALID_POLL", "Tam olarak iki seçenek gereklidir");
  }

  const optionLabels = rawOptions.map((option, index) =>
    validatePublicText(option, `Seçenek ${index + 1}`, { maxLength: 120 }),
  );
  const description = validatePublicText(input?.description, "Açıklama", {
    maxLength: 500,
    required: false,
  });

  if (sentenceCount(description) > 2) {
    throw pollError("INVALID_POLL", "Açıklama en fazla iki cümle olabilir");
  }

  const endsAtMs = Date.parse(String(input?.endsAt || ""));
  if (!Number.isFinite(endsAtMs) || endsAtMs <= nowMs) {
    throw pollError("INVALID_POLL", "Bitiş zamanı gelecekte olmalıdır");
  }

  return {
    alias,
    question,
    sourceHistoryId,
    options: optionLabels,
    description: description || null,
    endsAtMs,
  };
}

function validateCommentInput(input) {
  const text = classifyCommunityText(input?.text, "Yorum", { maxLength: 1000 });
  return {
    alias: validatePublicText(input?.alias, "Rumuz", { maxLength: 40 }),
    text: text.text,
    reviewStatus: text.status,
  };
}

function validateReportReason(value) {
  return validatePublicText(value, "Şikâyet nedeni", { maxLength: 500 });
}

function isVisible(data) {
  return data?.visibility !== "hidden" && data?.visibility !== "removed";
}

function pollStatus(data, nowMs) {
  const endsAtMs = timestampToMillis(data?.endsAt);
  return data?.status === "open" && endsAtMs > nowMs ? "open" : "closed";
}

function publicPoll(id, data, nowMs = Date.now()) {
  const options = Array.isArray(data?.options) ? data.options : [];
  const totalVotes = Math.max(0, Number(data?.totalVotes) || 0);

  return {
    id,
    alias: typeof data?.alias === "string" ? data.alias : "",
    question: typeof data?.question === "string" ? data.question : "",
    description: typeof data?.description === "string" ? data.description : null,
    options: options.map((option) => {
      const voteCount = Math.max(0, Number(option?.voteCount) || 0);
      return {
        id: option?.id,
        label: option?.label,
        voteCount,
        percentage: totalVotes === 0 ? 0 : (voteCount * 100) / totalVotes,
      };
    }),
    totalVotes,
    status: pollStatus(data, nowMs),
    createdAt: data?.createdAt || null,
    endsAt: data?.endsAt || null,
  };
}

function publicComment(id, data, canDelete = false) {
  return {
    id,
    alias: typeof data?.alias === "string" ? data.alias : "",
    text: typeof data?.text === "string" ? data.text : "",
    createdAt: data?.createdAt || null,
    canDelete,
  };
}

function sortNewest(left, right) {
  return timestampToMillis(right.createdAt) - timestampToMillis(left.createdAt);
}

export function createFortunePollService({ db, admin }) {
  const polls = db.collection("fortunePolls");
  const pollPrivate = db.collection("fortunePollPrivate");
  const voteUsage = db.collection("fortunePollVoteUsage");
  const commentPrivate = db.collection("fortunePollCommentPrivate");
  const reports = db.collection("fortunePollReports");
  const blocks = db.collection("fortunePollBlocks");

  async function blockedUidsFor(uid) {
    if (!uid) return new Set();
    const snapshot = await blocks.where("blockerUid", "==", uid).get();
    return new Set(
      snapshot.docs
        .map((doc) => doc.data() || {})
        .filter((block) => block.active !== false)
        .map((block) => block.blockedUid)
        .filter((blockedUid) => typeof blockedUid === "string" && blockedUid),
    );
  }

  async function pollOwnerUid(pollId) {
    const snapshot = await pollPrivate.doc(pollId).get();
    return snapshot.exists ? snapshot.data()?.ownerUid : null;
  }

  async function assertPollVisibleTo(uid, pollId) {
    const pollRef = polls.doc(pollId);
    const snapshot = await pollRef.get();
    if (!snapshot.exists || !isVisible(snapshot.data())) {
      throw pollError("POLL_NOT_FOUND", "Oylama bulunamadı", 404);
    }
    if (uid) {
      const [ownerUid, blockedUids] = await Promise.all([
        pollOwnerUid(pollId),
        blockedUidsFor(uid),
      ]);
      if (ownerUid && blockedUids.has(ownerUid)) {
        throw pollError("POLL_NOT_FOUND", "Oylama bulunamadı", 404);
      }
    }
    return { pollRef, data: snapshot.data() };
  }

  function requireModerator(actor) {
    if (!actor?.isModerator) {
      throw pollError("FORBIDDEN", "Bu işlem için moderatör yetkisi gerekli", 403);
    }
  }

  async function closeIfExpired(pollRef, data, now) {
    if (pollStatus(data, now.getTime()) === "open") return data;

    if (data.status !== "closed") {
      await pollRef.update({ status: "closed", closedAt: now });
    }

    return { ...data, status: "closed", closedAt: data.closedAt || now };
  }

  async function getPoll(pollId, viewerUid = null) {
    const { pollRef, data: originalData } = await assertPollVisibleTo(
      viewerUid,
      pollId,
    );
    const data = await closeIfExpired(pollRef, originalData, new Date());
    return publicPoll(pollId, data);
  }

  return {
    async createPoll(uid, input) {
      const now = new Date();
      const value = validatePollInput(input, now.getTime());
      const pollRef = polls.doc();
      const privateRef = pollPrivate.doc(pollRef.id);
      const sourceRef = db
        .collection("users")
        .doc(uid)
        .collection("history")
        .doc(value.sourceHistoryId);
      const endsAt = admin.firestore.Timestamp.fromMillis(value.endsAtMs);

      const data = {
        alias: value.alias,
        question: value.question,
        description: value.description,
        options: value.options.map((label, index) => ({
          id: `option${index + 1}`,
          label,
          voteCount: 0,
        })),
        totalVotes: 0,
        status: "open",
        createdAt: now,
        endsAt,
      };

      await db.runTransaction(async (transaction) => {
        const source = await transaction.get(sourceRef);
        if (!source.exists) {
          throw pollError("SOURCE_FORTUNE_NOT_FOUND", "Kaynak fal bulunamadı", 404);
        }

        transaction.set(pollRef, data);
        transaction.set(privateRef, {
          ownerUid: uid,
          sourceHistoryId: value.sourceHistoryId,
          createdAt: now,
        });
      });

      return publicPoll(pollRef.id, data, now.getTime());
    },

    async getActivePolls(viewerUid = null) {
      const now = new Date();
      const snapshot = await polls.where("endsAt", ">", now).get();
      const blockedUids = await blockedUidsFor(viewerUid);
      const owners = await Promise.all(
        snapshot.docs.map((doc) => pollOwnerUid(doc.id)),
      );

      return snapshot.docs
        .map((doc, index) => ({
          poll: publicPoll(doc.id, doc.data(), now.getTime()),
          visible: isVisible(doc.data()) && !blockedUids.has(owners[index]),
        }))
        .filter(({ poll, visible }) => visible && poll.status === "open")
        .map(({ poll }) => poll)
        .sort((left, right) => timestampToMillis(left.endsAt) - timestampToMillis(right.endsAt));
    },

    getPoll,

    async vote(uid, pollId, optionId) {
      const normalizedOptionId = trimRequired(optionId, "Seçenek");
      await assertPollVisibleTo(uid, pollId);
      const pollRef = polls.doc(pollId);
      const voteRef = pollRef.collection("votes").doc(uid);
      const userRef = db.collection("users").doc(uid);
      const now = new Date();
      const nowMs = now.getTime();
      const dayKey = getIstanbulDayKey(now);
      const usageRef = voteUsage.doc(`${uid}_${dayKey}`);

      const outcome = await db.runTransaction(async (transaction) => {
        const [pollSnapshot, voteSnapshot, userSnapshot, usageSnapshot] =
          await Promise.all([
            transaction.get(pollRef),
            transaction.get(voteRef),
            transaction.get(userRef),
            transaction.get(usageRef),
          ]);

        if (!pollSnapshot.exists) {
          return { code: "POLL_NOT_FOUND" };
        }
        if (!userSnapshot.exists) {
          return { code: "USER_NOT_FOUND" };
        }

        const poll = pollSnapshot.data();
        if (pollStatus(poll, nowMs) !== "open") {
          if (poll.status !== "closed") {
            transaction.update(pollRef, { status: "closed", closedAt: now });
          }
          return { code: "POLL_CLOSED" };
        }
        if (voteSnapshot.exists) {
          return { code: "DUPLICATE_VOTE" };
        }

        const options = Array.isArray(poll.options) ? poll.options : [];
        const optionIndex = options.findIndex(
          (option) => option?.id === normalizedOptionId,
        );
        if (optionIndex === -1) {
          return { code: "INVALID_OPTION" };
        }

        const user = userSnapshot.data() || {};
        const premium = isPremiumActive(user, nowMs);
        const usage = usageSnapshot.exists ? usageSnapshot.data() || {} : {};
        const usedVotes = Math.max(0, Number(usage.count) || 0);

        if (!premium && usedVotes >= FREE_DAILY_VOTE_LIMIT) {
          return { code: "DAILY_LIMIT" };
        }

        const updatedOptions = options.map((option, index) =>
          index === optionIndex
            ? { ...option, voteCount: Math.max(0, Number(option.voteCount) || 0) + 1 }
            : option,
        );
        const totalVotes = Math.max(0, Number(poll.totalVotes) || 0) + 1;

        transaction.update(pollRef, {
          options: updatedOptions,
          totalVotes,
          updatedAt: now,
        });
        transaction.set(voteRef, {
          optionId: normalizedOptionId,
          votedAt: now,
        });
        if (!premium) {
          transaction.set(
            usageRef,
            { uid, dayKey, count: usedVotes + 1, updatedAt: now },
            { merge: true },
          );
        }

        return { code: "OK", poll: { ...poll, options: updatedOptions, totalVotes } };
      });

      const messages = {
        POLL_NOT_FOUND: ["Oylama bulunamadı", 404],
        USER_NOT_FOUND: ["Kullanıcı bulunamadı", 404],
        POLL_CLOSED: ["Oylama kapandı", 409],
        DUPLICATE_VOTE: ["Bu oylamada zaten oy kullandınız", 409],
        INVALID_OPTION: ["Geçersiz seçenek", 400],
        DAILY_LIMIT: ["Günlük ücretsiz oy limitine ulaştınız", 403],
      };
      if (outcome.code !== "OK") {
        const [message, status] = messages[outcome.code] || ["Oy kullanılamadı", 500];
        throw pollError(outcome.code, message, status);
      }

      return publicPoll(pollId, outcome.poll, nowMs);
    },

    async getResults(uid, pollId) {
      const privateRef = pollPrivate.doc(pollId);
      const privateSnapshot = await privateRef.get();
      if (!privateSnapshot.exists) {
        throw pollError("POLL_NOT_FOUND", "Oylama bulunamadı", 404);
      }
      if (privateSnapshot.data()?.ownerUid !== uid) {
        throw pollError("FORBIDDEN", "Bu oylamanın sonuçlarını görüntüleyemezsiniz", 403);
      }

      return getPoll(pollId);
    },

    async getMyPolls(uid) {
      const now = Date.now();
      const privateSnapshot = await pollPrivate.where("ownerUid", "==", uid).get();
      const pollSnapshots = await Promise.all(
        privateSnapshot.docs.map((doc) => polls.doc(doc.id).get()),
      );

      return pollSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => publicPoll(snapshot.id, snapshot.data(), now))
        .sort(sortNewest);
    },

    async getComments(uid, pollId) {
      await getPoll(pollId, uid);
      const comments = await polls
        .doc(pollId)
        .collection("comments")
        .where("visibility", "==", "visible")
        .get();
      const [blockedUids, privateSnapshots] = await Promise.all([
        blockedUidsFor(uid),
        Promise.all(comments.docs.map((doc) => commentPrivate.doc(doc.id).get())),
      ]);

      return comments.docs
        .map((doc, index) => {
          const privateData = privateSnapshots[index].exists
            ? privateSnapshots[index].data() || {}
            : {};
          return {
            comment: publicComment(doc.id, doc.data(), privateData.authorUid === uid),
            authorUid: privateData.authorUid,
          };
        })
        .filter(({ authorUid }) => !blockedUids.has(authorUid))
        .map(({ comment }) => comment)
        .sort((left, right) => timestampToMillis(right.createdAt) - timestampToMillis(left.createdAt));
    },

    async createComment(uid, pollId, input) {
      const value = validateCommentInput(input);
      if (value.reviewStatus === "REJECTED") {
        throw pollError(
          "COMMENT_REJECTED",
          "Yorumun topluluk kurallarına uygun olmadığı için yayınlanmadı",
          400,
        );
      }
      const now = new Date();
      await assertPollVisibleTo(uid, pollId);
      const pollRef = polls.doc(pollId);
      const commentRef = pollRef.collection("comments").doc();
      const privateRef = commentPrivate.doc(commentRef.id);
      const userRef = db.collection("users").doc(uid);

      const outcome = await db.runTransaction(async (transaction) => {
        const [pollSnapshot, userSnapshot] = await Promise.all([
          transaction.get(pollRef),
          transaction.get(userRef),
        ]);
        if (!pollSnapshot.exists || !isVisible(pollSnapshot.data())) {
          return { code: "POLL_NOT_FOUND" };
        }
        if (!userSnapshot.exists) return { code: "USER_NOT_FOUND" };
        if (!isPremiumActive(userSnapshot.data() || {}, now.getTime())) {
          return { code: "PREMIUM_REQUIRED" };
        }

        if (value.reviewStatus === "PENDING_REVIEW") {
          transaction.set(privateRef, {
            alias: value.alias,
            text: value.text,
            authorUid: uid,
            pollId,
            status: "PENDING_REVIEW",
            createdAt: now,
          });
          return { code: "PENDING_REVIEW" };
        }

        const data = {
          alias: value.alias,
          text: value.text,
          createdAt: now,
          visibility: "visible",
        };
        transaction.set(commentRef, data);
        transaction.set(privateRef, {
          authorUid: uid,
          pollId,
          createdAt: now,
        });
        return { code: "OK", data };
      });

      const messages = {
        POLL_NOT_FOUND: ["Oylama bulunamadı", 404],
        USER_NOT_FOUND: ["Kullanıcı bulunamadı", 404],
        PREMIUM_REQUIRED: ["Yorum yazmak için aktif Premium üyelik gerekir", 403],
      };
      if (outcome.code === "PENDING_REVIEW") {
        return { id: commentRef.id, reviewStatus: "PENDING_REVIEW" };
      }
      if (outcome.code !== "OK") {
        const [message, status] = messages[outcome.code] || ["Yorum gönderilemedi", 500];
        throw pollError(outcome.code, message, status);
      }
      return { ...publicComment(commentRef.id, outcome.data, true), reviewStatus: "APPROVED" };
    },

    async deleteComment(uid, pollId, commentId) {
      const commentRef = polls.doc(pollId).collection("comments").doc(commentId);
      const privateRef = commentPrivate.doc(commentId);
      const outcome = await db.runTransaction(async (transaction) => {
        const [commentSnapshot, privateSnapshot] = await Promise.all([
          transaction.get(commentRef),
          transaction.get(privateRef),
        ]);
        if (!commentSnapshot.exists || !privateSnapshot.exists) {
          return { code: "COMMENT_NOT_FOUND" };
        }
        if (privateSnapshot.data()?.authorUid !== uid) {
          return { code: "FORBIDDEN" };
        }
        transaction.update(commentRef, {
          visibility: "removed",
          removedAt: new Date(),
        });
        return { code: "OK" };
      });
      if (outcome.code === "COMMENT_NOT_FOUND") {
        throw pollError(outcome.code, "Yorum bulunamadı", 404);
      }
      if (outcome.code === "FORBIDDEN") {
        throw pollError(outcome.code, "Bu yorumu silemezsiniz", 403);
      }
    },

    async reportPoll(uid, pollId, reason) {
      await getPoll(pollId, uid);
      const reportRef = reports.doc();
      await reportRef.set({
        targetType: "poll",
        pollId,
        targetId: pollId,
        reporterUid: uid,
        reason: validateReportReason(reason),
        status: "open",
        createdAt: new Date(),
      });
      return { id: reportRef.id };
    },

    async reportComment(uid, pollId, commentId, reason) {
      await getPoll(pollId, uid);
      const commentSnapshot = await polls.doc(pollId).collection("comments").doc(commentId).get();
      if (!commentSnapshot.exists || !isVisible(commentSnapshot.data())) {
        throw pollError("COMMENT_NOT_FOUND", "Yorum bulunamadı", 404);
      }
      const reportRef = reports.doc();
      await reportRef.set({
        targetType: "comment",
        pollId,
        targetId: commentId,
        reporterUid: uid,
        reason: validateReportReason(reason),
        status: "open",
        createdAt: new Date(),
      });
      return { id: reportRef.id };
    },

    async blockAuthor(uid, { pollId, commentId = null }) {
      const commentPrivateSnapshot = commentId
        ? await commentPrivate.doc(commentId).get()
        : null;
      let targetUid = null;
      if (commentPrivateSnapshot?.exists) {
        const privateData = commentPrivateSnapshot.data() || {};
        if (privateData.pollId === pollId) targetUid = privateData.authorUid;
      } else if (!commentId) {
        targetUid = await pollOwnerUid(pollId);
      }
      if (!targetUid) {
        throw pollError("TARGET_NOT_FOUND", "Kullanıcı bulunamadı", 404);
      }
      if (targetUid === uid) {
        throw pollError("INVALID_BLOCK", "Kendinizi engelleyemezsiniz", 400);
      }
      const existing = await blocks.where("blockerUid", "==", uid).get();
      const matching = existing.docs.find((doc) =>
        doc.data()?.blockedUid === targetUid,
      );
      const blockRef = matching ? blocks.doc(matching.id) : blocks.doc();
      await blockRef.set({
        blockerUid: uid,
        blockedUid: targetUid,
        sourcePollId: pollId,
        active: true,
        createdAt: matching?.data()?.createdAt || new Date(),
        updatedAt: new Date(),
      }, { merge: true });
      return { id: blockRef.id };
    },

    async getBlockedUsers(uid) {
      const snapshot = await blocks.where("blockerUid", "==", uid).get();
      const visible = snapshot.docs
        .filter((doc) => doc.data()?.active !== false)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
      const pollSnapshots = await Promise.all(
        visible.map((block) => polls.doc(block.sourcePollId).get()),
      );
      return visible.map((block, index) => ({
        id: block.id,
        alias: pollSnapshots[index].exists
          ? pollSnapshots[index].data()?.alias || "Engellenen kullanıcı"
          : "Engellenen kullanıcı",
        createdAt: block.createdAt || null,
      }));
    },

    async unblockUser(uid, blockId) {
      const blockRef = blocks.doc(blockId);
      const snapshot = await blockRef.get();
      if (!snapshot.exists || snapshot.data()?.blockerUid !== uid) {
        throw pollError("BLOCK_NOT_FOUND", "Engel kaydı bulunamadı", 404);
      }
      await blockRef.update({ active: false, removedAt: new Date() });
    },

    async getModerationReports(actor) {
      requireModerator(actor);
      const snapshot = await reports.where("status", "==", "open").get();
      return snapshot.docs
        .map((doc) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            targetType: data.targetType,
            pollId: data.pollId,
            targetId: data.targetId,
            reason: data.reason,
            createdAt: data.createdAt || null,
            status: data.status,
          };
        })
        .sort((left, right) => timestampToMillis(right.createdAt) - timestampToMillis(left.createdAt));
    },

    async getPendingComments(actor) {
      requireModerator(actor);
      const snapshot = await commentPrivate.where("status", "==", "PENDING_REVIEW").get();
      const pollSnapshots = await Promise.all(
        snapshot.docs.map((doc) => polls.doc(doc.data()?.pollId).get()),
      );

      return snapshot.docs
        .map((doc, index) => {
          const data = doc.data() || {};
          const pollSnapshot = pollSnapshots[index];
          const poll = pollSnapshot.exists ? pollSnapshot.data() || {} : {};
          return {
            id: doc.id,
            alias: typeof data.alias === "string" ? data.alias : "",
            text: typeof data.text === "string" ? data.text : "",
            poll: pollSnapshot.exists
              ? {
                id: pollSnapshot.id,
                alias: typeof poll.alias === "string" ? poll.alias : "",
                question: typeof poll.question === "string" ? poll.question : "",
              }
              : null,
            createdAt: data.createdAt || null,
          };
        })
        .sort((left, right) => timestampToMillis(right.createdAt) - timestampToMillis(left.createdAt));
    },

    async moderatePendingComment(actor, commentId, action) {
      requireModerator(actor);
      if (!["approve", "reject"].includes(action)) {
        throw pollError("INVALID_MODERATION_ACTION", "Geçersiz moderasyon işlemi", 400);
      }

      const moderationRef = commentPrivate.doc(commentId);
      const now = new Date();
      await db.runTransaction(async (transaction) => {
        const moderationSnapshot = await transaction.get(moderationRef);
        if (!moderationSnapshot.exists) {
          throw pollError("COMMENT_NOT_FOUND", "İnceleme kaydı bulunamadı", 404);
        }
        const pending = moderationSnapshot.data() || {};
        if (pending.status !== "PENDING_REVIEW") {
          throw pollError("MODERATION_ALREADY_RESOLVED", "Yorum zaten incelendi", 409);
        }

        if (action === "approve") {
          const pollRef = polls.doc(pending.pollId);
          const pollSnapshot = await transaction.get(pollRef);
          if (!pollSnapshot.exists || !isVisible(pollSnapshot.data())) {
            throw pollError("POLL_NOT_FOUND", "Oylama bulunamadı", 404);
          }
          const commentRef = pollRef.collection("comments").doc(commentId);
          transaction.set(commentRef, {
            alias: pending.alias,
            text: pending.text,
            createdAt: pending.createdAt || now,
            approvedAt: now,
            visibility: "visible",
          });
          transaction.set(commentPrivate.doc(commentId), {
            authorUid: pending.authorUid,
            pollId: pending.pollId,
            createdAt: pending.createdAt || now,
            approvedAt: now,
            status: "APPROVED",
          }, { merge: true });
        }

        transaction.update(moderationRef, {
          status: action === "approve" ? "APPROVED" : "REJECTED",
          moderationAction: action,
          moderatorUid: actor.uid,
          reviewedAt: now,
        });
      });
    },

    async moderateReport(actor, reportId, action) {
      requireModerator(actor);
      if (!["hide", "remove", "dismiss"].includes(action)) {
        throw pollError("INVALID_MODERATION_ACTION", "Geçersiz moderasyon işlemi", 400);
      }
      const reportRef = reports.doc(reportId);
      const reportSnapshot = await reportRef.get();
      if (!reportSnapshot.exists) {
        throw pollError("REPORT_NOT_FOUND", "Şikâyet bulunamadı", 404);
      }
      const report = reportSnapshot.data() || {};
      if (report.status !== "open") {
        throw pollError("REPORT_RESOLVED", "Şikâyet zaten incelendi", 409);
      }
      const targetRef = report.targetType === "comment"
        ? polls.doc(report.pollId).collection("comments").doc(report.targetId)
        : polls.doc(report.pollId);
      await db.runTransaction(async (transaction) => {
        const targetSnapshot = await transaction.get(targetRef);
        if (!targetSnapshot.exists && action !== "dismiss") {
          throw pollError("TARGET_NOT_FOUND", "İçerik bulunamadı", 404);
        }
        if (action === "hide" || action === "remove") {
          transaction.update(targetRef, {
            visibility: action === "hide" ? "hidden" : "removed",
            moderatedAt: new Date(),
          });
        }
        transaction.update(reportRef, {
          status: action === "dismiss" ? "dismissed" : "actioned",
          moderationAction: action,
          moderatorUid: actor.uid,
          reviewedAt: new Date(),
        });
      });
    },
  };
}
