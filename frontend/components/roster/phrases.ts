import type { DepartmentKind, Role } from "./types";

// Confirmation phrases are always Chinese ("将XXX设为XXX"), whatever the UI language.

type Named = { nameZh?: string; nameEn?: string; name?: string; email?: string };

export function phraseName(person: Named) {
  return person.nameZh || person.nameEn || person.name || person.email || "";
}

const ROLE_ZH = {
  presidium: { lead: "主席", member: "副主席" },
  regular: { lead: "部长", member: "部员" },
} as const;

export function rolePhrase(name: string, department: { kind: DepartmentKind; nameZh: string }, role: Role) {
  const title = ROLE_ZH[department.kind][role];
  return department.kind === "presidium" ? `将${name}设为${title}` : `将${name}设为${department.nameZh}${title}`;
}

export function retirePhrase(name: string, formerRole: Role) {
  return `将${name}设为${formerRole === "lead" ? "前主席" : "前副主席"}`;
}

export function deactivatePhrase(name: string) {
  return `将${name}设为停用`;
}

export function newDepartmentPhrase(nameZh: string) {
  return `将${nameZh.trim()}设为新部门`;
}
