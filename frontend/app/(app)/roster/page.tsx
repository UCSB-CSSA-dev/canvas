"use client";

import { useQuery } from "convex/react";
import { MailPlusIcon, SearchIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { PersonAvatar } from "@/components/people/person-avatar";
import { matchesPerson } from "@/components/people/use-people";
import { RosterTree } from "@/components/roster/roster-tree";
import {
  AddMemberDialog,
  ApproveDialog,
  DeactivationReviewDialog,
  DepartmentDialog,
  PreApproveDialog,
  RejectDialog,
} from "@/components/roster/dialogs";
import { PersonRow } from "@/components/roster/person-row";
import { PersonSheet } from "@/components/roster/person-sheet";
import { managedDepartments, type Roster, type RosterDialog } from "@/components/roster/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Id } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { bilingualName, localized } from "@/lib/names";

export default function RosterPage() {
  const t = useTranslations("roster");
  const roster = useQuery(api.roster.get);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<RosterDialog | null>(null);
  const [personId, setPersonId] = useState<Id<"users"> | null>(null);
  const [showDeactivated, setShowDeactivated] = useState(false);

  const canPreApprove = roster ? managedDepartments(roster).length > 0 : false;
  const closeDialog = () => setDialog(null);

  return (
    <>
      <PageHeader title={t("title")}>
        {canPreApprove ? (
          <Button size="sm" onClick={() => setDialog({ kind: "preApprove" })}>
            <MailPlusIcon />
            <span className="hidden sm:inline">{t("preApprove")}</span>
          </Button>
        ) : null}
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
          <div className="relative max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8"
            />
          </div>

          {!roster ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : (
            <>
              <PendingSection roster={roster} query={query} onDialog={setDialog} />
              <DeactivationSection roster={roster} query={query} onDialog={setDialog} />
              <RosterTree roster={roster} query={query} onOpenPerson={setPersonId} onDialog={setDialog} />
              <PeopleSection
                title={t("noDepartment")}
                people={roster.noDepartment.filter((p) => matchesPerson(p, query))}
                onOpenPerson={setPersonId}
              />
              {roster.viewer.isAdmin && roster.deactivated.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setShowDeactivated((v) => !v)}
                  >
                    {showDeactivated ? t("hideDeactivated") : t("showDeactivated")} ({roster.deactivated.length})
                  </Button>
                  {showDeactivated ? (
                    <PeopleSection
                      title={t("deactivatedTitle")}
                      people={roster.deactivated.filter((p) => matchesPerson(p, query))}
                      onOpenPerson={setPersonId}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {roster ? (
        <>
          <PersonSheet roster={roster} userId={personId} onClose={() => setPersonId(null)} />
          {dialog?.kind === "preApprove" ? (
            <PreApproveDialog roster={roster} initialDepartmentId={dialog.departmentId} onClose={closeDialog} />
          ) : null}
          {dialog?.kind === "approve" ? (
            <ApproveDialog roster={roster} applicant={dialog.applicant} onClose={closeDialog} />
          ) : null}
          {dialog?.kind === "reject" ? <RejectDialog applicant={dialog.applicant} onClose={closeDialog} /> : null}
          {dialog?.kind === "department" ? (
            <DepartmentDialog department={dialog.department} onClose={closeDialog} />
          ) : null}
          {dialog?.kind === "addMember" ? (
            <AddMemberDialog roster={roster} department={dialog.department} onClose={closeDialog} />
          ) : null}
          {dialog?.kind === "deactivation" ? (
            <DeactivationReviewDialog roster={roster} request={dialog.request} onClose={closeDialog} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function PendingSection({
  roster,
  query,
  onDialog,
}: {
  roster: Roster;
  query: string;
  onDialog: (dialog: RosterDialog) => void;
}) {
  const t = useTranslations("roster");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const pending = roster.pending.filter((p) => matchesPerson(p, query));
  if (pending.length === 0) return null;
  const departmentNames = new Map(
    roster.departments.map((d) => [d._id, localized(d.nameZh, d.nameEn, locale)]),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t("pendingTitle")}
        <Badge>{pending.length}</Badge>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {pending.map((applicant) => (
          <Card key={applicant._id} className="py-3 ring-primary/30">
            <CardContent className="flex flex-col gap-2 px-4">
              <div className="flex items-center gap-3">
                <PersonAvatar person={applicant} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{bilingualName(applicant)}</div>
                  <div className="truncate text-xs text-muted-foreground">{applicant.email}</div>
                </div>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {format.relativeTime(applicant.appliedAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t("requested")}</span>
                {applicant.requestedDepartmentIds.map((id) => (
                  <Badge key={id} variant="secondary">
                    {departmentNames.get(id) ?? "?"}
                  </Badge>
                ))}
              </div>
              {applicant.applicationNote ? (
                <p className="rounded-md bg-secondary px-2.5 py-1.5 text-xs whitespace-pre-wrap">
                  {applicant.applicationNote}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => onDialog({ kind: "reject", applicant })}>
                  {t("reject")}
                </Button>
                <Button size="sm" onClick={() => onDialog({ kind: "approve", applicant })}>
                  {t("approve")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function DeactivationSection({
  roster,
  query,
  onDialog,
}: {
  roster: Roster;
  query: string;
  onDialog: (dialog: RosterDialog) => void;
}) {
  const t = useTranslations("roster");
  const format = useFormatter();
  const requests = roster.deactivationRequests.filter((r) => matchesPerson(r.person, query));
  if (requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t("deactivationTitle")}
        <Badge variant="destructive">{requests.length}</Badge>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {requests.map((request) => (
          <Card key={request._id} className="py-3 ring-destructive/30">
            <CardContent className="flex flex-col gap-2 px-4">
              <div className="flex items-center gap-3">
                <PersonAvatar person={request.person} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{bilingualName(request.person)}</div>
                  <div className="truncate text-xs text-muted-foreground">{request.person.email}</div>
                </div>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {format.relativeTime(request.requestedAt)}
                </span>
              </div>
              {request.reason ? (
                <p className="line-clamp-2 rounded-md bg-secondary px-2.5 py-1.5 text-xs whitespace-pre-wrap">
                  {request.reason}
                </p>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="self-end"
                onClick={() => onDialog({ kind: "deactivation", request })}
              >
                {t("review")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function PeopleSection({
  title,
  people,
  onOpenPerson,
}: {
  title: string;
  people: Roster["noDepartment"];
  onOpenPerson: (id: Id<"users">) => void;
}) {
  if (people.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((person) => (
          <PersonRow key={person._id} person={person} onOpen={() => onOpenPerson(person._id)} />
        ))}
      </div>
    </section>
  );
}
