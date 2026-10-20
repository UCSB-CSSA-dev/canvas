"use client";

import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useViewer } from "@/components/auth/account-state";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import type { Person } from "./types";

const ALLOWED = ["p", "strong", "em", "del", "code", "pre", "a", "br", "ul", "ol", "li", "blockquote"];
const MENTION_SCHEME = "mention:";

function escapeLabel(text: string) {
  return text.replace(/[\\[\]]/g, "\\$&");
}

function urlTransform(url: string) {
  return url.startsWith(MENTION_SCHEME) ? url : defaultUrlTransform(url);
}

/** Message body as limited markdown: no raw HTML, no images. Mentions render as chips. */
export const Markdown = memo(function Markdown({
  body,
  people,
  className,
}: {
  body: string;
  people: Person[];
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("chat");
  const viewer = useViewer();
  const source = body.replace(/<@([a-z0-9]+)>/gi, (_, id: string) => {
    const label = id === "all" ? t("mentionAll") : displayName(people.find((p) => p._id === id), locale) || t("unknownUser");
    return `[@${escapeLabel(label)}](${MENTION_SCHEME}${id})`;
  });

  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith(MENTION_SCHEME)) {
        const id = href.slice(MENTION_SCHEME.length);
        const me = id === viewer._id || id === "all";
        return (
          <span className={cn("rounded px-0.5 font-medium text-primary", me && "bg-primary/15")}>{children}</span>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
          {children}
        </a>
      );
    },
    code: ({ className: codeClass, children }) => (
      <code className={cn("rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]", codeClass)}>{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="my-1 overflow-x-auto rounded-md bg-secondary p-2 text-xs [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    ),
    ul: ({ children }) => <ul className="my-1 list-disc pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="my-1 border-l-2 border-border pl-2 text-muted-foreground">{children}</blockquote>
    ),
    p: ({ children }) => <p>{children}</p>,
  };

  return (
    <div className={cn("min-w-0 text-sm break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        skipHtml
        urlTransform={urlTransform}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});

/** Plain one-line preview with mention tokens shown as names. */
export function usePlainPreview() {
  const locale = useLocale() as Locale;
  const t = useTranslations("chat");
  return (body: string, people: Person[], max = 120) => {
    const text = body
      .replace(/<@([a-z0-9]+)>/gi, (_, id: string) =>
        id === "all" ? `@${t("mentionAll")}` : `@${displayName(people.find((p) => p._id === id), locale)}`,
      )
      .replace(/[*_`~>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  };
}
