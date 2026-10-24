// In View (Motion Primitives): the block rises into place once it is on screen. It is never hidden, so it reads without JS.
import type { ReactNode } from "react";
import { InView } from "@/components/motion/in-view";

export default function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`mo ${className ?? ""}`}>
      <InView once variants={{ hidden: { y: 16 }, visible: { y: 0 } }} viewOptions={{ margin: "0px 0px -10% 0px" }} transition={{ duration: 0.5, delay, ease: "easeOut" }}>
        {children}
      </InView>
    </div>
  );
}
