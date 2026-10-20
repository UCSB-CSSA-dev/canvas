import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly("purge expired messages", { minuteUTC: 5 }, internal.maintenance.purgeMessages, {});
crons.hourly("expire attachments", { minuteUTC: 15 }, internal.attachments.expire, {});
crons.hourly("expire group proposals", { minuteUTC: 25 }, internal.groups.expireProposals, {});
crons.hourly("purge finished chat apps", { minuteUTC: 35 }, internal.apps.purge, {});
crons.hourly("ensure seed data", { minuteUTC: 45 }, internal.maintenance.seed, {});
crons.daily("clean up notifications", { hourUTC: 11, minuteUTC: 0 }, internal.notifications.cleanup, {});

export default crons;
