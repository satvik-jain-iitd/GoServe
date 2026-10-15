/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ORDER_URL: string;
  readonly VITE_DEMO_TOKEN: string;
  readonly VITE_AUTOPILOT_MS?: string;
  readonly VITE_REASK_MS?: string;       // how long after a Not yet the delivery question comes back; tests set a short one
  readonly VITE_BUILD?: string;          // the commit the build was made from; set by the deploy workflows   // step time of the autopilot; tests set a short one
}
