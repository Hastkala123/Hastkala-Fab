/** Helpers for the editable wholesale page text (Settings → Wholesale). Pure. */

export type FaqItem = { question: string; answer: string };

/** "Question? | Answer" per line → items. Lines without both halves are skipped. */
export function parseFaq(text: string): FaqItem[] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf("|");
      if (at < 0) return null;
      const question = line.slice(0, at).trim();
      const answer = line.slice(at + 1).trim();
      return question && answer ? { question, answer } : null;
    })
    .filter((item): item is FaqItem => item !== null)
    .slice(0, 30);
}

/** A wa.me link for an Indian number written any way ("+91 98765 43210", "09876543210"). */
export function whatsappLink(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `https://wa.me/91${national}?text=${encodeURIComponent(text)}`;
}
