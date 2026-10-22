# iPhone: TestFlight and other ways

**Date read:** 22 Oct 2026. Explain only. No work planned now.

| Claim | Evidence | Tier | Confidence | What it changes |
|---|---|---|---|---|
| TestFlight needs the Apple Developer Program, US$99 a year | Apple | A | 0.9 | A yearly cost and an Apple account |
| Enrolling from India goes through the Apple Developer app. Some people report payment errors | Forum posts | C | 0.4 | Expect delay |
| TestFlight takes real app builds, so a native wrapper (Capacitor) is needed | Apple | A | 0.9 | A PWA alone cannot go on TestFlight |
| Building and signing needs a Mac with Xcode or a paid macOS cloud runner | Apple | A | 0.9 | A cost and a setup |
| Up to 100 internal testers need no review. Up to 10,000 external testers need Beta App Review for the first build. Builds last 90 days | Apple | A | 0.9 | Plan a refresh every 90 days |
| A thin web wrapper can be rejected for the store under guideline 4.2 | Blogs | C | 0.6 | Real native features may be needed for the store |
| Safari Add to Home Screen works with no approval. Push works on iOS 16.4 and later when installed | Apple | A | 0.8 | The free way for iPhone testers |

On an iPhone, installed apps do not share storage. They use the join link (ADR-011, ADR-013).
