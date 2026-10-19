import { ConvexError } from "convex/values";
import type { ErrorCode } from "./constants";

export function appError(code: ErrorCode, message?: string) {
  return new ConvexError({ code, message: message ?? code });
}
