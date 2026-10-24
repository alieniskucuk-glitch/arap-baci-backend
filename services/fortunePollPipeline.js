import { emptyFalDilemma } from "../utils/falDilemma.js";
import { safeAiError } from "./fortunePollAiJson.js";
import { discoverFortunePollSeeds } from "./fortunePollSeedService.js";
import { writeFortunePollQuestion } from "./fortunePollQuestionWriter.js";
import { editFortunePollQuestion } from "./fortunePollQuestionEditor.js";

function logStageEvent(falId, stage, { attempt, status, error } = {}) {
  const metadata = {
    falId: String(falId || "").trim() || null,
    stage,
    ...(attempt ? { attempt } : {}),
    ...(status ? { status } : {}),
  };
  if (error) Object.assign(metadata, safeAiError(error));
  console.error("FORTUNE_POLL_PIPELINE_STAGE_EVENT", metadata);
}

export async function runFortunePollPipeline({
  fortuneText,
  falId,
  openaiClient,
}) {
  try {
    const seed = await discoverFortunePollSeeds({
      fortuneText,
      falId,
      openaiClient,
    });

    if (!seed.hasPollSeed) return emptyFalDilemma();

    let writer;
    try {
      writer = await writeFortunePollQuestion({
        fortuneText,
        seed,
        falId,
        openaiClient,
      });
    } catch (error) {
      logStageEvent(falId, "POLL_WRITER_ERROR", { error });
      return emptyFalDilemma();
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const editor = await editFortunePollQuestion({
          fortuneText,
          seed,
          writer,
          openaiClient,
          retry: attempt === 2,
        });

        if (editor.status === "pass") {
          return {
            hasDilemma: true,
            question: editor.question,
            option1: "Evet",
            option2: "Hayır",
          };
        }

        logStageEvent(falId, "POLL_EDITOR_REJECT", { attempt, status: "reject" });
      } catch (error) {
        logStageEvent(falId, "POLL_EDITOR_ERROR", { attempt, error });
      }

      if (attempt === 1) {
        logStageEvent(falId, "POLL_EDITOR_RETRY", { attempt, status: "retry" });
      }
    }

    return emptyFalDilemma();
  } catch (error) {
    logStageEvent(falId, "POLL_SEED_ERROR", { error });
    return emptyFalDilemma();
  }
}
