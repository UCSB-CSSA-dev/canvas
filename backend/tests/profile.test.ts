import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { addMember, bootstrapAdmin, setup } from "./helpers";

describe("profile", () => {
  test("bio is public on the roster and length-limited", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const member = await addMember(t, admin.as, "m@ucsb.edu", "events");
    await member.as.mutation(api.users.updateProfile, { nameZh: "成员", nameEn: "Member", bio: "  大三，摄影  " });

    const roster = await admin.as.query(api.roster.get, {});
    const events = roster.departments.find((d) => d.slug === "events")!;
    expect(events.members[0].bio).toBe("大三，摄影");

    await expect(
      member.as.mutation(api.users.updateProfile, { nameZh: "成员", nameEn: "Member", bio: "x".repeat(161) }),
    ).rejects.toThrow(/INVALID/);
  });
});

describe("deactivation requests", () => {
  test("a member requests, 主席团 approves, and the account is deactivated", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const member = await addMember(t, admin.as, "m@ucsb.edu", "events");

    await member.as.mutation(api.deactivationRequests.request, { reason: "毕业了" });
    await expect(member.as.mutation(api.deactivationRequests.request, {})).rejects.toThrow(/INVALID/);
    expect((await admin.as.query(api.users.viewer, {}))!.reviewCount).toBe(1);

    const roster = await admin.as.query(api.roster.get, {});
    expect(roster.deactivationRequests).toMatchObject([{ person: { _id: member.userId }, reason: "毕业了" }]);
    await expect(
      member.as.mutation(api.deactivationRequests.review, {
        requestId: roster.deactivationRequests[0]._id,
        approve: true,
      }),
    ).rejects.toThrow(/FORBIDDEN/);

    await admin.as.mutation(api.deactivationRequests.review, {
      requestId: roster.deactivationRequests[0]._id,
      approve: true,
    });
    const viewer = await member.as.query(api.users.viewer, {});
    expect(viewer?.status).toBe("deactivated");
    expect(viewer?.deactivationRequest?.status).toBe("approved");
  });

  test("declining keeps the account and shows the note; members can cancel", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const member = await addMember(t, admin.as, "m@ucsb.edu", "events");

    await member.as.mutation(api.deactivationRequests.request, {});
    let request = (await member.as.query(api.users.viewer, {}))!.deactivationRequest!;
    await admin.as.mutation(api.deactivationRequests.review, {
      requestId: request._id,
      approve: false,
      note: "先交接活动资料",
    });
    let viewer = (await member.as.query(api.users.viewer, {}))!;
    expect(viewer.status).toBe("approved");
    expect(viewer.deactivationRequest).toMatchObject({ status: "declined", reviewNote: "先交接活动资料" });

    await member.as.mutation(api.deactivationRequests.request, {});
    request = (await member.as.query(api.users.viewer, {}))!.deactivationRequest!;
    await member.as.mutation(api.deactivationRequests.cancel, { requestId: request._id });
    viewer = (await member.as.query(api.users.viewer, {}))!;
    expect(viewer.deactivationRequest?.status).toBe("cancelled");
  });

  test("system admins and the 主席 cannot request", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const chair = await addMember(t, admin.as, "chair@ucsb.edu", "presidium", "lead");
    await expect(admin.as.mutation(api.deactivationRequests.request, {})).rejects.toThrow(/FORBIDDEN/);
    await expect(chair.as.mutation(api.deactivationRequests.request, {})).rejects.toThrow(/CHAIR_REQUIRED/);
  });
});
