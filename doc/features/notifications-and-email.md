# Feature: Notifications and Email (通知与邮件)

## Summary

Two delivery channels:

1. **In-app notifications**: a bell icon with an unread count, plus the `/notifications` page. Real time through Convex.
2. **Email**: sent through Gmail by a Google Apps Script web app. Used sparingly for things people must not miss. Transport details are in [06-email-apps-script.md](../06-email-apps-script.md).

## Triggers

| Event | Recipients | In-app type | Email | Email preference |
| --- | --- | --- | --- | --- |
| New account request | Presidium + leads of requested departments | (admin badge) | Yes | always on for approvers |
| Email pre-approved (optional checkbox when pre-approving) | The pre-approved email | (none, no account yet) | Yes | always |
| Account approved | Applicant | `account_approved` | Yes | always |
| Account rejected | Applicant | `account_rejected` | Yes | always |
| Added to a department | User | `added_to_department` | No | - |
| New assignment published | Each assignee | `assignment_new` | Yes | `assignments` |
| Assignment due in 24 h | Assignees not done | `assignment_due_soon` | Yes | `assignments` |
| Assignment overdue | Assignee; creator gets daily summary | `assignment_overdue` | Yes | `assignments` |
| Submission received | Assignment creator | `submission_received` | No (daily summary) | `assignments` |
| Submission reviewed | Assignee | `submission_reviewed` | Only for "changes requested" | `assignments` |
| @mention or reply | Mentioned user | `mention` | Daily digest of unread mentions | `mentions` |
| Announcement posted | Channel members | `announcement` | Yes | `announcements` |

"Always" emails ignore preferences because they are about account access.

## In-app notifications

- `notifications.listMine` (paginated, newest first) and `notifications.unreadCount`.
- Clicking a notification marks it read and navigates to `link` (prefixed with the current locale).
- "全部标为已读 / Mark all as read".
- The display text is **not stored**. Store `type` + `params`, and render through `next-intl` keys like `notifications.assignment_new` with params `{ title, by }`, so each user sees their own language.
- Keep 90 days. A daily cron deletes older read notifications.

## Email

### Principles

- Gmail sending quotas are low (roughly **100 recipients per day** on a free Gmail account, around **1,500 per day** on Google Workspace). The design must stay well under them:
  - No per-message chat emails; mentions go out as one daily digest.
  - One email per assignment per assignee, not one per event.
  - Announcement emails go to one message with recipients in BCC, chunked to 50 per send.
- Every email is a row in `emailJobs` first (an outbox). Never call Apps Script directly from user-facing mutations.
- Language: use the recipient's `users.locale`.
- Every email includes a link back to the app and a footer: "在设置中管理邮件提醒 / Manage email reminders in Settings".

### Pipeline

1. A mutation or cron calls `internal.email.enqueue({ userId | to, template, params, dedupeKey? })`.
   - Skips when the user's preference is off (for preference-controlled templates).
   - Skips when a job with the same `dedupeKey` already exists.
   - Inserts `status = "queued"` and schedules `internal.email.send` immediately.
2. `internal.email.send` (action) marks the job `sending`, POSTs to Apps Script, then marks `sent` or `failed` with `attempts + 1` and `lastError`.
3. A cron every 10 minutes re-queues `failed` jobs with `attempts < 5`, using backoff (`sendAfter = now + 2^attempts minutes`).
4. If the Apps Script reports a quota error, stop sending until the next day by setting `sendAfter` to the next midnight Pacific time for all queued jobs.

### Digest

- Daily cron at 8:00 PM Pacific: for each user with unread `mention` notifications from the last 24 hours, and `emailPrefs.mentions = true`, send one `mention_digest` email listing up to 10 of them.
- Creators get a daily `creator_summary` email with new submissions and overdue counts for their open assignments (only if there is something to report).

### Templates

Defined in [06-email-apps-script.md](../06-email-apps-script.md#templates). Rendered on the Convex side (subject and HTML body in both languages) so the Apps Script stays a thin relay.

## Acceptance criteria

- [ ] The bell count updates in real time.
- [ ] Notifications render in the viewer's current language.
- [ ] Turning off an email preference stops those emails but keeps in-app notifications.
- [ ] Failed emails retry up to 5 times with backoff and never send duplicates.
- [ ] A quota error pauses sending until the next day instead of retrying in a loop.
