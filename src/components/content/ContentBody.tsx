import Link from "next/link";
import { fillPlaceholders, parseContent, type Inline } from "@/lib/content-text";

/**
 * Renders page / FAQ text written in Admin → Content (see lib/content-text).
 * Works in server and client components (the page editor's preview uses it).
 */
export default function ContentBody({
  body,
  values,
  className = "",
}: {
  body: string;
  values: Record<string, string>;
  className?: string;
}) {
  const blocks = parseContent(fillPlaceholders(body, values));
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed text-slate-700 ${className}`}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={index} className="pt-4 font-display text-xl font-bold text-indigo-ink-950 sm:text-2xl">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={index} className="pt-2 font-display text-lg font-bold text-indigo-ink-950">
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-madder-600">
                {block.items.map((item, i) => (
                  <li key={i}>
                    <InlineText parts={item} />
                  </li>
                ))}
              </ul>
            );
          case "p":
            return (
              <p key={index}>
                {block.lines.map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    <InlineText parts={line} />
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "bold") return <strong key={i} className="font-semibold text-indigo-ink-950">{part.text}</strong>;
        if (part.type === "link") {
          return part.href.startsWith("/") ? (
            <Link key={i} href={part.href} className="hf-link font-medium">
              {part.text}
            </Link>
          ) : (
            <a
              key={i}
              href={part.href}
              className="hf-link font-medium"
              {...(part.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {part.text}
            </a>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
}
