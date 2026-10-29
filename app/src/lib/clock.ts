import { openingClock } from "./area";

// Story #660: every time in the customer app reads h:mm am/pm, lower case ("8:12 pm").
export const clock12 = (d: Date): string => openingClock(`${d.getHours()}:${d.getMinutes()}`);
