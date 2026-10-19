"use client";

import { useMutation } from "convex/react";
import { AlertTriangleIcon, MailPlusIcon, MoreHorizontalIcon, PencilIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { matchesPerson } from "@/components/people/use-people";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { localized } from "@/lib/names";
import { cn } from "@/lib/utils";
import { FormerBadge, PersonRow, RoleBadge } from "./person-row";
import {
  canManageMembers,
  leadsDepartment,
  type Roster,
  type RosterDepartment,
  type RosterDialog,
} from "./types";

export function DepartmentCard({
  roster,
  department,
  query,
  onOpenPerson,
  onDialog,
  className,
}: {
  roster: Roster;
  department: RosterDepartment;
  query: string;
  onOpenPerson: (userId: Id<"users">) => void;
  onDialog: (dialog: RosterDialog) => void;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const revoke = useMutation(api.preApprovals.revoke);
  const showError = useErrorToast();

  const leads = department.leads.filter((p) => matchesPerson(p, query));
  const members = department.members.filter((p) => matchesPerson(p, query));
  const preApprovals = roster.preApprovals.filter(
    (p) => p.departmentId === department._id && matchesPerson({ email: p.email }, query),
  );
  const isPresidium = department.kind === "presidium";
  const former = isPresidium ? roster.former.filter((p) => matchesPerson(p, query)) : [];
  const canManage = canManageMembers(roster, department);
  const isAdmin = roster.viewer.isAdmin;
  const total = department.leads.length + department.members.length;
  const leadWarning = !isAdmin
    ? null
    : department.leads.length === 0
      ? t(isPresidium ? "roster.noChairWarning" : "roster.noLeadsWarning")
      : !isPresidium && department.leads.length > 2
        ? t("roster.tooManyLeadsWarning")
        : null;

  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="flex flex-row items-center gap-2 px-4">
        <CardTitle className="flex-1 text-base">
          <span className={department.kind === "presidium" ? "text-primary" : undefined}>
            {localized(department.nameZh, department.nameEn, locale)}
          </span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t("roster.memberCount", { count: total })}
          </span>
        </CardTitle>
        {canManage || isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t("common.edit")}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage ? (
                <>
                  <DropdownMenuItem onSelect={() => onDialog({ kind: "addMember", department })}>
                    <UserPlusIcon />
                    {t("roster.add")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onDialog({ kind: "preApprove", departmentId: department._id })}
                  >
                    <MailPlusIcon />
                    {t("roster.preApprove")}
                  </DropdownMenuItem>
                </>
              ) : null}
              {isAdmin ? (
                <DropdownMenuItem onSelect={() => onDialog({ kind: "department", department })}>
                  <PencilIcon />
                  {t("roster.rename")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-2">
        {leadWarning ? (
          <p className="mx-2 flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangleIcon className="size-3.5" />
            {leadWarning}
          </p>
        ) : null}
        <Group title={t(isPresidium ? "roster.chair" : "roster.leads")}>
          {leads.map((p) => (
            <PersonRow
              key={p._id}
              person={p}
              onOpen={() => onOpenPerson(p._id)}
              trailing={<RoleBadge kind={department.kind} role="lead" />}
            />
          ))}
        </Group>
        <Group title={t(isPresidium ? "roster.viceChairs" : "roster.members")}>
          {members.map((p) => (
            <PersonRow key={p._id} person={p} onOpen={() => onOpenPerson(p._id)} />
          ))}
        </Group>
        {former.length > 0 ? (
          <Group title={t("roster.former")}>
            {former.map((p) => (
              <PersonRow
                key={p._id}
                person={p}
                onOpen={() => onOpenPerson(p._id)}
                trailing={p.formerRole ? <FormerBadge role={p.formerRole} /> : null}
              />
            ))}
          </Group>
        ) : null}
        {preApprovals.length > 0 ? (
          <Group title={t("roster.preApproved")}>
            {preApprovals.map((p) => {
              const canRevoke = isAdmin || (p.role === "member" && leadsDepartment(roster, p.departmentId));
              return (
                <div key={p._id} className="flex items-center gap-2 px-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.email}</span>
                  <RoleBadge kind={department.kind} role={p.role} />
                  {canRevoke ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t("roster.revoke")}
                      onClick={() => void revoke({ preApprovalId: p._id }).catch(showError)}
                    >
                      <XIcon />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </Group>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Group({ title, children }: { title: string; children: ReactNode[] }) {
  const t = useTranslations("roster");
  return (
    <div>
      <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {children.length > 0 ? children : <p className="px-2 text-xs text-subtle-foreground">{t("none")}</p>}
    </div>
  );
}
