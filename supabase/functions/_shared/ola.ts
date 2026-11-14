// Stories #998 and 1519: one Ola Maps OAuth token for many calls. Ola's token lasts about an hour; a new one is asked in its last minute.
// The client credentials stay on the server (secrets OLA_MAPS_CLIENT_ID and OLA_MAPS_CLIENT_SECRET). No Origin header is sent: a server call needs none.
export const olaToken = (o: { id: string; secret: string; fetchFn?: typeof fetch; now?: () => number }) => {
  const fetchFn = o.fetchFn ?? fetch, now = o.now ?? Date.now;
  let token = "", until = 0;
  return async (): Promise<string> => {
    if (token && now() < until - 60_000) return token;
    const res = await fetchFn("https://api.olamaps.io/auth/v1/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", scope: "openid", client_id: o.id, client_secret: o.secret }) });
    if (!res.ok) throw new Error("token");
    const t = (await res.json()).access_token as string;
    const exp = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp as number;
    token = t; until = exp * 1000;
    return token;
  };
};
