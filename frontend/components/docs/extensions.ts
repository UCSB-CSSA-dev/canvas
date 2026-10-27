import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

/**
 * Editor features for task documents: only what markdown can express (no underline, colors or images),
 * so every document exports cleanly to .md. Changing nodes or marks changes the stored document schema.
 */
export function docExtensions(placeholder: string) {
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
  ];
}

const MARKDOWN_HINT = /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|[-*] \[[ xX]\]\s)|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\n]+\)/;

/** Plain text that was probably written as markdown, so pasting it should render it. */
export function looksLikeMarkdown(text: string) {
  return MARKDOWN_HINT.test(text);
}
