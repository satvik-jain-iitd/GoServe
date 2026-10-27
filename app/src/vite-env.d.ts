/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ORDER_URL: string;
  readonly VITE_STYLEGUIDE?: string;
  readonly VITE_DEMO_TOKEN: string;
  readonly VITE_AUTOPILOT_MS?: string;
  readonly VITE_REASK_MS?: string;       // how long after a Not yet the delivery question comes back; tests set a short one
  readonly VITE_OTP_GATE?: string;       // story #551: "1" asks the phone code at checkout
  readonly VITE_OTP_SMS?: string;        // story #551: "real" once the owner's SMS provider is set; anything else is the placeholder sender
  readonly VITE_PAYMENTS_PROVIDER?: string;     // story #552: "razorpay" once the owner's Razorpay click is done
  readonly VITE_PAYMENTS_PLACEHOLDER?: string;  // story #552: "1" shows the dev helper on the waiting panel (dev and tests only)
  readonly VITE_PAYMENTS_DEV_SECRET?: string;   // story #552: signs the dev helper's webhook; a dev value, public by design
  readonly VITE_BUILD?: string;          // the commit the build was made from; set by the deploy workflows   // step time of the autopilot; tests set a short one
}
