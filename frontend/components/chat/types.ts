import type { FunctionReturnType } from "convex/server";
import type { api } from "@/lib/api";
import type { Locale } from "@/lib/locale-store";
import { displayName, localized } from "@/lib/names";

export type ChannelLists = FunctionReturnType<typeof api.channels.listMine>;
export type Channel = ChannelLists["org"][number];

export function channelName(channel: Channel, locale: Locale, generalLabel: string): string {
  if (channel.type === "org") return generalLabel;
  if (channel.type === "department") return localized(channel.nameZh, channel.nameEn, locale);
  return displayName(channel.otherUser, locale);
}
