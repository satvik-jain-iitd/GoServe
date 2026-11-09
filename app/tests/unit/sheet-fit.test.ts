// Story #980: on iPhone the keyboard closing can leave a stale smaller height on the sheet overlay, so a band of the page shows under it.
// The overlay follows the visual viewport only while the keyboard is up; at full size its inline sizes are cleared and the CSS fills the screen again.
import { describe, expect, it } from "vitest";
import { bindSheetFit } from "../../src/ui/sheetFit";

const rig = (inner = 800) => {
  const vv = Object.assign(new EventTarget(), { height: inner, offsetTop: 0 });
  const frames: (() => void)[] = []; const timers: { at: number; f: () => void }[] = []; let now = 0;
  const win = Object.assign(new EventTarget(), { innerHeight: inner, requestAnimationFrame: (f: () => void) => { frames.push(f); return frames.length; }, setTimeout: (f: () => void, ms: number) => { timers.push({ at: now + ms, f }); return timers.length; } });
  const el = Object.assign(new EventTarget(), { style: { height: "", top: "", bottom: "" } as Record<string, string> });
  const off = bindSheetFit(el as unknown as HTMLElement, vv as unknown as VisualViewport, win as unknown as Window);
  const resizeTo = (h: number, top = 0) => { vv.height = h; vv.offsetTop = top; vv.dispatchEvent(new Event("resize")); };
  const flushFrames = () => { while (frames.length) frames.shift()!(); };
  const advance = (ms: number) => { now += ms; for (const t of timers.splice(0)) (t.at <= now ? t.f : () => timers.push(t))(); };
  return { vv, win, el, off, resizeTo, flushFrames, advance };
};

describe("bindSheetFit", () => {
  it("keyboard up: the overlay takes the visual viewport's height and top", () => {
    const r = rig();
    r.resizeTo(380, 40);
    expect(r.el.style).toMatchObject({ height: "380px", top: "40px", bottom: "auto" });
  });

  it("keyboard closed: the viewport is back to full size and the inline height, top and bottom are cleared", () => {
    const r = rig();
    r.resizeTo(380, 40);
    r.resizeTo(800, 0);
    expect(r.el.style).toMatchObject({ height: "", top: "", bottom: "" });
  });

  it("a stale intermediate height never sticks: the next frame refits to the final size", () => {
    const r = rig();
    r.resizeTo(500, 0);                 // an intermediate event while the keyboard is still closing
    r.vv.height = 800;                  // the viewport finishes growing without another event the sheet saw
    r.flushFrames();
    expect(r.el.style.height).toBe("");
  });

  it("a rotate or resize of the window refits, and full size clears the sizes", () => {
    const r = rig();
    r.resizeTo(380, 0);
    r.vv.height = 800;
    r.win.dispatchEvent(new Event("resize"));
    expect(r.el.style.height).toBe("");
  });

  it("focusout of a field refits after 300 ms, once the keyboard has gone", () => {
    const r = rig();
    r.resizeTo(380, 0);
    r.vv.height = 800;
    r.el.dispatchEvent(new Event("focusout"));
    expect(r.el.style.height).toBe("380px");   // not yet: the keyboard may still be on its way down
    r.advance(300);
    expect(r.el.style.height).toBe("");
  });

  it("a viewport a pixel short of the window still counts as full; one that is clearly short does not", () => {
    const r = rig();
    r.resizeTo(799, 0);
    expect(r.el.style.height).toBe("");
    r.resizeTo(780, 0);
    expect(r.el.style.height).toBe("780px");
  });

  it("stopping removes every listener: no later event touches the overlay", () => {
    const r = rig();
    r.off();
    r.resizeTo(380, 40);
    expect(r.el.style.height).toBe("");
  });
});
