// Scroll Progress (Motion Primitives): a thin bar at the top fills as the page scrolls. Hidden with reduced motion (CSS).
import { ScrollProgress as MPScrollProgress } from "@/components/motion/scroll-progress";

export default function ScrollProgress() {
  return <MPScrollProgress className="mo progress fixed z-20 h-[3px] bg-primary" />;
}
