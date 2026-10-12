# Options — where the app lives (hosting)

**Date read:** 13 Oct 2026. Tiers: A = the vendor's own page. Decision: Cloudflare Pages (owner, 13 Oct).

## Teach me

Hosting is the shop building for our app. We bring the goods (the code). The host gives the
building, the lights, the guard and the delivery boys who carry the app to every phone fast.
A kirana owner does not build a road to each house; the host already has roads everywhere (a CDN).

Vercel and Cloudflare Pages do the same job. You push code to GitHub. They build it and put it
on servers around the world, with a free web address and HTTPS. Both give a preview link for each
change, so you can see it before it goes live.

## Options

| Option | What you get free | Catch | Tier | Conf | Source |
|---|---|---|---|---|---|
| Cloudflare Pages | Free `<project>.pages.dev` address, 100 projects, 500 builds a month, static files free and unlimited, Pages Functions 100,000 requests a day (10 ms CPU each) | Functions over the daily limit fail (no bill on the free plan) | A | 0.85 | https://developers.cloudflare.com/pages/platform/limits/, https://developers.cloudflare.com/workers/platform/pricing/ |
| Vercel Hobby | Fast builds, preview links, made by the Next.js team; about 100 GB transfer, 1M function calls a month | "Restricted to non-commercial personal use only." A startup demo counts as commercial | A | 0.9 | https://vercel.com/docs/limits/fair-use-guidelines |
| Vercel Pro | Commercial use allowed | Paid (per seat, monthly) | A | 0.8 | https://vercel.com/pricing |
| Render / Railway free | Small servers | Render sleeps after 15 minutes; Railway gives $1 a month after a trial | A | 0.9 | https://render.com/docs/free, https://docs.railway.com/reference/pricing/free-trial |

## Recommendation

- **MVP 0 to MVP 3: Cloudflare Pages.** App at `goserve-app.pages.dev` (its own free project, so
  the investor site at `goserve.pages.dev` / `letsdwelo.in` is never touched by an app deploy).
- **Vercel:** keep for personal projects, or if we ever move to Next.js and pay for Pro.

## Address facts (checked 13 Oct 2026)

- `goserve.pages.dev` already serves our investor site (HTTP 200). `letsdwelo.in` points to the same project.
- `goserve-app.pages.dev` had no site on it, so the name is free to take.
