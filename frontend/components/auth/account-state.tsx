"use client";

import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { FullPageLoading } from "./full-page-loading";

export type Viewer = NonNullable<FunctionReturnType<typeof api.users.viewer>>;

export type AccountRoute = "signedOut" | "onboarding" | "pending" | "rejected" | "app";

export const ROUTE_PATHS: Record<AccountRoute, string> = {
  signedOut: "/sign-in/",
  onboarding: "/onboarding/",
  pending: "/pending/",
  rejected: "/rejected/",
  app: "/chat/",
};

export function useAccountState(): { route: AccountRoute | null; viewer: Viewer | null } {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && viewer === undefined)) return { route: null, viewer: null };
  if (!isAuthenticated || !viewer) return { route: "signedOut", viewer: null };
  if (viewer.status === "rejected" || viewer.status === "deactivated") {
    return { route: "rejected", viewer };
  }
  if (viewer.status === "new" || viewer.needsOnboarding) return { route: "onboarding", viewer };
  if (viewer.status === "pending") return { route: "pending", viewer };
  return { route: "app", viewer };
}

const ViewerContext = createContext<Viewer | null>(null);

export function useViewer(): Viewer {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside <AccountGate>");
  return viewer;
}

/**
 * Renders children only when the account is in one of the allowed states,
 * otherwise redirects to the page for the current state.
 */
export function AccountGate({
  allow,
  brandedLoading = false,
  children,
}: {
  allow: AccountRoute[];
  brandedLoading?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { route, viewer } = useAccountState();
  const allowed = route !== null && allow.includes(route);

  useEffect(() => {
    if (route !== null && !allow.includes(route)) router.replace(ROUTE_PATHS[route]);
  }, [route, allow, router]);

  if (!allowed) return <FullPageLoading branded={brandedLoading} />;
  return <ViewerContext value={viewer}>{children}</ViewerContext>;
}

/** Sends `/` to wherever the current account belongs. */
export function RootRedirect() {
  const router = useRouter();
  const { route } = useAccountState();
  useEffect(() => {
    if (route !== null) router.replace(ROUTE_PATHS[route]);
  }, [route, router]);
  return <FullPageLoading branded />;
}
