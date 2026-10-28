import { test } from "@playwright/test";
import { youLayout } from "./youLayout";

for (const theme of ["day", "night"] as const) test(`S1 ${theme}: the Google row sits under the details card; Edit opens Save and Cancel inside the card (iPhone 13 WebKit)`, async ({ page, context }) => youLayout(page, context, theme));
