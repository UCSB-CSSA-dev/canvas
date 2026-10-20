"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { PersonAvatar } from "@/components/people/person-avatar";
import { matchesPerson } from "@/components/people/use-people";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";

type RosterPerson = { _id: Id<"users">; nameZh?: string; nameEn?: string; name?: string; email?: string; image?: string };

/** People in the given departments, from the roster, for member pickers. */
export function useDepartmentPeople(departmentIds: Id<"departments">[] | "all") {
  const roster = useQuery(api.roster.get);
  return useMemo(() => {
    if (!roster) return undefined;
    const byId = new Map<string, RosterPerson>();
    for (const department of roster.departments) {
      if (departmentIds !== "all" && !departmentIds.includes(department._id)) continue;
      for (const person of [...department.leads, ...department.members]) byId.set(person._id, person);
    }
    if (departmentIds === "all") for (const person of roster.noDepartment) byId.set(person._id, person);
    return [...byId.values()].sort((a, b) => (a.nameEn ?? "").localeCompare(b.nameEn ?? ""));
  }, [roster, departmentIds]);
}

export function PeopleChecklist({
  people,
  selected,
  onToggle,
  exclude = [],
}: {
  people: RosterPerson[] | undefined;
  selected: Id<"users">[];
  onToggle: (id: Id<"users">) => void;
  exclude?: string[];
}) {
  const t = useTranslations("groups");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const list = (people ?? []).filter((p) => !exclude.includes(p._id) && matchesPerson(p, query));
  return (
    <div className="flex flex-col gap-2">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPeople")} />
      <ScrollArea className="h-48 rounded-md border border-border">
        <div className="flex flex-col p-1">
          {list.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">{t("noPeople")}</p> : null}
          {list.map((p) => (
            <label key={p._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
              <Checkbox checked={selected.includes(p._id)} onCheckedChange={() => onToggle(p._id)} />
              <PersonAvatar person={p} className="size-6" />
              <span className="truncate">{displayName(p, locale)}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * 部员 propose a group (approved by a 部长 of an involved department);
 * 部长, 主席团 and system admins create one directly.
 */
export function GroupFormDialog({ children }: { children: ReactNode }) {
  const t = useTranslations("groups");
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const router = useRouter();
  const departments = useQuery(api.departments.listPublic);
  const propose = useMutation(api.groups.propose);
  const create = useMutation(api.groups.create);
  const showError = useErrorToast();
  const direct = viewer.isAdmin || viewer.ledDepartmentIds.length > 0;

  const ownDepartments = viewer.memberships.filter((m) => m.kind === "regular").map((m) => m.departmentId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [departmentIds, setDepartmentIds] = useState<Id<"departments">[]>(
    direct ? viewer.ledDepartmentIds : ownDepartments,
  );
  const [memberIds, setMemberIds] = useState<Id<"users">[]>([]);
  const [busy, setBusy] = useState(false);

  // Proposers suggest people from the involved departments; creators pull in people they manage.
  const pickable = useDepartmentPeople(
    direct ? (viewer.isAdmin ? "all" : viewer.ledDepartmentIds) : departmentIds,
  );
  const regular = (departments ?? []).filter((d) => d.kind === "regular");
  const leadsAnInvolved = viewer.isAdmin || departmentIds.some((id) => viewer.ledDepartmentIds.includes(id));
  const valid =
    name.trim().length > 0 &&
    name.trim().length <= LIMITS.groupName &&
    purpose.trim().length <= LIMITS.groupPurpose &&
    (direct ? leadsAnInvolved : purpose.trim().length > 0 && departmentIds.length > 0);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const submit = async () => {
    setBusy(true);
    try {
      if (direct) {
        const channelId = await create({ name, purpose: purpose || undefined, departmentIds, memberIds });
        router.push(`/chat/?c=${channelId}`);
      } else {
        await propose({ name, purpose, departmentIds, suggestedUserIds: memberIds });
        toast.success(t("proposed"));
      }
      setOpen(false);
      setName("");
      setPurpose("");
      setMemberIds([]);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{direct ? t("createTitle") : t("proposeTitle")}</DialogTitle>
          <DialogDescription>{direct ? t("createHint") : t("proposeHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-name">{t("name")}</Label>
          <Input id="group-name" value={name} maxLength={LIMITS.groupName} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="group-purpose">
            {t("purpose")}
            {direct ? <span className="text-muted-foreground">{t("optional")}</span> : null}
          </Label>
          <Textarea
            id="group-purpose"
            rows={2}
            value={purpose}
            maxLength={LIMITS.groupPurpose}
            placeholder={t("purposePlaceholder")}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("departments")}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {regular.map((d) => (
              <label key={d._id} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={departmentIds.includes(d._id)}
                  onCheckedChange={() => setDepartmentIds((list) => toggle(list, d._id))}
                />
                {localized(d.nameZh, d.nameEn, locale)}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("departmentsHint")}</p>
          {direct && !leadsAnInvolved ? <p className="text-xs text-destructive">{t("mustLeadOne")}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{direct ? t("members") : t("suggestedMembers")}</Label>
          <PeopleChecklist
            people={pickable}
            selected={memberIds}
            exclude={[viewer._id]}
            onToggle={(id) => setMemberIds((list) => toggle(list, id))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={!valid || busy} onClick={() => void submit()}>
            {direct ? t("create") : t("propose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
