// Animated Number (Motion Primitives): counts up when it enters the screen. Plain final text until then, and with reduced motion.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { AnimatedNumber as MPNumber } from "@/components/motion/animated-number";

export default function AnimatedNumber({ value, prefix = "", className }: { value: number; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [go, setGo] = useState(false);
  const [to, setTo] = useState(0);
  useEffect(() => {
    if (!seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setGo(true);
    const t = setTimeout(() => setTo(value), 30);
    return () => clearTimeout(t);
  }, [seen, value]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {go ? <MPNumber value={to} springOptions={{ duration: 1200, bounce: 0 }} /> : value}
    </span>
  );
}
