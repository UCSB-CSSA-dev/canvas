# Feature: Notifications and Email (通知与邮件)

## Summary

Three delivery channels:

1. **In-app notifications**: a bell icon with an unread count, plus the `/notifications` page. Real time through Convex.
2. **Push notifications** (Web Push): system notifications on devices where the user turned them on in Settings, even when CSSA Hub is closed. See [Push notifications](#push-notifications).
3. **Email**: sent through Gmail by a Google Apps Script web app. Used sparingly for things people must not miss. Transport details are in [06-email-apps-script.md](../06-email-apps-script.md).

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

## Push notifications

Standard Web Push (service worker + VAPID), so it works with a static GitHub Pages site and Convex.

**What pushes:** every in-app notification (mentions, replies, announcements, group and app events, review results), plus every new **chat message** (DMs, 全体, department and group chats) to everyone in that chat except the sender and those who muted it. Someone who already got a mention, reply or announcement push for a message doesn't get a second one. Plain messages have no notification row; the chat list's unread count covers them in-app. A DM push is titled with the sender; other chats are titled with the chat name, with "sender: preview" as the body. Editing a message only pushes newly added mentions.

**Turning it on (Settings → 推送通知):**
- Per device. "开启通知" asks for the browser permission, subscribes with the deployment's VAPID public key (`push.config`), saves the subscription (`push.subscribe`) and sends a test push. "发送测试通知" and "在这台设备上关闭" are available afterwards.
- iPhone: Web Push only works in a web app added to the Home Screen (iOS 16.4+). In a Safari tab the card explains this; the "iPhone 设置说明" dialog walks through Share → Add to Home Screen → open from the icon → turn on.
- `app/manifest.ts` (standalone display, phoenix icons) is what makes "Add to Home Screen" open as an app.
- Signing out unsubscribes the device first, so the next person using it doesn't get the previous user's notifications. A subscribed endpoint follows whoever subscribed on it last.
- `PushSync` re-saves the subscription on each app load, since browsers can rotate or drop subscriptions.
- Reminder on the 通知 page (`PushReminder`): while this device can't get pushes (off, an iPhone Safari tab, or blocked), a gold card at the top says so, explains that updating, reinstalling or re-adding the Home Screen app turns notifications off, and offers "开启通知" (when possible), the iPhone guide and a link to Settings. It disappears once push is on, and never shows when the deployment has no VAPID keys or the browser can't do push at all.

**Sending:**
- `lib/notify.ts` and `messages.send` (for plain chat messages) call `queuePush`, which schedules `internal.pushNode.send` only for recipients with at least one device (users without push cost nothing).
- `pushNode.send` (Node action, `web-push`) builds the text server-side in each recipient's `users.locale` (`lib/pushText.ts` mirrors the `notifications.*` strings, since the service worker can't run next-intl), sends to every device, and deletes subscriptions the push service reports as gone (404/410). Deactivated or not-approved users get nothing.
- Payloads are encrypted end to end by the Web Push protocol; Apple, Google and Mozilla relay them without being able to read message previews.
- `public/sw.js` shows the notification and, on tap, focuses an open CSSA Hub window and navigates to the link, or opens one. On Chrome and Firefox it skips the system notification while a CSSA Hub window is focused. Anything on Apple's push service (Safari, every iOS browser, home-screen apps) always shows it, because Apple may revoke subscriptions that receive silent pushes. It detects Apple by WebKit rather than "Safari", since home-screen apps often leave "Safari" out of their user agent.
- `pushNode.send` logs one line per push (`push <type>: x/y delivered, n expired, m failed`), with no names or content, for debugging delivery.
- iPhone: removing and re-adding the Home Screen app (for example to pick up a new icon) creates a fresh app with its own storage, so notifications must be turned on again in its Settings. The old app's subscription is dropped the next time a push to it comes back as expired.

**Configuration:** Convex env `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys` in `backend/`), optional `VAPID_SUBJECT` (`mailto:` address). Without the keys the Settings card says notifications aren't set up and nothing is sent.

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
- [ ] With push on, a mention or DM shows a system notification on a closed desktop browser, an Android phone, and an iPhone home-screen app; tapping it opens the right chat.
- [ ] After signing out on a device, that device stops getting pushes.
- [ ] Notifications render in the viewer's current language.
- [ ] Turning off an email preference stops those emails but keeps in-app notifications.
- [ ] Failed emails retry up to 5 times with backoff and never send duplicates.
- [ ] A quota error pauses sending until the next day instead of retrying in a loop.
