import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { ERROR_CODES } from "./api";

const KNOWN_CODES = new Set<string>(ERROR_CODES);

export function errorCode(error: unknown): string {
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    if (code && KNOWN_CODES.has(code)) return code;
  }
  return "UNKNOWN";
}

/** Returns a handler that shows a translated toast for a failed mutation. */
export function useErrorToast() {
  const t = useTranslations("errors");
  return useCallback((error: unknown) => toast.error(t(errorCode(error))), [t]);
}
