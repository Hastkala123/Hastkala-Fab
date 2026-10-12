/**
 * The small text format used by pages and FAQ answers in Admin → Content.
 * Owners type plain text; a few marks give it structure:
 *
 *   ## Heading          ### Smaller heading
 *   - list item         (a blank line starts a new paragraph)
 *   **bold**            [link text](/contact)  [email us](mailto:…)
 *   {{returnDays}}      a value from Settings — see CONTENT_PLACEHOLDERS
 *
 * A line whose placeholder has no value yet (say, no phone number saved) is
 * left out, so a page never shows "Call us on ." Rendering builds React
 * elements from this structure; owner text is never inserted as HTML.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; lines: Inline[][] }
  | { type: "ul"; items: Inline[][] };

/** Placeholders an owner can use, with what each one shows (for the editor's help text). */
export const CONTENT_PLACEHOLDERS: Record<string, string> = {
  storeName: "Store name",
  legalName: "Registered business name",
  gstin: "GSTIN",
  address: "Business address",
  phone: "Phone number",
  whatsapp: "WhatsApp number",
  email: "Email address",
  grievanceOfficer: "Grievance officer's name",
  grievanceEmail: "Grievance officer's email",
  grievancePhone: "Grievance officer's phone",
  dispatchText: "Dispatch time (Settings → Shipping)",
  deliveryText: "Delivery time (Settings → Shipping)",
  shippingCharges: "A sentence with the retail shipping charge and free-shipping value",
  wholesaleShipping: "A sentence about wholesale freight",
  freeShippingAbove: "Free shipping from this order value",
  shippingFee: "Retail shipping fee",
  codAvailability: "A sentence saying whether, and up to what value, COD is offered",
  returnDays: "Return window in days (empty when returns are off)",
  returnConditions: "Return conditions (Settings → Returns)",
  exchangeNote: "A sentence about size exchanges, when they are offered",
  returnShippingDeduction: "Amount kept from refunds of change-of-mind returns",
  wholesaleGst: "How wholesale prices show GST",
};

const PLACEHOLDER = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/** Fills {{placeholders}}; drops any line that refers to one with no value. */
export function fillPlaceholders(body: string, values: Record<string, string>): string {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => [...line.matchAll(PLACEHOLDER)].every((m) => Boolean(values[m[1]!]?.trim())))
    .map((line) => line.replace(PLACEHOLDER, (_, key: string) => values[key]!.trim()))
    .join("\n");
}

/** Links may go to pages on this site, to http(s) sites, or open mail / phone. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^\/(?![/\\])[^\s"'<>\\]*$/.test(value)) return value;
  if (/^(https?:\/\/|mailto:|tel:)[^\s"'<>\\]+$/i.test(value)) return value;
  return null;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push({ type: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) {
      parts.push({ type: "bold", text: match[1] });
    } else {
      const href = safeHref(match[3]!);
      parts.push(href ? { type: "link", text: match[2]!, href } : { type: "text", text: match[2]! });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

export function parseContent(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", lines: paragraph });
    if (list.length) blocks.push({ type: "ul", items: list });
    paragraph = [];
    list = [];
  };

  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("### ")) {
      flush();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else if (/^[-*•] /.test(line)) {
      if (paragraph.length) flush();
      list.push(parseInline(line.slice(2).trim()));
    } else {
      if (list.length) flush();
      paragraph.push(parseInline(line));
    }
  }
  flush();
  return blocks;
}

/** Plain text of a filled body (marks removed), for meta descriptions and FAQ structured data. */
export function contentToPlainText(body: string): string {
  return parseContent(body)
    .flatMap((block) =>
      block.type === "p" ? block.lines : block.type === "ul" ? block.items : [[{ type: "text" as const, text: block.text }]],
    )
    .map((line) => line.map((part) => part.text).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
