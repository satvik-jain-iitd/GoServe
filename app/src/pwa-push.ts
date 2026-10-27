// The push part of the service worker (story A7), as source text. vite.config.ts writes it to dist/push-sw.js with this project's address and public (anon) key;
// the generated worker loads it with importScripts. A push carries no text: the worker asks the database for the latest order of this subscription
// and shows that. A push must always show a notification, so if the database cannot be reached a general line is shown.
export const pushWorkerSource = (supabaseUrl: string, anonKey: string): string => `
// Story #484: every step leaves a line in order_trace (the database turns the push address into the order). A lost line never stops the notification.
function gsLog(event, result, text) {
  return (async function () {
    try {
      var sub = await self.registration.pushManager.getSubscription();
      await fetch(${JSON.stringify(supabaseUrl + "/rest/v1/rpc/trace_sw")}, {
        method: 'POST',
        headers: { apikey: ${JSON.stringify(anonKey)}, Authorization: 'Bearer ' + ${JSON.stringify(anonKey)}, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_endpoint: sub ? sub.endpoint : '', p_event: event, p_result: result, p_text: text || null })
      });
    } catch (e) { /* offline: no line */ }
  })();
}
self.addEventListener('push', function (event) {
  var logs = [gsLog('push_received', 'ok')];   // started now, not awaited: the notification must not wait for a log call
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
    try {
      await self.registration.showNotification(title, { body: body, icon: '/icons/customer-192.png', tag: 'gs-order' });
      logs.push(gsLog('notification_shown', 'ok', body));
    } catch (e) {
      logs.push(gsLog('notification_failed', 'error', String(e && e.message)));
    }
    await Promise.all(logs);
  })());
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(Promise.all([gsLog('notification_click', 'ok'), clients.openWindow('/customer/')]));
});
`;
