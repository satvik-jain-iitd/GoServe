// Tilt (Motion Primitives): the phone leans toward the pointer. Reduced motion switches the lean off in CSS.
import type { ReactNode } from "react";
import { Tilt as MPTilt } from "@/components/motion/tilt";

export default function Tilt({ children }: { children: ReactNode }) {
  return <MPTilt className="mo" rotationFactor={8}>{children}</MPTilt>;
}
