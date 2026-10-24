// Spotlight (Motion Primitives): a soft light follows the pointer inside the block. Off with reduced motion (CSS).
import type { ReactNode } from "react";
import { Spotlight as MPSpotlight } from "@/components/motion/spotlight";

export default function Spotlight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
      <MPSpotlight className="mo from-[#c8d888] via-[#c8d888] to-transparent opacity-40" size={220} />
    </div>
  );
}
