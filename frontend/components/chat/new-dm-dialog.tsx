"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useViewer } from "@/components/auth/account-state";
import { PersonPicker } from "@/components/people/person-picker";
import { usePeople } from "@/components/people/use-people";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";

export function NewDmDialog({ children }: { children: ReactNode }) {
  const t = useTranslations("chat");
  const viewer = useViewer();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const people = usePeople()?.filter((p) => p._id !== viewer._id);
  const openDm = useMutation(api.channels.getOrCreateDm);
  const showError = useErrorToast();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newDmTitle")}</DialogTitle>
        </DialogHeader>
        {open ? (
          <PersonPicker
            people={people}
            disabled={busy}
            onPick={async (person) => {
              setBusy(true);
              try {
                const channelId = await openDm({ otherUserId: person._id });
                setOpen(false);
                router.push(`/chat/?c=${channelId}`);
              } catch (error) {
                showError(error);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
