/// <reference types="vite/client" />
import prosemirrorSyncTest from "@convex-dev/prosemirror-sync/test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { upsertUserFromOAuth } from "../convex/lib/users";

const modules = import.meta.glob("../convex/**/*.ts");

export function setup() {
  const t = convexTest(schema, modules);
  prosemirrorSyncTest.register(t);
  return t;
}

export type TestConvex = ReturnType<typeof setup>;

export async function signInUser(t: TestConvex, email: string, name = email.split("@")[0]) {
  const userId = await t.run((ctx) =>
    upsertUserFromOAuth(ctx, {
      existingUserId: null,
      profile: { email, name, emailVerified: true },
    }),
  );
  return { userId, as: asUser(t, userId) };
}

export function asUser(t: TestConvex, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|test-session` });
}

export async function departmentBySlug(t: TestConvex, slug: string) {
  const department = await t.run((ctx) =>
    ctx.db
      .query("departments")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
  );
  if (!department) throw new Error(`missing department ${slug}`);
  return department;
}

/** First account (system admin) with a completed profile. */
export async function bootstrapAdmin(t: TestConvex, email = "admin@ucsb.edu") {
  const admin = await signInUser(t, email);
  await admin.as.mutation(api.users.submitOnboarding, {
    nameZh: "管理员",
    nameEn: "Admin",
    consent: true,
  });
  return admin;
}

/** Signs in a new user who was pre-approved by `by` and completes onboarding. */
export async function addMember(
  t: TestConvex,
  by: ReturnType<typeof asUser>,
  email: string,
  departmentSlug: string,
  role: "lead" | "member" = "member",
) {
  const department = await departmentBySlug(t, departmentSlug);
  await by.mutation(api.preApprovals.createMany, {
    emails: [email],
    departmentId: department._id,
    role,
  });
  const user = await signInUser(t, email);
  await user.as.mutation(api.users.submitOnboarding, {
    nameZh: "测试",
    nameEn: email.split("@")[0],
    consent: true,
  });
  return user;
}
