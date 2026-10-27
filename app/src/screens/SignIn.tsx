import { useEffect, useState } from "react";
import { authErrorFrom, givenNameOf, linkGoogle, signedInName } from "../lib/auth";
import { ensureSession, getClient } from "../lib/supabase";
import { Button } from "../ui";

// One line under the title: "Continue with Google", or "Signed in as <name>". No password, no email form.
export function SignIn({ mode = "link", onGivenName }: { mode?: "link" | "signin"; onGivenName?: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => authErrorFrom(window.location.search, window.location.hash));
  useEffect(() => {
    if (error) history.replaceState(null, "", window.location.pathname);   // shown once
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
        onClick={async () => { await ensureSession().catch(() => {}); setError(await linkGoogle(getClient(), window.location.href.split("?")[0], mode)); }}>
        Continue with Google
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
