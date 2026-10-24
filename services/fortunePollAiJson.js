import { extractText } from "../utils/helpers.js";

export async function requestFortunePollJson({
  openaiClient,
  systemPrompt,
  userText,
  maxOutputTokens,
}) {
  if (!openaiClient?.responses?.create) {
    throw new Error("Fortune poll AI client is unavailable");
  }

  let timeoutId;
  const request = openaiClient.responses.create({
    model: "gpt-5.4-mini",
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [{ type: "input_text", text: userText }],
      },
    ],
    max_output_tokens: maxOutputTokens,
  });
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Fortune poll AI timeout")),
      10000,
    );
  });

  try {
    const response = await Promise.race([request, timeout]);
    const raw = extractText(response)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(raw);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function safeAiError(error) {
  return {
    errorName: error?.name || "UnknownError",
    errorCode: String(error?.code || error?.status || "UNKNOWN"),
  };
}
