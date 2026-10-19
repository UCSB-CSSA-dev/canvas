# Feature: Chat (聊天)

## Summary

Real-time messaging similar to GroupMe: org-wide and department channels, announcement channels, user-created group chats, and direct messages. Built on Convex subscriptions, so no websockets code is needed.

## Stage 1 scope

Stage 1 builds only basic text chat. Everything else in this doc is Stage 2 (see [09-roadmap.md](../09-roadmap.md)).

| In Stage 1 | Stage 2 |
| --- | --- |
| `org` channel (全体), `department` channels, `dm` | `announcement` and `group` channels |
| Send plain-text messages (with auto-linked URLs), real-time | Markdown formatting, attachments, mentions, replies, reactions |
| Paginated history, load older on scroll | Edit and delete, moderation |
| Unread badges, mark as read | Mute, search, notifications |
| Start a DM from the roster or a "new DM" picker | Oversight section and banner |

Department channel membership is synced from the hierarchy from day one: being added to a department on the roster (or through a pre-approval) gives access to its channel immediately, and removal takes it away. Admins can read and post in every department channel in Stage 1, because they can open every page.

## Channel types

| Type | Created by | Members | Who can post | Name |
| --- | --- | --- | --- | --- |
| `org` | Seed | All approved users (implicit) | All approved users | "全体 / General" |
| `department` | Auto when a department is created | Department members (synced) | Department members | Department name |
| `announcement` (org-wide) | Seed | All approved users (implicit) | Presidium | "全体公告 / Announcements" |
| `announcement` (department) | Auto with department | Department members (synced) | That department's leads and presidium | "{Dept} 公告" |
| `group` | Any approved user | Chosen members (2 or more besides creator) | Members | Custom name, required |
| `dm` | Any approved user | Exactly 2 | Both | Other person's name |

"Implicit" membership: for `org` and org-wide `announcement` channels, don't store a `channelMembers` row per user up front. Create the row lazily the first time a user opens the channel (it holds `lastReadAt` and `muted`).

## Layout

```text
+------------------+-------------------------------------------+
| Sidebar          | # 活动部                       [i] [search]|
| ---------------- |-------------------------------------------|
| 公告 Announcements|  Alice  10:02                             |
|   全体公告    (2) |  明天活动的物资清单已上传到文件夹          |
| 部门 Departments |                                           |
|   活动部      (5) |  Bob  10:05                               |
|   宣传部          |  @Alice 收到                               |
| 群聊 Groups      |                                           |
|   迎新晚会筹备    |                                           |
| 私信 DMs         |                                           |
|   Carol      (1) |-------------------------------------------|
| 监督 Oversight ▸ | [ + ] 输入消息...                [Send]   |
+------------------+-------------------------------------------+
```

- Unread counts appear as gold badges. Muted channels show a muted icon and no badge, only a dot.
- The "监督 Oversight" section shows only for leads and presidium, collapsed by default. See [02-roles-and-permissions.md](../02-roles-and-permissions.md#oversight-监督查看).
- On mobile widths the channel list and the message view are separate screens.

## Messages

### Content

- Plain text with lightweight markdown: bold, italic, inline code, code blocks, links (auto-linked). No raw HTML. Render safely (no `dangerouslySetInnerHTML` with user input).
- Maximum 4,000 characters.
- Attachments: up to 10 per message, each up to 25 MB (shared limit with Files; see [files.md](files.md)). Images show inline thumbnails; other files show a file card.
- Mentions: typing `@` opens a member picker for the channel. Stored as `mentionUserIds`. `@all` is allowed only for presidium and leads (in their department channels) and notifies everyone in the channel.
- Reply: quote a previous message (`replyToId`). No threaded sub-conversations in v1.
- Reactions: emoji reactions with a toggle; show counts and who reacted on hover.

### Actions

| Action | Who | Behavior |
| --- | --- | --- |
| Send | Members who can post | Insert, update `channels.lastMessageAt`, schedule mention notifications |
| Edit | Author, within 24 hours | Set `editedAt`, show "(已编辑 / edited)" |
| Delete | Author anytime; moderators (see matrix) | Soft delete, show "消息已删除 / Message deleted" |
| React | Anyone who can post | Toggle a `messageReactions` row |
| Copy text / copy link | Anyone who can read | Client only |

### Read state

- When the message view is focused and scrolled to the bottom, call `channels.markRead(channelId)` (debounced, about once every 2 seconds) to set `lastReadAt = now`.
- Show a "新消息 / New messages" divider at the first unread message when opening a channel.
- Read receipts per message are **not** in v1.

### Loading

- `messages.list` uses `usePaginatedQuery`, 50 per page, newest first. The view reverses for display and loads older pages when the user scrolls to the top.
- Keep the scroll position stable when older messages load. Auto-scroll on new messages only when the user is already near the bottom.

## Creating chats

- **New group**: name (required), pick members from the directory (approved users only). The creator becomes a group `admin`. Admins can rename, add or remove members, and promote other admins. Any member can leave.
- **New DM**: pick a person. `channels.getOrCreateDm(otherUserId)` looks up `dmKey` and creates the channel if missing.
- Department channels cannot be left while you are in the department; you can mute them.

## Search

- v1: search within the current channel using the `search_body` search index filtered by `channelId`.
- Later: global search across all channels the viewer can read.

## Notifications from chat

- Mention or reply to your message: in-app `mention` notification, and email via the daily digest if enabled (no instant email per message). See [notifications-and-email.md](notifications-and-email.md).
- New post in an announcement channel: in-app `announcement` notification for all members; email if the user enabled announcement emails.
- No notifications for ordinary messages. Unread badges cover that.

## Convex functions

| Function | Type | Notes |
| --- | --- | --- |
| `channels.listMine` | query | Channels with unread counts, grouped by type |
| `channels.listOversight` | query | Leads and presidium only |
| `channels.get` | query | Includes `via: "member" or "oversight"`; logs audit when via oversight (use a mutation `channels.recordOversightOpen` called on open, since queries cannot write) |
| `channels.createGroup` | mutation | |
| `channels.getOrCreateDm` | mutation | |
| `channels.updateGroup`, `addMembers`, `removeMember`, `leave` | mutation | |
| `channels.markRead`, `setMuted` | mutation | |
| `messages.list` | query (paginated) | Permission check per call |
| `messages.send`, `edit`, `remove` | mutation | |
| `messages.toggleReaction` | mutation | |
| `messages.search` | query | Within a channel |
| `files.generateUploadUrl` | mutation | Shared with Files |

Important: Convex queries cannot write, so oversight audit logging happens in a mutation the client calls when it opens an oversight channel. `messages.list` must still verify read access on every call.

## Acceptance criteria

- [ ] Messages appear for all viewers of a channel without a page refresh.
- [ ] A member cannot read a channel they are not in, unless they oversee a participant.
- [ ] An oversight viewer sees the read-only banner, cannot post, and one audit row is written per open.
- [ ] Posting in an announcement channel is limited to the roles in the table above.
- [ ] Unread badges update in real time and clear when the channel is read.
- [ ] DM between the same two people always resolves to the same channel.
