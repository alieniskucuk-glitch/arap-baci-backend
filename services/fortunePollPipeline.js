import { emptyFalDilemma } from "../utils/falDilemma.js";
import { safeAiError } from "./fortunePollAiJson.js";
import { discoverFortunePollSeeds } from "./fortunePollSeedService.js";
import { writeFortunePollQuestion } from "./fortunePollQuestionWriter.js";
import { editFortunePollQuestion } from "./fortunePollQuestionEditor.js";

function logStageFailure(falId, stage, error) {
  console.error("FORTUNE_POLL_PIPELINE_STAGE_ERROR", {
    falId: String(falId || "").trim() || null,
    stage,
    ...safeAiError(error),
  });
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
      logStageFailure(falId, "POLL_WRITER_ERROR", error);
      return emptyFalDilemma();
    }

    const editor = await editFortunePollQuestion({
      fortuneText,
      seed,
      writer,
      falId,
      openaiClient,
    });

    return {
      hasDilemma: true,
      question: editor.question,
      option1: "Evet",
      option2: "Hayır",
    };
  } catch (error) {
    logStageFailure(falId, "POLL_SEED_ERROR", error);
    return emptyFalDilemma();
  }
}
