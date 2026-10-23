// /styleguide exists only in builds made with VITE_STYLEGUIDE=1 (tests, dev). A release build leaves it off.
export const styleguideOn = (path: string, flag: string | undefined) => flag === "1" && path.replace(/\/$/, "") === "/styleguide";
