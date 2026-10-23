// The push part of the service worker (story A7), as source text. vite.config.ts writes it to dist/push-sw.js with this project's address and public (anon) key;
// the generated worker loads it with importScripts. A push carries no text: the worker asks the database for the latest order of this subscription
// and shows that. A push must always show a notification, so if the database cannot be reached a general line is shown.
export const pushWorkerSource = (supabaseUrl: string, anonKey: string): string => `
self.addEventListener('push', function (event) {
  event.waitUntil((async function () {
    var title = 'GoServe';
    var body = 'Your order has an update.';
    try {
      var sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        var res = await fetch(${JSON.stringify(supabaseUrl + "/rest/v1/rpc/push_latest")}, {
          method: 'POST',
          headers: { apikey: ${JSON.stringify(anonKey)}, Authorization: 'Bearer ' + ${JSON.stringify(anonKey)}, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_endpoint: sub.endpoint })
        });
        if (res.ok) {
          var d = await res.json();
          if (d && d.body) { title = d.title || title; body = d.body; }
        }
      }
    } catch (e) { /* offline: the general line stays */ }
    await self.registration.showNotification(title, { body: body, icon: '/icons/customer-192.png', tag: 'gs-order' });
  })());
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/customer/'));
});
`;
