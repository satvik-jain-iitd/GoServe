// Story #954: on iOS the keyboard shrinks the visual viewport and scrolls the layout viewport, so a fixed overlay drifts and leaves an empty band above the keyboard.
// The overlay takes the visual viewport's height and top while the keyboard is up (the sheet inside scrolls, so its title and fields stay above the keyboard).
// Story #980: when the keyboard closes the last resize event can leave a stale smaller height, so a band of the page shows under the sheet. At full size the inline
// sizes are cleared and the CSS fills the screen again; the overlay also refits on the next frame, on a window resize and 300 ms after a field loses focus.
// Story 1560: on an iPhone the visual viewport can be shorter than the window with no keyboard at all (a call or hotspot bar, the app opened from the home screen),
// so the overlay ended above the bottom and the tab bar showed under it. The keyboard is up only while a field you type in, inside the overlay, has the focus;
// at any other time the inline sizes are cleared and the CSS (inset: 0) fills the screen.
const TYPED = "input:not([type=checkbox], [type=radio], [type=file]), textarea, select, [contenteditable]";
export function bindSheetFit(el: HTMLElement, vv: VisualViewport, win: Window): () => void {
  const typing = () => { const a = el.ownerDocument.activeElement; return !!a && el.contains(a) && a.matches(TYPED); };
  const fit = () => {
    if (!typing() || (vv.height >= win.innerHeight - 1 && vv.offsetTop === 0)) { el.style.height = ""; el.style.top = ""; el.style.bottom = ""; return; }   // full size: the CSS decides
    el.style.height = `${vv.height}px`; el.style.top = `${vv.offsetTop}px`; el.style.bottom = "auto";
  };
  const soon = () => { fit(); win.requestAnimationFrame(fit); };   // once more on the next frame, so an intermediate height never sticks
  const reveal = (e: Event) => { const t = e.target as HTMLElement | null; if (t?.matches?.("input, textarea, select")) win.setTimeout(() => t.scrollIntoView?.({ block: "nearest" }), 300); };   // after the keyboard has come up
  const gone = () => { win.setTimeout(fit, 300); };   // the keyboard has gone: fit to what is left
  soon();
  vv.addEventListener("resize", soon);
  vv.addEventListener("scroll", soon);
  win.addEventListener("resize", soon);
  el.addEventListener("focusin", reveal);
  el.addEventListener("focusout", gone);
  return () => {
    vv.removeEventListener("resize", soon); vv.removeEventListener("scroll", soon); win.removeEventListener("resize", soon);
    el.removeEventListener("focusin", reveal); el.removeEventListener("focusout", gone);
  };
}
