// Text Effect (Motion Primitives), per word. The words are visible in the server HTML; only a small rise is animated.
import { TextEffect as MPTextEffect } from "@/components/motion/text-effect";

const variants = {
  container: { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } },
  item: { hidden: { y: 12 }, visible: { y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } },
};

export default function TextEffect({ text, as = "h1", className }: { text: string; as?: "h1" | "h2"; className?: string }) {
  return (
    <MPTextEffect per="word" as={as} variants={variants} className={`mo ${className ?? ""}`}>
      {text}
    </MPTextEffect>
  );
}
