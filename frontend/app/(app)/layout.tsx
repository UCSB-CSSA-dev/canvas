import type { ReactNode } from "react";
import { AccountGate } from "@/components/auth/account-state";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AccountGate allow={["app"]} brandedLoading>
      <AppShell>{children}</AppShell>
    </AccountGate>
  );
}
