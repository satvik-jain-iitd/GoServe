/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ORDER_URL: string;
  readonly VITE_DEMO_TOKEN: string;
  readonly VITE_AUTOPILOT_MS?: string;   // step time of the autopilot; tests set a short one
}
