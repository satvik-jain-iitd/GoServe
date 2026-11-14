// Story #1524 (owner, 14 Nov 2026): the ask on a first-open screen shows when the screen's own motion has ended, not at once.
// The end is the animation's own end (animationend), never a second clock. No motion on the element (reduce motion, a short phone
// that leaves the picture out) means "ended" at once, before the first paint. A phone that never says the motion ended still
// shows the ask: a fallback set from the animation's own length, plus half a second.
import { useLayoutEffect, useState, type RefObject } from "react";

export function useAfterMotion(ref: RefObject<Element | null>): boolean {
  const [ended, setEnded] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const lengths = (el?.getAnimations?.() ?? []).map((a) => Number(a.effect?.getComputedTiming().endTime)).filter((ms) => Number.isFinite(ms));   // an endless one never ends, so it is not waited for
    if (!el || !lengths.length) { setEnded(true); return; }
    const done = () => setEnded(true);
    const onEnd = (e: Event) => { if (e.target === el) done(); };   // not a child's motion
    el.addEventListener("animationend", onEnd);
    el.addEventListener("animationcancel", onEnd);
    const fallback = setTimeout(done, Math.max(...lengths) + 500);
    return () => { el.removeEventListener("animationend", onEnd); el.removeEventListener("animationcancel", onEnd); clearTimeout(fallback); };
  }, [ref]);
  return ended;
}
