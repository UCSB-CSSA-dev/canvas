"use client";

import { useLocale } from "next-intl";
import { memo, useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { UserSummaryLike } from "@/components/people/types";
import type { Locale } from "@/lib/locale-store";
import { cn } from "@/lib/utils";
import { linkMentions } from "./mention-textarea";

const components: Components = {
  a: ({ href, children }) =>
    href?.startsWith("mention:") ? (
      <span className="mention">{children}</span>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  img: () => null,
};

const urlTransform = (url: string) => (url.startsWith("mention:") ? url : defaultUrlTransform(url));

/**
 * Read-only markdown in document style (headings, lists, task lists, tables). No raw HTML or images.
 * With `people`, mention tokens render as "@Name" chips.
 */
export const MarkdownView = memo(function MarkdownView({
  source,
  breaks = false,
  people,
  className,
}: {
  source: string;
  /** Keep single line breaks, for text typed in a plain textarea. */
  breaks?: boolean;
  people?: UserSummaryLike[];
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const text = useMemo(() => (people ? linkMentions(source, people, locale) : source), [source, people, locale]);
  return (
    <div className={cn("doc-content", className)}>
      <ReactMarkdown
        remarkPlugins={breaks ? [remarkGfm, remarkBreaks] : [remarkGfm]}
        skipHtml
        components={components}
        urlTransform={urlTransform}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
