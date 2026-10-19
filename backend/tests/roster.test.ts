import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { addMember, bootstrapAdmin, departmentBySlug, setup, signInUser } from "./helpers";

describe("pre-approvals", () => {
  test("parses a pasted list and reports a result per email", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const events = await departmentBySlug(t, "events");
    await addMember(t, admin.as, "existing@ucsb.edu", "international");

    const results = await admin.as.mutation(api.preApprovals.createMany, {
      emails: ["a@ucsb.edu, b@ucsb.edu\nA@ucsb.edu; bad@gmail.com", "existing@ucsb.edu"],
      departmentId: events._id,
      role: "member",
    });
    expect(results).toEqual([
      { email: "a@ucsb.edu", result: "created" },
      { email: "b@ucsb.edu", result: "created" },
      { email: "bad@gmail.com", result: "invalid" },
      { email: "existing@ucsb.edu", result: "applied" },
    ]);

    const again = await admin.as.mutation(api.preApprovals.createMany, {
      emails: ["a@ucsb.edu"],
      departmentId: events._id,
      role: "lead",
    });
    expect(again).toEqual([{ email: "a@ucsb.edu", result: "updated" }]);
  });

  test("leads can only pre-approve members into departments they lead", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
    const events = await departmentBySlug(t, "events");
    const publicity = await departmentBySlug(t, "publicity");
    const presidium = await departmentBySlug(t, "presidium");

    await lead.as.mutation(api.preApprovals.createMany, {
      emails: ["ok@ucsb.edu"],
      departmentId: events._id,
      role: "member",
    });
    for (const [departmentId, role] of [
      [events._id, "lead"],
      [publicity._id, "member"],
      [presidium._id, "member"],
    ] as const) {
      await expect(
        lead.as.mutation(api.preApprovals.createMany, {
          emails: ["no@ucsb.edu"],
          departmentId,
          role,
        }),
      ).rejects.toThrow(/FORBIDDEN/);
    }
  });

  test("members cannot see pending applicants or pre-approvals", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const events = await departmentBySlug(t, "events");
    const member = await addMember(t, admin.as, "m@ucsb.edu", "events");
    await admin.as.mutation(api.preApprovals.createMany, {
      emails: ["future@ucsb.edu"],
      departmentId: events._id,
      role: "member",
    });

    const memberRoster = await member.as.query(api.roster.get, {});
    expect(memberRoster.pending).toEqual([]);
    expect(memberRoster.preApprovals).toEqual([]);

    const adminRoster = await admin.as.query(api.roster.get, {});
    expect(adminRoster.preApprovals.map((p) => p.email)).toEqual(["future@ucsb.edu"]);
  });

  test("revoked pre-approvals are not claimed", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const events = await departmentBySlug(t, "events");
    await admin.as.mutation(api.preApprovals.createMany, {
      emails: ["gone@ucsb.edu"],
      departmentId: events._id,
      role: "member",
    });
    const roster = await admin.as.query(api.roster.get, {});
    await admin.as.mutation(api.preApprovals.revoke, {
      preApprovalId: roster.preApprovals[0]._id,
    });

    const user = await signInUser(t, "gone@ucsb.edu");
    const viewer = await user.as.query(api.users.viewer, {});
    expect(viewer?.preApprovals).toEqual([]);
  });
});

describe("memberships", () => {
  test("lead can remove a member of their department but not a co-lead", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
    await addMember(t, admin.as, "colead@ucsb.edu", "events", "lead");
    await addMember(t, admin.as, "m@ucsb.edu", "events");

    const roster = await lead.as.query(api.roster.get, {});
    const events = roster.departments.find((d) => d.slug === "events")!;
    const coLead = events.leads.find((p) => p.email === "colead@ucsb.edu")!;
    const member = events.members.find((p) => p.email === "m@ucsb.edu")!;

    await expect(
      lead.as.mutation(api.memberships.remove, { membershipId: coLead.membershipId }),
    ).rejects.toThrow(/FORBIDDEN/);
    await lead.as.mutation(api.memberships.remove, { membershipId: member.membershipId });

    const after = await lead.as.query(api.roster.get, {});
    expect(after.noDepartment.map((p) => p.email)).toContain("m@ucsb.edu");
  });
});
