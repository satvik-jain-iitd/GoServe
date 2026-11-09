// Story #932: Safari in a browser tab ignores the viewport lock, so a pinch (gesturestart) is cancelled here. Everything else keeps working.
export const lockZoom = (target: EventTarget): void => {
  target.addEventListener("gesturestart", (e) => e.preventDefault());
};
