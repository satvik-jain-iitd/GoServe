import { useEffect, useState } from "react";
import { linkGoogle, signedInName } from "../lib/auth";
import { ensureSession, getClient } from "../lib/supabase";

// One line under the title: "Continue with Google", or "Signed in as <name>". No password, no email form.
export function SignIn() {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    ensureSession()
      .then(() => getClient().auth.getUser())
      .then(({ data }) => { if (alive) setName(signedInName(data.user)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (name) return <p className="notice" data-testid="signed-in">Signed in as {name}</p>;
  return (
    <div>
      <button type="button" className="btn ghost small" data-testid="google-signin"
        onClick={async () => { await ensureSession().catch(() => {}); setError(await linkGoogle(getClient(), window.location.href.split("?")[0])); }}>
        Continue with Google
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
