import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mention } from "@tiptap/extension-mention";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { UserSummaryLike } from "@/components/people/types";

export type MentionItem = { id: string; label: string; person: UserSummaryLike };

/**
 * Editor features for documents: only what markdown can express (no underline, colors or images),
 * so every document exports cleanly to .md, plus @mentions. Changing nodes or marks changes the stored
 * document schema. Mention nodes store the user id (`attrs.id`), which the server reads to notify people.
 */
export function docExtensions(placeholder: string, suggestion: Omit<SuggestionOptions<MentionItem>, "editor">) {
  return [
    StarterKit.configure({
      underline: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Markdown,
    Mention.extend({
      // Exports read "@Name" rather than Tiptap's shortcode.
      renderMarkdown: (node) => `@${node.attrs?.label ?? ""}`,
    }).configure({
      HTMLAttributes: { class: "mention" },
      deleteTriggerWithBackspace: true,
      suggestion,
    }),
  ];
}

const MARKDOWN_HINT = /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|[-*] \[[ xX]\]\s)|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\)/;

/** Plain text that was probably written as markdown, so pasting it should render it. */
export function looksLikeMarkdown(text: string) {
  return MARKDOWN_HINT.test(text);
}
