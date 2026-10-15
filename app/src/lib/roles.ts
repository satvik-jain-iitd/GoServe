// The role apps (story #83): customer, kitchen, rider and ops are separate installable apps on one origin. The address picks the app.
// The root address is the demo console (all roles, split view, demo tools); the health page has its own address.
export const ROLE_APPS = ["customer", "kitchen", "rider", "ops"] as const;
export type RoleApp = (typeof ROLE_APPS)[number];

export function roleFromPath(pathname: string): RoleApp | null {
  const m = /^\/(customer|kitchen|rider|ops)\/?$/.exec(pathname);
  return m ? (m[1] as RoleApp) : null;
}
