"use client";

import { CheckIcon, LoaderIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadItem } from "./use-file-upload";

export function UploadPanel({
  items,
  onDismiss,
  onClear,
  className,
}: {
  items: UploadItem[];
  onDismiss: (key: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const t = useTranslations("files");
  if (items.length === 0) return null;
  const busy = items.some((i) => !i.fileId && !i.error);
  return (
    <div className={cn("flex flex-col gap-1 rounded-md border border-border bg-popover p-2 shadow-md", className)}>
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{busy ? t("uploadingCount", { count: items.filter((i) => !i.fileId && !i.error).length }) : t("uploadsDone")}</span>
        {!busy ? (
          <Button size="xs" variant="ghost" onClick={onClear}>
            {t("clear")}
          </Button>
        ) : null}
      </div>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 rounded px-1 py-1 text-xs">
            <div className="min-w-0 flex-1">
              <div className="truncate">{item.name}</div>
              {item.drive && !item.error ? (
                <div className="truncate text-subtle-foreground">{t("toDrive")}</div>
              ) : null}
              {item.error ? (
                <div className="truncate text-destructive">{item.error}</div>
              ) : (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                </div>
              )}
            </div>
            {item.fileId ? (
              <CheckIcon className="size-3.5 text-primary" />
            ) : item.error ? (
              <button
                type="button"
                aria-label={t("dismiss")}
                onClick={() => onDismiss(item.key)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
