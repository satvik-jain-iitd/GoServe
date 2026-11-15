// Story 1560: the bug was seen on an iPhone, the app opened from the home screen, so the cases also run on WebKit as a standalone app (sheetToTheBottom.ts).
import { sheetToTheBottom } from "./sheetToTheBottom";

sheetToTheBottom({ standalone: true });
