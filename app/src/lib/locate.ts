// Story #668 (boards A1 to A3): the customer's own address from the phone's location. The browser gives the place; OpenStreetMap's reverse lookup (Nominatim, no key) gives the address.
// One call per customer, only after they allow location. Any failure is "type it by hand". Public server rules (1 call a second, our page as the referrer) are met by one call.
// Later, for many customers: a small proxy with a cache (the policy asks for it).
export type Place = { lat: number; lng: number };
export type Found = { address: string; pin: string };

type Reply = { address?: Record<string, string> };

// "B-12, Lajpat Nagar II, Lajpat Nagar, New Delhi": the street parts only, never the state or the country.
export function addressFrom(r: Reply): Found | null {
  const a = r.address;
  if (!a) return null;
  const street = [a.house_number, a.road, a.neighbourhood ?? a.suburb, a.city ?? a.town ?? a.village ?? a.state_district].filter(Boolean);
  if (street.length === 0) return null;
  return { address: street.join(", "), pin: /^\d{6}$/.test(a.postcode ?? "") ? a.postcode : "" };
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
