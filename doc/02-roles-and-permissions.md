# 02 Roles and Permissions

This is the most important spec in the project. Every Convex function must enforce these rules on the server.

## Roles

Roles come from **department memberships**, except system admin, which is a flag on the user.

| Role | How it is assigned | Scope |
| --- | --- | --- |
| **系统管理员 System Admin** | `users.isSystemAdmin = true`. The **first account ever created** gets it automatically (see [accounts-and-onboarding.md](features/accounts-and-onboarding.md#first-account-becomes-system-admin)) | Everything, every page |
| **主席团 Presidium** | Membership in the department whose `kind = "presidium"`. `role = "lead"` is **主席 President**, `role = "member"` is **副主席 Vice President** | Entire organization |
| **部长 Department Lead** | `departmentMemberships.role = "lead"` in a regular department | That department |
| **部员 Member** | `departmentMemberships.role = "member"` in a regular department | Self, plus shared spaces of their departments |
| **Approved, no department** | `users.status = "approved"` with no memberships | Self, org-wide channels and shared files only |

Rules:

- A user can belong to **multiple departments** and can be a lead in one and a member in another.
- A regular department has **at most 2 leads**; the server rejects a third with `TOO_MANY_LEADS`. The UI warns admins when a department has none.
- There is exactly one presidium department, created by the seed script. Presidium members are super admins.

### 主席 and 副主席

- 主席团 has **at most one 主席**. Assigning a second throws `CHAIR_EXISTS`; the seat changes hands through `presidium.transferChair` instead.
- Once there is a 主席, there is **always** one. Demoting, removing, retiring, or deactivating the 主席 throws `CHAIR_REQUIRED` until they hand the role over.
- **Transfer:** only the current 主席 (or a system admin) can make a 副主席 the new 主席. The old 主席 becomes 副主席 in the same mutation. A 副主席 cannot make themselves 主席.
- **Promote:** any presidium member can move a 部长 up into 主席团 as 副主席 (`presidium.promoteToViceChair`). Their 部长 seats are vacated.
- **Retire:** a presidium member retires themselves (`presidium.retire`); a system admin can retire anyone. They leave 主席团 and get a `formerPresidium` row, shown on the roster as **前主席** (if they were ever 主席 this term, tracked by `departmentMemberships.wasChair`) or **前副主席**. Former members are read-only history and get no permissions.
- **部长 promote 部员:** a lead can make a member of their own department a co-lead (within the 2-lead limit).

### Typed confirmation

Every promotion asks the user to type an exact Chinese phrase before the confirm button unlocks (UI only; the server enforces the rules above):

| Action | Phrase |
| --- | --- |
| Make someone 部长 | `将{姓名}设为{部门中文名}部长` |
| Make someone 副主席 (promote, add, or pre-approve) | `将{姓名}设为副主席` |
| Make someone 主席 (transfer or first 主席) | `将{姓名}设为主席` |
| Retire | `将{姓名}设为前主席` / `将{姓名}设为前副主席` |
| Create a department | `将{部门中文名}设为新部门` |

`{姓名}` is the Chinese name, falling back to the English name, Google name, then email (for pre-approvals, the email).
- **System admin is a superset of presidium.** Anywhere these docs say "presidium can ...", the system admin can too, even without being in the presidium department. On top of that, only a system admin can grant or remove system admin from another user, and presidium cannot demote or deactivate a system admin. There must always be at least one system admin.
- The system admin is a technical role (the person running the app). They may also hold a normal place in the hierarchy, for example as a member of 主席团 or a department.
- **Admin** in these docs means "system admin or presidium".
- Account status (`new`, `pending`, `approved`, `rejected`, `deactivated`) gates everything. Only `approved` users can use the app. See [features/accounts-and-onboarding.md](features/accounts-and-onboarding.md).

## Oversight (监督查看)

Leadership can read the content of the people they manage. This is a deliberate product requirement, and **users must accept it at signup**.

### Definition: `oversees(viewer, subject)`

`viewer` oversees `subject` when **any** of the following is true:

1. `viewer` is an admin (system admin or presidium; they oversee everyone, including other presidium members).
2. `viewer` is a lead of a regular department where `subject` has `role = "member"`.

Notes:

- A lead does **not** oversee co-leads of the same department, or leads of other departments. Only presidium oversees leads.
- A user never "oversees" themselves; their own content is simply theirs.
- Oversight follows **current** memberships. When someone leaves a department, its leads lose oversight of them from that point on. Audit logs are kept.

### What oversight grants

| Content | Overseer can |
| --- | --- |
| Channels the subject participates in (group chats, DMs, department channels) | Read messages and attachments (read-only) |
| Files the subject uploaded, including "My files" | Read and download |
| Assignments and submissions the subject is involved in | Read |
| Subject's profile and memberships | Read |

Oversight is **read-only**. An overseer cannot post as, edit, or delete the subject's content through oversight. Moderation (deleting content) is a separate permission described below.

### Oversight in the UI

- Every monitored chat shows an eye icon at the top right; hovering lists who can view it besides its participants.
- The channel list has a "监督 Oversight" section for admins and 部长. They pick a person they oversee and see that person's chats the viewer can read only through oversight. These are not mixed into the viewer's normal chats. The roster person drawer links to the same view.
- Opening a channel through oversight shows a gold read-only banner.
- Overseers do not receive notifications for channels they only oversee, and their reads do not change participants' read state.
- Settings shows each user who can see their content.

### Audit logging

Every oversight access writes an `auditLogs` row (see [03-data-model.md](03-data-model.md#auditlogs)):

- Opening a channel through oversight: `action = "oversight.channel.open"` (one row per open, not per message).
- Downloading another user's private file through oversight: `action = "oversight.file.download"`.
- Viewing another user's assignment submission through oversight: `action = "oversight.submission.view"`.

Other privileged actions are logged too: approvals, rejections, deactivations, role changes, and moderation deletes. Only presidium can read the audit log.

## Permission helpers (`convex/lib/permissions.ts`)

All functions start by building a **viewer context** once, then call pure helpers on it.

```ts
type ViewerContext = {
  user: Doc<"users">;
  memberships: Doc<"departmentMemberships">[];
  isSystemAdmin: boolean;
  isPresidium: boolean;
  isAdmin: boolean;                           // isSystemAdmin || isPresidium
  ledDepartmentIds: Id<"departments">[];      // regular departments where role = "lead"
  memberDepartmentIds: Id<"departments">[];   // all departments the viewer belongs to
};

getViewer(ctx): Promise<ViewerContext | null>      // null if not signed in
requireViewer(ctx): Promise<ViewerContext>          // throws if not signed in
requireApproved(ctx): Promise<ViewerContext>        // throws unless status === "approved"
requireAdmin(ctx): Promise<ViewerContext>           // system admin or presidium
requireSystemAdmin(ctx): Promise<ViewerContext>
requireLeadOf(ctx, departmentId): Promise<ViewerContext>  // lead of dept OR admin

canPreApprove(viewer, departmentId, role): boolean  // see "Accounts and organization" matrix

// convex/lib/channels.ts
oversees(ctx, viewer, subjectUserId): Promise<boolean>
channelAccess(ctx, viewer, channel): Promise<ChannelAccess | null>
  // { via: "member" | "oversight", readOnly, canPost, canInteract, canManage, canModerate,
  //   canSetRetention, canApproveApps, canProposeApps, canMentionAll }; null = no access
requireChannelAccess(ctx, viewer, channelId): Promise<{ channel, access }>

// later stages
canReadFolder / canWriteFolder(ctx, viewer, folder): Promise<boolean>
canReadFile(ctx, viewer, file): Promise<{ allowed: boolean; via: "access" | "oversight" | null }>
canManageAssignment(ctx, viewer, assignment): Promise<boolean>
```

Rules for agents:

- **Never** check permissions only in React. UI hiding is a convenience, not security.
- When a helper returns `via: "oversight"`, the calling function must call `logAudit(...)`.
- Errors use `ConvexError` with a code from `ERROR_CODES` in `convex/lib/constants.ts` (for example `"FORBIDDEN"`, `"INVALID"`, `"CHAIR_EXISTS"`). The client maps codes to translated messages.

## Permission matrix

Legend: Y = allowed, O = read via oversight (logged), Own = only their own, Dept = only for departments they lead, N = not allowed. The system admin can do everything in the Presidium column.

### Accounts and organization

| Action | Presidium | Lead | Member |
| --- | --- | --- | --- |
| View roster (full hierarchy, names, departments, roles) | Y | Y | Y |
| See pending applicants and unclaimed pre-approvals on the roster | Y | Dept | N |
| Pre-approve an email into a department as **member** | Y | Dept | N |
| Pre-approve an email as **lead**, or into 主席团 | Y | N | N |
| Revoke an unclaimed pre-approval | Y | Dept (only pre-approvals for their department) | N |
| Approve or reject accounts (approved applicants join as 部员) | Y | Dept (only into their own department) | N |
| Deactivate or reactivate an account | Y (not a system admin, not the 主席) | N | N |
| Grant or remove system admin | System admin only | N | N |
| Create, rename, archive departments | Y | N | N |
| Add someone to 主席团, or promote a 部长 to 副主席 | Y | N | N |
| Make a 副主席 the 主席 | Current 主席 or system admin | N | N |
| Retire from 主席团 | Self (system admin: anyone; 主席 must transfer first) | N | N |
| Make a 部员 a 部长 | Y | Dept | N |
| Demote or remove department leads | Y | N | N |
| Add or remove department members | Y | Dept | N |
| Edit own profile | Y | Y | Y |
| View audit log | Y | N | N |

### Chat

Implemented by `channelAccess` in `backend/convex/lib/channels.ts`. Through oversight everything is read-only except 主席团's moderation removal.

| Action | Presidium | Lead | Member |
| --- | --- | --- | --- |
| Read own channels (as participant) | Y | Y | Y |
| Read any DM, group, or department channel | O | O for chats with a 部员 they lead | N |
| Create a group chat | Y (any departments, or none) | Y (must include a department they lead) | N: propose one instead |
| Approve or reject a group proposal | Y | Dept (an involved department) | N |
| Manage a group (rename, add or remove departments, end) | Y if a member, or during a takeover | Dept (an involved department) | N |
| Add or remove group members | Y: anyone | Dept: members of departments they lead | N (can leave) |
| Start DM with any approved user | Y | Y | Y |
| Post in department channel | Y | Y (own dept) | Y (own dept) |
| Post an announcement (公告, notifies everyone in the chat) | Y in 全体 and department chats | Own department's chat only | N (can react) |
| `@all` | Y | Own department channels | N |
| Edit own message (history visible to the chat) | Y | Y | Y |
| Recall own message within 5 minutes | Y | Y | Y |
| Remove others' messages (moderation, audit logged) | Y | N | N |
| Change a chat's retention (15 days to 1 year) | Y (DMs: admins only) | Dept channels and groups they manage | N |
| Start a chat app (接龙, 投票, 集会) or approve a proposed one | Y in org, department chats, and groups they're in | Dept channels and groups they manage | N: propose one instead |

### Files

| Action | Presidium | Lead | Member |
| --- | --- | --- | --- |
| Read org-wide shared folder | Y | Y | Y |
| Write org-wide shared folder | Y | N | N |
| Read department folders | Y | Own depts | Own depts |
| Upload into department folders | Y | Own depts | Own depts |
| Create, rename, move, delete folders in a department | Y | Dept | N |
| Rename or delete own files | Y | Y | Y |
| Delete others' files in a department | Y | Dept | N |
| Read another user's "My files" | O | O for members they oversee | N |

### Assignments

| Action | Presidium | Lead | Member |
| --- | --- | --- | --- |
| Create assignment | Y (anyone) | Dept (assignees must be members of a department they lead) | N |
| Edit or close own assignments | Y | Y | N |
| Edit or close others' assignments | Y | Dept | N |
| View assignments assigned to me | Y | Y | Y |
| Submit work on my assignment | Y | Y | Y |
| Review submissions (approve / request changes) | Y | Own assignments and Dept | N |
| View others' assignments and submissions | O | O for members they oversee | N |

## Signup disclosure (必须同意)

Shown on the onboarding page before an account can be submitted for approval. The user must check a box to continue. Store `oversightConsentAt` and `oversightConsentVersion` on the user. If the text changes, bump the version and ask existing users to accept again on next login.

**中文:**

> **隐私与监督说明**
>
> CSSA Hub 是 UCSB CSSA 的内部工作平台，不是私人聊天工具。注册即表示你理解并同意：
>
> - **主席团** 可以查看平台上的所有内容，包括你发送的消息（含私信和群聊）、上传的文件和任务提交。
> - 你所在部门的 **部长** 可以查看你作为部员发送的消息（含私信和群聊）、上传的文件和任务提交。
> - 所有监督查看行为都会被记录在审计日志中。
> - 请勿在平台上发送与 CSSA 工作无关的私人或敏感信息。
>
> ☐ 我已阅读并同意以上说明

**English:**

> **Privacy and Oversight Notice**
>
> CSSA Hub is an internal work platform for UCSB CSSA, not a private messaging app. By creating an account, you understand and agree that:
>
> - The **Presidium (主席团)** can view all content on the platform, including messages you send (DMs and group chats), files you upload, and your assignment submissions.
> - **Department Leads (部长)** of departments you belong to can view the messages you send (DMs and group chats), files you upload, and your assignment submissions as a member.
> - Every oversight view is recorded in an audit log.
> - Please do not share personal or sensitive information unrelated to CSSA work on this platform.
>
> ☐ I have read and agree to the notice above

The same notice is always available under **Settings, then "Who can see my content"**. That page lists the current users who oversee the viewer, computed from `oversees`.
