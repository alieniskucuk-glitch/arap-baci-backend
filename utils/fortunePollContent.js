const PERSONAL_CONTACT_PATTERNS = [
  /https?:\/\//iu,
  /\bwww\./iu,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/iu,
  /(?:\+?90\s?)?(?:\(?0?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2})/u,
];

const PROHIBITED_TERMS = [
  "amk",
  "aq",
  "orospu",
  "siktir",
  "sikik",
  "piç",
  "gavat",
  "yarrak",
  "porno",
  "onlyfans",
];

function contentError(message) {
  const error = new Error(message);
  error.code = "UNSAFE_CONTENT";
  error.status = 400;
  return error;
}

function normalizeCommunityText(value, field, { maxLength, required = true } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (required) throw contentError(`${field} zorunludur`);
    return "";
  }
  if (maxLength && text.length > maxLength) {
    throw contentError(`${field} çok uzun`);
  }
  return text;
}

export function classifyCommunityText(value, field, options = {}) {
  const text = normalizeCommunityText(value, field, options);
  if (!text) return { status: "APPROVED", text };

  const normalized = text.toLocaleLowerCase("tr-TR");
  if (PROHIBITED_TERMS.some((term) => normalized.includes(term))) {
    return { status: "REJECTED", text };
  }
  if (PERSONAL_CONTACT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: "PENDING_REVIEW", text };
  }
  return { status: "APPROVED", text };
}

export function validateCommunityText(value, field, options = {}) {
  const result = classifyCommunityText(value, field, options);
  if (result.status === "REJECTED") {
    throw contentError(`${field} uygunsuz içerik içeriyor`);
  }
  if (result.status === "PENDING_REVIEW") {
    throw contentError(`${field} iletişim veya kişisel bilgi içeremez`);
  }
  return result.text;
}
