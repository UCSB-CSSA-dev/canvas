/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as apps from "../apps.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as channels from "../channels.js";
import type * as crons from "../crons.js";
import type * as deactivationRequests from "../deactivationRequests.js";
import type * as departments from "../departments.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_channels from "../lib/channels.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_departments from "../lib/departments.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_groups from "../lib/groups.js";
import type * as lib_memberships from "../lib/memberships.js";
import type * as lib_messageViews from "../lib/messageViews.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_preApprovals from "../lib/preApprovals.js";
import type * as lib_push from "../lib/push.js";
import type * as lib_pushText from "../lib/pushText.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_users from "../lib/users.js";
import type * as maintenance from "../maintenance.js";
import type * as memberships from "../memberships.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as preApprovals from "../preApprovals.js";
import type * as presidium from "../presidium.js";
import type * as push from "../push.js";
import type * as pushNode from "../pushNode.js";
import type * as roster from "../roster.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  apps: typeof apps;
  attachments: typeof attachments;
  auth: typeof auth;
  channels: typeof channels;
  crons: typeof crons;
  deactivationRequests: typeof deactivationRequests;
  departments: typeof departments;
  groups: typeof groups;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/channels": typeof lib_channels;
  "lib/constants": typeof lib_constants;
  "lib/departments": typeof lib_departments;
  "lib/email": typeof lib_email;
  "lib/errors": typeof lib_errors;
  "lib/groups": typeof lib_groups;
  "lib/memberships": typeof lib_memberships;
  "lib/messageViews": typeof lib_messageViews;
  "lib/messages": typeof lib_messages;
  "lib/notify": typeof lib_notify;
  "lib/permissions": typeof lib_permissions;
  "lib/preApprovals": typeof lib_preApprovals;
  "lib/push": typeof lib_push;
  "lib/pushText": typeof lib_pushText;
  "lib/text": typeof lib_text;
  "lib/types": typeof lib_types;
  "lib/users": typeof lib_users;
  maintenance: typeof maintenance;
  memberships: typeof memberships;
  messages: typeof messages;
  notifications: typeof notifications;
  preApprovals: typeof preApprovals;
  presidium: typeof presidium;
  push: typeof push;
  pushNode: typeof pushNode;
  roster: typeof roster;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
