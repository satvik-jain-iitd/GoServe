// Story 1598: how strict the screen gate is (tests/e2e/screens.spec.ts, set in playwright.config.ts). Read by the unit test tests/unit/screenGate.test.ts too.
// threshold: the colour distance (0 to 1) above which one pixel counts as different. Playwright's default is 0.2 (it was 0.2 here until story 1598; now 0.05): a light-green zigzag on a light-green page differs by less
// than that, so a whole zigzag band (3725 pixels) counted as 0 and a stale picture stayed green for a week.
// maxDiffPixels: how many different pixels are allowed (a stray anti-aliased edge).
export const SCREEN_THRESHOLD = 0.05;
export const SCREEN_MAX_DIFF_PIXELS = 10;
