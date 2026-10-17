import express from "express";

import { admin, db } from "../config/firebase.js";
import auth from "../middleware/auth.js";
import { createFortunePollService } from "../services/fortunePollService.js";

const router = express.Router();
const polls = createFortunePollService({ db, admin });

function sendError(res, error, fallback) {
  console.error("FORTUNE POLL ERROR:", error);
  return res.status(error.status || 500).json({
    error: error.message || fallback,
    code: error.code || "FORTUNE_POLL_ERROR",
  });
}

router.get("/active", auth, async (req, res) => {
  try {
    return res.json({ polls: await polls.getActivePolls(req.user.uid) });
  } catch (error) {
    return sendError(res, error, "Aktif oylamalar yüklenemedi");
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    return res.json({ polls: await polls.getMyPolls(req.user.uid) });
  } catch (error) {
    return sendError(res, error, "Oylamalarınız yüklenemedi");
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    return res.json(await polls.getProfile(req.user.uid));
  } catch (error) {
    return sendError(res, error, "Anket profili yüklenemedi");
  }
});

router.post("/drafts/claim", auth, async (req, res) => {
  try {
    return res.json(await polls.claimDraft(req.user.uid, req.body));
  } catch (error) {
    return sendError(res, error, "Anket taslağı doğrulanamadı");
  }
});

router.get("/blocked-users", auth, async (req, res) => {
  try {
    return res.json({ blocks: await polls.getBlockedUsers(req.user.uid) });
  } catch (error) {
    return sendError(res, error, "Engellenen kullanıcılar yüklenemedi");
  }
});

router.delete("/blocked-users/:blockId", auth, async (req, res) => {
  try {
    await polls.unblockUser(req.user.uid, req.params.blockId);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error, "Engel kaldırılamadı");
  }
});

router.get("/moderation/reports", auth, async (req, res) => {
  try {
    return res.json({ reports: await polls.getModerationReports(req.user) });
  } catch (error) {
    return sendError(res, error, "Şikâyetler yüklenemedi");
  }
});

router.post("/moderation/reports/:reportId", auth, async (req, res) => {
  try {
    await polls.moderateReport(req.user, req.params.reportId, req.body?.action);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error, "Şikâyet incelenemedi");
  }
});

router.get("/moderation/comments/pending", auth, async (req, res) => {
  try {
    return res.json({ comments: await polls.getPendingComments(req.user) });
  } catch (error) {
    return sendError(res, error, "Onay bekleyen yorumlar yüklenemedi");
  }
});

router.post("/moderation/comments/:commentId", auth, async (req, res) => {
  try {
    await polls.moderatePendingComment(req.user, req.params.commentId, req.body?.action);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error, "Yorum incelenemedi");
  }
});

router.post("/", auth, async (req, res) => {
  try {
    return res.status(201).json(await polls.createPoll(req.user.uid, req.body));
  } catch (error) {
    return sendError(res, error, "Oylama oluşturulamadı");
  }
});

router.get("/:pollId/results", auth, async (req, res) => {
  try {
    return res.json(await polls.getResults(req.user.uid, req.params.pollId));
  } catch (error) {
    return sendError(res, error, "Oylama sonuçları yüklenemedi");
  }
});

router.post("/:pollId/votes", auth, async (req, res) => {
  try {
    return res.json(
      await polls.vote(req.user.uid, req.params.pollId, req.body?.optionId),
    );
  } catch (error) {
    return sendError(res, error, "Oy kullanılamadı");
  }
});

router.get("/:pollId/comments", auth, async (req, res) => {
  try {
    return res.json({ comments: await polls.getComments(req.user.uid, req.params.pollId) });
  } catch (error) {
    return sendError(res, error, "Yorumlar yüklenemedi");
  }
});

router.post("/:pollId/comments", auth, async (req, res) => {
  try {
    return res.status(201).json(
      await polls.createComment(req.user.uid, req.params.pollId, req.body),
    );
  } catch (error) {
    return sendError(res, error, "Yorum gönderilemedi");
  }
});

router.delete("/:pollId/comments/:commentId", auth, async (req, res) => {
  try {
    await polls.deleteComment(req.user.uid, req.params.pollId, req.params.commentId);
    return res.status(204).send();
  } catch (error) {
    return sendError(res, error, "Yorum silinemedi");
  }
});

router.post("/:pollId/comments/:commentId/report", auth, async (req, res) => {
  try {
    return res.status(201).json(await polls.reportComment(
      req.user.uid,
      req.params.pollId,
      req.params.commentId,
      req.body?.reason,
    ));
  } catch (error) {
    return sendError(res, error, "Yorum şikâyet edilemedi");
  }
});

router.post("/:pollId/comments/:commentId/block-author", auth, async (req, res) => {
  try {
    return res.status(201).json(await polls.blockAuthor(req.user.uid, {
      pollId: req.params.pollId,
      commentId: req.params.commentId,
    }));
  } catch (error) {
    return sendError(res, error, "Kullanıcı engellenemedi");
  }
});

router.post("/:pollId/report", auth, async (req, res) => {
  try {
    return res.status(201).json(
      await polls.reportPoll(req.user.uid, req.params.pollId, req.body?.reason),
    );
  } catch (error) {
    return sendError(res, error, "Oylama şikâyet edilemedi");
  }
});

router.post("/:pollId/block-owner", auth, async (req, res) => {
  try {
    return res.status(201).json(
      await polls.blockAuthor(req.user.uid, { pollId: req.params.pollId }),
    );
  } catch (error) {
    return sendError(res, error, "Kullanıcı engellenemedi");
  }
});

router.get("/:pollId", auth, async (req, res) => {
  try {
    return res.json(await polls.getPoll(req.params.pollId, req.user.uid));
  } catch (error) {
    return sendError(res, error, "Oylama yüklenemedi");
  }
});

export default router;
