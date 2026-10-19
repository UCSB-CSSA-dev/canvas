# Feature: Roster (组织架构 / 成员名册)

## Summary

The roster page (`/roster`) shows the whole CSSA hierarchy: 主席团 at the top, then every department with its leads (部长) and members (部员). **Every approved user can see it.** Admins and leads also manage people from here: they pre-approve emails, approve pending applicants, and add, remove, or re-role members within their permissions.

In Stage 1 the roster is also the main admin tool. From Stage 2, the [admin console](admin-console.md) adds an overview and audit log, but people management stays on the roster.

## Who sees what

| Element | Member | Lead | Admin (system admin, 主席团) |
| --- | --- | --- | --- |
| Hierarchy: departments, leads, members, names, emails | Y | Y | Y |
| System admin badge on that person | Y | Y | Y |
| "未分配部门 / No department" group (approved users with no membership) | Y | Y | Y |
| "待审批 / Pending" applicants | N | Those who requested their departments | All |
| "已预批准 / Pre-approved (not signed in yet)" emails | N | Their departments | All |
| Management actions | N | Own departments, as members only | All |

Server rule: `roster.get` returns pending applicants and unclaimed pre-approvals **only** for the parts the viewer is allowed to see. Do not send them to the client and hide them in the UI.

## Layout

```text
组织架构 Roster                         [Search name or email]  [+ 预批准邮箱]
--------------------------------------------------------------------------------
待审批 Pending (2)                                    (admins / leads only)
  王小明 Xiaoming Wang  xw@ucsb.edu  申请：活动部   [通过 Approve] [拒绝 Reject]
  ...
--------------------------------------------------------------------------------
主席团 Presidium
  [avatar] 李华 Hua Li          hli@ucsb.edu
  [avatar] 张伟 Wei Zhang       wzhang@ucsb.edu   [系统管理员]
--------------------------------------------------------------------------------
+----------------------+  +----------------------+  +----------------------+
| 活动部 Events     (8) |  | 国际部 Intl.      (6) |  | 宣传部 Publicity  (5) |
| 部长 Leads            |  | 部长 Leads            |  | 部长 Leads            |
|   [av] Alice    LEAD |  |   [av] Dan      LEAD |  |   (none) ! warning   |
|   [av] Bob      LEAD |  | 部员 Members          |  | 部员 Members          |
| 部员 Members          |  |   [av] Erin          |  |   ...                |
|   [av] Carol         |  |   ...                |  |                      |
|   ...                |  | 已预批准 Pre-approved |  |                      |
|                      |  |   frank@ucsb.edu     |  |                      |
| [+ Add] [...]        |  | [+ Add] [...]        |  | [+ Add] [...]        |
+----------------------+  +----------------------+  +----------------------+
未分配部门 No department
  [av] Grace   ...
```

- Department cards in a responsive grid (1 column on mobile, 2 on tablet, 3 on desktop), ordered by `departments.sortOrder`.
- Lead badge: gold outline "部长 / Lead". System admin badge: small gold "系统管理员 / Admin".
- A department with 0 leads or more than 2 leads shows a warning icon (admins only).
- Pre-approved emails show in a muted style with the email only, a role tag, and a revoke button for those allowed.
- Deactivated users are hidden by default; admins can toggle "显示已停用 / Show deactivated".
- Search filters across names (zh and en) and email, client-side (the roster is small).

## Person card and profile drawer

Clicking a person opens a drawer:

- Avatar, 中文名, English name, email.
- Departments and roles.
- **"发消息 / Message"** button: calls `channels.getOrCreateDm` and opens the DM. Hidden on your own card.
- Management actions (if allowed): change role (lead or member), remove from department, add to another department, deactivate (admins only, not on system admins).

## Pre-approving emails

The "+ 预批准邮箱 / Pre-approve emails" button (page header for admins, or "+ Add" on a department card for leads) opens a dialog:

| Field | Notes |
| --- | --- |
| Emails | Textarea. Paste one or many, separated by newlines, commas, spaces, or semicolons |
| Department | Admins: any department including 主席团. Leads: only departments they lead (preselected when opened from a card) |
| Role | Admins: lead or member. Leads: member only (field hidden) |
| Note | Optional, e.g. "2026 秋季招新" |

On submit, `preApprovals.createMany` processes each email and returns a per-email result, shown as a summary in the dialog:

| Result | Meaning |
| --- | --- |
| `created` | New active pre-approval |
| `updated` | An active pre-approval for this email and department already existed; role updated |
| `applied` | The email belongs to an approved user; membership added immediately |
| `approved_pending` | The email belonged to a pending user; they are now approved and placed |
| `already_member` | Already in that department with that role; nothing changed |
| `needs_review` | The email belongs to a rejected or deactivated user; nothing changed |
| `invalid` | Not a valid `@ucsb.edu` address |

Rules:

- Emails are trimmed and lowercased; duplicates in the same paste are merged.
- Maximum 100 emails per submission.
- Each created, updated, or applied row writes an audit entry (`preapproval.create`, `preapproval.update`, `membership.add`).
- Revoking (`preApprovals.revoke`) sets `revokedAt` and `revokedBy`. Only unclaimed pre-approvals can be revoked; claimed ones are history. Revoking writes `preapproval.revoke`.
- Pre-approvals do not expire in Stage 1 (see [open questions](../10-open-questions.md)).
- From Stage 3 on, creating a pre-approval can optionally send an invite email.

## Managing members

| Action | Where | Who |
| --- | --- | --- |
| Approve or reject a pending applicant | Pending section | Admins (any department and role); leads (own department, member) |
| Add an existing approved user to a department | "+ Add" on a card, then pick a person | Admins; leads for their departments (as member) |
| Change role (lead or member) | Person drawer | Admins |
| Remove from department | Person drawer | Admins; leads for members of their departments |
| Create a department | Page header "+ 新部门 / New department" | Admins |
| Rename a department, reorder departments | Card menu "..." | Admins |
| Archive a department | Card menu "..." | Admins (Stage 2) |
| Grant or remove system admin | Person drawer | System admin only |

Every change keeps department channel memberships in sync in the same mutation and writes an audit entry (`membership.add`, `membership.remove`, `membership.role_change`, `department.create`, `department.update`, `user.approve`, `user.reject`, `user.system_admin_grant`, `user.system_admin_revoke`).

Guards:

- You cannot remove the last system admin.
- Leads cannot change their own role or remove themselves from a department they lead (ask an admin).

## Convex functions

| Function | Type | Notes |
| --- | --- | --- |
| `roster.get` | query | Departments with leads and members, no-department group; plus pending applicants and active pre-approvals, filtered by permission |
| `preApprovals.createMany` | mutation | `{ emails: string[], departmentId, role, note? }`, returns per-email results |
| `preApprovals.revoke` | mutation | |
| `users.approve` | mutation | `{ userId, memberships: { departmentId, role }[] }` |
| `users.reject` | mutation | `{ userId, reason }` |
| `users.setSystemAdmin` | mutation | System admin only |
| `users.deactivate`, `users.reactivate` | mutation | Admins |
| `departments.create`, `departments.update`, `departments.reorder` | mutation | Admins |
| `memberships.add`, `memberships.remove`, `memberships.setRole` | mutation | Permission per the matrix in [02-roles-and-permissions.md](../02-roles-and-permissions.md#accounts-and-organization) |

## Acceptance criteria

- [ ] Every approved user sees the full hierarchy with the correct leads and members.
- [ ] Members never receive pending applicants or pre-approved emails from the server.
- [ ] A lead can pre-approve emails only into their own department and only as members.
- [ ] An admin can pre-approve a list of emails into any department, including 主席团, as lead or member.
- [ ] Pasting a mixed list returns a correct per-email result summary.
- [ ] Pre-approving the email of an approved user adds the membership immediately.
- [ ] "Message" on a person opens the existing DM with them or creates one.
- [ ] Membership changes show up on the roster and in channel access in real time.
- [ ] The last system admin cannot be removed.
