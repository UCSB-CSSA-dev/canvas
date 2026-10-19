"use client";

import { useMutation } from "convex/react";
import { SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, LIMITS, type Id } from "@/lib/api";
import { useErrorToast } from "@/lib/errors";

export function Composer({ channelId, channelLabel }: { channelId: Id<"channels">; channelLabel: string }) {
  const t = useTranslations("chat");
  const send = useMutation(api.messages.send);
  const showError = useErrorToast();
  const [body, setBody] = useState("");

  const trimmed = body.trim();
  const tooLong = trimmed.length > LIMITS.messageBody;
  const canSend = trimmed.length > 0 && !tooLong;

  const submit = () => {
    if (!canSend) return;
    const text = body;
    setBody("");
    send({ channelId, body: text }).catch((error) => {
      setBody(text);
      showError(error);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: Enter confirms a Chinese IME candidate, it must not send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder", { channel: channelLabel })}
          aria-label={t("placeholder", { channel: channelLabel })}
          rows={1}
          className="max-h-40 min-h-9 resize-none"
        />
        <Button size="icon-lg" onClick={submit} disabled={!canSend} aria-label={t("send")}>
          <SendIcon />
        </Button>
      </div>
      <p className={tooLong ? "mt-1 text-xs text-destructive" : "mt-1 hidden text-xs text-subtle-foreground md:block"}>
        {tooLong ? t("tooLong", { max: LIMITS.messageBody }) : t("sendHint")}
      </p>
    </div>
  );
}
