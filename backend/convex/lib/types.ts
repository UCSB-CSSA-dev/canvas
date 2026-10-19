import type { Infer } from "convex/values";
import type { locale, membershipRole, userStatus } from "../schema";

export type MembershipRole = Infer<typeof membershipRole>;
export type UserStatus = Infer<typeof userStatus>;
export type Locale = Infer<typeof locale>;
