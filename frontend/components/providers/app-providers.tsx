"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./i18n-provider";
import { MissingConfig } from "./missing-config";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      {convex ? (
        <ConvexAuthProvider client={convex} storageNamespace="cssa-hub">
          <TooltipProvider>{children}</TooltipProvider>
        </ConvexAuthProvider>
      ) : (
        <MissingConfig />
      )}
      <Toaster position="top-center" />
    </I18nProvider>
  );
}
