// Story #691 (boards T2 and T3): the rider's ping becomes a point on the map and the words under it. The words are the boards' words.
import { clock12 } from "./clock";

export type Point = { lat: number; lng: number; at: string };
type TrackRow = { rider_lat: number | null; rider_lng: number | null; updated_at: string };

export const toPoint = (row: TrackRow | null): Point | null =>
  row && row.rider_lat !== null && row.rider_lng !== null ? { lat: row.rider_lat, lng: row.rider_lng, at: row.updated_at } : null;

export function agoText(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
}

// The same great-circle rule as distance_m in the database (earth radius 6371 km).
export function metres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
export function distanceText(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const m = metres(lat1, lng1, lat2, lng2);
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export const riderLine = (name: string, distance: string, at: string, now: number): string => `${name} is ${distance} away · updated ${agoText(at, now)}`;
export const lastSeenText = (at: string, now: number): string => `Last seen ${clock12(new Date(at))}, ${agoText(at, now)}`;

// The tile address comes from the build (VITE_MAP_TILES). None means no tile call at all, which is how prod stays tile-free until the PMTiles test (radar, 29 Oct).
export const tileUrl = (template: string | undefined): string | null =>
  template && ["{z}", "{x}", "{y}"].every((p) => template.includes(p)) ? template : null;
