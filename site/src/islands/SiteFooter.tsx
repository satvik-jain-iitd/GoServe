import { Footer3 } from "@/components/ui/footer-3";

// Server-rendered only: no JavaScript is sent for the footer.
export default function SiteFooter() {
  return (
    <Footer3
      logo={<img src="/site-img/logo.png" alt="" width={32} height={32} className="block h-8 w-auto" />}
      brandName="GoServe"
      description="Hot meals from our kitchen · Delhi. Pilot in Delhi. Cash at the door. No app to install."
      linkGroups={[
        { title: "Contact", links: [{ label: "hello@letsdwelo.in", href: "mailto:hello@letsdwelo.in" }] },
        { title: "Pages", links: [{ label: "How it works", href: "/" }, { label: "For investors", href: "/investors" }, { label: "Pre-register", href: "/pre-register" }] },
      ]}
      copyright="© GoServe · letsdwelo.in"
      credit={
        <>
          Thali photos:{" "}
          <a className="underline" href="https://commons.wikimedia.org/wiki/File:Punjabi_Thali.JPG">Punjabi Thali by Sarahbatra</a> and{" "}
          <a className="underline" href="https://commons.wikimedia.org/wiki/File:Malwani_Chicken_Thali.jpg">Malwani Chicken Thali by Shailesh V Nigawale</a>,{" "}
          <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, via Wikimedia Commons
        </>
      }
    />
  );
}
