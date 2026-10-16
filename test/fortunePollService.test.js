import assert from "node:assert/strict";
import test from "node:test";

import {
  createFortunePollService,
  isPremiumActive,
  validatePollInput,
} from "../services/fortunePollService.js";

class FakeSnapshot {
  constructor(id, value) {
    this.id = id;
    this.value = value;
    this.exists = value !== undefined;
  }

  data() {
    return structuredClone(this.value);
  }
}

class FakeDocument {
  constructor(db, path) {
    this.db = db;
    this.path = path;
    this.id = path.at(-1);
  }

  collection(name) {
    return new FakeCollection(this.db, [...this.path, name]);
  }

  async get() {
    return new FakeSnapshot(this.id, this.db.records.get(this.path.join("/")));
  }

  async update(value) {
    const key = this.path.join("/");
    this.db.records.set(key, { ...this.db.records.get(key), ...structuredClone(value) });
  }

  async set(value, options) {
    const key = this.path.join("/");
    const current = this.db.records.get(key);
    this.db.records.set(
      key,
      options?.merge ? { ...current, ...structuredClone(value) } : structuredClone(value),
    );
  }
}

class FakeCollection {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  doc(id) {
    return new FakeDocument(this.db, [...this.path, id || `new-${++this.db.id}`]);
  }

  where(field, operator, expected) {
    return {
      get: async () => {
        const prefix = `${this.path.join("/")}/`;
        const depth = this.path.length + 1;
        const docs = [...this.db.records.entries()]
          .filter(([key]) => key.startsWith(prefix) && key.split("/").length === depth)
          .map(([key, value]) => new FakeSnapshot(key.split("/").at(-1), value))
          .filter((snapshot) => {
            const actual = snapshot.data()[field];
            if (operator === "==") return actual === expected;
            if (operator === ">") return actual > expected;
            throw new Error(`Unsupported operator: ${operator}`);
          });
        return { docs };
      },
    };
  }
}

class FakeFirestore {
  constructor(records) {
    this.records = new Map(Object.entries(records));
    this.id = 0;
    this.queue = Promise.resolve();
  }

  collection(name) {
    return new FakeCollection(this, [name]);
  }

  async runTransaction(callback) {
    const operation = this.queue.catch(() => undefined).then(() =>
      callback({
        get: (ref) => ref.get(),
        set: (ref, value, options) => {
          const key = ref.path.join("/");
          const current = this.records.get(key);
          this.records.set(
            key,
            options?.merge ? { ...current, ...structuredClone(value) } : structuredClone(value),
          );
        },
        update: (ref, value) => {
          const key = ref.path.join("/");
          this.records.set(key, { ...this.records.get(key), ...structuredClone(value) });
        },
      }),
    );
    this.queue = operation;
    return operation;
  }
}

const fakeAdmin = {
  firestore: {
    Timestamp: { fromMillis: (value) => new Date(value) },
  },
};

function pollRecord() {
  return {
    alias: "Ada",
    question: "Hangisini seçmeliyim?",
    description: null,
    options: [
      { id: "option1", label: "A", voteCount: 0 },
      { id: "option2", label: "B", voteCount: 0 },
    ],
    totalVotes: 0,
    status: "open",
    createdAt: new Date(),
    endsAt: new Date(Date.now() + 86_400_000),
  };
}

function validPollInput(overrides = {}) {
  return {
    alias: "Ada",
    question: "Hangisini seçmeliyim?",
    sourceHistoryId: "history-1",
    options: ["A", "B"],
    description: "İlk cümle. İkinci cümle!",
    endsAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

test("oylama girdisi iki seçenek, kaynak fal ve iki cümle açıklama ister", () => {
  const poll = validatePollInput(validPollInput());
  assert.equal(poll.options.length, 2);

  assert.throws(
    () => validatePollInput(validPollInput({ options: ["A"] })),
    { code: "INVALID_POLL" },
  );
  assert.throws(
    () => validatePollInput(validPollInput({ description: "Bir. İki. Üç." })),
    { code: "INVALID_POLL" },
  );
  assert.throws(
    () => validatePollInput(validPollInput({ question: "https://ornek.test" })),
    { code: "UNSAFE_CONTENT" },
  );
});

test("kaynak fal yalnızca sahibinin geçmişinden doğrulanır ve özel metin kopyalanmaz", async () => {
  const db = new FakeFirestore({
    "users/owner/history/history-1": { type: "tarot", interpretation: "özel metin" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  const poll = await service.createPoll("owner", validPollInput());
  assert.equal(poll.id, "new-1");
  assert.equal(poll.sourceHistoryId, undefined);
  assert.equal(db.records.get("fortunePolls/new-1").interpretation, undefined);
  assert.deepEqual(db.records.get("fortunePollPrivate/new-1"), {
    ownerUid: "owner",
    sourceHistoryId: "history-1",
    createdAt: db.records.get("fortunePollPrivate/new-1").createdAt,
  });

  await assert.rejects(
    service.createPoll("other", validPollInput()),
    { code: "SOURCE_FORTUNE_NOT_FOUND" },
  );
});

test("premium yalnızca sunucudaki süresi geçmemiş abonelikte aktiftir", () => {
  assert.equal(
    isPremiumActive({ isPremium: true, premiumUntil: new Date(Date.now() + 60_000) }),
    true,
  );
  assert.equal(
    isPremiumActive({ isPremium: true, premiumUntil: new Date(Date.now() - 1) }),
    false,
  );
  assert.equal(isPremiumActive({ isPremium: false }), false);
});

test("yetkisiz sonuç erişimi, mükerrer oy ve günlük limit engellenir", async () => {
  const db = new FakeFirestore({
    "users/owner/history/history-1": { type: "tarot", interpretation: "özel" },
    "users/voter": { isPremium: false, premiumUntil: new Date(0) },
    "users/other": { isPremium: false, premiumUntil: new Date(0) },
    "fortunePolls/poll-1": pollRecord(),
    "fortunePolls/poll-2": pollRecord(),
    "fortunePolls/poll-3": pollRecord(),
    "fortunePollPrivate/poll-1": { ownerUid: "owner", sourceHistoryId: "history-1" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  await assert.rejects(
    service.getResults("other", "poll-1"),
    { code: "FORBIDDEN" },
  );

  const concurrentVotes = await Promise.allSettled([
    service.vote("voter", "poll-1", "option1"),
    service.vote("voter", "poll-1", "option1"),
  ]);
  assert.equal(concurrentVotes.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    concurrentVotes.find((result) => result.status === "rejected").reason.code,
    "DUPLICATE_VOTE",
  );

  await service.vote("voter", "poll-2", "option2");
  await assert.rejects(service.vote("voter", "poll-3", "option1"), {
    code: "DAILY_LIMIT",
  });
  assert.equal(db.records.get("fortunePolls/poll-1").totalVotes, 1);
  assert.equal(db.records.get("fortunePolls/poll-2").totalVotes, 1);
  assert.equal(db.records.get("fortunePolls/poll-3").totalVotes, 0);
});

test("süresi geçen oylama transaction içinde kapatılır ve oy kabul etmez", async () => {
  const db = new FakeFirestore({
    "users/voter": { isPremium: true, premiumUntil: new Date(Date.now() + 60_000) },
    "fortunePolls/closed": { ...pollRecord(), endsAt: new Date(Date.now() - 1) },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  await assert.rejects(service.vote("voter", "closed", "option1"), {
    code: "POLL_CLOSED",
  });
  assert.equal(db.records.get("fortunePolls/closed").status, "closed");
  assert.equal(db.records.get("fortunePolls/closed").totalVotes, 0);
});

test("aktif Premium yorum yazabilir; ücretsiz veya süresi dolmuş üyelik yazamaz", async () => {
  const db = new FakeFirestore({
    "users/owner": { isPremium: false },
    "users/premium": { isPremium: true, premiumUntil: new Date(Date.now() + 60_000) },
    "users/free": { isPremium: false },
    "users/expired": { isPremium: true, premiumUntil: new Date(Date.now() - 1) },
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollPrivate/poll-1": { ownerUid: "owner", sourceHistoryId: "history-1" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  const comment = await service.createComment("premium", "poll-1", {
    alias: "Deniz",
    text: "Bence içinden geleni dinlemelisin.",
  });
  assert.equal(comment.alias, "Deniz");
  assert.equal(comment.canDelete, true);
  assert.equal(comment.authorUid, undefined);
  assert.equal(comment.reviewStatus, "APPROVED");

  await assert.rejects(
    service.createComment("free", "poll-1", { alias: "Ece", text: "Katılıyorum." }),
    { code: "PREMIUM_REQUIRED" },
  );
  await assert.rejects(
    service.createComment("expired", "poll-1", { alias: "Ece", text: "Katılıyorum." }),
    { code: "PREMIUM_REQUIRED" },
  );
});

test("yorum filtresi temiz yorumu yayımlar, kişisel iletişimi incelemeye alır ve yasak içeriği reddeder", async () => {
  const db = new FakeFirestore({
    "users/owner": { isPremium: false },
    "users/premium": { isPremium: true, premiumUntil: new Date(Date.now() + 60_000) },
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollPrivate/poll-1": { ownerUid: "owner", sourceHistoryId: "history-1" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  const clean = await service.createComment("premium", "poll-1", {
    alias: "Deniz",
    text: "İçinden geleni dinlemelisin.",
  });
  assert.equal(clean.reviewStatus, "APPROVED");
  assert.equal(db.records.get("fortunePolls/poll-1/comments/new-1").visibility, "visible");

  const pending = await service.createComment("premium", "poll-1", {
    alias: "Deniz",
    text: "Bana test@example.com üzerinden ulaş.",
  });
  assert.equal(pending.reviewStatus, "PENDING_REVIEW");
  assert.equal(db.records.get("fortunePolls/poll-1/comments/new-2"), undefined);
  assert.equal(
    db.records.get("fortunePollCommentPrivate/new-2").status,
    "PENDING_REVIEW",
  );
  assert.deepEqual(await service.getComments("viewer", "poll-1"), [
    {
      id: "new-1",
      alias: "Deniz",
      text: "İçinden geleni dinlemelisin.",
      createdAt: db.records.get("fortunePolls/poll-1/comments/new-1").createdAt,
      canDelete: false,
    },
  ]);

  await assert.rejects(
    service.createComment("premium", "poll-1", {
      alias: "Deniz",
      text: "Bu porno içerik yayımlansın.",
    }),
    { code: "COMMENT_REJECTED" },
  );
  assert.equal(db.records.get("fortunePollCommentPrivate/new-3"), undefined);
  assert.equal(db.records.get("fortunePolls/poll-1/comments/new-3"), undefined);
});

test("yalnız moderatör bekleyen yorumu görür, onaylar veya reddeder", async () => {
  const db = new FakeFirestore({
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollCommentPrivate/comment-approve": {
      alias: "Deniz",
      text: "Bana örnek@site.test üzerinden ulaş.",
      authorUid: "premium-user",
      pollId: "poll-1",
      status: "PENDING_REVIEW",
      createdAt: new Date(),
    },
    "fortunePollCommentPrivate/comment-reject": {
      alias: "Ece",
      text: "İletişim bilgisi içeren yorum.",
      authorUid: "premium-user",
      pollId: "poll-1",
      status: "PENDING_REVIEW",
      createdAt: new Date(),
    },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });
  const moderator = { uid: "moderator", isModerator: true };

  await assert.rejects(
    service.getPendingComments({ uid: "viewer", isModerator: false }),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(
    service.moderatePendingComment({ uid: "viewer", isModerator: false }, "comment-approve", "approve"),
    { code: "FORBIDDEN" },
  );

  const queue = await service.getPendingComments(moderator);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].poll.id, "poll-1");
  assert.equal(queue[0].poll.question, "Hangisini seçmeliyim?");

  await service.moderatePendingComment(moderator, "comment-approve", "approve");
  assert.equal(
    db.records.get("fortunePolls/poll-1/comments/comment-approve").visibility,
    "visible",
  );
  assert.equal(
    db.records.get("fortunePollCommentPrivate/comment-approve").status,
    "APPROVED",
  );

  await service.moderatePendingComment(moderator, "comment-reject", "reject");
  assert.equal(db.records.get("fortunePolls/poll-1/comments/comment-reject"), undefined);
  assert.equal(
    db.records.get("fortunePollCommentPrivate/comment-reject").status,
    "REJECTED",
  );
});

test("eşzamanlı yorum incelemesinde yalnız ilk moderasyon işlemi uygulanır", async () => {
  const db = new FakeFirestore({
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollCommentPrivate/comment-1": {
      alias: "Deniz",
      text: "İnceleme yorumu",
      authorUid: "premium-user",
      pollId: "poll-1",
      status: "PENDING_REVIEW",
      createdAt: new Date(),
    },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });
  const moderator = { uid: "moderator", isModerator: true };

  const outcomes = await Promise.allSettled([
    service.moderatePendingComment(moderator, "comment-1", "approve"),
    service.moderatePendingComment(moderator, "comment-1", "reject"),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(
    outcomes.find((outcome) => outcome.status === "rejected").reason.code,
    "MODERATION_ALREADY_RESOLVED",
  );
});

test("yorum sahibi olmayan kullanıcı yorumu silemez", async () => {
  const db = new FakeFirestore({
    "fortunePolls/poll-1": pollRecord(),
    "fortunePolls/poll-1/comments/comment-1": {
      alias: "Deniz",
      text: "Yorum",
      visibility: "visible",
      createdAt: new Date(),
    },
    "fortunePollCommentPrivate/comment-1": { authorUid: "comment-owner", pollId: "poll-1" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  await assert.rejects(
    service.deleteComment("other-user", "poll-1", "comment-1"),
    { code: "FORBIDDEN" },
  );
  assert.equal(
    db.records.get("fortunePolls/poll-1/comments/comment-1").visibility,
    "visible",
  );
});

test("oylama ve yorum şikâyeti özel kaydedilir; engellenen yazarın içeriği gizlenir", async () => {
  const db = new FakeFirestore({
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollPrivate/poll-1": { ownerUid: "poll-owner", sourceHistoryId: "history-1" },
    "fortunePolls/poll-1/comments/comment-1": {
      alias: "Deniz",
      text: "Yorum",
      visibility: "visible",
      createdAt: new Date(),
    },
    "fortunePollCommentPrivate/comment-1": { authorUid: "comment-owner", pollId: "poll-1" },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  await service.reportPoll("viewer", "poll-1", "Uygunsuz içerik");
  await service.reportComment("viewer", "poll-1", "comment-1", "Uygunsuz içerik");
  const reports = [...db.records.entries()]
    .filter(([key]) => key.startsWith("fortunePollReports/"));
  assert.equal(reports.length, 2);
  assert.equal(reports[0][1].reporterUid, "viewer");

  await service.blockAuthor("viewer", { pollId: "poll-1", commentId: "comment-1" });
  assert.deepEqual(await service.getComments("viewer", "poll-1"), []);
  await service.blockAuthor("viewer", { pollId: "poll-1" });
  assert.deepEqual(await service.getActivePolls("viewer"), []);
});

test("moderatör olmayan kullanıcı şikâyet inceleyemez", async () => {
  const db = new FakeFirestore({
    "fortunePolls/poll-1": pollRecord(),
    "fortunePollReports/report-1": {
      targetType: "poll",
      pollId: "poll-1",
      targetId: "poll-1",
      reason: "Uygunsuz içerik",
      status: "open",
      createdAt: new Date(),
    },
  });
  const service = createFortunePollService({ db, admin: fakeAdmin });

  await assert.rejects(
    service.moderateReport({ uid: "viewer", isModerator: false }, "report-1", "hide"),
    { code: "FORBIDDEN" },
  );
  await service.moderateReport({ uid: "moderator", isModerator: true }, "report-1", "hide");
  assert.equal(db.records.get("fortunePolls/poll-1").visibility, "hidden");
});
