// The last 20 things the tester did in the app (story S-B, #94). It is sent with a feedback report so we can see what led to the problem.
export const TRAIL_MAX = 20;
export type TrailEntry = { at: string; line: string };

let entries: TrailEntry[] = [];

export function pushTrail(line: string): void {
  entries = [...entries, { at: new Date().toISOString(), line: line.slice(0, 120) }].slice(-TRAIL_MAX);
}
export const readTrail = (): TrailEntry[] => entries.map((e) => ({ ...e }));
export const clearTrail = (): void => void (entries = []);
