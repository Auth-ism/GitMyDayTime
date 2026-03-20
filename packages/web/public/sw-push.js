// Push notification handler — imported by Workbox-generated SW
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || "GitMyDayTime";
    const options = {
      body: data.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: "/" },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // fallback for plain text
    event.waitUntil(
      self.registration.showNotification("GitMyDayTime", {
        body: event.data.text(),
        icon: "/favicon.svg",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
