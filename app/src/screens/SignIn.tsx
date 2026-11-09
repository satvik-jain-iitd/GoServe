import { useEffect, useState } from "react";
import { cachedSignedInName, friendlyAuth, givenNameOf, linkGoogle, markTried, rememberReturn, signedInName, takeTried, type ReturnScreen } from "../lib/auth";
import { ensureSession, getClient } from "../lib/supabase";
import { Button } from "../ui";

// One line under the title: "Continue with Google", or "Signed in as <name>". No password, no email form.
// `returnTo` is the screen Google comes back to (story #801). Only You asks for "account"; everywhere else the menu is right.
export function SignIn({ mode = "link", returnTo = "menu", big, filled, onGivenName, help }: { mode?: "link" | "signin"; returnTo?: ReturnScreen; big?: boolean; filled?: boolean; onGivenName?: (name: string) => void; help?: string }) {
  const [name, setName] = useState<string | null>(() => cachedSignedInName());   // story #1134: the banner is there on the first paint; the call below only confirms it
  const [back] = useState(() => friendlyAuth(window.location.search, window.location.hash));
  const [error, setError] = useState<string | null>(back?.message ?? null);
  useEffect(() => {
    if (error) history.replaceState(null, "", window.location.pathname);   // shown once
    if (!back) takeTried();   // a clean return: the next error may sign in again
    // Story #635: the Google account is already on another user: this phone becomes that user (once; a second return with the same error only shows the line).
    if (back?.signIn && !takeTried()) { markTried(); rememberReturn(returnTo); void linkGoogle(getClient(), window.location.href.split("?")[0], "signin").then((e) => e && setError(e)); }
    let alive = true;
    ensureSession()
      .then(() => getClient().auth.getUser())
      .then(({ data }) => { if (!alive) return; setName(signedInName(data.user)); const given = givenNameOf(data.user); if (given) onGivenName?.(given); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (name) return (
    <p className="notice"><span data-testid="signed-in">Signed in as {name}</span>{" "}
      <Button variant="ghost" onClick={async () => { await getClient().auth.signOut(); window.location.reload(); }}>Sign out</Button>
    </p>
  );
  return (
    <div className={big ? "ui-google-stack" : undefined}>
      <Button variant={filled ? "primary" : "ghost"} size={big ? "big" : undefined} data-testid="google-signin"
        onClick={async () => {
          if (typeof navigator !== "undefined" && navigator.onLine === false) { setError("No internet. Connect and tap again."); return; }   // story #1108: never leave for the browser's error page
          setError(null);
          rememberReturn(returnTo); await ensureSession().catch(() => {}); setError(await linkGoogle(getClient(), window.location.href.split("?")[0], mode)); }}>
        Continue with Google
      </Button>
      {help && <p className="ui-google-help">{help}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
