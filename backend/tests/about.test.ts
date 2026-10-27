import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { addMember, bootstrapAdmin, setup } from "./helpers";

describe("about-us roster", () => {
  test("is public, lists approved members with positions, and hides emails unless shown", async () => {
    const t = setup();
    const admin = await bootstrapAdmin(t);
    const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
    const alice = await addMember(t, admin.as, "alice@ucsb.edu", "events");
    await alice.as.mutation(api.users.updateProfile, { nameZh: "爱丽丝", nameEn: "Alice", bio: "Loves hiking" });

    const roster = await t.query(api.about.roster, {});
    const leadRow = roster.members.find((m) => m._id === lead.userId);
    const aliceRow = roster.members.find((m) => m._id === alice.userId);
    expect(leadRow?.positions.map((p) => p.role)).toEqual(["lead"]);
    expect(aliceRow?.bio).toBe("Loves hiking");
    expect(roster.members.every((m) => m.email === undefined)).toBe(true);
    const allowed = new Set(["_id", "bio", "email", "image", "name", "nameEn", "nameZh", "positions"]);
    expect(Object.keys(aliceRow!).filter((key) => !allowed.has(key))).toEqual([]);
    expect(roster.departments.find((d) => d._id === leadRow!.positions[0].departmentId)?.nameEn).toBe("Events");

    await alice.as.mutation(api.users.setShowEmailPublicly, { show: true });
    const after = await t.query(api.about.roster, {});
    expect(after.members.find((m) => m._id === alice.userId)?.email).toBe("alice@ucsb.edu");
    expect(after.members.find((m) => m._id === lead.userId)?.email).toBeUndefined();
  });
});
