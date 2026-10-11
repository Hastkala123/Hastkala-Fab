/**
 * Serialises structured data for a <script type="application/ld+json"> tag.
 * Product names and descriptions are owner-entered text; escaping "<", ">" and
 * "&" means a title containing "</script>" can't break out of the tag.
 */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

export function jsonLd(data: unknown): { __html: string } {
  return {
    __html: JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(LINE_SEPARATOR, "\\u2028")
      .replace(PARAGRAPH_SEPARATOR, "\\u2029"),
  };
}
