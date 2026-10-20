"use client";

import { useMutation } from "convex/react";
import { EyeIcon, MessageSquareIcon, MoreHorizontalIcon, ShieldIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { bilingualName, displayName, localized } from "@/lib/names";
import { ConfirmPhraseDialog, type ConfirmRequest } from "./confirm-phrase-dialog";
import { RoleSelect, useRoleConfirmation } from "./dialogs";
import { FormerBadge, RoleBadge } from "./person-row";
import { phraseName, retirePhrase, rolePhrase } from "./phrases";
import {
  formerRoleKey,
  leadsDepartment,
  managedDepartments,
  needsConfirmation,
  presidiumOf,
  type Role,
  type Roster,
  type RosterDepartment,
} from "./types";

export function PersonSheet({
  roster,
  userId,
  onClose,
}: {
  roster: Roster;
  userId: Id<"users"> | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {userId ? <PersonDetails roster={roster} userId={userId} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

type MenuAction = { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean };

function PersonDetails({ roster, userId, onClose }: { roster: Roster; userId: Id<"users">; onClose: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const showError = useErrorToast();
  const roleConfirmation = useRoleConfirmation();
  const openDm = useMutation(api.channels.getOrCreateDm);
  const setRole = useMutation(api.memberships.setRole);
  const removeMembership = useMutation(api.memberships.remove);
  const addMembership = useMutation(api.memberships.add);
  const transferChair = useMutation(api.presidium.transferChair);
  const promoteToViceChair = useMutation(api.presidium.promoteToViceChair);
  const retire = useMutation(api.presidium.retire);
  const deactivate = useMutation(api.users.deactivate);
  const reactivate = useMutation(api.users.reactivate);
  const setSystemAdmin = useMutation(api.users.setSystemAdmin);

  const [addDepartmentId, setAddDepartmentId] = useState<Id<"departments"> | undefined>();
  const [addRole, setAddRole] = useState<Role>("member");
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const memberships = roster.departments.flatMap((department) =>
    [
      ...department.leads.map((p) => ({ department, person: p, role: "lead" as const })),
      ...department.members.map((p) => ({ department, person: p, role: "member" as const })),
    ].filter((entry) => entry.person._id === userId),
  );
  const deactivatedPerson = roster.deactivated.find((p) => p._id === userId);
  const person =
    memberships[0]?.person ??
    roster.former.find((p) => p._id === userId) ??
    roster.noDepartment.find((p) => p._id === userId) ??
    deactivatedPerson;
  if (!person) return null;

  const { isAdmin, isSystemAdmin, isChair } = roster.viewer;
  const isSelf = userId === roster.viewer.userId;
  const isDeactivated = deactivatedPerson !== undefined;
  const name = displayName(person, locale);
  const phrasedName = phraseName(person);
  const presidium = presidiumOf(roster);
  const chairSeatEmpty = (presidium?.leads.length ?? 0) === 0;
  const presidiumEntry = memberships.find((m) => m.department.kind === "presidium");
  const targetIsChair = presidiumEntry?.role === "lead";
  const leadsElsewhere = memberships.some((m) => m.department.kind === "regular" && m.role === "lead");
  const formerRole = "formerRole" in person ? person.formerRole : undefined;

  const oversees =
    !isSelf &&
    (isAdmin || memberships.some((m) => m.role === "member" && leadsDepartment(roster, m.department._id)));
  const memberOf = new Set(memberships.map((m) => m.department._id));
  const addOptions = isDeactivated ? [] : managedDepartments(roster).filter((d) => !memberOf.has(d._id));
  const addDepartment = addOptions.find((d) => d._id === addDepartmentId);

  const run = (action: Promise<unknown>) => void action.catch(showError);

  const message = async () => {
    try {
      const channelId = await openDm({ otherUserId: userId });
      onClose();
      router.push(`/chat/?c=${channelId}`);
    } catch (error) {
      showError(error);
    }
  };

  const confirmRole = (department: RosterDepartment, role: Role, action: () => Promise<unknown>) =>
    setConfirm({ ...roleConfirmation(person, department, role), action });

  const presidiumActions = (membershipId: Id<"departmentMemberships">, role: Role): MenuAction[] => {
    const actions: MenuAction[] = [];
    if (role === "member" && chairSeatEmpty && isAdmin) {
      actions.push({
        label: t("person.makeChair"),
        onSelect: () => confirmRole(presidium!, "lead", () => setRole({ membershipId, role: "lead" })),
      });
    } else if (role === "member" && (isChair || isSystemAdmin)) {
      actions.push({
        label: t("person.makeChair"),
        onSelect: () =>
          setConfirm({
            title: t("confirm.makeChairTitle"),
            description: t(isChair ? "confirm.transferChairDescription" : "confirm.transferChairAdminDescription", {
              name,
            }),
            phrase: rolePhrase(phrasedName, presidium!, "lead"),
            action: () => transferChair({ userId }),
          }),
      });
    }
    if (isSelf || isSystemAdmin) {
      const retiredAs: Role = presidiumEntry?.person.wasChair ? "lead" : "member";
      actions.push({
        label: role === "lead" ? t("person.retireChairHint") : t("person.retire"),
        disabled: role === "lead",
        onSelect: () =>
          setConfirm({
            title: t("confirm.retireTitle"),
            description: t("confirm.retireDescription", { name, title: t(`roles.${formerRoleKey(retiredAs)}`) }),
            phrase: retirePhrase(phrasedName, retiredAs),
            destructive: true,
            action: () => retire({ userId }),
          }),
      });
    }
    if (isSystemAdmin && role === "member") {
      actions.push({
        label: t("person.removeFromDepartment"),
        destructive: true,
        onSelect: () => run(removeMembership({ membershipId })),
      });
    }
    return actions;
  };

  const departmentActions = (
    department: RosterDepartment,
    membershipId: Id<"departmentMemberships">,
    role: Role,
  ): MenuAction[] => {
    const actions: MenuAction[] = [];
    const leadsThis = leadsDepartment(roster, department._id);
    if (role === "member" && (isAdmin || leadsThis)) {
      actions.push({
        label: t("person.makeLead"),
        onSelect: () => confirmRole(department, "lead", () => setRole({ membershipId, role: "lead" })),
      });
    }
    if (role === "lead" && isAdmin) {
      actions.push({
        label: t("person.makeMember"),
        onSelect: () => run(setRole({ membershipId, role: "member" })),
      });
    }
    if (isAdmin || (leadsThis && role === "member" && !isSelf)) {
      actions.push({
        label: t("person.removeFromDepartment"),
        destructive: true,
        onSelect: () => run(removeMembership({ membershipId })),
      });
    }
    return actions;
  };

  const addToDepartment = () => {
    if (!addDepartment) return;
    const role = isAdmin ? addRole : "member";
    const action = () =>
      addMembership({ userId, departmentId: addDepartment._id, role }).then(() => setAddDepartmentId(undefined));
    if (needsConfirmation(addDepartment.kind, role)) confirmRole(addDepartment, role, action);
    else run(action());
  };

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <PersonAvatar person={person} className="size-12" />
          <div className="min-w-0">
            <SheetTitle className="truncate">{bilingualName(person)}</SheetTitle>
            <SheetDescription className="truncate">{person.email}</SheetDescription>
          </div>
        </div>
        {person.bio ? <p className="pt-1 text-sm whitespace-pre-wrap text-muted-foreground">{person.bio}</p> : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {person.isSystemAdmin ? (
            <Badge variant="outline" className="border-primary/50 text-primary">
              <ShieldIcon />
              {t("common.systemAdmin")}
            </Badge>
          ) : null}
          {formerRole ? <FormerBadge role={formerRole} /> : null}
          {isDeactivated ? <Badge variant="destructive">{t("common.deactivated")}</Badge> : null}
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-4 pb-6">
        {!isSelf && !isDeactivated ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void message()}>
              <MessageSquareIcon />
              {t("person.message")}
            </Button>
            {oversees ? (
              <Button
                variant="outline"
                className="flex-1 border-primary/40 text-primary"
                onClick={() => {
                  onClose();
                  router.push(`/chat/?oversee=${userId}`);
                }}
              >
                <EyeIcon />
                {t("person.oversee")}
              </Button>
            ) : null}
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{t("person.departments")}</h3>
          {memberships.length === 0 ? (
            <p className="text-sm text-subtle-foreground">{t("person.noDepartments")}</p>
          ) : (
            memberships.map(({ department, person: entry, role }) => {
              const actions =
                department.kind === "presidium"
                  ? presidiumActions(entry.membershipId, role)
                  : departmentActions(department, entry.membershipId, role);
              return (
                <div key={department._id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {localized(department.nameZh, department.nameEn, locale)}
                  </span>
                  <RoleBadge kind={department.kind} role={role} />
                  {actions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost" aria-label={t("common.edit")}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.label}
                            variant={action.destructive ? "destructive" : "default"}
                            disabled={action.disabled}
                            onSelect={action.onSelect}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              );
            })
          )}
          {isAdmin && !presidiumEntry && leadsElsewhere && presidium ? (
            <Button
              variant="outline"
              onClick={() =>
                setConfirm({
                  title: t("confirm.makeViceTitle"),
                  description: t("confirm.promoteViceDescription", { name }),
                  phrase: rolePhrase(phrasedName, presidium, "member"),
                  action: () => promoteToViceChair({ userId }),
                })
              }
            >
              {t("person.promoteToVice")}
            </Button>
          ) : null}
        </section>

        {addOptions.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t("person.addToDepartment")}</h3>
            <div className="flex gap-2">
              <Select
                value={addDepartmentId}
                onValueChange={(v) => {
                  setAddDepartmentId(v as Id<"departments">);
                  setAddRole("member");
                }}
              >
                <SelectTrigger className="min-w-0 flex-1">
                  <SelectValue placeholder={t("dialogs.department")} />
                </SelectTrigger>
                <SelectContent>
                  {addOptions.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {localized(d.nameZh, d.nameEn, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && addDepartment ? (
                <RoleSelect
                  roster={roster}
                  kind={addDepartment.kind}
                  value={addRole}
                  onChange={setAddRole}
                  className="w-28"
                />
              ) : null}
              <Button disabled={!addDepartment} onClick={addToDepartment}>
                {t("roster.add")}
              </Button>
            </div>
          </section>
        ) : null}

        {isAdmin && !isSelf ? (
          <>
            <Separator />
            <section className="flex flex-col gap-2">
              {isSystemAdmin && !isDeactivated ? (
                <Button
                  variant="outline"
                  onClick={() => run(setSystemAdmin({ userId, value: !person.isSystemAdmin }))}
                >
                  <ShieldIcon />
                  {person.isSystemAdmin ? t("person.revokeSystemAdmin") : t("person.grantSystemAdmin")}
                </Button>
              ) : null}
              {isDeactivated ? (
                <Button variant="outline" onClick={() => run(reactivate({ userId }))}>
                  {t("person.reactivate")}
                </Button>
              ) : targetIsChair ? (
                <p className="text-xs text-muted-foreground">{t("person.chairCannotDeactivate")}</p>
              ) : !person.isSystemAdmin ? (
                confirmingDeactivate ? (
                  <div className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
                    <p className="text-sm">{t("person.confirmDeactivate", { name: bilingualName(person) })}</p>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingDeactivate(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => run(deactivate({ userId }).then(() => setConfirmingDeactivate(false)))}
                      >
                        {t("common.confirm")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={() => setConfirmingDeactivate(true)}>
                    {t("person.deactivate")}
                  </Button>
                )
              ) : null}
            </section>
          </>
        ) : null}
      </div>

      {confirm ? <ConfirmPhraseDialog request={confirm} onClose={() => setConfirm(null)} /> : null}
    </>
  );
}
