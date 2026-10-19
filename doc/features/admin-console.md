# Feature: Admin Console (管理后台)

## Summary

**Stage 2 and later.** People management (approvals, pre-approvals, departments, memberships, roles) lives on the [roster page](roster.md) from Stage 1. The `/admin` area adds the things that don't fit there: an overview, the audit log, and the yearly handover. "Admin" means system admin or presidium.

## Sections

| Section | Route | Stage | Admin | Lead |
| --- | --- | --- | --- | --- |
| Overview 概览 | `/admin` | 2 | Org-wide counts | Own departments' counts |
| Audit log 审计日志 | `/admin/audit` | 2 | Yes | No |
| Department archive | Roster card menu | 2 | Yes | No |
| Oversight shortcuts | Roster person drawer | 2 | Yes | For members they oversee |
| Yearly handover 换届 | `/admin/handover` | 5 | Yes | No |

Non-admins never see the Admin link, and every admin function re-checks permissions on the server.

## Overview

Cards: pending approvals, unclaimed pre-approvals, active members, members per department, and later open assignments, overdue submissions, and emails failed in the last 24 hours (admins only).

## Department archive

Archiving (admins) hides the department from pickers, makes its channels read-only, and keeps all data.

## Oversight shortcuts

In the roster person drawer, admins and the person's overseers see links to that person's channels, files, and submissions. Using them goes through oversight and is logged (see [02-roles-and-permissions.md](../02-roles-and-permissions.md#oversight-监督查看)).

## Yearly handover (换届)

A guided flow that, for each department, lets admins pick next year's leads, demote outgoing leads to member or remove them, and optionally deactivate graduated members. Pre-approving the incoming members' emails is part of the same flow. Every change is audit logged.

## Audit log

- Presidium only.
- Filters: actor, subject user, action type, date range.
- Columns: time, actor, action (translated label), target (linked when it still exists), subject user.
- Read-only. Export to CSV.

Logged actions (non-exhaustive):

| Action | When |
| --- | --- |
| `user.approve`, `user.reject` | Account review |
| `user.deactivate`, `user.reactivate` | Account status changes |
| `user.system_admin_bootstrap`, `user.system_admin_grant`, `user.system_admin_revoke` | System admin changes |
| `preapproval.create`, `preapproval.update`, `preapproval.revoke`, `preapproval.claim` | Pre-approved emails |
| `membership.add`, `membership.remove`, `membership.role_change` | Department changes |
| `department.create`, `department.update`, `department.archive` | Department admin |
| `oversight.channel.open` | Reading a channel through oversight |
| `oversight.file.download` | Downloading a private file through oversight |
| `oversight.submission.view` | Viewing a submission through oversight |
| `message.moderate_delete` | Deleting someone else's message |
| `file.moderate_delete` | Deleting someone else's file |

## Acceptance criteria

- [ ] Leads only see their own departments' data in the overview.
- [ ] Archiving keeps channel memberships and channel posting rules in sync.
- [ ] The handover flow can be completed in one sitting and is fully audit logged.
- [ ] The audit log cannot be modified through any function.
