import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { addMember, bootstrapAdmin, setup, type TestConvex } from "./helpers";

function withMentions(...ids: Id<"users">[]) {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: ids.map((id) => ({ type: "mention", attrs: { id, label: "x" } })) }],
  });
}

async function notificationTypes(t: TestConvex, userId: Id<"users">) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
  return rows.map((n) => n.type);
}

async function team(t: TestConvex) {
  const admin = await bootstrapAdmin(t);
  const lead = await addMember(t, admin.as, "lead@ucsb.edu", "events", "lead");
  const alice = await addMember(t, admin.as, "alice@ucsb.edu", "events");
  const bob = await addMember(t, admin.as, "bob@ucsb.edu", "events");
  const carol = await addMember(t, admin.as, "carol@ucsb.edu", "publicity");
  const channels = await alice.as.query(api.channels.listMine, {});
  const events = channels.departments.find((c) => c.nameEn === "Events")!._id;
  return { admin, lead, alice, bob, carol, events };
}

type As = Awaited<ReturnType<typeof bootstrapAdmin>>["as"];

async function task(as: As, channelId: Id<"channels">, assigneeIds: Id<"users">[], publish = true) {
  return await as.mutation(api.assignments.create, {
    channelId,
    kind: "task",
    title: "Plan the gala",
    requiresSubmission: false,
    assigneeIds,
    everyone: false,
    publish,
  });
}

describe("task documents", () => {
  test("assignees and reviewers edit, chat members read, others can't see", async () => {
    const t = setup();
    const { lead, alice, bob, carol, events } = await team(t);
    const assignmentId = await task(lead.as, events, [alice.userId]);

    const documentId = await alice.as.mutation(api.documents.create, { assignmentId, title: "  Run of show  " });
    expect((await alice.as.query(api.documents.get, { documentId }))?.title).toBe("Run of show");
    expect((await alice.as.query(api.prosemirror.getSnapshot, { id: documentId })).content).not.toBeNull();

    await alice.as.mutation(api.prosemirror.submitSteps, { id: documentId, version: 1, clientId: "alice", steps: [] });
    await lead.as.mutation(api.documents.rename, { documentId, title: "Schedule" });

    // Bob is in the chat but not assigned: read-only.
    const asBob = await bob.as.query(api.documents.get, { documentId });
    expect(asBob?.canEdit).toBe(false);
    await expect(
      bob.as.mutation(api.prosemirror.submitSteps, { id: documentId, version: 1, clientId: "bob", steps: [] }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(bob.as.mutation(api.documents.create, { assignmentId, title: "Mine" })).rejects.toThrow(/FORBIDDEN/);

    // Carol isn't in the department chat.
    expect(await carol.as.query(api.documents.get, { documentId })).toBeNull();
    await expect(carol.as.query(api.prosemirror.getSnapshot, { id: documentId })).rejects.toThrow(/NOT_FOUND/);

    const list = await bob.as.query(api.documents.listForTask, { assignmentId });
    expect(list?.documents.map((d) => d.title)).toEqual(["Schedule"]);
    expect(list?.canCreate).toBe(false);
  });

  test("closed tasks are read-only; deleting a draft deletes its documents", async () => {
    const t = setup();
    const { lead, alice, events } = await team(t);
    const assignmentId = await task(lead.as, events, [alice.userId]);
    const documentId = await alice.as.mutation(api.documents.create, { assignmentId, title: "Notes" });
    await lead.as.mutation(api.assignments.close, { assignmentId });
    expect((await alice.as.query(api.documents.get, { documentId }))?.canEdit).toBe(false);
    await expect(
      alice.as.mutation(api.prosemirror.submitSteps, { id: documentId, version: 1, clientId: "alice", steps: [] }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(alice.as.mutation(api.documents.remove, { documentId })).rejects.toThrow(/FORBIDDEN/);

    const draftId = await task(lead.as, events, [alice.userId], false);
    const draftDoc = await lead.as.mutation(api.documents.create, { assignmentId: draftId, title: "Draft notes" });
    await lead.as.mutation(api.assignments.remove, { assignmentId: draftId });
    expect(await t.run((ctx) => ctx.db.get("documents", draftDoc))).toBeNull();
  });
});

describe("chat documents", () => {
  test("any participant starts one (not in 全体); it posts a card and mentions notify people in the chat", async () => {
    const t = setup();
    const { admin, alice, bob, carol, events } = await team(t);
    const org = (await admin.as.query(api.channels.listMine, {})).org[0]._id;
    await expect(alice.as.mutation(api.documents.createInChat, { channelId: org, title: "Notes" })).rejects.toThrow(
      /FORBIDDEN/,
    );
    expect(await alice.as.query(api.documents.listForChat, { channelId: org })).toBeNull();

    const documentId = await alice.as.mutation(api.documents.createInChat, { channelId: events, title: "Meeting notes" });
    const card = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", events))
        .collect(),
    );
    expect(card.find((m) => m.kind === "doc")?.documentId).toBe(documentId);
    expect((await bob.as.query(api.documents.listForChat, { channelId: events }))?.documents).toHaveLength(1);

    const asBob = await bob.as.query(api.documents.get, { documentId });
    expect(asBob?.canEdit).toBe(true);
    expect(asBob?.canDelete).toBe(false);
    expect(asBob?.parent.kind).toBe("chat");
    expect(await carol.as.query(api.documents.get, { documentId })).toBeNull();

    // Mentioning Bob notifies him once; Carol can't open the document, so she isn't notified.
    const content = withMentions(bob.userId, carol.userId);
    await alice.as.mutation(api.prosemirror.submitSnapshot, { id: documentId, version: 2, content });
    await alice.as.mutation(api.prosemirror.submitSnapshot, { id: documentId, version: 3, content: content + " " });
    expect((await notificationTypes(t, bob.userId)).filter((type) => type === "doc_mention")).toHaveLength(1);
    expect(await notificationTypes(t, carol.userId)).not.toContain("doc_mention");

    await expect(bob.as.mutation(api.documents.remove, { documentId })).rejects.toThrow(/FORBIDDEN/);
    await alice.as.mutation(api.documents.remove, { documentId });
    expect(await t.run((ctx) => ctx.db.get("documents", documentId))).toBeNull();
  });
});

describe("documents in Files", () => {
  test("uploaders create and edit them like files; trash hides them, purge deletes them", async () => {
    const t = setup();
    const { lead, alice, carol } = await team(t);
    await expect(alice.as.mutation(api.documents.createInFolder, { space: "presidium", title: "Plan" })).rejects.toThrow(
      /NOT_FOUND/,
    );
    await expect(carol.as.mutation(api.documents.createInFolder, { space: "events", title: "Plan" })).rejects.toThrow(
      /FORBIDDEN/,
    );
    const documentId = await alice.as.mutation(api.documents.createInFolder, { space: "events", title: "Plan" });
    const [file] = (await carol.as.query(api.files.listFolder, { space: "events" }))!.files;
    expect(file).toMatchObject({ name: "Plan", documentId, size: 0, canEdit: false });
    expect((await carol.as.query(api.documents.get, { documentId }))?.canEdit).toBe(false);
    expect((await lead.as.query(api.documents.get, { documentId }))?.canEdit).toBe(true);

    // A second one with the same name gets a counter, and renaming the file renames the document.
    const second = await alice.as.mutation(api.documents.createInFolder, { space: "events", title: "Plan" });
    expect((await alice.as.query(api.documents.get, { documentId: second }))?.title).toBe("Plan (1)");
    await alice.as.mutation(api.files.rename, { fileId: file._id, name: "Gala plan" });
    expect((await alice.as.query(api.documents.get, { documentId }))?.title).toBe("Gala plan");

    expect(await alice.as.mutation(api.documents.remove, { documentId })).toEqual({ trashed: true });
    expect(await alice.as.query(api.documents.get, { documentId })).toBeNull();
    await lead.as.mutation(api.files.restore, { fileId: file._id });
    expect(await alice.as.query(api.documents.get, { documentId })).not.toBeNull();

    await alice.as.mutation(api.files.remove, { fileId: file._id });
    await lead.as.mutation(api.files.purge, { fileId: file._id });
    expect(await t.run((ctx) => ctx.db.get("documents", documentId))).toBeNull();
  });
});

describe("task description mentions", () => {
  test("publishing and editing notify newly mentioned chat members", async () => {
    const t = setup();
    const { lead, alice, bob, carol, events } = await team(t);
    const assignmentId = await lead.as.mutation(api.assignments.create, {
      channelId: events,
      kind: "task",
      title: "Poster",
      description: `<@${alice.userId}> designs, <@${bob.userId}> reviews`,
      requiresSubmission: false,
      assigneeIds: [alice.userId],
      everyone: false,
      publish: true,
    });
    expect(await notificationTypes(t, bob.userId)).toEqual(["task_mention"]);
    // Alice is assigned, so she only gets "assigned to you".
    expect(await notificationTypes(t, alice.userId)).toEqual(["assignment_new"]);

    await lead.as.mutation(api.assignments.update, {
      assignmentId,
      description: `<@${bob.userId}> reviews, <@${carol.userId}> and <@${alice.userId}> help`,
    });
    expect(await notificationTypes(t, bob.userId)).toEqual(["task_mention"]);
    expect(await notificationTypes(t, carol.userId)).toEqual([]);
    expect(await notificationTypes(t, alice.userId)).toEqual(["assignment_new"]);

    const view = await bob.as.query(api.assignments.get, { assignmentId });
    expect(view?.people.map((p) => p._id)).toContain(bob.userId);
  });
});
