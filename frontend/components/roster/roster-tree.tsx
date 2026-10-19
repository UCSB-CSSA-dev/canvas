"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Id } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DepartmentCard } from "./department-card";
import type { Roster, RosterDialog } from "./types";

// Connector lines are pseudo-elements on each branch.
// Below xl: a vertical rail on the left with a tick into each card.
// xl and up: a horizontal bar across the branches with a stub down into each card.
const BRANCH = cn(
  "relative pb-4 pl-8",
  "before:absolute before:top-0 before:left-3 before:h-full before:w-px before:bg-border last:before:h-8",
  "after:absolute after:top-8 after:left-3 after:h-px after:w-5 after:bg-border",
  "xl:min-w-60 xl:flex-1 xl:px-2 xl:pt-6 xl:pb-0",
  "xl:before:left-1/2 xl:before:h-6 xl:last:before:h-6",
  "xl:after:top-0 xl:after:right-0 xl:after:left-0 xl:after:w-auto xl:first:after:left-1/2 xl:last:after:right-1/2",
);

export function RosterTree({
  roster,
  query,
  onOpenPerson,
  onDialog,
}: {
  roster: Roster;
  query: string;
  onOpenPerson: (userId: Id<"users">) => void;
  onDialog: (dialog: RosterDialog) => void;
}) {
  const presidium = roster.departments.filter((d) => d.kind === "presidium");
  const branches = roster.departments.filter((d) => d.kind !== "presidium");
  const cardProps = { roster, query, onOpenPerson, onDialog };
  const t = useTranslations("roster");
  const canAddDepartment = roster.viewer.isAdmin && !query;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex w-full flex-col xl:mx-auto xl:w-max xl:min-w-full xl:items-center">
        {presidium.map((department) => (
          <div key={department._id} className="w-full xl:max-w-md">
            <DepartmentCard {...cardProps} department={department} className="ring-primary/40" />
          </div>
        ))}
        {branches.length > 0 || canAddDepartment ? (
          <>
            {presidium.length > 0 ? <div aria-hidden className="ml-3 h-6 w-px bg-border xl:ml-0" /> : null}
            <ul className="flex flex-col xl:w-full xl:flex-row">
              {branches.map((department) => (
                <li key={department._id} className={BRANCH}>
                  <DepartmentCard {...cardProps} department={department} />
                </li>
              ))}
              {canAddDepartment ? (
                <li className={cn(BRANCH, "xl:max-w-48 xl:min-w-40 xl:flex-none")}>
                  <button
                    type="button"
                    onClick={() => onDialog({ kind: "department" })}
                    className="flex h-16 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <PlusIcon className="size-4" />
                    {t("newDepartment")}
                  </button>
                </li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
