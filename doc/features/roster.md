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
                        +----------------------------+
                        | 主席团 Presidium        (2) |
                        | 主席 President              |
                        |   [av] 李华 Hua Li     主席 |
                        | 副主席 Vice Presidents      |
                        |   [av] 张伟 Wei Zhang [Admin]|
                        | 往届 Former                 |
                        |   [av*] 陈晨 Chen    前主席 |
                        +-------------+--------------+
                                      |
           +--------------------------+--------------------------+
           |                          |                          |
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
                                                     [ + 新部门 New department ]  (admins)
未分配部门 No department
  [av] Grace   ...
```

- The hierarchy is drawn as a tree (`frontend/components/roster/roster-tree.tsx`): the 主席团 card on top with a gold outline, and regular departments as branches ordered by `departments.sortOrder`. From the `xl` breakpoint the branches sit side by side under a connector bar (scrolling horizontally if there are many). Below `xl` they stack along a vertical rail.
- Admins get a dashed "+ 新部门 / New department" branch at the end of the tree.
- Role labels depend on the department: 主席 / 副主席 in 主席团, 部长 / 部员 elsewhere. Lead badge: gold outline. System admin badge: small gold "系统管理员 / Admin".
- 主席团 also lists 往届 / Former: retired members, each with a small gold crown on the top right of the avatar and a "前主席 / 前副主席" badge.
- Admins see a warning when a department has no lead or 主席团 has no 主席.
- Pre-approved emails show in a muted style with the email only, a role tag, and a revoke button for those allowed.
- Deactivated users are hidden by default; admins can toggle "显示已停用 / Show deactivated".
- Admins see a "停用申请 / Deactivation requests" section under pending applicants, one card per member asking to leave, with a "审核 / Review" button (see [accounts-and-onboarding.md](accounts-and-onboarding.md#requesting-deactivation-yourself)).
- Search filters across names (zh and en) and email, client-side (the roster is small).

## Person card and profile drawer

Clicking a person opens a drawer:

- Avatar, 中文名, English name, email.
- Departments and roles.
- **"发消息 / Message"** button: calls `channels.getOrCreateDm` and opens the DM. Hidden on your own card.
- Management actions (if allowed), each in the department row's "..." menu:
  - Regular department: 设为部长 (admins, or a lead of that department), 设为部员 (admins), 移出部门.
  - 主席团: 设为主席 (current 主席 or system admin; anyone admin while the seat is empty), 卸任 (self or system admin; disabled for the 主席), 移出 (system admin, not the 主席).
  - "设为副主席 / Make Vice President" button when the person is a 部长 and not in 主席团 (admins).
  - Add to another department, deactivate (admins only, not on system admins or the 主席).
- Promotions and department creation use a typed confirmation: the user types the exact phrase (for example `将李华设为活动部部长`) before the confirm button unlocks. Phrases are listed in [02-roles-and-permissions.md](../02-roles-and-permissions.md#typed-confirmation).

## Public about-us page (`/about-us/`)

A public page (no sign-in) introducing CSSA, modeled on [ucsbcssa.com](https://www.ucsbcssa.com): hero, about, what we do, and the team.

- **Team:** every approved member, grouped by department (主席团 first, then by `sortOrder`; 部长 before 部员), with a filter chip per department. Members without a department are under "其他成员".
- **Each card:** photo, name in both languages, positions (主席 / 副主席, or "<department> · 部长 / 部员"), and their bio from Settings.
- **Email:** hidden by default. A member can show it with "在「关于我们」公开页面显示我的邮箱" in Settings (`users.setShowEmailPublicly`).
- `about.roster` is a public query and returns only those fields. Settings already tells members that photo, names and bio are public.
- Linked from the sign-in page and from Settings.

## Pre-approving emails

The "+ 预批准邮箱 / Pre-approve emails" button (page header for admins, or "+ Add" on a department card for leads) opens a dialog:

| Field | Notes |
| --- | --- |
| Emails | Textarea. Paste one or many, separated by newlines, commas, spaces, or semicolons |
| Department | Admins: any department including 主席团. Leads: only departments they lead (preselected when opened from a card) |
| Role | Admins: 部长 or 部员, or for 主席团 副主席 or 主席 (only while the seat is empty). Leads: member only (field hidden). A lead or 主席团 role takes one email at a time and needs the typed confirmation |
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
| Approve or reject a pending applicant (joins as 部员) | Pending section | Admins (any regular department); leads (own department) |
| Add an existing approved user to a department | "+ Add" on a card, then pick a person | Admins (any role, confirmation for leads and 主席团); leads for their departments (as member) |
| Make a 部员 a 部长 | Person drawer | Admins; leads of that department |
| Demote a lead | Person drawer | Admins |
| Promote a 部长 to 副主席 / transfer 主席 / retire | Person drawer | See [02-roles-and-permissions.md](../02-roles-and-permissions.md#主席-and-副主席) |
| Remove from department | Person drawer | Admins; leads for members of their departments |
| Create a department | "+ 新部门" branch at the end of the tree | Admins |
| Rename a department, reorder departments | Card menu "..." | Admins |
| Archive a department | Card menu "..." | Admins (Stage 2) |
| Grant or remove system admin | Person drawer | System admin only |

Department channel access follows membership changes automatically (it is derived, not stored). Every change writes an audit entry (`membership.add`, `membership.remove`, `membership.role_change`, `department.create`, `department.update`, `user.approve`, `user.reject`, `user.system_admin_grant`, `user.system_admin_revoke`).

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
| `deactivationRequests.review` | mutation | `{ requestId, approve, note? }`; admins, not on their own request. Requests are listed in `roster.get` as `deactivationRequests` |
| `departments.create`, `departments.update`, `departments.reorder` | mutation | Admins |
| `memberships.add`, `memberships.remove`, `memberships.setRole` | mutation | Permission per the matrix in [02-roles-and-permissions.md](../02-roles-and-permissions.md#accounts-and-organization) |
| `presidium.transferChair` | mutation | `{ userId }` of a 副主席; current 主席 or system admin |
| `presidium.promoteToViceChair` | mutation | `{ userId }` of a 部长; admins |
| `presidium.retire` | mutation | `{ userId }`; self or system admin; not the 主席 |

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
- [ ] 主席团 never has two 主席, and once it has one it always does; a 副主席 cannot make themselves 主席.
- [ ] Retired members show as 前主席 / 前副主席 under 主席团.
- [ ] Every promotion and new department requires typing the exact `将XXX设为XXX` phrase.
