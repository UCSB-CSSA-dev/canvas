import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { allowedEmailDomain } from "./lib/email";
import { upsertUserFromOAuth } from "./lib/users";

type GoogleProfile = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  email_verified?: boolean;
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: { hd: allowedEmailDomain(), prompt: "select_account" },
      },
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified,
        } as { id: string; name?: string; email?: string; image?: string };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      return upsertUserFromOAuth(ctx as unknown as MutationCtx, {
        existingUserId: args.existingUserId as Id<"users"> | null,
        profile: args.profile,
      });
    },
  },
});
