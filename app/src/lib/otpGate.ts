// Story #551: is the phone code asked at checkout? OFF by default, so today's checkout (name and phone typed on the bill, cash) keeps working.
// PLACEHOLDER (owner click): SMS provider — until the owner picks one, the otp function sends with FakeSms and no real phone gets a code.
// To switch on for real customers: the owner's SMS click, then set VITE_OTP_SMS=real and VITE_OTP_GATE=1 in .github/workflows/deploy-app.yml.
// A phone can also switch it on for itself (localStorage gs-otp-gate=1), which is how the tests and a dev phone try the sheets.
type Env = { VITE_OTP_GATE?: string; VITE_OTP_SMS?: string };

export const otpGateOn = (env: Env, storage?: Pick<Storage, "getItem">): boolean => {
  if (env.VITE_OTP_GATE === "1") return true;
  try { return storage?.getItem("gs-otp-gate") === "1"; } catch { return false; }   // blocked storage: off
};

// The gate is on for everyone but the sender is still the placeholder: a customer would wait for a code that never comes.
export const placeholderLeft = (env: Env): boolean => env.VITE_OTP_GATE === "1" && env.VITE_OTP_SMS !== "real";

// Story 829: the phone code login is a switch the admin flips (settings row otp_login_on). The phone's own override wins (tests, a dev phone), then the
// setting, then VITE_OTP_GATE, then off. `setting` is null when it could not be read: the app never waits on it and never shows a half screen.
// Story #1106: when the read fails (offline), the last setting this phone read stands in; the build value is only for a phone that never read one.
export const LAST_KEY = "gs-otp-last";
export const rememberOtpSetting = (on: boolean, storage: Pick<Storage, "setItem"> = window.localStorage): void => { try { storage.setItem(LAST_KEY, on ? "1" : "0"); } catch { /* blocked storage: no memory */ } };
export const otpLoginOn = (setting: boolean | null, env: Env, storage?: Pick<Storage, "getItem">): boolean => {
  try { if (storage?.getItem("gs-otp-gate") === "1") return true; } catch { /* blocked storage: no override */ }
  if (setting !== null) return setting;
  try { const last = storage?.getItem(LAST_KEY); if (last === "1" || last === "0") return last === "1"; } catch { /* blocked storage: no memory */ }
  return env.VITE_OTP_GATE === "1";
};

