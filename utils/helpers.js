export function imagesToOpenAI(files) {
  return files.map((f) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${f.buffer.toString("base64")}`,
  }));
}

export function extractText(r) {
  try {
    const t = r?.output_text;
    if (typeof t === "string" && t.trim()) return t.trim();

    const outputs = Array.isArray(r?.output) ? r.output : [];
    const parts = [];

    for (const o of outputs) {
      const content = Array.isArray(o?.content) ? o.content : [];
      for (const c of content) {
        if (!c) continue;
        if (
          (c.type === "output_text" || c.type === "text") &&
          typeof c.text === "string"
        ) {
          parts.push(c.text);
          continue;
        }
        if (typeof c.text === "string") parts.push(c.text);
      }
    }

    return parts.join("\n").trim();
  } catch {
    return "";
  }
}
