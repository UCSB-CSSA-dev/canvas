"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { PersonAvatar } from "./person-avatar";
import type { UserSummaryLike } from "./types";
import { matchesPerson } from "./use-people";

export function PersonPicker({
  people,
  onPick,
  disabled,
}: {
  people: UserSummaryLike[] | undefined;
  onPick: (person: UserSummaryLike) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const filtered = (people ?? []).filter((p) => matchesPerson(p, query));

  return (
    <div className="flex flex-col gap-2">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPeople")}
      />
      <ScrollArea className="h-72 rounded-md border border-border">
        <div className="flex flex-col p-1">
          {filtered.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">{t("noPeople")}</p>
          ) : (
            filtered.map((person) => (
              <button
                key={person._id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(person)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
              >
                <PersonAvatar person={person} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{displayName(person, locale)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
