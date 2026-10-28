import { useEffect, useState } from "react";
import { friendlyAuth, givenNameOf, linkGoogle, markTried, rememberReturn, signedInName, takeTried } from "../lib/auth";
import { ensureSession, getClient } from "../lib/supabase";
import { Button } from "../ui";

// One line under the title: "Continue with Google", or "Signed in as <name>". No password, no email form.
export function SignIn({ mode = "link", onGivenName }: { mode?: "link" | "signin"; onGivenName?: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  const [back] = useState(() => friendlyAuth(window.location.search, window.location.hash));
  const [error, setError] = useState<string | null>(back?.message ?? null);
  useEffect(() => {
    if (error) history.replaceState(null, "", window.location.pathname);   // shown once
    if (!back) takeTried();   // a clean return: the next error may sign in again
    // Story #635: the Google account is already on another user: this phone becomes that user (once; a second return with the same error only shows the line).
    if (back?.signIn && !takeTried()) { markTried(); rememberReturn(); void linkGoogle(getClient(), window.location.href.split("?")[0], "signin").then((e) => e && setError(e)); }
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
    <div>
      <Button variant="ghost" data-testid="google-signin"
        onClick={async () => { rememberReturn(); await ensureSession().catch(() => {}); setError(await linkGoogle(getClient(), window.location.href.split("?")[0], mode)); }}>
        Continue with Google
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
