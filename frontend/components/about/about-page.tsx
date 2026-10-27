"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRightIcon,
  CompassIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MailIcon,
  PartyPopperIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/layout/brand";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { PersonAvatar } from "@/components/people/person-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";
import { cn } from "@/lib/utils";
import { CAMPUS_PHOTOS, CampusBackdrop } from "./campus-backdrop";

const OFFICIAL_SITE = "https://www.ucsbcssa.com";

type Roster = FunctionReturnType<typeof api.about.roster>;
type Member = Roster["members"][number];
type Department = Roster["departments"][number];

const PILLARS: {
  key: "culture" | "academic" | "social" | "newcomers";
  icon: LucideIcon;
}[] = [
  { key: "culture", icon: PartyPopperIcon },
  { key: "academic", icon: GraduationCapIcon },
  { key: "social", icon: UsersIcon },
  { key: "newcomers", icon: CompassIcon },
];

export function AboutPage() {
  const t = useTranslations("about");
  const roster = useQuery(api.about.roster, {});

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/about-us/" className="h-8">
            <BrandMark className="h-8" />
          </Link>
          <div className="ml-4 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#about" className="hover:text-foreground">
              {t("navAbout")}
            </a>
            <a href="#what-we-do" className="hover:text-foreground">
              {t("navWhatWeDo")}
            </a>
            <a href="#team" className="hover:text-foreground">
              {t("navTeam")}
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle />
            <Button asChild size="sm">
              <Link href="/">{t("openHub")}</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative">
        <div className="relative">
          <div className="absolute inset-x-0 -top-14 bottom-0">
            <CampusBackdrop />
          </div>
          <section className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {t("eyebrow")}
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                {t("heroTitle")}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("heroSubtitle")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <a href="#team">
                  {t("meetTeam")}
                  <ArrowRightIcon />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={OFFICIAL_SITE} target="_blank" rel="noopener noreferrer">
                  {t("officialSite")}
                  <ExternalLinkIcon />
                </a>
              </Button>
            </div>
            <dl className="mt-14 grid w-full max-w-xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/60 py-5 backdrop-blur">
              <Stat label={t("statMembers")} value={roster ? String(roster.members.length) : "–"} />
              <Stat label={t("statDepartments")} value={roster ? String(roster.departments.length) : "–"} />
              <Stat label={t("statCampus")} value="UCSB" />
            </dl>
          </section>
        </div>

        <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:items-start">
            <div>
              <p className="text-sm font-medium text-primary">{t("aboutEyebrow")}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("aboutTitle")}</h2>
            </div>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>{t("aboutBody1")}</p>
              <p>{t("aboutBody2")}</p>
            </div>
          </div>
        </section>

        <section id="what-we-do" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <p className="text-sm font-medium text-primary">{t("whatEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("whatTitle")}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="group rounded-2xl border border-border bg-card/60 p-6 transition-colors hover:border-primary/40"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{t(`pillars.${key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`pillars.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="team" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <p className="text-sm font-medium text-primary">{t("teamEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">{t("teamTitle")}</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t("teamBody")}</p>
          {roster === undefined ? <TeamSkeleton /> : <Team roster={roster} />}
        </section>
      </main>

      <footer className="relative border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 pt-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} UCSB CSSA</span>
          <div className="flex items-center gap-5">
            <a href={OFFICIAL_SITE} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              ucsbcssa.com
            </a>
            <Link href="/privacy/" className="hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link href="/" className="hover:text-foreground">
              {t("openHub")}
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pt-4 pb-8 text-center text-xs text-subtle-foreground sm:text-left">
          {t("photoCredits")}{" "}
          {CAMPUS_PHOTOS.map((photo, i) => (
            <span key={photo.url}>
              {i > 0 ? " · " : null}
              <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted-foreground hover:underline"
              >
                {photo.author} ({photo.license})
              </a>
            </span>
          ))}
        </p>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <dt className="order-2 text-xs text-muted-foreground">{label}</dt>
      <dd className="order-1 text-2xl font-bold text-primary tabular-nums">{value}</dd>
    </div>
  );
}

const ALL = "all";
const OTHERS = "others";

function Team({ roster }: { roster: Roster }) {
  const t = useTranslations("about");
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<string>(ALL);

  const groups = useMemo(() => {
    const byName = (a: Member, b: Member) => displayName(a, locale).localeCompare(displayName(b, locale), locale);
    const sections: {
      key: string;
      department: Department | null;
      members: Member[];
    }[] = roster.departments.map((d) => {
      const role = (m: Member) => m.positions.find((p) => p.departmentId === d._id)?.role;
      const members = roster.members
        .filter((m) => role(m) !== undefined)
        .sort((a, b) => (role(a) === role(b) ? byName(a, b) : role(a) === "lead" ? -1 : 1));
      return { key: d._id, department: d, members };
    });
    const others = roster.members.filter((m) => m.positions.length === 0).sort(byName);
    sections.push({ key: OTHERS, department: null, members: others });
    return sections.filter((s) => s.members.length > 0);
  }, [roster, locale]);

  if (groups.length === 0) return <p className="mt-10 text-muted-foreground">{t("teamEmpty")}</p>;

  const sectionName = (s: (typeof groups)[number]) =>
    s.department ? localized(s.department.nameZh, s.department.nameEn, locale) : t("otherMembers");
  const shown = filter === ALL ? groups : groups.filter((s) => s.key === filter);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip
          active={filter === ALL}
          onClick={() => setFilter(ALL)}
          label={t("filterAll")}
          count={roster.members.length}
        />
        {groups.map((s) => (
          <FilterChip
            key={s.key}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
            label={sectionName(s)}
            count={s.members.length}
          />
        ))}
      </div>
      <div className="mt-10 flex flex-col gap-14">
        {shown.map((s) => (
          <div key={s.key}>
            <div className="mb-5 flex items-baseline gap-3">
              <h3 className="text-xl font-semibold">{sectionName(s)}</h3>
              <span className="text-sm text-muted-foreground">{t("memberCount", { count: s.members.length })}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {s.members.map((m) => (
                <MemberCard key={m._id} member={m} departments={roster.departments} highlight={s.department?._id} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "text-primary-foreground/70" : "text-subtle-foreground")}>
        {count}
      </span>
    </button>
  );
}

function MemberCard({
  member,
  departments,
  highlight,
}: {
  member: Member;
  departments: Department[];
  highlight?: string;
}) {
  const t = useTranslations("roles");
  const locale = useLocale() as Locale;
  const primary = displayName(member, locale);
  const secondary = locale === "zh" ? member.nameEn : member.nameZh;
  const positions = member.positions
    .map((p) => ({
      ...p,
      department: departments.find((d) => d._id === p.departmentId),
    }))
    .filter((p) => p.department)
    .sort((a, b) => (a.departmentId === highlight ? -1 : b.departmentId === highlight ? 1 : 0));
  const isLead = positions.some((p) => p.role === "lead" && p.departmentId === highlight);

  const roleLabel = (p: (typeof positions)[number]) =>
    p.department!.kind === "presidium"
      ? t(p.role === "lead" ? "chair" : "viceChair")
      : `${localized(p.department!.nameZh, p.department!.nameEn, locale)} · ${t(p.role === "lead" ? "lead" : "member")}`;

  return (
    <article className="group flex flex-col items-center rounded-2xl border border-border bg-card/60 p-6 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_30px_-12px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
      <PersonAvatar
        person={member}
        className={cn("size-20 text-lg ring-2 ring-offset-2 ring-offset-card", isLead ? "ring-primary" : "ring-border")}
      />
      <h4 className="mt-4 text-base font-semibold">{primary}</h4>
      {secondary && secondary !== primary ? <p className="text-sm text-muted-foreground">{secondary}</p> : null}
      {positions.length > 0 ? (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {positions.map((p) => (
            <span
              key={p.departmentId}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                p.role === "lead" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
              )}
            >
              {roleLabel(p)}
            </span>
          ))}
        </div>
      ) : null}
      {member.bio ? (
        <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">{member.bio}</p>
      ) : null}
      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <MailIcon className="size-3.5" />
          {member.email}
        </a>
      ) : null}
    </article>
  );
}

function TeamSkeleton() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-56 rounded-2xl" />
      ))}
    </div>
  );
}
