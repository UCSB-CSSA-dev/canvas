// Web Push service worker. Served from the site root (or the GitHub Pages base path), so its
// scope covers the whole app. Payloads come from backend/convex/pushNode.ts:
// { title, body?, link?, tag? }, where link is an in-app path like "/chat/?c=<id>".

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ua = self.navigator.userAgent;
// Safari (including iPhone home-screen apps) may revoke the subscription if a push shows nothing.
const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(ua);

function urlFor(link) {
  return new URL((link || "chat/").replace(/^\//, ""), self.registration.scope).href;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    (async () => {
      if (!isSafari) {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        if (windows.some((w) => w.focused && w.visibilityState === "visible")) return;
      }
      await self.registration.showNotification(data.title || "CSSA Hub", {
        body: data.body,
        tag: data.tag,
        icon: urlFor("icon.png"),
        data: { url: urlFor(data.link) },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (existing) {
        await existing.focus();
        try {
          await existing.navigate(url);
          return;
        } catch {
          // Not controlled by this worker yet; fall through to a new window.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
