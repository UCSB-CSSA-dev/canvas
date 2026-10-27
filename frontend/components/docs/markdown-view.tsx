"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: () => null,
};

/** Read-only markdown in document style (headings, lists, task lists, tables). No raw HTML or images. */
export const MarkdownView = memo(function MarkdownView({
  source,
  breaks = false,
  className,
}: {
  source: string;
  /** Keep single line breaks, for text typed in a plain textarea. */
  breaks?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("doc-content", className)}>
      <ReactMarkdown remarkPlugins={breaks ? [remarkGfm, remarkBreaks] : [remarkGfm]} skipHtml components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
});
