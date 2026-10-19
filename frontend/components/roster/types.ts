import type { FunctionReturnType } from "convex/server";
import type { api, Id } from "@/lib/api";

export type Roster = FunctionReturnType<typeof api.roster.get>;
export type RosterDepartment = Roster["departments"][number];
export type RosterPerson = RosterDepartment["leads"][number];
export type PendingApplicant = Roster["pending"][number];
export type DeactivationRequest = Roster["deactivationRequests"][number];
export type Role = "lead" | "member";
export type DepartmentKind = RosterDepartment["kind"];

/** Translation key under `roles`: 主席团 uses 主席 / 副主席, departments use 部长 / 部员. */
export function roleKey(kind: DepartmentKind, role: Role) {
  if (kind === "presidium") return role === "lead" ? "chair" : "viceChair";
  return role;
}

export function formerRoleKey(role: Role) {
  return role === "lead" ? "formerChair" : "formerViceChair";
}

/** Making someone 部长, or anything in 主席团, needs the typed confirmation. */
export function needsConfirmation(kind: DepartmentKind, role: Role) {
  return kind === "presidium" || role === "lead";
}

export function presidiumOf(roster: Roster) {
  return roster.departments.find((d) => d.kind === "presidium");
}

export function leadsDepartment(roster: Roster, departmentId: Id<"departments">) {
  return roster.viewer.ledDepartmentIds.includes(departmentId);
}

/** Mirrors the backend rule: admins anywhere, leads add/remove members of regular departments they lead. */
export function canManageMembers(roster: Roster, department: RosterDepartment) {
  return (
    roster.viewer.isAdmin ||
    (department.kind === "regular" && leadsDepartment(roster, department._id))
  );
}

export function managedDepartments(roster: Roster) {
  return roster.departments.filter((d) => canManageMembers(roster, d));
}

export type RosterDialog =
  | { kind: "preApprove"; departmentId?: Id<"departments"> }
  | { kind: "approve"; applicant: PendingApplicant }
  | { kind: "reject"; applicant: PendingApplicant }
  | { kind: "department"; department?: RosterDepartment }
  | { kind: "addMember"; department: RosterDepartment }
  | { kind: "deactivation"; request: DeactivationRequest };
