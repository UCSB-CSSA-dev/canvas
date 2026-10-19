"use client";

import { CrownIcon, ShieldIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/people/person-avatar";
import type { UserSummaryLike } from "@/components/people/types";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { formerRoleKey, roleKey, type DepartmentKind, type Role } from "./types";

export function PersonRow({
  person,
  onOpen,
  trailing,
}: {
  person: UserSummaryLike & { formerRole?: Role };
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
    >
      <span className="relative shrink-0">
        <PersonAvatar person={person} className="size-7" />
        {person.formerRole ? (
          <span
            title={t(`roles.${formerRoleKey(person.formerRole)}`)}
            className={cn(
              "absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full ring-2 ring-card",
              person.formerRole === "lead" ? "bg-primary text-primary-foreground" : "bg-primary/60 text-primary-foreground",
            )}
          >
            <CrownIcon className="size-2" aria-label={t(`roles.${formerRoleKey(person.formerRole)}`)} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm">
          <span className="truncate">{displayName(person, locale)}</span>
          {person.isSystemAdmin ? (
            <ShieldIcon className="size-3.5 shrink-0 text-primary" aria-label={t("common.systemAdmin")} />
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
      </span>
      {trailing}
    </button>
  );
}

export function RoleBadge({ kind, role }: { kind: DepartmentKind; role: Role }) {
  const t = useTranslations("roles");
  return role === "lead" ? (
    <Badge variant="outline" className="border-primary/50 text-primary">
      {t(roleKey(kind, role))}
    </Badge>
  ) : (
    <Badge variant="secondary">{t(roleKey(kind, role))}</Badge>
  );
}

export function FormerBadge({ role }: { role: Role }) {
  const t = useTranslations("roles");
  return (
    <Badge variant="outline" className="border-primary/30 text-primary/80">
      <CrownIcon />
      {t(formerRoleKey(role))}
    </Badge>
  );
}
