"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import {
  ClipboardListIcon,
  FolderIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useViewer } from "@/components/auth/account-state";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hasStoredLocale, setStoredLocale, type Locale } from "@/lib/locale-store";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./language-toggle";

type NavItem = {
  key: "chat" | "roster" | "files" | "assignments" | "settings";
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { key: "chat", href: "/chat/", icon: MessageSquareIcon },
  { key: "roster", href: "/roster/", icon: UsersIcon },
  { key: "files", href: "/files/", icon: FolderIcon, disabled: true },
  { key: "assignments", href: "/assignments/", icon: ClipboardListIcon, disabled: true },
  { key: "settings", href: "/settings/", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const viewer = useViewer();

  useEffect(() => {
    if (!hasStoredLocale()) setStoredLocale(viewer.locale as Locale);
  }, [viewer.locale]);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      <MobileNav />
    </div>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href);
}

function Sidebar() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const viewer = useViewer();
  const isActive = useIsActive();
  const { signOut } = useAuthActions();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="px-4 py-4 text-base font-semibold">
        <span className="text-primary">CSSA</span> Hub
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={isActive(item.href)}
            label={t(`nav.${item.key}`)}
            count={item.key === "roster" ? viewer.reviewCount : 0}
          />
        ))}
      </nav>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <div className="flex items-center gap-2">
          <PersonAvatar person={viewer} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{displayName(viewer, locale)}</div>
            <div className="truncate text-xs text-muted-foreground">{viewer.email}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <LanguageToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={() => void signOut()} aria-label={t("common.signOut")}>
                <LogOutIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.signOut")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  label,
  count,
}: {
  item: NavItem;
  active: boolean;
  label: string;
  count: number;
}) {
  const t = useTranslations("common");
  const Icon = item.icon;
  const className = cn(
    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
    active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

  if (item.disabled) {
    return (
      <div className={cn(className, "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground")}>
        <Icon className="size-4" />
        <span className="flex-1">{label}</span>
        <span className="text-[10px]">{t("comingSoon")}</span>
      </div>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {count > 0 ? <CountBadge count={count} /> : null}
    </Link>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "min-w-4.5 rounded-full bg-primary px-1 text-center text-[10px] leading-4.5 font-semibold text-primary-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MobileNav() {
  const t = useTranslations("nav");
  const viewer = useViewer();
  const isActive = useIsActive();
  return (
    <nav className="flex shrink-0 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.filter((item) => !item.disabled).map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.key === "roster" && viewer.reviewCount > 0 ? (
              <CountBadge count={viewer.reviewCount} className="absolute top-1 left-1/2 ml-1.5" />
            ) : null}
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Page header used by app pages; holds the title and page-level actions. */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
      {children}
    </header>
  );
}
