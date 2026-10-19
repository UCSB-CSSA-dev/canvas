# 10 Open Questions

Decisions still to be made. Each has a **current default** that the docs and code assume until someone decides otherwise.

How to use this file:

- Agents: if your task depends on one of these, either ask the user or implement the default and mention that you did.
- When a question is decided, remove it from here, update the relevant doc, and add a line to the "Decided" log at the bottom.

## Permissions and oversight

### Q1. Cross-department DMs

A member of 活动部 DMs a member of 宣传部. Who can read it through oversight?

- **Default:** leads of **both** departments (each oversees their own member) plus presidium. This follows directly from the `oversees` rule.
- Alternative: presidium only for cross-department DMs.

### Q2. Leads' own DMs and group chats

Who can read messages sent by a department lead?

- **Default:** presidium only. Co-leads and other leads cannot.
- Alternative: co-leads of the same department can read each other's content.

### Q3. Should leads approve accounts?

- **Default:** yes, leads can approve applicants who requested their department, as members only. Presidium can approve anyone.
- Alternative: presidium only.

### Q4. Should participants know when an oversight view happens?

- **Default:** no live notice. Users accept the disclosure at signup, and the audit log records each view (presidium can read it).
- Alternative: show participants "this chat was viewed by an overseer" or let users see the audit entries about themselves.

## Content and retention

### Q5. Deleted message content

When a message is soft deleted, is the original text kept?

- **Default:** the row and original `body` are kept in the database and visible only to presidium (as "deleted content") for moderation. Everyone else sees "消息已删除".
- Alternative: clear `body` and attachments on delete (true deletion).

### Q6. Officer term handover and old data

What happens to messages, files, and assignments when a school year ends?

- **Default:** keep everything. Department channels and folders carry over to the new leads. Graduated members are deactivated, not deleted.
- Alternative: archive each year's channels and start fresh ones, or auto-delete after N years.

### Q7. Storage limits

Convex file storage has plan-based limits and costs.

- **Default:** 25 MB per file, no per-department quota in v1. Show total usage in the admin overview.
- Alternative: per-department quotas (for example 5 GB), or a smaller per-file limit with large videos kept elsewhere.

## Features

### Q8. Grading on assignments

- **Default:** no scores. Only approve or request changes, plus comments.
- Alternative: optional points or a simple rubric.

### Q9. In-app documents (Google Docs style)

- **Default:** uploads only. No in-app editing in v1. Revisit in Stage 5 with a simple single-editor rich text page (TipTap), not real-time co-editing.
- Alternative: build real-time collaborative docs (much larger scope), or link out to Google Docs.

### Q10. Department list

- **Default:** seed 主席团, 活动部, 国际部, 宣传部. Admins add the rest from the roster page.
- Needed: the full, current list of CSSA departments with official English names.

### Q11. Sending account for email

- **Default:** a dedicated CSSA Google account (free Gmail, about 100 recipients per day).
- Needed: which account, and whether CSSA has Google Workspace (higher limits).

### Q12. Custom domain and account ownership

Hosting is decided (GitHub Pages static export + Convex Cloud, see Decided below).

- **Default:** `https://ucsb-cssa-dev.github.io/canvas/`, Convex free tier.
- Needed: whether CSSA wants a custom domain, and who owns the GitHub organization and Convex team for continuity across officer terms.

### Q13. Calendar and events

- **Default:** out of scope; assignment due dates only. A calendar view of due dates is a Stage 5 option.
- Alternative: add CSSA events (with RSVP) as a fourth pillar later.

## Accounts and roster (added with Stage 1)

### Q14. Do pre-approvals expire?

- **Default:** no. Unclaimed pre-approvals stay active until revoked. The roster shows them so they can be cleaned up.
- Alternative: expire after N days (for example 30), or at the end of the school year.

### Q15. Do pre-approved users still see the oversight notice?

- **Default:** yes. They skip the approval wait but still complete the short onboarding (names + notice checkbox), because consent must come from the person, not the admin who invited them.
- Alternative: skip onboarding entirely and ask for names and consent later. Not recommended.

### Q16. Titles inside the hierarchy

Should the roster show titles such as 主席, 副主席, 秘书长, or only the role (主席团 member, 部长, 部员)?

- **Default:** role only.
- Alternative: an optional free-text `title` on `departmentMemberships`, edited by admins.

### Q17. Is the system admin visible on the roster?

- **Default:** yes, with a small "系统管理员 / Admin" badge wherever they appear. If they are in no department, they show under "未分配部门 / No department".
- Alternative: hide the system admin from members unless they hold a department role.

### Q18. Can leads also approve pending applicants (not just pre-approve)?

- **Default:** yes, same as Q3: leads can approve applicants who requested their department, as members only.
- Alternative: leads can only pre-approve emails; only admins approve pending applicants.

## Decided

Record decisions here as `YYYY-MM-DD - Qn - decision - where documented`.

- 2026-10-19 - Stack - Next.js + React + Tailwind + shadcn/ui, Convex backend, Gmail via Google Apps Script - [README](../README.md#tech-stack)
- 2026-10-19 - Sign-in - `@ucsb.edu` Google accounts only, admin approval required - [accounts-and-onboarding.md](features/accounts-and-onboarding.md)
- 2026-10-19 - Roles - 主席团 super admin, 1 to 2 部长 per department, oversight disclosed at signup - [02-roles-and-permissions.md](02-roles-and-permissions.md)
- 2026-10-19 - Language - Chinese primary, English secondary, toggle - [05-i18n.md](05-i18n.md)
- 2026-10-19 - Platform - web app first; email reminders via Gmail - [09-roadmap.md](09-roadmap.md)
- 2026-10-19 - Design - minimal dark theme, white text, gold accent, system fonts - [04-design-system.md](04-design-system.md)
- 2026-10-19 - Stages - Stage 1 = rough UI, hierarchy, Google sign-in, basic messaging; Stage 2 = full chat and oversight; Stage 3 = files + assignments + email; Stage 4 = AI embedding (TBA); Stage 5 = polish - [09-roadmap.md](09-roadmap.md)
- 2026-10-19 - System admin - the first account becomes system admin with full access (optional `BOOTSTRAP_ADMIN_EMAIL` lock) - [accounts-and-onboarding.md](features/accounts-and-onboarding.md#first-account-becomes-system-admin)
- 2026-10-19 - Pre-approvals - admins and leads pre-approve emails into the hierarchy; those users skip the approval queue on first sign-in - [roster.md](features/roster.md#pre-approving-emails)
- 2026-10-19 - Roster - every approved user can see the full hierarchy - [roster.md](features/roster.md)
- 2026-10-19 - Q12 - Hosting: frontend as a Next.js static export on GitHub Pages (`UCSB-CSSA-dev/canvas`), deployed with Convex by GitHub Actions; code split into `frontend/` and `backend/` workspaces - [01-architecture.md](01-architecture.md#deployment)
- 2026-10-19 - Chat access - department channel access is derived from `departmentMemberships`; `channelMembers` holds DM membership and read state only - [03-data-model.md](03-data-model.md#channels-and-channelmembers)
