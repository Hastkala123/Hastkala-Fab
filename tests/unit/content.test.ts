import { describe, expect, it } from "vitest";
import { contentToPlainText, fillPlaceholders, parseContent, parseInline, safeHref } from "@/lib/content-text";

describe("fillPlaceholders", () => {
  it("fills values from Settings", () => {
    expect(fillPlaceholders("Returns within {{returnDays}} days.", { returnDays: "7" })).toBe("Returns within 7 days.");
  });

  it("drops a line whose value isn't set, keeping the rest", () => {
    const body = "Call us:\nPhone: {{phone}}\nEmail: {{ email }}";
    expect(fillPlaceholders(body, { phone: "", email: "hello@example.test" })).toBe("Call us:\nEmail: hello@example.test");
  });

  it("drops lines with unknown placeholders", () => {
    expect(fillPlaceholders("A\n{{nope}}\nB", {})).toBe("A\nB");
  });
});

describe("parseContent", () => {
  it("reads headings, paragraphs and lists", () => {
    const blocks = parseContent("## Refunds\nLine one\nline two\n\n- first\n- **second**\n### Small");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "h3"]);
    const paragraph = blocks[1] as Extract<(typeof blocks)[number], { type: "p" }>;
    expect(paragraph.lines).toHaveLength(2);
    const list = blocks[2] as Extract<(typeof blocks)[number], { type: "ul" }>;
    expect(list.items[1]).toEqual([{ type: "bold", text: "second" }]);
  });
});

describe("links", () => {
  it("keeps safe links", () => {
    expect(parseInline("see [returns](/returns-policy) now")).toEqual([
      { type: "text", text: "see " },
      { type: "link", text: "returns", href: "/returns-policy" },
      { type: "text", text: " now" },
    ]);
    expect(safeHref("mailto:hello@example.test")).toBe("mailto:hello@example.test");
    expect(safeHref("https://wa.me/919876543210")).toBe("https://wa.me/919876543210");
  });

  it.each(["javascript:alert(1)", "//evil.example", "/\\evil.example", "data:text/html,hi", "vbscript:x"])(
    "turns %j into plain text",
    (href) => {
      expect(safeHref(href)).toBeNull();
      const parts = parseInline(`[click](${href})`);
      expect(parts.some((part) => part.type === "link")).toBe(false);
      expect(parts[0]).toEqual({ type: "text", text: "click" });
    },
  );

  it("never produces markup from text", () => {
    const parts = parseInline("<img src=x onerror=alert(1)>");
    expect(parts).toEqual([{ type: "text", text: "<img src=x onerror=alert(1)>" }]);
  });
});

describe("contentToPlainText", () => {
  it("strips marks for search descriptions", () => {
    expect(contentToPlainText("## Title\nSome **bold** and a [link](/x).\n- item")).toBe("Title Some bold and a link. item");
  });
});
