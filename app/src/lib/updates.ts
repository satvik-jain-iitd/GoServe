// Story M.1 (#320): an installed app that stays open must pick up a new build.
// An iPhone checks for a new service worker only when the page loads, and a worker that takes over does not reload the page by itself.
export function buildLabel(build: string | undefined): string {
  return `Build ${build && build !== "dev" ? build.slice(0, 7) : "dev"}`;
}

type Sw = Pick<ServiceWorkerContainer, "addEventListener" | "getRegistration" | "controller">;
type Doc = Pick<Document, "addEventListener" | "visibilityState">;

export function watchForUpdates(sw: Sw | undefined, doc: Doc, reload: () => void): void {
  if (!sw) return;
  const hadController = !!sw.controller;   // the first install has none: it must not reload the page
  let reloaded = false;
  sw.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    reload();
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState !== "visible") return;
    sw.getRegistration().then((r) => r?.update()).catch(() => undefined);   // offline or blocked: try again next time
  });
}
