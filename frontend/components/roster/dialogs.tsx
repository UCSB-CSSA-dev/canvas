"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { PersonPicker } from "@/components/people/person-picker";
import { usePeople } from "@/components/people/use-people";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";
import { cn } from "@/lib/utils";
import { ConfirmPhraseDialog, type ConfirmRequest } from "./confirm-phrase-dialog";
import { deactivatePhrase, newDepartmentPhrase, phraseName, rolePhrase } from "./phrases";
import {
  leadsDepartment,
  managedDepartments,
  needsConfirmation,
  presidiumOf,
  roleKey,
  type DeactivationRequest,
  type DepartmentKind,
  type PendingApplicant,
  type Role,
  type Roster,
  type RosterDepartment,
} from "./types";

type CloseProps = { onClose: () => void };

function DialogShell({
  title,
  description,
  children,
  onClose,
}: CloseProps & { title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** 部员 / 部长 for departments; 副主席 / 主席 for 主席团, where 主席 is only offered while the seat is empty. */
export function RoleSelect({
  roster,
  kind,
  value,
  onChange,
  id,
  className,
}: {
  roster: Roster;
  kind: DepartmentKind;
  value: Role;
  onChange: (role: Role) => void;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("roles");
  const chairTaken = (presidiumOf(roster)?.leads.length ?? 0) > 0;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="member">{t(roleKey(kind, "member"))}</SelectItem>
        <SelectItem value="lead" disabled={kind === "presidium" && chairTaken}>
          {t(roleKey(kind, "lead"))}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

/** Title, description and phrase for adding `name` to `department` as `role`. */
export function useRoleConfirmation() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (person: { nameZh?: string; nameEn?: string; name?: string; email?: string }, department: RosterDepartment, role: Role) => {
    const name = displayName(person, locale);
    const phrase = rolePhrase(phraseName(person), department, role);
    if (department.kind === "regular") {
      return {
        phrase,
        title: t("confirm.makeLeadTitle"),
        description: t("confirm.makeLeadDescription", {
          name,
          department: localized(department.nameZh, department.nameEn, locale),
        }),
      };
    }
    return role === "lead"
      ? { phrase, title: t("confirm.makeChairTitle"), description: t("confirm.setChairDescription", { name }) }
      : { phrase, title: t("confirm.makeViceTitle"), description: t("confirm.addViceDescription", { name }) };
  };
}

function splitEmails(text: string) {
  return text.split(/[\s,，;；]+/).filter(Boolean);
}

function DepartmentSelect({
  departments,
  value,
  onChange,
  id,
}: {
  departments: RosterDepartment[];
  value: Id<"departments"> | undefined;
  onChange: (id: Id<"departments">) => void;
  id?: string;
}) {
  const locale = useLocale() as Locale;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Id<"departments">)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {departments.map((d) => (
          <SelectItem key={d._id} value={d._id}>
            {localized(d.nameZh, d.nameEn, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type PreApprovalResults = FunctionReturnType<typeof api.preApprovals.createMany>;
const GOOD_RESULTS = new Set(["created", "updated", "applied", "approved_pending"]);

export function PreApproveDialog({
  roster,
  initialDepartmentId,
  onClose,
}: CloseProps & { roster: Roster; initialDepartmentId?: Id<"departments"> }) {
  const t = useTranslations();
  const createMany = useMutation(api.preApprovals.createMany);
  const showError = useErrorToast();
  const options = managedDepartments(roster);
  const isAdmin = roster.viewer.isAdmin;

  const confirmation = useRoleConfirmation();

  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? options[0]?._id);
  const [role, setRole] = useState<Role>("member");
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PreApprovalResults | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const department = options.find((d) => d._id === departmentId);
  const effectiveRole = isAdmin ? role : "member";
  const elevated = department ? needsConfirmation(department.kind, effectiveRole) : false;
  const emailList = splitEmails(emails);
  const tooManyForElevated = elevated && emailList.length > 1;

  const submit = async () => {
    if (!departmentId) return;
    const res = await createMany({
      emails: [emails],
      departmentId,
      role: effectiveRole,
      note: note || undefined,
    });
    setResults(res);
    setEmails("");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!department || emailList.length === 0 || tooManyForElevated) return;
    if (elevated) {
      const email = emailList[0].toLowerCase();
      const base = confirmation({ email }, department, effectiveRole);
      setConfirm({
        ...base,
        description: t("confirm.preApproveDescription", {
          email,
          role: t(`roles.${roleKey(department.kind, effectiveRole)}`),
        }),
        action: submit,
      });
      return;
    }
    setBusy(true);
    try {
      await submit();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t("dialogs.preApproveTitle")} description={t("dialogs.preApproveDescription")} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pa-emails">{t("dialogs.emails")}</Label>
          <Textarea
            id="pa-emails"
            rows={4}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={t("dialogs.emailsPlaceholder")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pa-department">{t("dialogs.department")}</Label>
            <DepartmentSelect
              id="pa-department"
              departments={options}
              value={departmentId}
              onChange={(id) => {
                setDepartmentId(id);
                setRole("member");
              }}
            />
          </div>
          {isAdmin && department ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="pa-role">{t("dialogs.role")}</Label>
              <RoleSelect id="pa-role" roster={roster} kind={department.kind} value={role} onChange={setRole} />
            </div>
          ) : null}
        </div>
        {tooManyForElevated ? <p className="text-xs text-destructive">{t("dialogs.singleEmailForLead")}</p> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="pa-note">
            {t("common.note")} <span className="text-muted-foreground">{t("common.optional")}</span>
          </Label>
          <Input
            id="pa-note"
            value={note}
            maxLength={LIMITS.preApprovalNote}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("dialogs.notePlaceholder")}
          />
        </div>
        {results ? (
          <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <span className="mb-1 text-xs font-medium text-muted-foreground">{t("dialogs.results")}</span>
            {results.map((r) => (
              <div key={r.email} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate">{r.email}</span>
                <span className={cn("shrink-0", GOOD_RESULTS.has(r.result) ? "text-success" : r.result === "already_member" ? "text-muted-foreground" : "text-destructive")}>
                  {t(`dialogs.result.${r.result}`)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button type="submit" disabled={busy || !departmentId || emailList.length === 0 || tooManyForElevated}>
            {t("common.submit")}
          </Button>
        </DialogFooter>
      </form>
      {confirm ? <ConfirmPhraseDialog request={confirm} onClose={() => setConfirm(null)} /> : null}
    </DialogShell>
  );
}

export function ApproveDialog({
  roster,
  applicant,
  onClose,
}: CloseProps & { roster: Roster; applicant: PendingApplicant }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const approve = useMutation(api.users.approve);
  const showError = useErrorToast();
  const isAdmin = roster.viewer.isAdmin;
  // Applicants join as 部员; promotions happen afterwards from the person sheet with a typed confirmation.
  const options = roster.departments.filter(
    (d) =>
      d.kind === "regular" &&
      (isAdmin ||
        (leadsDepartment(roster, d._id) && applicant.requestedDepartmentIds.includes(d._id))),
  );

  const [selected, setSelected] = useState<Set<Id<"departments">>>(
    () => new Set(options.filter((d) => applicant.requestedDepartmentIds.includes(d._id)).map((d) => d._id)),
  );
  const [busy, setBusy] = useState(false);

  const toggle = (id: Id<"departments">, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const onSubmit = async () => {
    setBusy(true);
    try {
      await approve({
        userId: applicant._id,
        memberships: [...selected].map((departmentId) => ({ departmentId, role: "member" as const })),
      });
      onClose();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={t("dialogs.approveTitle", { name: displayName(applicant, locale) })}
      description={t("dialogs.approveDescription")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        {options.map((d) => (
          <div key={d._id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={selected.has(d._id)} onCheckedChange={(c) => toggle(d._id, c === true)} />
              {localized(d.nameZh, d.nameEn, locale)}
              {applicant.requestedDepartmentIds.includes(d._id) ? (
                <span className="text-xs text-primary">{t("roster.requested")}</span>
              ) : null}
            </label>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void onSubmit()} disabled={busy || (!isAdmin && selected.size === 0)}>
          {t("roster.approve")}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

export function RejectDialog({ applicant, onClose }: CloseProps & { applicant: PendingApplicant }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const reject = useMutation(api.users.reject);
  const showError = useErrorToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await reject({ userId: applicant._id, reason });
      onClose();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t("dialogs.rejectTitle", { name: displayName(applicant, locale) })} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reject-reason">{t("dialogs.rejectReason")}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            maxLength={LIMITS.rejectionReason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>
            {t("roster.reject")}
          </Button>
        </DialogFooter>
      </form>
    </DialogShell>
  );
}

export function DepartmentDialog({ department, onClose }: CloseProps & { department?: RosterDepartment }) {
  const t = useTranslations();
  const create = useMutation(api.departments.create);
  const update = useMutation(api.departments.update);
  const showError = useErrorToast();
  const [nameZh, setNameZh] = useState(department?.nameZh ?? "");
  const [nameEn, setNameEn] = useState(department?.nameEn ?? "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!department) {
      setConfirm({
        title: t("confirm.newDepartmentTitle"),
        description: t("confirm.newDepartmentDescription", { name: nameZh.trim() }),
        phrase: newDepartmentPhrase(nameZh),
        action: () => create({ nameZh, nameEn }),
      });
      return;
    }
    setBusy(true);
    try {
      await update({ departmentId: department._id, nameZh, nameEn });
      onClose();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <DialogShell
      title={department ? t("dialogs.departmentTitleRename") : t("dialogs.departmentTitleNew")}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-zh">{t("dialogs.nameZh")}</Label>
            <Input id="dept-zh" value={nameZh} maxLength={LIMITS.departmentName} onChange={(e) => setNameZh(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-en">{t("dialogs.nameEn")}</Label>
            <Input id="dept-en" value={nameEn} maxLength={LIMITS.departmentName} onChange={(e) => setNameEn(e.target.value)} required />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy || !nameZh.trim() || !nameEn.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </form>
      {confirm ? <ConfirmPhraseDialog request={confirm} onClose={() => setConfirm(null)} onDone={onClose} /> : null}
    </DialogShell>
  );
}

export function DeactivationReviewDialog({
  roster,
  request,
  onClose,
}: CloseProps & { roster: Roster; request: DeactivationRequest }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const review = useMutation(api.deactivationRequests.review);
  const showError = useErrorToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const { person } = request;
  const name = displayName(person, locale);
  const memberships = roster.departments.flatMap((d) => [
    ...d.leads.filter((p) => p._id === person._id).map(() => ({ department: d, role: "lead" as const })),
    ...d.members.filter((p) => p._id === person._id).map(() => ({ department: d, role: "member" as const })),
  ]);

  const decline = async () => {
    setBusy(true);
    try {
      await review({ requestId: request._id, approve: false, note: note || undefined });
      onClose();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <DialogShell title={t("dialogs.deactivationReviewTitle", { name })} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dialogs.deactivationReason")}</span>
          <p className={cn("rounded-md bg-secondary px-3 py-2 whitespace-pre-wrap", !request.reason && "text-subtle-foreground")}>
            {request.reason ?? t("dialogs.noReason")}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("person.departments")}</span>
          {memberships.length === 0 ? (
            <p className="text-subtle-foreground">{t("person.noDepartments")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {memberships.map(({ department, role }) => (
                <span key={department._id} className="rounded-md border border-border px-2 py-0.5 text-xs">
                  {localized(department.nameZh, department.nameEn, locale)} · {t(`roles.${roleKey(department.kind, role)}`)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t("dialogs.deactivationFiles")}</span>
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {t("dialogs.deactivationFilesPending")}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deactivation-note">{t("dialogs.reviewNote")}</Label>
          <Textarea
            id="deactivation-note"
            rows={2}
            value={note}
            maxLength={LIMITS.deactivationReason}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => void decline()} disabled={busy}>
          {t("dialogs.decline")}
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() =>
            setConfirm({
              title: t("confirm.deactivateTitle"),
              description: t("confirm.deactivateDescription", { name }),
              phrase: deactivatePhrase(phraseName(person)),
              destructive: true,
              action: () => review({ requestId: request._id, approve: true, note: note || undefined }),
            })
          }
        >
          {t("dialogs.approveDeactivation")}
        </Button>
      </DialogFooter>
      {confirm ? <ConfirmPhraseDialog request={confirm} onClose={() => setConfirm(null)} onDone={onClose} /> : null}
    </DialogShell>
  );
}

export function AddMemberDialog({
  roster,
  department,
  onClose,
}: CloseProps & { roster: Roster; department: RosterDepartment }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const add = useMutation(api.memberships.add);
  const showError = useErrorToast();
  const confirmation = useRoleConfirmation();
  const isAdmin = roster.viewer.isAdmin;
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const inDepartment = new Set([...department.leads, ...department.members].map((p) => p._id));
  const people = usePeople()?.filter((p) => !inDepartment.has(p._id));
  const effectiveRole = isAdmin ? role : "member";

  return (
    <DialogShell
      title={t("dialogs.addMemberTitle", { department: localized(department.nameZh, department.nameEn, locale) })}
      onClose={onClose}
    >
      {isAdmin ? (
        <div className="flex items-center gap-3">
          <Label className="shrink-0">{t("dialogs.role")}</Label>
          <RoleSelect roster={roster} kind={department.kind} value={role} onChange={setRole} />
        </div>
      ) : null}
      <PersonPicker
        people={people}
        disabled={busy}
        onPick={async (person) => {
          const action = () => add({ userId: person._id, departmentId: department._id, role: effectiveRole });
          if (needsConfirmation(department.kind, effectiveRole)) {
            setConfirm({ ...confirmation(person, department, effectiveRole), action });
            return;
          }
          setBusy(true);
          try {
            await action();
            onClose();
          } catch (error) {
            showError(error);
            setBusy(false);
          }
        }}
      />
      {confirm ? <ConfirmPhraseDialog request={confirm} onClose={() => setConfirm(null)} onDone={onClose} /> : null}
    </DialogShell>
  );
}
