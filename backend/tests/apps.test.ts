import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { addMember, bootstrapAdmin, setup, type TestConvex } from "./helpers";

async function org(t: TestConvex) {
  const admin = await bootstrapAdmin(t);
  const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
  const members = [];
  for (const name of ["a", "b", "c", "d"]) {
    members.push(await addMember(t, admin.as, `${name}@ucsb.edu`, "events"));
  }
  const channels = await lead.as.query(api.channels.listMine, {});
  const events = channels.departments.find((c) => c.nameEn === "Events")!._id;
  return { admin, lead, members, events };
}

const poll = (anonymous: boolean) => ({
  kind: "poll" as const,
  config: {
    options: ["披萨", "寿司", "火锅"],
    multiple: false,
    allowOther: true,
    anonymous,
    showResults: "live" as const,
  },
});

describe("chat apps", () => {
  test("a member's proposal is hidden until a 部长 approves it", async () => {
    const t = setup();
    const { lead, members, events } = await org(t);
    const [proposer, other] = members;
    const appId = await proposer.as.mutation(api.apps.create, {
      channelId: events,
      title: "午餐",
      spec: poll(false),
    });
    expect((await other.as.query(api.apps.list, { channelId: events })).proposed).toHaveLength(0);
    expect((await lead.as.query(api.apps.list, { channelId: events })).proposed).toHaveLength(1);
    await expect(other.as.query(api.apps.get, { appId })).rejects.toThrow(/NOT_FOUND/);
    await expect(
      other.as.mutation(api.apps.review, { appId, approve: true }),
    ).rejects.toThrow(/NOT_FOUND/);

    await lead.as.mutation(api.apps.review, { appId, approve: true });
    const list = await other.as.query(api.apps.list, { channelId: events });
    expect(list.running.map((a) => a._id)).toEqual([appId]);
    await other.as.mutation(api.apps.respond, { appId, data: { choices: [1] } });
    const view = await proposer.as.query(api.apps.get, { appId });
    expect(view.poll?.counts).toEqual([0, 1, 0]);
    expect(view.poll?.voters?.[1]).toEqual([other.userId]);
  });

  test("anonymous votes never reveal who voted", async () => {
    const t = setup();
    const { admin, lead, members, events } = await org(t);
    const appId = await lead.as.mutation(api.apps.create, { channelId: events, title: "匿名", spec: poll(true) });
    await members[0].as.mutation(api.apps.respond, { appId, data: { choices: [], other: "麻辣烫" } });
    await members[1].as.mutation(api.apps.respond, { appId, data: { choices: [0] } });
    await expect(
      members[2].as.mutation(api.apps.respond, { appId, data: { choices: [0, 1] } }),
    ).rejects.toThrow(/INVALID/);

    for (const viewer of [admin, lead, members[3]]) {
      const view = await viewer.as.query(api.apps.get, { appId });
      expect(view.poll?.counts).toEqual([1, 0, 0]);
      expect(view.poll?.voters).toBeNull();
      expect(view.poll?.others).toEqual([{ text: "麻辣烫" }]);
      const ids = view.people.map((p) => p._id);
      expect(ids).not.toContain(members[0].userId);
      expect(ids).not.toContain(members[1].userId);
    }
  });

  test("a 接龙 with a cap stops accepting entries until someone leaves", async () => {
    const t = setup();
    const { lead, members, events } = await org(t);
    const appId = await lead.as.mutation(api.apps.create, {
      channelId: events,
      title: "报名",
      spec: { kind: "signup", config: { cap: 2 } },
    });
    await members[0].as.mutation(api.apps.respond, { appId, data: { text: "A - 套餐A" } });
    await members[1].as.mutation(api.apps.respond, { appId, data: { text: "B - 套餐B" } });
    await expect(
      members[2].as.mutation(api.apps.respond, { appId, data: { text: "C" } }),
    ).rejects.toThrow(/SIGNUP_FULL/);
    // Editing your own line is still allowed when full.
    await members[0].as.mutation(api.apps.respond, { appId, data: { text: "A - 套餐B" } });
    await members[1].as.mutation(api.apps.withdraw, { appId });
    await members[2].as.mutation(api.apps.respond, { appId, data: { text: "C" } });
    const view = await lead.as.query(api.apps.get, { appId });
    expect(view.signup?.entries.map((e) => e.text)).toEqual(["A - 套餐B", "C"]);
    expect(view.signup?.full).toBe(true);
  });

  test("集会 suggests the slot where the most people are free", async () => {
    const t = setup();
    const { lead, members, events } = await org(t);
    // Wednesday 18:00–21:00, 1 hour meetings. Slot = weekday * 48 + minutes / 30.
    const appId = await lead.as.mutation(api.apps.create, {
      channelId: events,
      title: "例会",
      spec: {
        kind: "meeting",
        config: { days: [3], startMinutes: 18 * 60, endMinutes: 21 * 60, durationMinutes: 60 },
      },
    });
    const slot = (h: number, m = 0) => 3 * 48 + (h * 60 + m) / 30;
    const free = [
      [slot(18), slot(18, 30), slot(19), slot(19, 30)],
      [slot(19), slot(19, 30)],
      [slot(19), slot(19, 30), slot(20)],
      [slot(19, 30), slot(20)],
      [slot(18)],
    ];
    const people = [lead, ...members];
    for (const [i, slots] of free.entries()) {
      await people[i].as.mutation(api.apps.respond, { appId, data: { slots } });
    }
    await expect(
      members[0].as.mutation(api.apps.respond, { appId, data: { slots: [slot(9)] } }),
    ).rejects.toThrow(/INVALID/);
    const view = await lead.as.query(api.apps.get, { appId });
    expect(view.meeting?.best[0].start).toBe(slot(19));
    expect(view.meeting?.best[0].userIds).toHaveLength(3);

    await lead.as.mutation(api.apps.close, { appId, confirmedSlot: slot(19) });
    const messages = await lead.as.query(api.messages.list, { channelId: events, paginationOpts: { numItems: 5, cursor: null } });
    expect(messages.page[0].system?.event).toBe("meeting_confirmed");
  });

  test("at most 5 running apps per chat, and DMs have none", async () => {
    const t = setup();
    const { lead, members, events } = await org(t);
    for (let i = 0; i < 5; i++) {
      await lead.as.mutation(api.apps.create, {
        channelId: events,
        title: `接龙${i}`,
        spec: { kind: "signup", config: {} },
      });
    }
    await expect(
      lead.as.mutation(api.apps.create, { channelId: events, title: "6", spec: { kind: "signup", config: {} } }),
    ).rejects.toThrow(/TOO_MANY_APPS/);
    const dm = await lead.as.mutation(api.channels.getOrCreateDm, { otherUserId: members[0].userId });
    await expect(
      lead.as.mutation(api.apps.create, { channelId: dm, title: "x", spec: { kind: "signup", config: {} } }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("attachments", () => {
  test("only the uploader's unsent uploads can be attached, and files expire", async () => {
    const t = setup();
    const { lead, members, events } = await org(t);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["hello"], { type: "text/plain" })));
    const attachmentId = await members[0].as.mutation(api.attachments.register, { storageId, name: "a.txt" });

    await expect(
      members[1].as.mutation(api.messages.send, { channelId: events, body: "", attachmentIds: [attachmentId] }),
    ).rejects.toThrow(/INVALID/);
    await members[0].as.mutation(api.messages.send, { channelId: events, body: "", attachmentIds: [attachmentId] });
    await expect(
      members[0].as.mutation(api.messages.send, { channelId: events, body: "again", attachmentIds: [attachmentId] }),
    ).rejects.toThrow(/INVALID/);

    const [message] = (
      await lead.as.query(api.messages.list, { channelId: events, paginationOpts: { numItems: 1, cursor: null } })
    ).page;
    expect(message.attachments[0].name).toBe("a.txt");
    expect(message.attachments[0].url).not.toBeNull();

    await t.run((ctx) => ctx.db.patch("attachments", attachmentId, { expiresAt: Date.now() - 1 }));
    await t.mutation(internal.attachments.expire, {});
    const [after] = (
      await lead.as.query(api.messages.list, { channelId: events, paginationOpts: { numItems: 1, cursor: null } })
    ).page;
    expect(after.attachments[0].expired).toBe(true);
    expect(after.attachments[0].url).toBeNull();
  });
});
