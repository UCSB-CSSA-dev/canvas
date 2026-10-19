import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { UserSummaryLike } from "./types";

/** Every approved member from the roster, deduplicated and sorted. */
export function usePeople(): UserSummaryLike[] | undefined {
  const roster = useQuery(api.roster.get);
  return useMemo(() => {
    if (!roster) return undefined;
    const byId = new Map<string, UserSummaryLike>();
    for (const department of roster.departments) {
      for (const person of [...department.leads, ...department.members]) byId.set(person._id, person);
    }
    for (const person of roster.noDepartment) byId.set(person._id, person);
    return [...byId.values()].sort((a, b) =>
      (a.nameEn ?? a.email ?? "").localeCompare(b.nameEn ?? b.email ?? ""),
    );
  }, [roster]);
}

export function matchesPerson(
  person: Pick<UserSummaryLike, "nameZh" | "nameEn" | "name" | "email">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [person.nameZh, person.nameEn, person.name, person.email].some((field) =>
    field?.toLowerCase().includes(q),
  );
}
