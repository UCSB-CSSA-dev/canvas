"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useViewer } from "@/components/auth/account-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";
import { PeopleChecklist, useDepartmentPeople } from "./group-form-dialog";

type Proposal = FunctionReturnType<typeof api.groups.listProposals>["mine"][number];

export function ProposalsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("groups");
  const data = useQuery(api.groups.listProposals, open ? {} : "skip");
  const [reviewing, setReviewing] = useState<Proposal | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReviewing(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {reviewing ? (
          <ReviewForm proposal={reviewing} onDone={() => setReviewing(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("proposalsTitle")}</DialogTitle>
              <DialogDescription>{t("proposalsHint")}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh]">
              <div className="flex flex-col gap-4 pr-3">
                {data && data.toReview.length > 0 ? (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs font-medium text-muted-foreground">{t("toReview")}</h3>
                    {data.toReview.map((p) => (
                      <ProposalCard key={p._id} proposal={p} onReview={() => setReviewing(p)} />
                    ))}
                  </section>
                ) : null}
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground">{t("myProposals")}</h3>
                  {data?.mine.length === 0 ? <p className="text-sm text-muted-foreground">{t("noProposals")}</p> : null}
                  {(data?.mine ?? []).map((p) => (
                    <ProposalCard key={p._id} proposal={p} mine />
                  ))}
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProposalCard({ proposal, mine, onReview }: { proposal: Proposal; mine?: boolean; onReview?: () => void }) {
  const t = useTranslations("groups");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const cancel = useMutation(api.groups.cancelProposal);
  const showError = useErrorToast();
  const departments = proposal.departments.map((d) => localized(d.nameZh, d.nameEn, locale)).join(" · ");

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{proposal.name}</span>
        <Badge variant={proposal.status === "pending" ? "default" : "secondary"}>{t(`status.${proposal.status}`)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{proposal.purpose}</p>
      <p className="text-xs text-subtle-foreground">
        {t("proposalMeta", {
          proposer: displayName(proposal.proposer, locale),
          departments,
          date: format.dateTime(proposal._creationTime, { month: "short", day: "numeric" }),
        })}
      </p>
      {proposal.suggested.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("suggested")}: {proposal.suggested.map((p) => displayName(p, locale)).join(locale === "zh" ? "、" : ", ")}
        </p>
      ) : null}
      {proposal.reviewNote ? (
        <p className="text-xs text-muted-foreground">
          {t("reviewNoteBy", { name: displayName(proposal.reviewer, locale) })}: {proposal.reviewNote}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {mine && proposal.status === "pending" ? (
          <Button size="sm" variant="ghost" onClick={() => cancel({ proposalId: proposal._id }).catch(showError)}>
            {t("cancelProposal")}
          </Button>
        ) : null}
        {proposal.status === "approved" && proposal.channelId ? (
          <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/?c=${proposal.channelId}`)}>
            {t("openGroup")}
          </Button>
        ) : null}
        {onReview && proposal.canReview ? (
          <Button size="sm" onClick={onReview}>
            {t("review")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ReviewForm({ proposal, onDone }: { proposal: Proposal; onDone: () => void }) {
  const t = useTranslations("groups");
  const viewer = useViewer();
  const router = useRouter();
  const review = useMutation(api.groups.reviewProposal);
  const showError = useErrorToast();
  const [name, setName] = useState(proposal.name);
  const [memberIds, setMemberIds] = useState<Id<"users">[]>(proposal.suggested.map((p) => p._id));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Approvers can keep suggested people and add members of departments they lead (admins: anyone).
  const own = useDepartmentPeople(viewer.isAdmin ? "all" : viewer.ledDepartmentIds);
  const people = [...proposal.suggested, ...(own ?? []).filter((p) => !proposal.suggested.some((s) => s._id === p._id))];

  const act = async (approve: boolean) => {
    setBusy(true);
    try {
      const channelId = await review({
        proposalId: proposal._id,
        approve,
        note: note.trim() || undefined,
        name: approve ? name : undefined,
        memberIds: approve ? memberIds : undefined,
      });
      onDone();
      if (channelId) router.push(`/chat/?c=${channelId}`);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("reviewTitle", { name: proposal.name })}</DialogTitle>
        <DialogDescription>{proposal.purpose}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-name">{t("name")}</Label>
        <Input id="review-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("finalMembers")}</Label>
        <p className="text-xs text-muted-foreground">{t("finalMembersHint")}</p>
        <PeopleChecklist
          people={people}
          selected={memberIds}
          exclude={[proposal.proposer?._id ?? ""]}
          onToggle={(id) => setMemberIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-note">{t("reviewNote")}</Label>
        <Textarea id="review-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("back")}
        </Button>
        <Button variant="destructive" disabled={busy || !note.trim()} onClick={() => void act(false)}>
          {t("reject")}
        </Button>
        <Button disabled={busy || !name.trim()} onClick={() => void act(true)}>
          {t("approve")}
        </Button>
      </div>
    </>
  );
}
