// Infinite Slider (Motion Primitives): the product row drifts and pauses on hover. Without motion it stays a plain scroll row.
import { useEffect, useState, type ReactNode } from "react";
import { InfiniteSlider } from "@/components/motion/infinite-slider";

export default function Slider({ children }: { children: ReactNode }) {
  const [drift, setDrift] = useState(false);
  useEffect(() => { setDrift(!window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  if (!drift) return <div className="phones" tabIndex={0} role="region" aria-label="Product screens">{children}</div>;
  return (
    <div className="phones phones--drift" role="region" aria-label="Product screens" tabIndex={0}>
      <InfiniteSlider gap={24} speed={30} speedOnHover={0}>{children}</InfiniteSlider>
    </div>
  );
}
