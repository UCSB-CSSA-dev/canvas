# CSSA Hub (UCSB CSSA 内部平台)

An internal web platform for **UCSB CSSA** (Chinese Students and Scholars Association). It combines three tools the organization currently spreads across several apps:

| Pillar | Replaces | Summary |
| --- | --- | --- |
| **Chat 聊天** | GroupMe / WeChat groups | Real-time department channels, group chats, DMs, announcements |
| **Files 文件** | Google Drive | Department-scoped folders, uploads, previews |
| **Assignments 任务** | Canvas | Leads assign tasks with due dates; members submit; leads review |

A **roster** page shows the whole organization hierarchy (主席团, departments, 部长, 部员) to every member.

Access is limited to `@ucsb.edu` Google accounts. Every account must be **approved by an admin or lead**, or have its email **pre-approved** into a department beforehand. The first account ever created becomes the **system admin**. Officers have oversight over the content of the people they manage (see [Roles & Permissions](doc/02-roles-and-permissions.md)).

> Status: **Planning / documentation.** No application code exists yet. Next up: **Stage 1** (app shell, hierarchy and roster, Google sign-in with pre-approvals, basic chat). See [doc/09-roadmap.md](doc/09-roadmap.md). The docs in `doc/` are the source of truth for what to build.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript |
| UI | TailwindCSS + shadcn/ui, dark theme (black / dark gray background, white text, gold accent) |
| Backend | Convex (database, server functions, real-time subscriptions, file storage, crons) |
| Auth | Convex Auth with Google OAuth, restricted to `@ucsb.edu`, admin approval or email pre-approval required |
| Email | Google Apps Script web app that sends through Gmail, called from Convex actions |
| i18n | `next-intl`, Chinese (`zh`) default, English (`en`) secondary, toggle in UI |

---

## Documentation index

Read in this order when starting fresh:

1. [doc/00-overview.md](doc/00-overview.md): vision, goals, non-goals, glossary (中英术语表)
2. [doc/01-architecture.md](doc/01-architecture.md): system diagram, routes, Convex function layout, data flows
3. [doc/02-roles-and-permissions.md](doc/02-roles-and-permissions.md): 主席团 / 部长 / 部员, permission matrix, visibility, audit log, signup disclosure
4. [doc/03-data-model.md](doc/03-data-model.md): Convex schema draft with indexes
5. Feature specs:
   - [doc/features/accounts-and-onboarding.md](doc/features/accounts-and-onboarding.md)
   - [doc/features/roster.md](doc/features/roster.md)
   - [doc/features/chat.md](doc/features/chat.md)
   - [doc/features/files.md](doc/features/files.md)
   - [doc/features/assignments.md](doc/features/assignments.md)
   - [doc/features/notifications-and-email.md](doc/features/notifications-and-email.md)
   - [doc/features/admin-console.md](doc/features/admin-console.md)
6. [doc/04-design-system.md](doc/04-design-system.md): colors, typography, layout, shadcn theme
7. [doc/05-i18n.md](doc/05-i18n.md): bilingual UI and data
8. [doc/06-email-apps-script.md](doc/06-email-apps-script.md): Gmail via Google Apps Script contract
9. [doc/07-security-and-privacy.md](doc/07-security-and-privacy.md): auth checks, file access, secrets, retention
10. [doc/08-conventions.md](doc/08-conventions.md): code structure, naming, Convex patterns, testing
11. [doc/09-roadmap.md](doc/09-roadmap.md): build stages and exit criteria (start with Stage 1)
12. [doc/10-open-questions.md](doc/10-open-questions.md): undecided items, to resolve before building the related feature

---

## Agent instructions

These rules apply to any coding agent (Cursor, Claude, Codex, etc.) working in this repo.

### Before writing code

1. Read this README, then `doc/00-overview.md`, `doc/02-roles-and-permissions.md`, and `doc/03-data-model.md`.
2. Read the feature spec in `doc/features/` for the area you are touching.
3. Check `doc/10-open-questions.md`. If your task depends on an open question, **ask the user** instead of guessing, or implement the default listed there and say so.
4. Check `doc/09-roadmap.md` to confirm which stage the work belongs to. Do not build later-stage features unless asked. Feature specs describe the full feature; each one says which parts belong to Stage 1.

### While writing code

- Follow [doc/08-conventions.md](doc/08-conventions.md) for structure and naming.
- **Every Convex query, mutation, and action that touches user data must check permissions on the server** using the helpers described in `doc/02-roles-and-permissions.md`. Never rely on the UI to hide data.
- Users with `status !== "approved"` may only call onboarding functions.
- All user-facing strings go through `next-intl`. Add keys to **both** `messages/zh.json` and `messages/en.json`. Never hard-code display text in components.
- Use the design tokens in `doc/04-design-system.md`. Do not introduce new colors or fonts.
- Use shadcn/ui components before writing custom ones.
- Secrets (Apps Script URL, shared secret, OAuth credentials) live in Convex environment variables, never in the repo.

### Keeping docs in sync

- The docs are the spec. If you change behavior, schema, routes, or permissions, **update the matching doc in the same change**.
- When an open question is resolved, move it out of `doc/10-open-questions.md` into the relevant doc and note the decision.
- Keep docs in English (code language), with Chinese terms in parentheses where they help (e.g. "Department Lead (部长)").

---

## Planned repository structure

```text
.
├── README.md                  # this file
├── doc/                       # specifications (source of truth)
├── app/                       # Next.js App Router
│   └── [locale]/              # zh | en
│       ├── (auth)/            # sign-in, pending-approval, disclosure
│       └── (app)/             # authenticated shell with sidebar
│           ├── chat/
│           ├── roster/
│           ├── files/
│           ├── assignments/
│           ├── admin/
│           └── settings/
├── components/
│   ├── ui/                    # shadcn/ui generated components
│   └── <feature>/             # feature components (chat, files, ...)
├── convex/                    # Convex backend
│   ├── schema.ts
│   ├── auth.ts
│   ├── lib/permissions.ts     # shared permission helpers
│   ├── users.ts, departments.ts, memberships.ts, preApprovals.ts,
│   ├── roster.ts, seed.ts, channels.ts, messages.ts,
│   ├── files.ts, assignments.ts, notifications.ts, email.ts,
│   ├── audit.ts
│   └── crons.ts
├── messages/                  # next-intl dictionaries
│   ├── zh.json
│   └── en.json
├── google-apps-script/        # Apps Script source for the email relay
│   └── Code.gs
└── lib/                       # client utilities
```

## Getting started (once code exists)

```bash
npm install
npx convex dev          # starts Convex dev deployment, generates types
npm run dev             # starts Next.js on http://localhost:3000
```

Required Convex environment variables are listed in [doc/07-security-and-privacy.md](doc/07-security-and-privacy.md#secrets-and-environment-variables).

The **first account to sign in becomes system admin**. In production, set `BOOTSTRAP_ADMIN_EMAIL` so only the intended person can claim it.
