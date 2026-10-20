import type { NotificationType } from "./constants";

export type PushLocale = "zh" | "en";
export type PushInput = {
  type: NotificationType | "dm" | "test";
  params: Record<string, unknown>;
  link?: string;
  /** Replaces an earlier notification with the same tag on the device. */
  tag?: string;
};
type Named = { name?: string; nameZh?: string; nameEn?: string; email?: string };
export type PushLookup = {
  people: Record<string, Named>;
  departments: Record<string, { nameZh: string; nameEn: string }>;
};

// Mirrors the "notifications" strings in frontend/messages/{zh,en}.json; the service worker can't run next-intl.
const TEXT = {
  zh: {
    someone: "某人",
    aDepartment: "某部门",
    mention: "{actor} 提到了你",
    mentionAll: "{actor} @了所有人",
    reply: "{actor} 回复了你",
    announcement: "{actor} 发布了公告",
    addedToGroup: "{actor} 将你加入了群聊「{name}」",
    addedToDepartment: "{actor} 将你加入了{department}（{role}）",
    deactivationDeclined: "主席团未批准你的停用申请",
    groupProposed: "{proposer} 申请创建群聊「{name}」，等待你审核",
    groupApproved: "{reviewer} 批准了你的群聊申请「{name}」",
    groupRejected: "{reviewer} 拒绝了你的群聊申请「{name}」",
    groupExpired: "群聊申请「{name}」超过 14 天未处理，已过期",
    groupTakeover: "{department}没有部长，主席团已接管 {count} 个群聊",
    appProposed: "{actor} 申请发起{kind}「{title}」",
    appApproved: "{reviewer} 批准了你的{kind}「{title}」",
    appRejected: "{reviewer} 拒绝了你的{kind}「{title}」",
    appDueSoon: "{kind}「{title}」即将截止，别忘了参与",
    signup: "接龙",
    poll: "投票",
    meeting: "集会",
    lead: "部长",
    member: "部员",
    attachment: "[文件]",
    testTitle: "CSSA Hub 通知已开启",
    testBody: "有新消息时会这样提醒你。",
  },
  en: {
    someone: "Someone",
    aDepartment: "a department",
    mention: "{actor} mentioned you",
    mentionAll: "{actor} mentioned everyone",
    reply: "{actor} replied to you",
    announcement: "{actor} posted an announcement",
    addedToGroup: '{actor} added you to "{name}"',
    addedToDepartment: "{actor} added you to {department} ({role})",
    deactivationDeclined: "The Presidium declined your deactivation request",
    groupProposed: '{proposer} requested the group "{name}" and needs your review',
    groupApproved: '{reviewer} approved your group "{name}"',
    groupRejected: '{reviewer} declined your group request "{name}"',
    groupExpired: 'Your group request "{name}" expired after 14 days without review',
    groupTakeover: "{department} has no lead; the Presidium now manages {count} group(s)",
    appProposed: '{actor} proposed a {kind}: "{title}"',
    appApproved: '{reviewer} approved your {kind} "{title}"',
    appRejected: '{reviewer} declined your {kind} "{title}"',
    appDueSoon: 'The {kind} "{title}" closes soon',
    signup: "Sign-up",
    poll: "Poll",
    meeting: "Meeting",
    lead: "Lead",
    member: "Member",
    attachment: "[File]",
    testTitle: "CSSA Hub notifications are on",
    testBody: "This is how new activity will reach you.",
  },
} as const;

type Key = keyof (typeof TEXT)["zh"];

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function pushText(input: PushInput, locale: PushLocale, lookup: PushLookup): { title: string; body?: string } {
  const text = TEXT[locale];
  const t = (key: Key, values: Record<string, string | number> = {}) => fill(text[key], values);
  const params = input.params;
  const person = (key: string) => {
    const p = lookup.people[String(params[key])];
    const primary = locale === "zh" ? p?.nameZh : p?.nameEn;
    const secondary = locale === "zh" ? p?.nameEn : p?.nameZh;
    return primary || secondary || p?.name || p?.email || text.someone;
  };
  const department = () => {
    const d = lookup.departments[String(params.departmentId)];
    return d ? (locale === "zh" ? d.nameZh : d.nameEn || d.nameZh) : text.aDepartment;
  };
  const name = String(params.name ?? "");
  const title = String(params.title ?? "");
  const kind = () => (params.kind === "signup" || params.kind === "poll" || params.kind === "meeting" ? text[params.kind] : "");
  const preview = typeof params.preview === "string" && params.preview ? params.preview : undefined;
  const note = typeof params.note === "string" && params.note ? params.note : undefined;

  switch (input.type) {
    case "test":
      return { title: text.testTitle, body: text.testBody };
    case "dm":
      return { title: person("actorId"), body: preview ?? text.attachment };
    case "mention":
      return { title: t(params.all ? "mentionAll" : "mention", { actor: person("actorId") }), body: preview };
    case "reply":
      return { title: t("reply", { actor: person("actorId") }), body: preview };
    case "announcement":
      return { title: t("announcement", { actor: person("actorId") }), body: preview };
    case "added_to_group":
      return { title: t("addedToGroup", { actor: person("actorId"), name }) };
    case "added_to_department":
      return {
        title: t("addedToDepartment", {
          actor: person("actorId"),
          department: department(),
          role: params.role === "lead" ? text.lead : text.member,
        }),
      };
    case "deactivation_reviewed":
      return { title: t("deactivationDeclined"), body: note };
    case "group_proposed":
      return { title: t("groupProposed", { proposer: person("proposerId"), name }) };
    case "group_approved":
      return { title: t("groupApproved", { reviewer: person("reviewerId"), name }) };
    case "group_rejected":
      return { title: t("groupRejected", { reviewer: person("reviewerId"), name }), body: note };
    case "group_expired":
      return { title: t("groupExpired", { name }) };
    case "group_takeover":
      return {
        title: t("groupTakeover", { department: department(), count: Number(params.count ?? 0) }),
        body: Array.isArray(params.groupNames) ? params.groupNames.join(locale === "zh" ? "、" : ", ") : undefined,
      };
    case "app_proposed":
      return { title: t("appProposed", { actor: person("actorId"), kind: kind(), title }) };
    case "app_approved":
      return { title: t("appApproved", { reviewer: person("reviewerId"), kind: kind(), title }) };
    case "app_rejected":
      return { title: t("appRejected", { reviewer: person("reviewerId"), kind: kind(), title }), body: note };
    case "app_due_soon":
      return { title: t("appDueSoon", { kind: kind(), title }) };
  }
}
