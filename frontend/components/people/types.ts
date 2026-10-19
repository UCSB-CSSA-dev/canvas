import type { Id } from "@/lib/api";

export type UserSummaryLike = {
  _id: Id<"users">;
  name?: string;
  nameZh?: string;
  nameEn?: string;
  email?: string;
  image?: string;
  isSystemAdmin: boolean;
};
