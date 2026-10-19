import { afterEach, describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { addMember, bootstrapAdmin, departmentBySlug, setup, signInUser } from "./helpers";

afterEach(() => {
  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
});

describe("sign-in", () => {
  test("first account becomes system admin and seeds departments", async () => {
    const t = setup();
    const admin = await signInUser(t, "first@ucsb.edu");
    const viewer = await admin.as.query(api.users.viewer, {});
    expect(viewer?.isSystemAdmin).toBe(true);
    expect(viewer?.status).toBe("approved");
    expect(viewer?.needsOnboarding).toBe(true);

    const departments = await admin.as.query(api.departments.listPublic, {});
    expect(departments.map((d) => d.slug)).toEqual([
      "presidium",
      "events",
      "international",
      "publicity",
    ]);

    const second = await signInUser(t, "second@ucsb.edu");
    const secondViewer = await second.as.query(api.users.viewer, {});
    expect(secondViewer?.isSystemAdmin).toBe(false);
    expect(secondViewer?.status).toBe("new");
  });

  test("BOOTSTRAP_ADMIN_EMAIL restricts who becomes system admin", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = "owner@ucsb.edu";
    const t = setup();
    const stranger = await signInUser(t, "stranger@ucsb.edu");
    expect((await stranger.as.query(api.users.viewer, {}))?.isSystemAdmin).toBe(false);
    const owner = await signInUser(t, "Owner@UCSB.edu");
    expect((await owner.as.query(api.users.viewer, {}))?.isSystemAdmin).toBe(true);
  });

  test("non-ucsb emails cannot create an account", async () => {
    const t = setup();
    await expect(signInUser(t, "someone@gmail.com")).rejects.toThrow(/DOMAIN_NOT_ALLOWED/);
  });

  test("signing in again returns the same user", async () => {
    const t = setup();
    const first = await signInUser(t, "same@ucsb.edu");
    const again = await signInUser(t, "same@ucsb.edu");
    expect(again.userId).toBe(first.userId);
  });
});

describe("onboarding and approval", () => {
  test("pre-approved email is placed in the hierarchy on first onboarding", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const member = await addMember(t, admin.as, "new.member@ucsb.edu", "events");

    const viewer = await member.as.query(api.users.viewer, {});
    expect(viewer?.status).toBe("approved");
    expect(viewer?.memberships.map((m) => [m.nameEn, m.role])).toEqual([["Events", "member"]]);

    const roster = await member.as.query(api.roster.get, {});
    const events = roster.departments.find((d) => d.slug === "events");
    expect(events?.members.map((m) => m.email)).toEqual(["new.member@ucsb.edu"]);
  });

  test("onboarding requires consent", async () => {
    const t = setup();
    await bootstrapAdmin(t);
    const user = await signInUser(t, "u@ucsb.edu");
    const events = await departmentBySlug(t, "events");
    await expect(
      user.as.mutation(api.users.submitOnboarding, {
        nameZh: "名",
        nameEn: "Name",
        consent: false,
        requestedDepartmentIds: [events._id],
      }),
    ).rejects.toThrow(/INVALID/);
  });

  test("applicant without pre-approval waits, then a lead approves into their department", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
    const events = await departmentBySlug(t, "events");
    const publicity = await departmentBySlug(t, "publicity");

    const applicant = await signInUser(t, "applicant@ucsb.edu");
    const result = await applicant.as.mutation(api.users.submitOnboarding, {
      nameZh: "申请人",
      nameEn: "Applicant",
      consent: true,
      requestedDepartmentIds: [events._id],
    });
    expect(result.status).toBe("pending");
    await expect(applicant.as.query(api.roster.get, {})).rejects.toThrow(/NOT_APPROVED/);

    const leadRoster = await lead.as.query(api.roster.get, {});
    expect(leadRoster.pending.map((p) => p.email)).toEqual(["applicant@ucsb.edu"]);

    await expect(
      lead.as.mutation(api.users.approve, {
        userId: applicant.userId,
        memberships: [{ departmentId: publicity._id, role: "member" }],
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      lead.as.mutation(api.users.approve, {
        userId: applicant.userId,
        memberships: [{ departmentId: events._id, role: "lead" }],
      }),
    ).rejects.toThrow(/FORBIDDEN/);

    await lead.as.mutation(api.users.approve, {
      userId: applicant.userId,
      memberships: [{ departmentId: events._id, role: "member" }],
    });
    expect((await applicant.as.query(api.users.viewer, {}))?.status).toBe("approved");
    await expect(
      admin.as.mutation(api.users.approve, { userId: applicant.userId, memberships: [] }),
    ).rejects.toThrow(/ALREADY_REVIEWED/);
  });

  test("pre-approving a pending applicant's email approves them immediately", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const events = await departmentBySlug(t, "events");
    const applicant = await signInUser(t, "late@ucsb.edu");
    await applicant.as.mutation(api.users.submitOnboarding, {
      nameZh: "迟到",
      nameEn: "Late",
      consent: true,
      requestedDepartmentIds: [events._id],
    });

    const results = await admin.as.mutation(api.preApprovals.createMany, {
      emails: ["late@ucsb.edu"],
      departmentId: events._id,
      role: "member",
    });
    expect(results).toEqual([{ email: "late@ucsb.edu", result: "approved_pending" }]);
    expect((await applicant.as.query(api.users.viewer, {}))?.status).toBe("approved");
  });

  test("last system admin cannot be removed", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    await expect(
      admin.as.mutation(api.users.setSystemAdmin, { userId: admin.userId, value: false }),
    ).rejects.toThrow(/LAST_SYSTEM_ADMIN/);
  });
});
