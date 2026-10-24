import { Navigation3 } from "@/components/ui/navigation-3";

export default function SiteNav({ current }: { current: string }) {
  return (
    <Navigation3
      brand="GoServe"
      logoSrc="/site-img/logo.png"
      current={current}
      links={[{ label: "How it works", href: "/" }, { label: "For investors", href: "/investors" }]}
      cta={{ label: "Pre-register", href: "/pre-register" }}
    />
  );
}
