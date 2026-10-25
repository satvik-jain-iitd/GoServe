# Roadmap page

Open `docs/roadmap/index.html` in a browser (it is built on this Mac, not committed).
Build it now: `python3 scripts/roadmap.py`. The launchd job `ops/launchd/com.goserve.roadmap.plist` rebuilds it every 15 minutes and publishes it.

## The public address (story #247)

`https://goserve-roadmap.pages.dev` once the owner has done the two steps in the plist header (the Pages project and the token file). The page says "updated HH:MM", so a stale deploy is visible.

- Publish by hand: `python3 scripts/roadmap.py --deploy`. Only `index.html` goes public, nothing else from `docs/`.
- No token file: the page is still written here, the command fails and says which variable is missing. Look in `/tmp/goserve-roadmap.log`.
- The launchd copy in `~/Library/LaunchAgents` is an install, not a link: after this change run the install line from the plist header again (bootout first).
