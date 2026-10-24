// Watermelon UI "navigation-3" (a bar with a menu popover), trimmed to GoServe's three links.
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface Navigation3Props {
  brand: string;
  logoSrc: string;
  links: { label: string; href: string }[];
  cta: { label: string; href: string };
  current: string;
}

export function Navigation3({ brand, logoSrc, links, cta, current }: Navigation3Props) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav aria-label="Site" className="sticky top-0 z-5 w-full border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 text-foreground">
        <a href="/" className="flex items-center gap-2.5 no-underline" style={{ fontFamily: "var(--gs-font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: "inherit" }}>
          <img src={logoSrc} alt="" width={32} height={32} className="block h-8 w-auto" />
          {brand}
        </a>

        <div className="hidden items-center gap-5 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} aria-current={current === l.href ? "page" : undefined} className="font-medium no-underline aria-[current=page]:underline underline-offset-8" style={{ color: "inherit" }}>
              {l.label}
            </a>
          ))}
          <a href={cta.href} className="ui-btn" aria-current={current === cta.href ? "page" : undefined}>{cta.label}</a>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <a href={cta.href} className="ui-btn">{cta.label}</a>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-md" aria-label={isOpen ? "Close menu" : "Open menu"}>
                {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={12} className="w-56 p-2">
              <ul className="m-0 flex list-none flex-col p-0">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} aria-current={current === l.href ? "page" : undefined} className="flex min-h-11 items-center rounded-md px-3 font-medium no-underline hover:bg-secondary" style={{ color: "inherit" }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </nav>
  );
}
