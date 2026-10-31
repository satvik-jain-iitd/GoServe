// Story #668 (boards A1 to A3): the customer's own address from the phone's location. The browser gives the place; OpenStreetMap's reverse lookup (Nominatim, no key) gives the address.
// One call per customer, only after they allow location. Any failure is "type it by hand". Public server rules (1 call a second, our page as the referrer) are met by one call.
// Later, for many customers: a small proxy with a cache (the policy asks for it).
export type Place = { lat: number; lng: number };
export type Found = { address: string; pin: string };

type Reply = { address?: Record<string, string> };

// The first two or three digits of an Indian pin name its state. Only the states we serve and their neighbours; a state not in the table keeps its pin.
// Story 827: OpenStreetMap postcodes are typed by volunteers and some are wrong (a Gurgaon object tagged 110058, a Delhi pin). A pin that disagrees with the
// state in the same reply is not better than no pin: the customer types it.
const PIN_PREFIXES: Record<string, string[]> = {
  delhi: ["110"], haryana: ["12", "13"], punjab: ["14", "15", "16"], rajasthan: ["30", "31", "32", "33", "34"],
  "uttar pradesh": ["20", "21", "22", "23", "24", "25", "26", "27", "28"],
};
const pinFits = (pin: string, state: string | undefined) => {
  const prefixes = PIN_PREFIXES[(state ?? "").trim().toLowerCase()];
  return !prefixes || prefixes.some((p) => pin.startsWith(p));
};

// "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi, Delhi": the street parts, the city and the state, so the customer can see what the app thinks. Never the country.
export function addressFrom(r: Reply): Found | null {
  const a = r.address;
  if (!a) return null;
  const street = [a.house_number, a.road, a.neighbourhood ?? a.suburb, a.city ?? a.town ?? a.village ?? a.state_district].filter(Boolean);
  if (street.length === 0) return null;
  if (a.state && street[street.length - 1] !== a.state) street.push(a.state);
  const pin = /^\d{6}$/.test(a.postcode ?? "") && pinFits(a.postcode, a.state) ? a.postcode : "";
  return { address: street.join(", "), pin };
}

export async function reverseAddress(lat: number, lng: number, fetchFn: typeof fetch = fetch): Promise<Found | null> {
  try {
    const res = await fetchFn(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`);
    return res.ok ? addressFrom(await res.json()) : null;
  } catch {
    return null;
  }
}

// The phone's place, once. Rejects when location is not allowed or not found.
export const currentPlace = (): Promise<Place> =>
  new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 });
  });
