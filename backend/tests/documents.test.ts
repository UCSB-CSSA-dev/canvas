import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { addMember, bootstrapAdmin, setup, type TestConvex } from "./helpers";

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
