"use client";

import { useMutation } from "convex/react";
import { UserXIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useViewer } from "@/components/auth/account-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";

/** Lets a member ask 主席团 to deactivate their account. */
export function DeactivateCard() {
  const t = useTranslations();
  const format = useFormatter();
  const viewer = useViewer();
  const cancel = useMutation(api.deactivationRequests.cancel);
  const showError = useErrorToast();
  const [open, setOpen] = useState(false);

  const request = viewer.deactivationRequest;
  const isChair = viewer.memberships.some((m) => m.kind === "presidium" && m.role === "lead");
  const blocker = viewer.isSystemAdmin
    ? t("settings.deactivateSystemAdmin")
    : isChair
      ? t("settings.deactivateChair")
      : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <h2 className="flex items-center gap-2 font-semibold text-destructive">
        <UserXIcon className="size-4" />
        {t("settings.deactivateTitle")}
      </h2>
      <p className="text-muted-foreground">{t("settings.deactivateBody")}</p>

      {request?.status === "pending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>{t("settings.deactivatePending", { date: format.dateTime(request.createdAt, { dateStyle: "medium" }) })}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void cancel({ requestId: request._id }).catch(showError)}
          >
            {t("settings.deactivateCancel")}
          </Button>
        </div>
      ) : (
        <>
          {request?.status === "declined" ? (
            <div className="rounded-md bg-secondary px-3 py-2 text-xs">
              <p>{t("settings.deactivateDeclined")}</p>
              {request.reviewNote ? (
                <p className="mt-1 text-muted-foreground">
                  {t("settings.deactivateDeclinedNote", { note: request.reviewNote })}
                </p>
              ) : null}
            </div>
          ) : null}
          {blocker ? <p className="text-xs text-muted-foreground">{blocker}</p> : null}
          <Button variant="destructive" className="self-start" disabled={blocker !== null} onClick={() => setOpen(true)}>
            {t("settings.deactivateButton")}
          </Button>
        </>
      )}

      {open ? <RequestDialog onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const requestDeactivation = useMutation(api.deactivationRequests.request);
  const showError = useErrorToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestDeactivation({ reason: reason || undefined });
      toast.success(t("settings.deactivateSubmitted"));
      onClose();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.deactivateButton")}</DialogTitle>
          <DialogDescription>{t("settings.deactivateBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deactivate-reason">{t("settings.deactivateReason")}</Label>
          <Textarea
            id="deactivate-reason"
            rows={3}
            value={reason}
            maxLength={LIMITS.deactivationReason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={busy}>
            {t("settings.deactivateSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
