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
import type * as assignments from "../assignments.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as channels from "../channels.js";
import type * as crons from "../crons.js";
import type * as deactivationRequests from "../deactivationRequests.js";
import type * as departments from "../departments.js";
import type * as documents from "../documents.js";
import type * as drive from "../drive.js";
import type * as email from "../email.js";
import type * as files from "../files.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_appsScript from "../lib/appsScript.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_channels from "../lib/channels.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_departments from "../lib/departments.js";
import type * as lib_digest from "../lib/digest.js";
import type * as lib_documents from "../lib/documents.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_groups from "../lib/groups.js";
import type * as lib_memberships from "../lib/memberships.js";
import type * as lib_messageViews from "../lib/messageViews.js";
import type * as lib_messages from "../lib/messages.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_preApprovals from "../lib/preApprovals.js";
import type * as lib_push from "../lib/push.js";
import type * as lib_pushText from "../lib/pushText.js";
import type * as lib_tasks from "../lib/tasks.js";
import type * as lib_text from "../lib/text.js";
import type * as lib_time from "../lib/time.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_users from "../lib/users.js";
import type * as maintenance from "../maintenance.js";
import type * as memberships from "../memberships.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as preApprovals from "../preApprovals.js";
import type * as presidium from "../presidium.js";
import type * as prosemirror from "../prosemirror.js";
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
  assignments: typeof assignments;
  attachments: typeof attachments;
  auth: typeof auth;
  channels: typeof channels;
  crons: typeof crons;
  deactivationRequests: typeof deactivationRequests;
  departments: typeof departments;
  documents: typeof documents;
  drive: typeof drive;
  email: typeof email;
  files: typeof files;
  groups: typeof groups;
  http: typeof http;
  "lib/appsScript": typeof lib_appsScript;
  "lib/audit": typeof lib_audit;
  "lib/channels": typeof lib_channels;
  "lib/constants": typeof lib_constants;
  "lib/departments": typeof lib_departments;
  "lib/digest": typeof lib_digest;
  "lib/documents": typeof lib_documents;
  "lib/email": typeof lib_email;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/errors": typeof lib_errors;
  "lib/files": typeof lib_files;
  "lib/groups": typeof lib_groups;
  "lib/memberships": typeof lib_memberships;
  "lib/messageViews": typeof lib_messageViews;
  "lib/messages": typeof lib_messages;
  "lib/notify": typeof lib_notify;
  "lib/permissions": typeof lib_permissions;
  "lib/preApprovals": typeof lib_preApprovals;
  "lib/push": typeof lib_push;
  "lib/pushText": typeof lib_pushText;
  "lib/tasks": typeof lib_tasks;
  "lib/text": typeof lib_text;
  "lib/time": typeof lib_time;
  "lib/types": typeof lib_types;
  "lib/users": typeof lib_users;
  maintenance: typeof maintenance;
  memberships: typeof memberships;
  messages: typeof messages;
  notifications: typeof notifications;
  preApprovals: typeof preApprovals;
  presidium: typeof presidium;
  prosemirror: typeof prosemirror;
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

export declare const components: {
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};
