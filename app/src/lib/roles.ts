// The role apps (story #83): customer, kitchen, rider, ops and admin are separate installable apps on one origin. The address picks the app.
// The root address is the demo console (all roles, split view, demo tools); the health page has its own address.
export const ROLE_APPS = ["customer", "kitchen", "rider", "ops", "admin"] as const;
export type RoleApp = (typeof ROLE_APPS)[number];

export function roleFromPath(pathname: string): RoleApp | null {
  const m = /^\/(customer|kitchen|rider|ops|admin)\/?$/.exec(pathname);
  return m ? (m[1] as RoleApp) : null;
}

// The page title of a role app (the customer app keeps the plain brand name).
export const roleTitle = (role: RoleApp): string => (role === "customer" ? "GoServe" : `GoServe ${role[0].toUpperCase()}${role.slice(1)}`);
